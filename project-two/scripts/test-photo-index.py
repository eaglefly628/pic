#!/usr/bin/env python3
"""只读索引器回归测试：暂停续跑、分类提示、增量更新和缺失标记。"""

from __future__ import annotations

import sqlite3
import stat
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT = Path(__file__).with_name("photo_index.py")


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(SCRIPT), *args], check=True, text=True, capture_output=True)


def check(ok: bool, label: str) -> None:
    if not ok:
        raise AssertionError(label)
    print(f"  ✓ {label}")


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        base = Path(td)
        source = base / "share"
        db = base / "index.sqlite3"
        (source / "iPhone" / "Screenshots").mkdir(parents=True)
        (source / "Trips").mkdir()
        (source / "TimeMachine" / "noise").mkdir(parents=True)
        (source / "iPhone" / "IMG_0001.HEIC").write_bytes(b"photo")
        (source / "iPhone" / "IMG_0001.MOV").write_bytes(b"live")
        (source / "iPhone" / "Screenshots" / "Screenshot 1.PNG").write_bytes(b"screen")
        (source / "Trips" / "clip.MOV").write_bytes(b"video")
        (source / "TimeMachine" / "noise" / "old.jpg").write_bytes(b"excluded")

        print("① 暂停与续跑")
        run("--db", str(db), "scan", str(source), "--max-entries", "2", "--report-every", "999")
        with sqlite3.connect(db) as conn:
            state = conn.execute("SELECT status FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()[0]
        check(state == "paused", "达到上限后保存为 paused")
        check(stat.S_IMODE(db.stat().st_mode) == 0o600, "索引数据库只有当前用户可读写")
        check(stat.S_IMODE(db.with_suffix(".sqlite3.lock").stat().st_mode) == 0o600, "扫描锁文件只有当前用户可读写")
        run("--db", str(db), "scan", str(source), "--report-every", "999")
        with sqlite3.connect(db) as conn:
            conn.row_factory = sqlite3.Row
            state = conn.execute("SELECT status FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()[0]
            rows = conn.execute("SELECT * FROM media_files WHERE status='active'").fetchall()
        check(state == "completed", "从断点继续并完成")
        check(len(rows) == 4, "排除 TimeMachine，仅索引 4 个媒体文件")
        check(sum(r["kind"] == "image" for r in rows) == 2, "图片类型正确")
        check(sum(r["kind"] == "video" for r in rows) == 2, "视频类型正确")
        check(sum(r["classification_hint"] == "screenshot" for r in rows) == 1, "文件名/目录识别截屏候选")

        print("② 增量更新与缺失保护")
        target = source / "Trips" / "clip.MOV"
        target.write_bytes(b"video-updated")
        removed = source / "iPhone" / "IMG_0001.HEIC"
        removed.unlink()
        run("--db", str(db), "scan", str(source), "--new-run", "--report-every", "999")
        with sqlite3.connect(db) as conn:
            conn.row_factory = sqlite3.Row
            updated = conn.execute("SELECT size,status FROM media_files WHERE rel_path='Trips/clip.MOV'").fetchone()
            missing = conn.execute("SELECT status FROM media_files WHERE rel_path='iPhone/IMG_0001.HEIC'").fetchone()
        check(updated["size"] == len(b"video-updated") and updated["status"] == "active", "同路径文件变化会更新索引")
        check(missing["status"] == "missing", "完整扫描后才标记消失文件")

        print("全部通过 ✓")


if __name__ == "__main__":
    main()
