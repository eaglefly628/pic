#!/usr/bin/env python3
"""时间轴月份聚合、地点展开与异常时间隔离回归测试。"""

from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import run  # noqa: E402


def check(condition: bool, label: str) -> None:
    if not condition:
        raise AssertionError(label)
    print(f"  ✓ {label}")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="photo-timeline-test-") as tmp:
        base = Path(tmp)
        source = base / "source"
        source.mkdir()
        current_month = source / "家庭影像库" / "2024" / "2024-02"
        suspicious_month = source / "家庭影像库" / "1899" / "1899-11"
        current_month.mkdir(parents=True)
        suspicious_month.mkdir(parents=True)
        (current_month / "IMG_20240201_120000.jpg").write_bytes(b"one")
        (current_month / "IMG_20240202_120000.jpg").write_bytes(b"two")
        (suspicious_month / "archive_18991101.jpg").write_bytes(b"old")
        db = base / "index.sqlite3"
        subprocess.run(
            [sys.executable, str(SCRIPTS / "photo_index.py"), "--db", str(db), "scan", str(source)],
            check=True, stdout=subprocess.DEVNULL,
        )
        with sqlite3.connect(db) as conn:
            conn.execute(
                """UPDATE media_files SET metadata_status='done',capture_time_text=CASE name
                     WHEN 'IMG_20240201_120000.jpg' THEN '2024-02-01T12:00:00'
                     WHEN 'IMG_20240202_120000.jpg' THEN '2024-02-02T12:00:00'
                     ELSE '1899-11-01T00:00:00' END,metadata_review_needed=1"""
            )
            conn.execute(
                """UPDATE media_files SET latitude=31.23,longitude=121.47,metadata_review_needed=0
                   WHERE name='IMG_20240201_120000.jpg'"""
            )
            conn.execute("""CREATE TABLE photo_place_labels (
                key TEXT PRIMARY KEY, latitude REAL, longitude REAL,
                label TEXT, source TEXT, distance_km REAL, updated_at TEXT)""")
            conn.execute("INSERT INTO photo_place_labels VALUES (?,?,?,?,?,?,?)",
                         ("approx:31.2,121.5", 31.2, 121.5, "杨浦 · CN", "geonames-city", 2.0, "2026-10-09"))
            conn.commit()

        original = run.PHOTO_INDEX_DB
        run.PHOTO_INDEX_DB = db
        try:
            summary = run.photo_timeline({})
            check(summary["ok"] and len(summary["periods"]) == 1, "主时间轴只保留可信月份")
            check(summary["suspiciousTime"] == 1, "异常年份进入待确认计数")
            detail = run.photo_timeline({"period": ["2024-02"]})
            check(sum(item["files"] for item in detail["places"]) == 2, "地点展开覆盖该月全部媒体")
            check(any(item["key"] == "unknown" for item in detail["places"]), "无 GPS 媒体单独归组")
            check(any(item["label"] == "附近：杨浦 · CN" for item in detail["places"]), "离线地名替代坐标")
            check(run.photo_timeline({"period": ["bad"]})["ok"] is False, "拒绝无效月份参数")
        finally:
            run.PHOTO_INDEX_DB = original
    print("全部通过 ✓")


if __name__ == "__main__":
    main()
