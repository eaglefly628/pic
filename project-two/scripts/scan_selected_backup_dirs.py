#!/usr/bin/env python3
"""Index selected backup directories into the existing NAS source without a full rescan."""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import signal
import sys
import time
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parent))
import photo_index as index


def selected(rel_path: str, roots: tuple[str, ...]) -> bool:
    return any(rel_path == root or rel_path.startswith(root + "/") for root in roots)


def safe_include(root: Path, raw: str) -> str:
    path = PurePosixPath(raw.replace("\\", "/"))
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
        raise ValueError(f"不安全的备份目录：{raw}")
    rel = path.as_posix()
    if (index.excluded(rel, index.DEFAULT_EXCLUDES) or not any("备份" in part for part in path.parts)
            or path.parts[0] in {"我家里的一切-索引备份", "我家里的一切-接力"}):
        raise ValueError(f"只允许选择未排除的备份目录：{raw}")
    target = root.joinpath(*path.parts)
    if any(root.joinpath(*path.parts[:i]).is_symlink() for i in range(1, len(path.parts) + 1)):
        raise ValueError(f"备份目录不能是符号链接：{raw}")
    if not target.is_dir() or not target.resolve().is_relative_to(root):
        raise ValueError(f"备份目录不存在或不在 S300 中：{raw}")
    with os.scandir(target):
        pass
    return rel


