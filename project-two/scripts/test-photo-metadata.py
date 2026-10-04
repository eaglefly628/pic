#!/usr/bin/env python3
"""时间地点分析回归测试：迁移、暂停续跑和文件名时间推断。"""

from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


HERE = Path(__file__).resolve().parent


def run(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(HERE / script), *args], check=True, text=True, capture_output=True)


def check(ok: bool, label: str) -> None:
    if not ok:
        raise AssertionError(label)
    print(f"  ✓ {label}")


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        base = Path(td)
        source, db = base / "share", base / "index.sqlite3"
        source.mkdir()
        (source / "IMG_20200102_030405.jpg").write_bytes(b"not-a-real-jpeg")
        (source / "clip.mov").write_bytes(b"not-a-real-video")
        run("photo_index.py", "--db", str(db), "scan", str(source), "--report-every", "999")

        print("① 暂停与续跑")
        run("photo_metadata.py", "--db", str(db), "--max-entries", "1")
        with sqlite3.connect(db) as conn:
            conn.row_factory = sqlite3.Row
            state = conn.execute("SELECT status FROM analysis_runs ORDER BY id DESC LIMIT 1").fetchone()["status"]
            image = conn.execute("SELECT * FROM media_files WHERE extension='jpg'").fetchone()
        check(state == "paused", "达到本次上限后暂停")
        check(image["metadata_status"] == "done", "中间结果已经落库")
        check(image["capture_time_text"].startswith("2020-01-02T03:04:05"), "无法读 EXIF 时从文件名提取时间")
        check(image["capture_time_source"] == "filename_or_path", "保存时间证据来源")

        run("photo_metadata.py", "--db", str(db))
        with sqlite3.connect(db) as conn:
            conn.row_factory = sqlite3.Row
            state = conn.execute("SELECT status,processed,total FROM analysis_runs ORDER BY id DESC LIMIT 1").fetchone()
            rows = conn.execute("SELECT metadata_status FROM media_files WHERE kind IN ('image','video')").fetchall()
        check(state["status"] == "completed" and state["processed"] == state["total"] == 2, "续跑后完整完成")
        check(all(r["metadata_status"] == "done" for r in rows), "照片与视频都有分析状态")
        print("全部通过 ✓")


if __name__ == "__main__":
    main()
