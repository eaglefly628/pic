#!/usr/bin/env python3
"""Plan and checkpoint deletion of exact duplicates after the monthly hash run.

The plan keeps one byte-identical file per group, preferring the clean name.
Files that share a stem with a photo/video companion are never auto-deleted.
Execution checks size and mtime from the completed hash pass, without rereading
the media, and records each deletion so a network interruption can be resumed.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import shutil
import sqlite3
import stat
import sys
import time
from pathlib import Path, PurePosixPath

from photo_duplicates import month_bucket, source_path


COLLISION_SUFFIX = re.compile(r"__[0-9a-f]{10}(?=\.[^.]+$)", re.IGNORECASE)


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(4 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def connect_readonly(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)


def checked_root(work_db: Path) -> Path:
    with contextlib.closing(connect_readonly(work_db)) as conn:
        row = conn.execute("SELECT value FROM meta WHERE key='root'").fetchone()
    if not row:
        raise RuntimeError("进度库缺少 S300 根目录")
    root = Path(row[0])
    if not root.is_dir() or not os.path.ismount(root) or not (root / "家庭影像库").is_dir():
        raise RuntimeError("S300 未挂载或家庭影像库不可读")
    return root


def verify_complete(work_db: Path, report: dict) -> dict[str, tuple]:
    with contextlib.closing(connect_readonly(work_db)) as conn:
        if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("重复检测进度库完整性检查未通过")
        months, total, unresolved, errors = conn.execute(
            """SELECT count(DISTINCT bucket),count(*),
               sum(probe_status!='done' OR full_status NOT IN ('done','skipped')),
               sum(probe_status='error' OR full_status='error') FROM items"""
        ).fetchone()
        if months != 183 or total != 68653 or unresolved or errors:
            raise RuntimeError(f"重复检测尚未完整结束：{months} 个月、{total} 项、{unresolved} 未完成、{errors} 错误")
        rows = conn.execute(
            "SELECT rel_path,bucket,kind,size,actual_mtime_ns,full_hash FROM items WHERE full_status='done'"
        ).fetchall()
    if report.get("sourceCandidates") != total:
        raise RuntimeError("报告的候选数与进度库不一致")
    return {row[0]: row for row in rows}


def active_index(index_db: Path) -> tuple[dict[str, tuple], set[str]]:
    with contextlib.closing(connect_readonly(index_db)) as conn:
        if conn.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise RuntimeError("影像索引完整性检查未通过")
        latest = conn.execute("SELECT status FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
        if not latest or latest[0] != "completed":
            raise RuntimeError("仍有未完成的影像整理任务")
        rows = conn.execute(
            """SELECT source_id,rel_path,kind,size FROM media_files
               WHERE status='active' AND kind IN ('image','video')"""
        ).fetchall()
    active = {row[1]: row for row in rows}
    stems: dict[tuple[str, str], set[str]] = {}
    for _sid, relative, kind, _size in rows:
        if month_bucket(relative) is None:
            continue
        path = PurePosixPath(relative)
        stems.setdefault((str(path.parent), path.stem.casefold()), set()).add(kind)
    paired = {relative for _sid, relative, _kind, _size in rows
              if month_bucket(relative) is not None
              and stems.get((str(PurePosixPath(relative).parent), PurePosixPath(relative).stem.casefold())) == {"image", "video"}}
    return active, paired


def choose_keeper(members: list[str], paired: set[str]) -> str:
    return min(members, key=lambda path: (
        0 if path in paired else 1,
        1 if COLLISION_SUFFIX.search(PurePosixPath(path).name) else 0,
        path.casefold(),
    ))


def make_plan(index_db: Path, work_db: Path, report_path: Path, plan_db: Path) -> dict:
    if plan_db.exists():
        raise RuntimeError(f"清理计划已存在，不覆盖：{plan_db}")
    checked_root(work_db)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    work = verify_complete(work_db, report)
    active, paired = active_index(index_db)
    groups = report.get("groups")
    if not isinstance(groups, list) or len(groups) != report.get("exactGroups"):
        raise RuntimeError("重复报告分组不完整")
    actions: list[tuple] = []
    seen: set[str] = set()
    protected = 0
    skipped_mixed = 0
    for group in groups:
        bucket, size, digest = group["month"], group["size"], group["sha256"]
        members = [item["path"] for item in group["members"]]
        if len(members) < 2 or len(set(members)) != len(members):
            raise RuntimeError("重复报告中存在无效分组")
        kinds = set()
        for relative in members:
            if relative in seen:
                raise RuntimeError(f"重复报告中路径出现多次：{relative}")
            seen.add(relative)
            row = work.get(relative)
            indexed = active.get(relative)
            if (row is None or indexed is None or row[1] != bucket or row[3] != size
                    or row[5] != digest or indexed[3] != size or indexed[2] != row[2]
                    or month_bucket(relative) != bucket):
                raise RuntimeError(f"报告、进度和索引不一致：{relative}")
            kinds.add(row[2])
        if len(kinds) != 1:
            skipped_mixed += len(members)
            continue
        keeper = choose_keeper(members, paired)
        keeper_mtime = work[keeper][4]
        if keeper_mtime is None:
            raise RuntimeError(f"保留文件缺少哈希时的修改时间：{keeper}")
        for relative in members:
            if relative == keeper:
                continue
            if relative in paired:
                protected += 1
                continue
            mtime = work[relative][4]
            if mtime is None:
                raise RuntimeError(f"待删除文件缺少哈希时的修改时间：{relative}")
            actions.append((relative, active[relative][0], keeper, size, digest, mtime, keeper_mtime, work[relative][2]))
    plan_db.parent.mkdir(parents=True, exist_ok=True)
    with contextlib.closing(sqlite3.connect(plan_db)) as conn:
        conn.executescript(
            """CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
               CREATE TABLE actions(
                 rel_path TEXT PRIMARY KEY,source_id INTEGER NOT NULL,keep_path TEXT NOT NULL,
                 size INTEGER NOT NULL,sha256 TEXT NOT NULL,expected_mtime_ns INTEGER NOT NULL,
                 keep_mtime_ns INTEGER NOT NULL,kind TEXT NOT NULL,
                 status TEXT NOT NULL DEFAULT 'planned',error TEXT,updated_at INTEGER
               );
               CREATE INDEX actions_status_idx ON actions(status);"""
        )
        conn.executemany("INSERT INTO meta VALUES (?,?)", [
            ("index_db", str(index_db)), ("work_db", str(work_db)),
            ("report", str(report_path)), ("report_sha256", digest_file(report_path)),
            ("root", str(checked_root(work_db))), ("created_at", dt.datetime.now().isoformat()),
        ])
        conn.executemany(
            """INSERT INTO actions(rel_path,source_id,keep_path,size,sha256,expected_mtime_ns,keep_mtime_ns,kind)
               VALUES (?,?,?,?,?,?,?,?)""", actions
        )
        conn.commit()
    os.chmod(plan_db, 0o600)
    return {"plannedFiles": len(actions), "plannedBytes": sum(item[3] for item in actions),
            "protectedPairFiles": protected, "mixedKindFilesSkipped": skipped_mixed,
            "planDb": str(plan_db)}


def status(plan_db: Path) -> dict:
    with contextlib.closing(connect_readonly(plan_db)) as conn:
        counts = {row[0]: row[1] for row in conn.execute("SELECT status,count(*) FROM actions GROUP BY status")}
        bytes_by_status = {row[0]: row[1] for row in conn.execute(
            "SELECT status,sum(size) FROM actions GROUP BY status"
        )}
        backups = dict(conn.execute("SELECT key,value FROM meta WHERE key LIKE '%backup%'"))
    return {"counts": counts, "bytes": bytes_by_status, "backups": backups}


def backup_index(index_db: Path, root: Path, plan_db: Path) -> dict:
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    local_dir = index_db.parent / "backups"
    local_dir.mkdir(parents=True, exist_ok=True)
    local = local_dir / f"photo-index-before-duplicate-cleanup-{stamp}.sqlite3"
    remote_dir = root / "我家里的一切-索引备份"
    if not remote_dir.is_dir():
        raise RuntimeError("S300 索引备份目录不存在")
    remote = remote_dir / local.name
    if local.exists() or remote.exists():
        raise RuntimeError("索引备份文件名冲突")
    temp_local = local.with_suffix(".tmp")
    temp_remote = remote.with_suffix(".tmp")
    with contextlib.closing(connect_readonly(index_db)) as source, contextlib.closing(sqlite3.connect(temp_local)) as target:
        source.backup(target)
        if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("本机索引备份完整性检查失败")
    os.replace(temp_local, local)
    shutil.copyfile(local, temp_remote)
    if digest_file(local) != digest_file(temp_remote):
        raise RuntimeError("本机和 S300 索引备份校验不一致")
    os.replace(temp_remote, remote)
    with contextlib.closing(sqlite3.connect(plan_db)) as conn:
        conn.executemany("INSERT INTO meta VALUES (?,?)", [
            ("local_backup", str(local)), ("remote_backup", str(remote)),
            ("backup_sha256", digest_file(local)),
        ])
        conn.commit()
    return {"local": str(local), "remote": str(remote)}


def verify_file(path: Path, size: int, mtime_ns: int) -> os.stat_result:
    info = path.stat(follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_size != size or info.st_mtime_ns != mtime_ns:
        raise RuntimeError(f"文件自哈希检查后发生变化：{path}")
    return info


def run(index_db: Path, work_db: Path, report_path: Path, plan_db: Path, limit: int) -> dict:
    root = checked_root(work_db)
    lock_path = plan_db.with_suffix(".lock")
    with lock_path.open("a+b") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        with contextlib.closing(sqlite3.connect(plan_db, timeout=5)) as plan:
            meta = dict(plan.execute("SELECT key,value FROM meta"))
            if (meta["root"] != str(root) or meta["index_db"] != str(index_db)
                    or meta["work_db"] != str(work_db) or meta["report"] != str(report_path)
                    or meta["report_sha256"] != digest_file(report_path)):
                raise RuntimeError("清理计划的来源或报告已变化")
            verify_complete(work_db, json.loads(report_path.read_text(encoding="utf-8")))
            if "local_backup" not in meta or "remote_backup" not in meta:
                backup_index(index_db, root, plan_db)
            actions = plan.execute(
                """SELECT rel_path,source_id,keep_path,size,expected_mtime_ns,keep_mtime_ns
                   FROM actions WHERE status IN ('planned','error') ORDER BY rel_path COLLATE NOCASE"""
            ).fetchall()
            handled = 0
            with contextlib.closing(sqlite3.connect(index_db, timeout=5)) as index:
                for relative, sid, keep_relative, size, mtime, keep_mtime in actions:
                    if limit and handled >= limit:
                        break
                    keeper = source_path(root, keep_relative)
                    candidate = source_path(root, relative)
                    try:
                        keep_stat = verify_file(keeper, size, keep_mtime)
                        try:
                            target_stat = verify_file(candidate, size, mtime)
                        except FileNotFoundError:
                            target_stat = None
                        if target_stat is not None:
                            if (keep_stat.st_dev, keep_stat.st_ino) == (target_stat.st_dev, target_stat.st_ino):
                                plan.execute("UPDATE actions SET status='skipped_hardlink',updated_at=? WHERE rel_path=?",
                                             (int(time.time()*1000), relative))
                                plan.commit()
                                continue
                            if keep_stat.st_dev != target_stat.st_dev:
                                raise RuntimeError("保留和待删文件不在同一文件系统")
                            row = index.execute(
                                "SELECT status,size FROM media_files WHERE source_id=? AND rel_path=?",
                                (sid, relative),
                            ).fetchone()
                            if not row or row != ("active", size):
                                raise RuntimeError("待删文件与影像索引不一致")
                            candidate.unlink()
                        # A crash after unlink but before the index commit is reconciled here.
                        try:
                            candidate.stat(follow_symlinks=False)
                        except FileNotFoundError:
                            pass
                        else:
                            raise RuntimeError("删除后文件仍存在")
                        index.execute(
                            """UPDATE media_files SET status='duplicate_removed',reviewed_state='exact_duplicate',
                               decision_note=?,updated_at=? WHERE source_id=? AND rel_path=? AND status='active'""",
                            (f"SHA-256 相同；保留 {keep_relative}", int(time.time()*1000), sid, relative),
                        )
                        index.commit()
                        plan.execute("UPDATE actions SET status='deleted',error=NULL,updated_at=? WHERE rel_path=?",
                                     (int(time.time()*1000), relative))
                        plan.commit()
                        handled += 1
                    except (OSError, RuntimeError, sqlite3.Error) as exc:
                        plan.execute("UPDATE actions SET status='error',error=?,updated_at=? WHERE rel_path=?",
                                     (str(exc), int(time.time()*1000), relative))
                        plan.commit()
                        raise RuntimeError(f"清理停在 {relative}：{exc}") from exc
    return {"handledThisCall": handled, **status(plan_db)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("plan", "status", "run"))
    parser.add_argument("--index-db", type=Path, required=True)
    parser.add_argument("--work-db", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--plan-db", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    if args.command == "plan":
        result = make_plan(args.index_db, args.work_db, args.report, args.plan_db)
    elif args.command == "status":
        result = status(args.plan_db)
    else:
        result = run(args.index_db, args.work_db, args.report, args.plan_db, args.limit)
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