def main() -> int:
    parser = argparse.ArgumentParser(description="只扫描指定备份目录，不对其它目录做缺失对账")
    parser.add_argument("source", type=Path)
    parser.add_argument("--db", type=Path, default=index.default_db())
    parser.add_argument("--include", action="append", required=True, help="相对于 S300 根目录的备份目录")
    parser.add_argument("--report-every", type=float, default=10.0)
    args = parser.parse_args()

    root = args.source.expanduser().resolve()
    if not root.is_dir():
        parser.error("S300 尚未挂载")
    try:
        roots = tuple(dict.fromkeys(safe_include(root, value) for value in args.include))
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    if any(a != b and selected(a, (b,)) for a in roots for b in roots):
        parser.error("指定目录不能相互包含")

    stop = False

    def request_stop(_signum: int, _frame: object) -> None:
        nonlocal stop
        stop = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    db = args.db.expanduser()
    with index.exclusive_lock(db), contextlib.closing(index.connect(db)) as conn:
        sid = index.source_id(conn, root)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS selected_scan_scopes ("
            "run_id INTEGER PRIMARY KEY REFERENCES scan_runs(id), roots_json TEXT NOT NULL)"
        )
        active = conn.execute(
            "SELECT id,status,message FROM scan_runs WHERE source_id=? AND status IN ('running','paused','error') ORDER BY id DESC LIMIT 1",
            (sid,),
        ).fetchone()
        if active:
            scope = conn.execute("SELECT roots_json FROM selected_scan_scopes WHERE run_id=?", (active["id"],)).fetchone()
            if not scope or tuple(json.loads(scope["roots_json"])) != roots:
                raise RuntimeError("另一个索引任务尚未完成；请先继续或处理该任务")
            run_id = int(active["id"])
            conn.execute(
                "UPDATE scan_runs SET status='running',updated_at=?,message=? WHERE id=?",
                (index.now_ms(), "仅扫描：" + "、".join(roots), run_id),
            )
            conn.execute("UPDATE directories SET status='pending',updated_at=? WHERE run_id=? AND status='scanning'",
                         (index.now_ms(), run_id))
        else:
            stamp = index.now_ms()
            cur = conn.execute(
                "INSERT INTO scan_runs(source_id,status,started_at,updated_at,excludes_json,message) VALUES (?,'running',?,?,?,?)",
                (sid, stamp, stamp, json.dumps(index.DEFAULT_EXCLUDES, ensure_ascii=False),
                 "仅扫描：" + "、".join(roots)),
            )
            run_id = int(cur.lastrowid)
            conn.execute("INSERT INTO selected_scan_scopes(run_id,roots_json) VALUES (?,?)",
                         (run_id, json.dumps(roots, ensure_ascii=False)))
            for rel in roots:
                index.upsert_directory(conn, sid, run_id, rel)
        conn.commit()
        print(json.dumps({"event": "selected_scan_started", "runId": run_id,
                          "source": str(root), "includes": roots}, ensure_ascii=False), flush=True)

        last_report = time.monotonic()
        try:
            while not stop:
                row = conn.execute(
                    "SELECT rel_path FROM directories WHERE source_id=? AND run_id=? AND status='pending' "
                    "ORDER BY length(rel_path),rel_path LIMIT 1", (sid, run_id),
                ).fetchone()
                if row is None:
                    break
                rel_dir = str(row["rel_path"])
                if not selected(rel_dir, roots):
                    raise RuntimeError(f"扫描范围异常：{rel_dir}")
                conn.execute(
                    "UPDATE directories SET status='scanning',last_error=NULL,updated_at=? "
                    "WHERE source_id=? AND rel_path=?", (index.now_ms(), sid, rel_dir),
                )
                conn.commit()
                entries_seen = 0
                try:
                    with os.scandir(root / rel_dir) as entries:
                        for entry in entries:
                            if stop:
                                break
                            rel = index.norm_rel(f"{rel_dir}/{entry.name}")
                            if index.excluded(rel, index.DEFAULT_EXCLUDES) or entry.is_symlink():
                                continue
                            entries_seen += 1
                            try:
                                if entry.is_dir(follow_symlinks=False):
                                    index.upsert_directory(conn, sid, run_id, rel)
                                elif entry.is_file(follow_symlinks=False):
                                    kind, size = index.upsert_file(conn, sid, run_id, rel, entry.stat(follow_symlinks=False))
                                    conn.execute(
                                        "UPDATE scan_runs SET entries_seen=entries_seen+1,files_indexed=files_indexed+1,"
                                        "media_indexed=media_indexed+?,bytes_indexed=bytes_indexed+?,last_path=?,updated_at=? "
                                        "WHERE id=?", (int(kind in ("image", "video")), size, rel, index.now_ms(), run_id),
                                    )
                            except OSError as exc:
                                conn.execute(
                                    "UPDATE scan_runs SET errors=errors+1,last_path=?,updated_at=?,message=? WHERE id=?",
                                    (rel, index.now_ms(), str(exc), run_id),
                                )
                            if entries_seen % 100 == 0:
                                conn.commit()
                            if time.monotonic() - last_report >= args.report_every:
                                conn.commit()
                                index.print_status(conn, run_id, event="progress")
                                last_report = time.monotonic()
                    conn.execute(
                        "UPDATE directories SET status=?,entries_seen=?,updated_at=? WHERE source_id=? AND rel_path=?",
                        ("pending" if stop else "done", entries_seen, index.now_ms(), sid, rel_dir),
                    )
                    conn.commit()
                except OSError as exc:
                    conn.execute(
                        "UPDATE directories SET status='pending',last_error=?,updated_at=? WHERE source_id=? AND rel_path=?",
                        (str(exc), index.now_ms(), sid, rel_dir),
                    )
                    conn.execute(
                        "UPDATE scan_runs SET status='paused',errors=errors+1,message=?,updated_at=? WHERE id=?",
                        (f"{rel_dir}: {exc}", index.now_ms(), run_id),
                    )
                    conn.commit()
                    index.print_status(conn, run_id, event="paused")
                    return 3

            stamp = index.now_ms()
            if stop:
                conn.execute("UPDATE scan_runs SET status='paused',updated_at=?,message='收到暂停信号' WHERE id=?", (stamp, run_id))
                conn.commit()
                index.print_status(conn, run_id, event="paused")
                return 0
            conn.execute(
                "UPDATE scan_runs SET status='completed',finished_at=?,updated_at=?,message=? WHERE id=?",
                (stamp, stamp, "指定备份目录扫描完成；未对其它目录做缺失对账", run_id),
            )
            conn.commit()
            index.print_status(conn, run_id, event="completed")
            print(json.dumps({"event": "new_media", "runId": run_id, "items": [dict(r) for r in conn.execute(
                "SELECT kind,count(*) AS files,coalesce(sum(size),0) AS bytes FROM media_files "
                "WHERE source_id=? AND first_seen_run=? GROUP BY kind ORDER BY kind", (sid, run_id)
            )]}, ensure_ascii=False), flush=True)
            return 0
        except Exception as exc:
            conn.execute(
                "UPDATE scan_runs SET status='error',updated_at=?,message=? WHERE id=?",
                (index.now_ms(), str(exc), run_id),
            )
            conn.commit()
            raise


if __name__ == "__main__":
    raise SystemExit(main())
