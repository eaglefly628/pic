#!/usr/bin/env python3
"""按时间整理：预演、冲突改名、断点续跑和不删除源目录。"""

from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


HERE = Path(__file__).resolve().parent


def call(script: str, *args: str, check: bool = True):
    return subprocess.run([sys.executable, str(HERE / script), *args], check=check, text=True, capture_output=True)


def check(ok: bool, label: str):
    if not ok:
        raise AssertionError(label)
    print(f"  ✓ {label}")


def main():
    with tempfile.TemporaryDirectory(prefix="photo-organize-") as tmp:
        base = Path(tmp)
        source, db = base / "share", base / "index.sqlite3"
        (source / "a").mkdir(parents=True)
        (source / "b").mkdir(parents=True)
        (source / "a" / "IMG_0001.JPG").write_bytes(b"one")
        (source / "a" / "IMG_0001.MOV").write_bytes(b"live")
        (source / "b" / "IMG_0001.JPG").write_bytes(b"two")
        (source / "b" / "unknown.jpg").write_bytes(b"unknown")
        call("photo_index.py", "--db", str(db), "scan", str(source))
        with sqlite3.connect(db) as conn:
            conn.execute("""UPDATE media_files SET metadata_status='done',capture_time_text='2022-03-04T05:06:07',
                            capture_time_source='embedded_metadata',capture_time_confidence='high'
                            WHERE name LIKE 'IMG_0001.%'""")
            conn.execute("""UPDATE media_files SET metadata_status='done',capture_time_text='2020-01-01T00:00:00',
                            capture_time_source='filesystem_mtime',capture_time_confidence='low'
                            WHERE name='unknown.jpg'""")
            conn.commit()

        call("photo_organize.py", "--db", str(db), "plan")
        with sqlite3.connect(db) as conn:
            conn.row_factory = sqlite3.Row
            job = conn.execute("SELECT * FROM organize_runs").fetchone()
            entries = conn.execute("SELECT * FROM organize_entries ORDER BY source_rel").fetchall()
        check(job["status"] == "planned" and job["total"] == 3, "预演只自动安排可信时间媒体")
        check(len(entries) == 4 and sum(r["status"] == "review" for r in entries) == 1, "低可信时间只列入审核，不自动移动")
        reliable = [r for r in entries if "2022/2022-03/2022-03-04" in r["target_rel"]]
        check(len(reliable) == 3, "可信时间进入年月日目录")
        check(any("_待确认时间/2020-01/b" in r["target_rel"] for r in entries), "低可信时间进入待确认区")
        stems = {Path(r["target_rel"]).stem.split("__")[0] for r in reliable}
        check(stems == {"IMG_0001"}, "Live Photo 图片与视频保持同名关联")
        check(len({r["target_rel"].casefold() for r in entries}) == 4, "同日同名文件不会覆盖")

        first = entries[0]
        source_path = source / first["source_rel"]
        target_path = source / first["target_rel"]
        target_path.parent.mkdir(parents=True, exist_ok=True)
        source_path.rename(target_path)

        call("photo_organize.py", "--db", str(db), "run", "--max-entries", "2")
        with sqlite3.connect(db) as conn:
            reconciled = conn.execute(
                "SELECT status FROM organize_entries WHERE source_rel=?", (first["source_rel"],)
            ).fetchone()[0]
        check(reconciled == "verified", "移动后写库前中断可自动对账")
        check((source / "a").is_dir(), "暂停后不删除原目录")
        call("photo_organize.py", "--db", str(db), "run")
        with sqlite3.connect(db) as conn:
            conn.row_factory = sqlite3.Row
            job = conn.execute("SELECT * FROM organize_runs").fetchone()
            active = conn.execute("SELECT rel_path FROM media_files WHERE status='active'").fetchall()
        check(job["status"] == "completed" and job["verified"] == 3, "断点续跑后全部可信项已核验")
        check(all((source / row["rel_path"]).is_file() for row in active), "索引路径随移动原子更新")
        check((source / "b" / "unknown.jpg").is_file(), "低可信文件保留原位等待审核")
        check(not (source / "a" / "IMG_0001.JPG").exists(), "源文件已移动而非复制")
    print("全部通过 ✓")


if __name__ == "__main__":
    main()
