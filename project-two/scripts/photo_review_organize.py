#!/usr/bin/env python3
"""Plan the second pass for media left in the first organize run's review queue.

Unique, consistent month evidence goes to YYYY/YYYY-MM. A unique year without a
consistent month goes to YYYY/_仅确定年份. Year conflicts and unknown dates go to
未能归档，未归类 with their original relative paths intact. ``preview`` is read-only;
``plan`` writes only an auditable SQLite plan. ``photo_organize.py run`` performs
the existing same-volume, no-overwrite, resumable renames.
"""

from __future__ import annotations

import argparse
import collections
import contextlib
import datetime as dt
import json
import os
import sqlite3
from pathlib import Path, PurePosixPath

from photo_index import connect, exclusive_lock, now_ms
from photo_organize import ensure_schema, latest_source, safe_rel, unique_names
from photo_year_clues import destination_from_evidence, evidence_for


LAYOUT = "review_month_year"
TARGET_NAME = "家庭影像库"
UNCLASSIFIED = "未能归档，未归类"
DEFAULT_SOURCE_RUN_ID = 2


def source_rows(conn: sqlite3.Connection, source_run_id: int) -> list[sqlite3.Row]:
    expected = int(conn.execute(
        "SELECT count(*) FROM organize_entries WHERE run_id=? AND status='review'", (source_run_id,)
    ).fetchone()[0])
    rows = conn.execute(
        """SELECT m.* FROM organize_entries e JOIN media_files m
             ON m.source_id=(SELECT source_id FROM organize_runs WHERE id=e.run_id)
            AND m.rel_path=e.source_rel
           WHERE e.run_id=? AND e.status='review' AND m.status='active'
           ORDER BY e.source_rel COLLATE NOCASE""", (source_run_id,)
    ).fetchall()
    if expected != len(rows) or expected == 0:
        raise RuntimeError(f"待审核清单与当前索引不一致：清单 {expected}，可用媒体 {len(rows)}")
    return rows


def grouped(rows: list[sqlite3.Row]) -> dict[tuple[str, str], list[sqlite3.Row]]:
    groups: dict[tuple[str, str], list[sqlite3.Row]] = {}
    for row in rows:
        path = safe_rel(str(row["rel_path"]))
        groups.setdefault((str(path.parent).casefold(), path.stem.casefold()), []).append(row)
    return groups


def classify_group(rows: list[sqlite3.Row], current_year: int) -> tuple[str, int | None, int | None, list[dict]]:
    evidence: list[dict] = []
    for row in rows:
        if str(row["kind"]) == "sidecar":
            continue
        item_evidence, _ = evidence_for(
            str(row["rel_path"]), row["capture_time_source"], row["capture_time_text"], current_year
        )
        evidence.extend(item_evidence)
    category, year, month = destination_from_evidence(evidence)
    return category, year, month, evidence


def target_dir(category: str, year: int | None, month: int | None, source: PurePosixPath) -> PurePosixPath:
    if category == "month":
        assert year is not None and month is not None
        return PurePosixPath(TARGET_NAME, f"{year:04d}", f"{year:04d}-{month:02d}")
    if category == "year_only":
        assert year is not None
        return PurePosixPath(TARGET_NAME, f"{year:04d}", "_仅确定年份")
    return PurePosixPath(TARGET_NAME, UNCLASSIFIED, *source.parent.parts)


def prepare(conn: sqlite3.Connection, source_run_id: int) -> tuple[list[tuple], dict]:
    rows = source_rows(conn, source_run_id)
    used = {str(row[0]).casefold() for row in conn.execute(
        "SELECT rel_path FROM media_files WHERE status='active' AND rel_path LIKE ?", (TARGET_NAME + "/%",)
    )}
    entries: list[tuple] = []
    counts: collections.Counter[str] = collections.Counter()
    byte_counts: collections.Counter[str] = collections.Counter()
    examples: dict[str, list[dict]] = collections.defaultdict(list)
    current_year = dt.date.today().year
    for members in grouped(rows).values():
        category, year, month, evidence = classify_group(members, current_year)
        source = safe_rel(str(members[0]["rel_path"]))
        directory = target_dir(category, year, month, source)
        targets = unique_names(members, directory, used)
        for row, target in zip(members, targets):
            source_rel = str(row["rel_path"])
            target_rel = str(target)
            if target_rel.casefold() in used or target_rel == source_rel:
                raise RuntimeError(f"目标路径冲突或未变化：{target_rel}")
            used.add(target_rel.casefold())
            entries.append((source_rel, target_rel, str(row["kind"]), int(row["size"]),
                            int(row["mtime_ns"]), category))
            counts[category] += 1
            byte_counts[category] += int(row["size"])
            if len(examples[category]) < 5:
                examples[category].append({"source": source_rel, "target": target_rel,
                                           "evidence": evidence[:5]})
    if len(entries) != len(rows) or len({item[1].casefold() for item in entries}) != len(entries):
        raise RuntimeError("预演数量或目标路径唯一性检查失败")
    summary = {"sourceRunId": source_run_id, "total": len(entries), "counts": dict(counts),
               "bytes": dict(byte_counts), "examples": dict(examples)}
    return entries, summary


