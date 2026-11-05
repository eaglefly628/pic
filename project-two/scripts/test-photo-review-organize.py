#!/usr/bin/env python3
"""Second-pass plan and move: month, year only, conflict and unknown."""

from __future__ import annotations

import json
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

from photo_organize import ensure_schema


HERE = Path(__file__).resolve().parent


def call(script: str, *args: str) -> dict:
    result = subprocess.run([sys.executable, str(HERE / script), *args],
                            check=True, text=True, capture_output=True)
    return json.loads(result.stdout.strip().splitlines()[-1])


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="photo-review-organize-") as temp:
        root = Path(temp) / "share"
        db = Path(temp) / "index.sqlite3"
        names = [
            "a/2021-05/IMG_1.jpg", "b/2021/IMG_2.jpg",
            "c/2020/2021-04/IMG_3.jpg", "d/unknown.jpg",
            "e/2019.9 Japan/2019年05月/IMG_4.jpg",
            "f/200610_4-2安吉/IMG_5.jpg",
        ]
        for name in names + ["家庭影像库/2021/2021-05/IMG_1.jpg"]:
            file = root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(name.encode())
        call("photo_index.py", "--db", str(db), "scan", str(root))
        with sqlite3.connect(db) as conn:
            conn.row_factory = sqlite3.Row
            ensure_schema(conn)
            conn.execute(
                """INSERT INTO organize_runs(id,source_id,status,source_root,target_root,layout,created_at,updated_at)
                   VALUES (2,1,'completed',?,?,'month',1,1)""",
                (str(root), str(root / "家庭影像库")),
            )
            for row in conn.execute("SELECT rel_path,kind,size,mtime_ns FROM media_files WHERE rel_path NOT LIKE '家庭影像库/%'").fetchall():
                conn.execute(
                    """INSERT INTO organize_entries(run_id,source_rel,target_rel,kind,size,mtime_ns,status,updated_at)
                       VALUES (2,?,?,?,?,?,'review',1)""",
                    (row["rel_path"], row["rel_path"], row["kind"], row["size"], row["mtime_ns"]),
                )
            conn.commit()

        preview = call("photo_review_organize.py", "--db", str(db), "preview")
        assert preview["counts"] == {"month": 1, "year_only": 3, "year_conflict": 1, "unknown": 1}
        assert preview["total"] == 6
        planned = call("photo_review_organize.py", "--db", str(db), "plan")
        assert planned["runId"] == 3
        replaced = call("photo_review_organize.py", "--db", str(db), "--replace-planned", "plan")
        assert replaced["total"] == 6
        call("photo_organize.py", "--db", str(db), "run", "--workers", "2", "--batch-size", "2")
        with sqlite3.connect(db) as conn:
            job = conn.execute("SELECT status,total,verified,errors,needs_review FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
            paths = [row[0] for row in conn.execute("SELECT rel_path FROM media_files WHERE rel_path LIKE '家庭影像库/%'")]
        assert job == ("completed", 6, 6, 0, 2), job
        assert any(path.startswith("家庭影像库/2021/2021-05/IMG_1__") for path in paths)
        assert "家庭影像库/2021/_仅确定年份/IMG_2.jpg" in paths
        assert "家庭影像库/2019/_仅确定年份/IMG_4.jpg" in paths
        assert "家庭影像库/2006/_仅确定年份/IMG_5.jpg" in paths
        assert "家庭影像库/未能归档，未归类/c/2020/2021-04/IMG_3.jpg" in paths
        assert "家庭影像库/未能归档，未归类/d/unknown.jpg" in paths
        assert (root / "家庭影像库/2021/2021-05/IMG_1.jpg").read_bytes() == "家庭影像库/2021/2021-05/IMG_1.jpg".encode()
        print("second-pass plan, collision safety and resumable move passed")


if __name__ == "__main__":
    main()
