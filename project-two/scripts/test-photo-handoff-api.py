#!/usr/bin/env python3
"""Application-menu photo handoff API regression test."""

import sqlite3
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import run as app  # noqa: E402
from photo_index import connect, now_ms  # noqa: E402
from photo_organize import ensure_schema  # noqa: E402


def seed_database(path: Path, source_root: Path) -> None:
    with connect(path) as conn:
        ensure_schema(conn)
        stamp = now_ms()
        sid = int(conn.execute(
            "INSERT INTO sources(root,label,created_at,last_seen_at) VALUES (?,?,?,?)",
            (str(source_root), "source", stamp, stamp),
        ).lastrowid)
        conn.execute(
            """INSERT INTO scan_runs(source_id,status,started_at,finished_at,updated_at,excludes_json)
               VALUES (?,'completed',?,?,?,'[]')""", (sid, stamp, stamp, stamp),
        )
        conn.execute(
            """INSERT INTO organize_runs(source_id,status,source_root,target_root,layout,created_at,updated_at,total,verified)
               VALUES (?,'paused',?,?,'month',?,?,100,25)""",
            (sid, str(source_root), str(source_root / "家庭影像库"), stamp, stamp),
        )
        conn.commit()


def main() -> int:
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        first_root = base / "first-computer-share"
        next_root = base / "next-computer-share"
        first_root.mkdir()
        next_root.mkdir()
        source_db = base / "source.sqlite3"
        imported_db = base / "imported.sqlite3"
        seed_database(source_db, first_root)

        app.PHOTO_INDEX_DB = source_db
        app.PHOTO_DEFAULT_SOURCE = first_root
        app._photo_handoff_roots = lambda: [first_root]
        exported = app.photo_handoff_export()
        assert exported["ok"] is True, exported
        bundle = Path(exported["bundle"])
        assert bundle.name.startswith("photo-handoff-computer-")
        assert (bundle.parent / "其他电脑一键继续照片整理.cmd").is_file()
        assert exported["manifest"]["verified"] == 25

        next_handoff = next_root / app.PHOTO_HANDOFF_DIR_NAME
        next_handoff.mkdir()
        (next_handoff / bundle.name).write_bytes(bundle.read_bytes())
        app.PHOTO_INDEX_DB = imported_db
        app.PHOTO_DEFAULT_SOURCE = next_root
        app._photo_handoff_roots = lambda: [next_root]
        imported = app.photo_handoff_import()
        assert imported["ok"] is True, imported
        assert imported["importResult"]["verified"] == 25
        with sqlite3.connect(imported_db) as conn:
            rebound = conn.execute("SELECT root FROM sources").fetchone()[0]
            progress = conn.execute("SELECT verified FROM organize_runs").fetchone()[0]
        assert rebound == str(next_root.resolve())
        assert progress == 25
    print("应用内其他电脑照片接力测试通过 ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