def preview(db: Path, source_run_id: int = DEFAULT_SOURCE_RUN_ID) -> dict:
    uri = db.resolve().as_uri() + "?mode=ro"
    with contextlib.closing(sqlite3.connect(uri, uri=True)) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA query_only=ON")
        return prepare(conn, source_run_id)[1]


def plan(db: Path, replace_planned: bool = False,
         source_run_id: int = DEFAULT_SOURCE_RUN_ID) -> dict:
    with exclusive_lock(db), contextlib.closing(connect(db)) as conn:
        ensure_schema(conn)
        old_run = conn.execute("SELECT source_id,status,layout FROM organize_runs WHERE id=?", (source_run_id,)).fetchone()
        if not old_run or old_run["status"] != "completed" or old_run["layout"] not in ("day", "month"):
            raise RuntimeError("第一轮时间整理尚未完成")
        latest = conn.execute("SELECT id,status,layout,verified FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
        if latest and int(latest["id"]) != source_run_id:
            if (replace_planned and latest["status"] == "planned" and latest["layout"] == LAYOUT
                    and int(latest["verified"] or 0) == 0):
                conn.execute("DELETE FROM organize_entries WHERE run_id=?", (int(latest["id"]),))
                conn.execute("DELETE FROM organize_runs WHERE id=?", (int(latest["id"]),))
            else:
                raise RuntimeError("已存在后续整理任务；不会覆盖已开始的预演")
        elif not latest:
            raise RuntimeError("没有第一轮整理任务")
        source = latest_source(conn)
        if int(source["id"]) != int(old_run["source_id"]):
            raise RuntimeError("最新索引来源与第一轮整理不一致")
        root = Path(str(source["root"]))
        if not root.is_dir() or (os.name != "nt" and not os.access(root, os.R_OK | os.W_OK)):
            raise RuntimeError("S300 未挂载或不可读写")
        entries, summary = prepare(conn, source_run_id)
        stamp = now_ms()
        run_id = int(conn.execute(
            """INSERT INTO organize_runs(source_id,status,source_root,target_root,layout,created_at,updated_at,
                      total,reliable,needs_review,bytes_total,message)
               VALUES (?,'planned',?,?,?,?,?,?,?,?,?,?)""",
            (int(source["id"]), str(root), str(root / TARGET_NAME), LAYOUT, stamp, stamp,
             len(entries), summary["counts"].get("month", 0) + summary["counts"].get("year_only", 0),
             summary["counts"].get("year_conflict", 0) + summary["counts"].get("unknown", 0),
             sum(summary["bytes"].values()), "待确认项目二次归档；冲突与未知移入未能归档，未归类")
        ).lastrowid)
        conn.executemany(
            """INSERT INTO organize_entries(run_id,source_rel,target_rel,kind,size,mtime_ns,status,updated_at)
               VALUES (?,?,?,?,?,?,'planned',?)""",
            [(run_id, src, dst, kind, size, mtime_ns, stamp)
             for src, dst, kind, size, mtime_ns, _category in entries],
        )
        conn.commit()
        return {"runId": run_id, **summary}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--source-run-id", type=int, default=DEFAULT_SOURCE_RUN_ID)
    parser.add_argument("--replace-planned", action="store_true", help="仅替换尚未搬移的本轮预演")
    parser.add_argument("command", choices=("preview", "plan"))
    args = parser.parse_args()
    if args.source_run_id < 1:
        parser.error("--source-run-id 必须为正整数")
    result = (preview(args.db, args.source_run_id) if args.command == "preview"
              else plan(args.db, args.replace_planned, args.source_run_id))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
