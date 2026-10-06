#!/usr/bin/env python3
"""时间地点分析回归测试：迁移、暂停续跑和文件名时间推断。"""

from __future__ import annotations

import sqlite3
import struct
import subprocess
import sys
import tempfile
import datetime as dt
from pathlib import Path


HERE = Path(__file__).resolve().parent


def run(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(HERE / script), *args], check=True, text=True, capture_output=True)


def check(ok: bool, label: str) -> None:
    if not ok:
        raise AssertionError(label)
    print(f"  ✓ {label}")


def atom(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I4s", len(payload) + 8, kind) + payload


def quicktime_movie(when: dt.datetime) -> bytes:
    epoch = dt.datetime(1904, 1, 1, tzinfo=dt.timezone.utc)
    seconds = int((when - epoch).total_seconds())
    mvhd = atom(b"mvhd", b"\x00\x00\x00\x00" + struct.pack(">I", seconds) + b"\x00" * 12)
    return atom(b"ftyp", b"qt  \x00\x00\x00\x00") + atom(b"moov", mvhd)


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        base = Path(td)
        source, db = base / "share", base / "index.sqlite3"
        source.mkdir()
        (source / "IMG_20200102_030405.jpg").write_bytes(b"not-a-real-jpeg")
        (source / "clip.mov").write_bytes(quicktime_movie(dt.datetime(2021, 6, 7, 8, 9, 10, tzinfo=dt.timezone.utc)))
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
            video = conn.execute("SELECT * FROM media_files WHERE extension='mov'").fetchone()
        check(state["status"] == "completed" and state["processed"] == state["total"] == 2, "续跑后完整完成")
        check(all(r["metadata_status"] == "done" for r in rows), "照片与视频都有分析状态")
        check(video["capture_time_text"].startswith("2021-06-07T08:09:10"), "从 MOV 容器提取视频时间")
        check(video["capture_time_source"] == "video_container", "视频时间记录独立证据来源")
        print("全部通过 ✓")


if __name__ == "__main__":
    main()
