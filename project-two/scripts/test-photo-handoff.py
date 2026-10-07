#!/usr/bin/env python3
"""Cross-machine photo index handoff regression test."""

import json
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

from photo_index import connect, now_ms
from photo_organize import ensure_schema


HERE = Path(__file__).resolve().parent


def main() -> int:
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        old_root = base / "mac-share"
        new_root = base / "surface-share"
        old_root.mkdir()
        new_root.mkdir()
        db = base / "source.sqlite3"
        with connect(db) as conn:
            ensure_schema(conn)
            stamp = now_ms()
            sid = int(conn.execute(
                "INSERT INTO sources(root,label,created_at,last_seen_at) VALUES (?,?,?,?)",
                (str(old_root), "old", stamp, stamp),
            ).lastrowid)
            conn.execute(
                """INSERT INTO scan_runs(source_id,status,started_at,finished_at,updated_at,excludes_json)
                   VALUES (?,'completed',?,?,?,'[]')""", (sid, stamp, stamp, stamp),
            )
            conn.execute(
                """INSERT INTO organize_runs(source_id,status,source_root,target_root,layout,created_at,updated_at,total,verified)
                   VALUES (?,'paused',?,?,'month',?,?,100,25)""",
                (sid, str(old_root), str(old_root / "家庭影像库"), stamp, stamp),
            )
            conn.commit()
        bundle = base / "photo-handoff.zip"
        imported = base / "surface.sqlite3"
        export = subprocess.run(
            [sys.executable, str(HERE / "photo_handoff.py"), "export", "--db", str(db), "--output", str(bundle)],
            text=True, capture_output=True, check=True,
        )
        assert json.loads(export.stdout)["verified"] == 25
        restore = subprocess.run(
            [sys.executable, str(HERE / "photo_handoff.py"), "import", "--bundle", str(bundle),
             "--db", str(imported), "--source-root", str(new_root)],
            text=True, capture_output=True, check=True,
        )
        result = json.loads(restore.stdout)
        assert result["verified"] == 25
        with sqlite3.connect(imported) as conn:
            root = conn.execute("SELECT root FROM sources WHERE id=?", (sid,)).fetchone()[0]
            job = conn.execute("SELECT source_root,target_root,status,verified FROM organize_runs").fetchone()
        assert root == str(new_root.resolve())
        assert job == (str(new_root.resolve()), str(new_root.resolve() / "家庭影像库"), "paused", 25)
        with sqlite3.connect(imported) as conn:
            conn.execute("UPDATE organize_runs SET verified=30 WHERE id=1")
            conn.commit()
        repeat = subprocess.run(
            [sys.executable, str(HERE / "photo_handoff.py"), "import", "--bundle", str(bundle),
             "--db", str(imported), "--source-root", str(new_root), "--replace", "--keep-newer"],
            text=True, capture_output=True, check=True,
        )
        assert json.loads(repeat.stdout)["unchanged"] is True
        with sqlite3.connect(imported) as conn:
            assert conn.execute("SELECT verified FROM organize_runs WHERE id=1").fetchone()[0] == 30
    print("照片索引接力测试通过 ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
