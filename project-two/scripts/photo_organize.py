#!/usr/bin/env python3
"""按可信时间在同一挂载卷内整理家庭影像。

先 ``plan`` 生成可审计清单；``run`` 才逐文件 rename。每次 rename 后立即核对
大小并更新 SQLite，因此掉线、退出或重启后都能从不确定状态重新对账。
本工具不覆盖目标、不删除旧目录、不合并重复内容。
"""

from __future__ import annotations

import argparse
import contextlib
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import signal
import sqlite3
import sys
from pathlib import Path, PurePosixPath

from photo_index import connect, exclusive_lock, now_ms


VALID_KINDS = {"image", "video", "sidecar"}


class StopFlag:
    requested = False


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS organize_runs (
          id INTEGER PRIMARY KEY,
          source_id INTEGER NOT NULL REFERENCES sources(id),
          status TEXT NOT NULL,
          source_root TEXT NOT NULL,
          target_root TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          started_at INTEGER,
          finished_at INTEGER,
          total INTEGER NOT NULL DEFAULT 0,
          moved INTEGER NOT NULL DEFAULT 0,
          verified INTEGER NOT NULL DEFAULT 0,
          errors INTEGER NOT NULL DEFAULT 0,
          bytes_total INTEGER NOT NULL DEFAULT 0,
          bytes_moved INTEGER NOT NULL DEFAULT 0,
          reliable INTEGER NOT NULL DEFAULT 0,
          needs_review INTEGER NOT NULL DEFAULT 0,
          last_path TEXT,
          message TEXT
        );
        CREATE TABLE IF NOT EXISTS organize_entries (
          run_id INTEGER NOT NULL REFERENCES organize_runs(id) ON DELETE CASCADE,
          source_rel TEXT NOT NULL,
          target_rel TEXT NOT NULL,
          kind TEXT NOT NULL,
          size INTEGER NOT NULL,
          mtime_ns INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'planned',
          error TEXT,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (run_id, source_rel),
          UNIQUE (run_id, target_rel)
        );
        CREATE INDEX IF NOT EXISTS organize_entry_status_idx ON organize_entries(run_id,status);
        CREATE INDEX IF NOT EXISTS organize_entry_queue_idx
          ON organize_entries(run_id,status,source_rel COLLATE NOCASE);
        """
    )
    conn.commit()


def latest_source(conn: sqlite3.Connection) -> sqlite3.Row:
    row = conn.execute(
        """SELECT s.* FROM scan_runs r JOIN sources s ON s.id=r.source_id
           WHERE r.status='completed' ORDER BY r.id DESC LIMIT 1"""
    ).fetchone()
    if not row:
        raise RuntimeError("请先完成文件索引")
    return row


def safe_rel(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
        raise RuntimeError(f"不安全的相对路径：{value}")
    return path


def parsed_capture(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    current_year = dt.datetime.now().year
    return parsed if 1990 <= parsed.year <= current_year + 1 else None


def bucket_for(row: sqlite3.Row) -> tuple[PurePosixPath, bool]:
    captured = parsed_capture(row["capture_time_text"])
    confidence = str(row["capture_time_confidence"] or "")
    original = safe_rel(str(row["rel_path"]))
    if captured and confidence in ("high", "medium"):
        return PurePosixPath(f"{captured.year:04d}", f"{captured.year:04d}-{captured.month:02d}", captured.strftime("%Y-%m-%d")), True
    if captured:
        return PurePosixPath("_待确认时间", captured.strftime("%Y-%m"), *original.parent.parts), False
    return PurePosixPath("_待确认时间", "时间异常或缺失", *original.parent.parts), False


def group_key(rel_path: str) -> tuple[str, str]:
    path = PurePosixPath(rel_path)
    return str(path.parent), path.stem.casefold()


def unique_names(rows: list[sqlite3.Row], target_dir: PurePosixPath, used: set[str]) -> list[PurePosixPath]:
    candidates = [target_dir / str(row["name"]) for row in rows]
    if all(str(path).casefold() not in used for path in candidates):
        return candidates
    suffix = hashlib.sha256(str(rows[0]["rel_path"]).encode("utf-8")).hexdigest()[:10]
    result = []
    for row in rows:
        name = PurePosixPath(str(row["name"]))
        result.append(target_dir / f"{name.stem}__{suffix}{name.suffix}")
    if any(str(path).casefold() in used for path in result):
        raise RuntimeError(f"无法生成无冲突目标名：{rows[0]['rel_path']}")
    return result


def plan(args: argparse.Namespace) -> int:
    db_path = Path(args.db).expanduser()
    target_name = args.target_name.strip()
    if target_name in ("", ".", "..") or "/" in target_name or "\\" in target_name:
        raise RuntimeError("目标目录必须是一个安全的单层目录名")
    with exclusive_lock(db_path), contextlib.closing(connect(db_path)) as conn:
        ensure_schema(conn)
        source = latest_source(conn)
        sid, root = int(source["id"]), Path(str(source["root"]))
        if not root.is_dir() or not os.access(root, os.R_OK | os.W_OK):
            raise RuntimeError(f"共享目录不可读写或尚未挂载：{root}")
        target_root = root / target_name
        active = conn.execute(
            """SELECT * FROM organize_runs WHERE source_id=? AND status IN ('planned','running','paused','error')
               ORDER BY id DESC LIMIT 1""", (sid,),
        ).fetchone()
        if active and int(active["moved"] or 0) > 0:
            print(json.dumps({"event": "organize_plan", **dict(active)}, ensure_ascii=False))
            return 0
        if active:
            conn.execute("DELETE FROM organize_runs WHERE id=?", (int(active["id"]),))

        media = conn.execute(
            """SELECT * FROM media_files WHERE source_id=? AND status='active' AND kind IN ('image','video')
               AND rel_path NOT LIKE ? ESCAPE '\\' ORDER BY parent_path COLLATE NOCASE,name COLLATE NOCASE""",
            (sid, target_name.replace("%", "\\%").replace("_", "\\_") + "/%"),
        ).fetchall()
        sidecars = conn.execute(
            """SELECT * FROM media_files WHERE source_id=? AND status='active' AND kind='sidecar'
               AND rel_path NOT LIKE ? ESCAPE '\\' ORDER BY parent_path COLLATE NOCASE,name COLLATE NOCASE""",
            (sid, target_name.replace("%", "\\%").replace("_", "\\_") + "/%"),
        ).fetchall()
        groups: dict[tuple[str, str], list[sqlite3.Row]] = {}
        for row in media:
            groups.setdefault(group_key(str(row["rel_path"])), []).append(row)
        for row in sidecars:
            key = group_key(str(row["rel_path"]))
            if key in groups:
                groups[key].append(row)

        used = {str(row["rel_path"]).casefold() for row in conn.execute(
            "SELECT rel_path FROM media_files WHERE source_id=? AND rel_path LIKE ?",
            (sid, target_name + "/%"),
        )}
        stamp = now_ms()
        run_id = int(conn.execute(
            """INSERT INTO organize_runs(source_id,status,source_root,target_root,created_at,updated_at)
               VALUES (?,'planned',?,?,?,?)""", (sid, str(root), str(target_root), stamp, stamp),
        ).lastrowid)
        entries = []
        reliable = 0
        needs_review = 0
        bytes_total = 0
        for rows in groups.values():
            primary = next((r for r in rows if r["kind"] == "image"), None) or next((r for r in rows if r["kind"] == "video"), rows[0])
            target_dir, is_reliable = bucket_for(primary)
            paths = unique_names(rows, PurePosixPath(target_name) / target_dir, used)
            for row, target_rel in zip(rows, paths):
                used.add(str(target_rel).casefold())
                entry_status = "planned" if is_reliable else "review"
                entries.append((run_id, str(row["rel_path"]), str(target_rel), str(row["kind"]),
                                int(row["size"]), int(row["mtime_ns"]), entry_status, stamp))
                if is_reliable:
                    bytes_total += int(row["size"])
                reliable += int(is_reliable)
                needs_review += int(not is_reliable)
        conn.executemany(
            """INSERT INTO organize_entries(run_id,source_rel,target_rel,kind,size,mtime_ns,status,updated_at)
               VALUES (?,?,?,?,?,?,?,?)""", entries,
        )
        conn.execute(
            """UPDATE organize_runs SET total=?,bytes_total=?,reliable=?,needs_review=?,updated_at=? WHERE id=?""",
            (reliable, bytes_total, reliable, needs_review, now_ms(), run_id),
        )
        conn.commit()
        print(json.dumps({"event": "organize_plan", "runId": run_id, "status": "planned", "total": reliable,
                          "bytesTotal": bytes_total, "reliable": reliable, "needsReview": needs_review,
                          "targetRoot": str(target_root)}, ensure_ascii=False))
    return 0


def update_summary(conn: sqlite3.Connection, run_id: int, last_path: str | None = None) -> dict:
    row = conn.execute(
        """SELECT sum(CASE WHEN status!='review' THEN 1 ELSE 0 END) total,
                  sum(CASE WHEN status IN ('moved','verified') THEN 1 ELSE 0 END) moved,
                  sum(CASE WHEN status='verified' THEN 1 ELSE 0 END) verified,
                  sum(CASE WHEN status='error' THEN 1 ELSE 0 END) errors,
                  coalesce(sum(CASE WHEN status IN ('moved','verified') THEN size ELSE 0 END),0) bytes_moved
           FROM organize_entries WHERE run_id=?""", (run_id,),
    ).fetchone()
    summary = {key: int(row[key] or 0) for key in ("total", "moved", "verified", "errors", "bytes_moved")}
    conn.execute(
        """UPDATE organize_runs SET total=?,moved=?,verified=?,errors=?,bytes_moved=?,updated_at=?,
           last_path=coalesce(?,last_path) WHERE id=?""",
        (summary["total"], summary["moved"], summary["verified"], summary["errors"], summary["bytes_moved"], now_ms(), last_path, run_id),
    )
    conn.commit()
    return summary


def move_one(root: Path, entry: dict) -> dict:
    """Move and verify one planned file; never opens or copies its contents."""
    source_rel = safe_rel(str(entry["source_rel"]))
    target_rel = safe_rel(str(entry["target_rel"]))
    source_path = root.joinpath(*source_rel.parts)
    target_path = root.joinpath(*target_rel.parts)
    expected_size = int(entry["size"])
    try:
        try:
            source_stat = source_path.stat(follow_symlinks=False)
        except FileNotFoundError:
            source_stat = None
        try:
            target_stat = target_path.stat(follow_symlinks=False)
        except FileNotFoundError:
            target_stat = None
        if source_stat is not None and target_stat is not None:
            raise RuntimeError("源和目标同时存在，已停止以避免覆盖")
        if source_stat is None and target_stat is None:
            raise RuntimeError("源和目标都不存在，已停止等待人工核对")
        if source_stat is not None:
            if source_stat.st_size != expected_size:
                raise RuntimeError("源文件大小与预演不一致，已停止")
            # 目标存在检查和 rename 之间仍可能有外部竞争；整理任务持有独占锁，
            # 且目标名由预演唯一约束生成，因此这里只允许本任务单实例运行。
            os.rename(source_path, target_path)
            target_stat = target_path.stat(follow_symlinks=False)
        if target_stat is None or target_stat.st_size != expected_size:
            raise RuntimeError("移动后文件大小不一致，已停止")
        return {"ok": True, "entry": entry, "source_rel": source_rel, "target_rel": target_rel,
                "size": expected_size}
    except Exception as exc:
        return {"ok": False, "entry": entry, "source_rel": source_rel, "target_rel": target_rel,
                "size": expected_size, "error": str(exc)}


def run(args: argparse.Namespace) -> int:
    db_path = Path(args.db).expanduser()
    stop = StopFlag()
    signal.signal(signal.SIGINT, lambda *_: setattr(stop, "requested", True))
    signal.signal(signal.SIGTERM, lambda *_: setattr(stop, "requested", True))
    with exclusive_lock(db_path), contextlib.closing(connect(db_path)) as conn:
        ensure_schema(conn)
        job = conn.execute(
            """SELECT * FROM organize_runs WHERE status IN ('planned','paused','error','running')
               ORDER BY id DESC LIMIT 1"""
        ).fetchone()
        if not job:
            raise RuntimeError("请先生成整理预演")
        run_id = int(job["id"])
        root = Path(str(job["source_root"])).resolve()
        target_root = Path(str(job["target_root"])).resolve()
        try:
            target_root.relative_to(root)
        except ValueError as exc:
            raise RuntimeError("整理目标不在当前共享盘内") from exc
        if not root.is_dir() or not os.access(root, os.R_OK | os.W_OK):
            raise RuntimeError(f"共享目录不可读写或尚未挂载：{root}")
        target_root.mkdir(parents=True, exist_ok=True)
        if root.stat().st_dev != target_root.stat().st_dev:
            raise RuntimeError("源和目标不在同一文件系统，已拒绝复制式搬迁")
        conn.execute("UPDATE organize_runs SET status='running',started_at=coalesce(started_at,?),updated_at=?,message=NULL WHERE id=?",
                     (now_ms(), now_ms(), run_id))
        conn.commit()
        handled = 0
        made_dirs: set[str] = set()
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            while not stop.requested:
                batch_size = args.batch_size
                if args.max_entries:
                    batch_size = min(batch_size, args.max_entries - handled)
                    if batch_size <= 0:
                        stop.requested = True
                        break
                rows = conn.execute(
                    """SELECT * FROM organize_entries WHERE run_id=? AND status IN ('planned','error')
                       ORDER BY source_rel COLLATE NOCASE LIMIT ?""", (run_id, batch_size),
                ).fetchall()
                if not rows:
                    break
                entries = [dict(row) for row in rows]
                # Directory creation is serialized and cached; files within the batch are independent.
                for entry in entries:
                    target_rel = safe_rel(str(entry["target_rel"]))
                    parent = str(target_rel.parent)
                    if parent not in made_dirs:
                        root.joinpath(*target_rel.parent.parts).mkdir(parents=True, exist_ok=True)
                        made_dirs.add(parent)
                results = list(pool.map(lambda item: move_one(root, item), entries))
                stamp = now_ms()
                successes = [item for item in results if item["ok"]]
                failures = [item for item in results if not item["ok"]]
                recovered_errors = 0
                for result in successes:
                    entry = result["entry"]
                    source_rel, target_rel = result["source_rel"], result["target_rel"]
                    conn.execute(
                        "UPDATE organize_entries SET status='verified',error=NULL,updated_at=? WHERE run_id=? AND source_rel=?",
                        (stamp, run_id, str(source_rel)),
                    )
                    conn.execute(
                        """UPDATE media_files SET rel_path=?,parent_path=?,name=?,updated_at=?
                           WHERE source_id=? AND rel_path=?""",
                        (str(target_rel), str(target_rel.parent) if str(target_rel.parent) != "." else "", target_rel.name,
                         stamp, int(job["source_id"]), str(source_rel)),
                    )
                    recovered_errors += int(str(entry["status"]) == "error")
                if successes:
                    conn.execute(
                        """UPDATE organize_runs SET moved=moved+?,verified=verified+?,bytes_moved=bytes_moved+?,
                           errors=max(errors-?,0),last_path=?,updated_at=? WHERE id=?""",
                        (len(successes), len(successes), sum(int(item["size"]) for item in successes), recovered_errors,
                         str(successes[-1]["source_rel"]), stamp, run_id),
                    )
                new_errors = 0
                for result in failures:
                    entry = result["entry"]
                    conn.execute(
                        "UPDATE organize_entries SET status='error',error=?,updated_at=? WHERE run_id=? AND source_rel=?",
                        (str(result["error"]), stamp, run_id, str(result["source_rel"])),
                    )
                    new_errors += int(str(entry["status"]) != "error")
                if new_errors:
                    conn.execute("UPDATE organize_runs SET errors=errors+? WHERE id=?", (new_errors, run_id))
                conn.commit()
                handled += len(successes)
                current = conn.execute(
                    "SELECT total,moved,verified,errors,bytes_moved FROM organize_runs WHERE id=?", (run_id,)
                ).fetchone()
                summary = {key: int(current[key] or 0) for key in ("total", "moved", "verified", "errors", "bytes_moved")}
                last_path = str(successes[-1]["source_rel"]) if successes else str(failures[0]["source_rel"])
                print(json.dumps({"event": "organize_progress", "runId": run_id, "lastPath": last_path, **summary}, ensure_ascii=False), flush=True)
                if failures:
                    error = str(failures[0]["error"])
                    conn.execute("UPDATE organize_runs SET status='error',message=?,updated_at=? WHERE id=?",
                                 (error, now_ms(), run_id))
                    conn.commit()
                    print(json.dumps({"event": "organize_error", "runId": run_id, "error": error, **summary}, ensure_ascii=False), flush=True)
                    return 2
                if args.max_entries and handled >= args.max_entries:
                    stop.requested = True
        summary = update_summary(conn, run_id)
        if stop.requested:
            conn.execute("UPDATE organize_runs SET status='paused',message=?,updated_at=? WHERE id=?",
                         ("用户暂停、共享盘断开或达到本次上限", now_ms(), run_id))
            event, status = "organize_paused", "paused"
        else:
            stamp = now_ms()
            conn.execute("UPDATE organize_runs SET status='completed',finished_at=?,updated_at=?,message=NULL WHERE id=?",
                         (stamp, stamp, run_id))
            event, status = "organize_completed", "completed"
        conn.commit()
        print(json.dumps({"event": event, "runId": run_id, "status": status, **summary}, ensure_ascii=False), flush=True)
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="S300 家庭影像按时间安全整理")
    root.add_argument("--db", required=True)
    sub = root.add_subparsers(dest="command", required=True)
    p = sub.add_parser("plan")
    p.add_argument("--target-name", default="家庭影像库")
    p.set_defaults(func=plan)
    r = sub.add_parser("run")
    r.add_argument("--report-every", type=int, default=25)
    r.add_argument("--workers", type=int, default=8)
    r.add_argument("--batch-size", type=int, default=16)
    r.add_argument("--max-entries", type=int, default=0)
    r.set_defaults(func=run)
    return root


if __name__ == "__main__":
    try:
        args = parser().parse_args()
        raise SystemExit(args.func(args))
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
