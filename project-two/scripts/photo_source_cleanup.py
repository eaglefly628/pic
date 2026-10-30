#!/usr/bin/env python3
"""Collect old top-level photo source folders after all indexed files move.

Only roots named in completed photo organize runs 1, 2 and 3 are considered.
``shelve`` renames each entire tree within the same SMB volume into
家庭影像库/_旧来源目录待审核, preserving even unindexed or hidden leftovers.
Unrelated S300 folders are never selected.
"""

from __future__ import annotations

import argparse
import collections
import contextlib
import json
import os
import sqlite3
from pathlib import Path


LIBRARY = "家庭影像库"
HOLD = "_旧来源目录待审核"
EXPECTED_RUN = 4


def roots_from_index(conn: sqlite3.Connection) -> list[str]:
    roots = set()
    for (rel,) in conn.execute("SELECT source_rel FROM organize_entries WHERE run_id IN (1,2,3)"):
        name = str(rel).split("/", 1)[0]
        if name != LIBRARY:
            roots.add(name)
    return sorted(roots, key=str.casefold)


def shelve_plan(conn: sqlite3.Connection, root: Path) -> list[dict]:
    indexed_outside = collections.Counter(
        str(rel).split("/", 1)[0] for (rel,) in conn.execute(
            "SELECT rel_path FROM media_files WHERE status='active' AND rel_path NOT LIKE ?", (LIBRARY + "/%",)
        )
    )
    hold = root / LIBRARY / HOLD
    result = []
    for name in roots_from_index(conn):
        if name in ("", ".", "..") or "/" in name or "\\" in name:
            raise RuntimeError(f"不安全的来源目录名：{name}")
        source, target = root / name, hold / name
        source_exists = source.exists() or source.is_symlink()
        target_exists = target.exists() or target.is_symlink()
        if indexed_outside[name]:
            action = "skip_indexed"
        elif target_exists and not source_exists:
            action = "already_shelved"
        elif target_exists:
            action = "skip_target_exists"
        elif not source_exists:
            action = "already_absent"
        elif source.is_symlink() or not source.is_dir() or os.path.ismount(source):
            action = "skip_non_directory"
        else:
            action = "shelve"
        result.append({"root": name, "action": action, "indexedOutside": indexed_outside[name],
                       "target": str(target.relative_to(root))})
    return result


def prerequisites(conn: sqlite3.Connection) -> Path:
    row = conn.execute("SELECT id,status,total,verified,errors,source_root FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
    if not row or tuple(row[:5]) != (EXPECTED_RUN, "completed", 4803, 4803, 0):
        raise RuntimeError("其他文件收纳尚未完整核验，拒绝清理旧目录")
    root = Path(str(row[5]))
    library = root / LIBRARY
    if not root.is_dir() or not os.path.ismount(root) or not library.is_dir():
        raise RuntimeError("S300 或家庭影像库未挂载")
    if root.stat().st_dev != library.stat().st_dev:
        raise RuntimeError("来源和收纳目录不在同一文件系统")
    return root


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("command", choices=("shelve-preview", "shelve"))
    args = parser.parse_args()
    uri = args.db.resolve().as_uri() + "?mode=ro"
    with contextlib.closing(sqlite3.connect(uri, uri=True)) as conn:
        root = prerequisites(conn)
        plan = shelve_plan(conn, root)
    if args.command == "shelve-preview":
        print(json.dumps({"roots": plan}, ensure_ascii=False))
        return
    hold = root / LIBRARY / HOLD
    if any(item["action"].startswith("skip_") for item in plan):
        raise RuntimeError("旧来源目录存在索引或目标冲突，拒绝整体移动；请先核对预演")
    results = []
    for item in plan:
        name = item["root"]
        if item["action"] != "shelve":
            results.append({"root": name, "action": item["action"]})
            continue
        source, target = root / name, hold / name
        hold.mkdir(parents=True, exist_ok=True)
        if source.stat().st_dev != hold.stat().st_dev:
            raise RuntimeError(f"来源目录与收纳目录不在同一卷：{name}")
        if target.exists() or target.is_symlink():
            raise RuntimeError(f"目标已出现，拒绝覆盖：{target}")
        os.rename(source, target)
        if source.exists() or not target.is_dir():
            raise RuntimeError(f"目录移动后核验失败：{name}")
        results.append({"root": name, "action": "shelved", "target": item["target"]})
    print(json.dumps({"results": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
