#!/usr/bin/env python3
"""Plan a separate review bucket for non-media files left in old photo folders.

The source path is retained below 家庭影像库/_其他文件待审核. ``preview`` is read-only;
``plan`` writes an auditable SQLite queue. The existing photo_organize.py runner
performs same-volume, no-overwrite renames and verifies each result.
"""

from __future__ import annotations

import argparse
import collections
import contextlib
import json
import os
import sqlite3
from pathlib import Path, PurePosixPath

from photo_index import connect, exclusive_lock, now_ms
from photo_organize import ensure_schema, latest_source, safe_rel


LAYOUT = "other_review"
LIBRARY = "家庭影像库"
REVIEW_DIR = "_其他文件待审核"
EXPECTED_PREVIOUS_RUN = 3
SKIPPED_TRANSIENT = {".DS_Store"}  # Finder rewrites the S300 root metadata during browsing.


def source_rows(conn: sqlite3.Connection, source_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        """SELECT * FROM media_files WHERE source_id=? AND status='active' AND kind='other'
             AND rel_path NOT LIKE ? ORDER BY rel_path COLLATE NOCASE""",
        (source_id, LIBRARY + "/%"),
    ).fetchall()


def target_rel(source_rel: str) -> PurePosixPath:
    source = safe_rel(source_rel)
    if source.parts[0] == LIBRARY:
        raise RuntimeError(f"来源已在家庭影像库：{source_rel}")
    return PurePosixPath(LIBRARY, REVIEW_DIR, *source.parts)


def prepare(conn: sqlite3.Connection, source_id: int, expected_count: int) -> tuple[list[tuple], dict]:
    rows = source_rows(conn, source_id)
    if len(rows) != expected_count:
        raise RuntimeError(f"其他文件数量已变化：预计 {expected_count}，实际 {len(rows)}；请先重新核对")
    entries: list[tuple] = []
    targets: set[str] = set()
    roots: collections.Counter[str] = collections.Counter()
    extensions: collections.Counter[str] = collections.Counter()
    bytes_total = 0
    for row in rows:
        source = str(row["rel_path"])
        if source in SKIPPED_TRANSIENT:
            continue
        target = str(target_rel(source))
        key = target.casefold()
        if key in targets:
            raise RuntimeError(f"目标路径大小写冲突：{target}")
        targets.add(key)
        entries.append((source, target, "other", int(row["size"]), int(row["mtime_ns"])))
        roots[safe_rel(source).parts[0]] += 1
        extensions[str(row["extension"] or "(无扩展名)")] += 1
        bytes_total += int(row["size"])
    return entries, {
        "total": len(entries), "bytesTotal": bytes_total,
        "skippedTransient": sorted(SKIPPED_TRANSIENT),
        "target": f"{LIBRARY}/{REVIEW_DIR}/<原相对路径>",
        "sourceRoots": dict(roots.most_common()),
        "extensions": dict(extensions.most_common(12)),
        "examples": [{"sourceRel": src, "targetRel": dst} for src, dst, *_ in entries[:8]],
    }


def preview(db: Path, expected_count: int) -> dict:
    uri = db.resolve().as_uri() + "?mode=ro"
    with contextlib.closing(sqlite3.connect(uri, uri=True)) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA query_only=ON")
        source = latest_source(conn)
        return prepare(conn, int(source["id"]), expected_count)[1]


def plan(db: Path, expected_count: int) -> dict:
    with exclusive_lock(db), contextlib.closing(connect(db)) as conn:
        ensure_schema(conn)
        latest = conn.execute("SELECT id,status,source_id FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
        if not latest or int(latest["id"]) != EXPECTED_PREVIOUS_RUN or latest["status"] != "completed":
            raise RuntimeError("上一轮整理尚未完成或已存在其他整理任务；不会覆盖预演")
        source = latest_source(conn)
        if int(source["id"]) != int(latest["source_id"]):
            raise RuntimeError("最新扫描来源与上一轮整理不一致")
        root = Path(str(source["root"]))
        library = root / LIBRARY
        review = library / REVIEW_DIR
        if not root.is_dir() or not library.is_dir() or not os.access(root, os.R_OK | os.W_OK):
            raise RuntimeError("S300 或家庭影像库不可访问")
        if root.stat().st_dev != library.stat().st_dev:
            raise RuntimeError("来源与家庭影像库不在同一文件系统")
        if review.exists() or review.is_symlink():
            raise RuntimeError(f"目标目录已存在，需先核对：{review}")
        entries, summary = prepare(conn, int(source["id"]), expected_count)
        stamp = now_ms()
        run_id = int(conn.execute(
            """INSERT INTO organize_runs(source_id,status,source_root,target_root,layout,created_at,updated_at,
                      total,reliable,needs_review,bytes_total,message)
               VALUES (?,'planned',?,?,?,?,?,?,?,?,?,?)""",
            (int(source["id"]), str(root), str(library), LAYOUT, stamp, stamp,
             len(entries), 0, len(entries), summary["bytesTotal"],
             "其他文件集中待审核；保留原相对路径和文件名"),
        ).lastrowid)
        conn.executemany(
            """INSERT INTO organize_entries(run_id,source_rel,target_rel,kind,size,mtime_ns,status,updated_at)
               VALUES (?,?,?,?,?,?,'planned',?)""",
            [(run_id, src, dst, kind, size, mtime_ns, stamp) for src, dst, kind, size, mtime_ns in entries],
        )
        conn.commit()
        return {"runId": run_id, **summary}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--expected-count", type=int, default=4804)
    parser.add_argument("command", choices=("preview", "plan"))
    args = parser.parse_args()
    result = preview(args.db, args.expected_count) if args.command == "preview" else plan(args.db, args.expected_count)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
