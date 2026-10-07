#!/usr/bin/env python3
"""家庭影像第二阶段：可续跑的时间、地点与相机元数据分析。"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import json
import os
import re
import shutil
import signal
import sqlite3
import struct
import subprocess
import sys
from pathlib import Path

from photo_index import connect, exclusive_lock, now_ms


IMAGE_METADATA_EXTS = {"jpg", "jpeg", "png", "heic", "heif", "avif", "tif", "tiff", "dng"}
QUICKTIME_EXTS = {"mov", "mp4", "m4v", "3gp"}
QUICKTIME_EPOCH = dt.datetime(1904, 1, 1, tzinfo=dt.timezone.utc)
FULL_DATE_RE = re.compile(
    r"(?<!\d)(20\d{2})[-_.年]?(0[1-9]|1[0-2])[-_.月]?(0[1-9]|[12]\d|3[01])"
    r"(?:[T _-]?([01]\d|2[0-3])[-_.时:]?([0-5]\d)[-_.分:]?([0-5]\d))?",
    re.I,
)
MONTH_RE = re.compile(r"(?<!\d)(20\d{2})[年._-](0?[1-9]|1[0-2])(?:月)?(?!\d)")


class StopFlag:
    requested = False


def _atoms(handle, start: int, end: int):
    """Yield bounded ISO BMFF/QuickTime atoms without reading media payloads."""
    offset = start
    while offset + 8 <= end:
        handle.seek(offset)
        header = handle.read(8)
        if len(header) != 8:
            return
        size, atom_type = struct.unpack(">I4s", header)
        header_size = 8
        if size == 1:
            extended = handle.read(8)
            if len(extended) != 8:
                return
            size = struct.unpack(">Q", extended)[0]
            header_size = 16
        elif size == 0:
            size = end - offset
        if size < header_size or offset + size > end:
            return
        yield atom_type, offset + header_size, offset + size
        offset += size


def quicktime_creation_time(path: Path) -> str | None:
    """Read the movie-header creation time using seeks only.

    This avoids copying large videos over SMB and does not depend on ffprobe.
    Zero, 1970 placeholders and implausible future values are rejected.
    """
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            moov = next(((a, b) for kind, a, b in _atoms(handle, 0, size) if kind == b"moov"), None)
            if not moov:
                return None
            mvhd = next(((a, b) for kind, a, b in _atoms(handle, *moov) if kind == b"mvhd"), None)
            if not mvhd:
                return None
            start, end = mvhd
            handle.seek(start)
            version_flags = handle.read(4)
            if len(version_flags) != 4:
                return None
            if version_flags[0] == 1:
                raw = handle.read(8)
                seconds = struct.unpack(">Q", raw)[0] if len(raw) == 8 else 0
            else:
                raw = handle.read(4)
                seconds = struct.unpack(">I", raw)[0] if len(raw) == 4 else 0
        if not seconds:
            return None
        value = QUICKTIME_EPOCH + dt.timedelta(seconds=seconds)
        current_year = dt.datetime.now(dt.timezone.utc).year
        if value.year < 1990 or value.year > current_year + 1:
            return None
        return value.isoformat()
    except (OSError, OverflowError, struct.error, StopIteration):
        return None


def infer_path_time(rel_path: str, mtime_ns: int) -> tuple[str, str, str]:
    match = FULL_DATE_RE.search(rel_path)
    if match:
        year, month, day = (int(match.group(i)) for i in range(1, 4))
        hour, minute, second = (int(match.group(i) or 0) for i in range(4, 7))
        try:
            return dt.datetime(year, month, day, hour, minute, second).isoformat(), "filename_or_path", "medium"
        except ValueError:
            pass
    match = MONTH_RE.search(rel_path)
    if match:
        return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-01T00:00:00", "folder_month", "low"
    stamp = dt.datetime.fromtimestamp(mtime_ns / 1_000_000_000, tz=dt.timezone.utc)
    return stamp.isoformat(), "filesystem_mtime", "low"


def locate_exifr() -> Path | None:
    project_two = Path(__file__).resolve().parents[1]
    candidates = [
        project_two / "node_modules" / "exifr" / "dist" / "full.umd.cjs",
        Path(__file__).resolve().parent / "vendor" / "exifr.umd.cjs",
    ]
    return next((p for p in candidates if p.is_file()), None)


class ImageWorker:
    def __init__(self):
        node = os.environ.get("HOME_NODE_BINARY") or shutil.which("node")
        exifr = locate_exifr()
        if not node or not exifr:
            raise RuntimeError("缺少本机图片元数据解析器（Node/exifr）")
        env = dict(os.environ)
        if os.environ.get("HOME_NODE_ELECTRON"):
            env["ELECTRON_RUN_AS_NODE"] = "1"
        self.proc = subprocess.Popen(
            [node, str(Path(__file__).with_name("photo_metadata_worker.cjs")), str(exifr)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", bufsize=1, env=env,
        )

    def inspect(self, path: Path) -> dict:
        if self.proc.poll() is not None or self.proc.stdin is None or self.proc.stdout is None:
            raise RuntimeError("图片元数据解析器意外退出")
        self.proc.stdin.write(json.dumps({"path": str(path)}, ensure_ascii=False) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("图片元数据解析器没有返回结果")
        return json.loads(line)

    def close(self) -> None:
        if self.proc.stdin:
            with contextlib.suppress(Exception):
                self.proc.stdin.close()
        with contextlib.suppress(Exception):
            self.proc.terminate()
            self.proc.wait(timeout=2)


def latest_source(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute(
        """SELECT s.* FROM scan_runs r JOIN sources s ON s.id=r.source_id
           WHERE r.status='completed' ORDER BY r.id DESC LIMIT 1"""
    ).fetchone()


def current_summary(conn: sqlite3.Connection, sid: int) -> dict:
    row = conn.execute(
        """SELECT count(*) total,
                  sum(CASE WHEN metadata_status='done' THEN 1 ELSE 0 END) processed,
                  sum(CASE WHEN capture_time_text IS NOT NULL THEN 1 ELSE 0 END) with_time,
                  sum(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) with_gps,
                  sum(CASE WHEN metadata_review_needed=1 THEN 1 ELSE 0 END) needs_review,
                  sum(CASE WHEN metadata_error IS NOT NULL THEN 1 ELSE 0 END) errors
           FROM media_files WHERE source_id=? AND status='active' AND kind IN ('image','video')""",
        (sid,),
    ).fetchone()
    return {key: int(row[key] or 0) for key in ("total", "processed", "with_time", "with_gps", "needs_review", "errors")}


def begin_run(conn: sqlite3.Connection, sid: int) -> int:
    old = conn.execute(
        """SELECT id FROM analysis_runs WHERE source_id=? AND analysis_type='metadata'
           AND status IN ('running','paused','error') ORDER BY id DESC LIMIT 1""",
        (sid,),
    ).fetchone()
    summary = current_summary(conn, sid)
    if old:
        run_id = int(old["id"])
        conn.execute(
            """UPDATE analysis_runs SET status='running',updated_at=?,message=NULL,total=?,processed=?,
               with_time=?,with_gps=?,needs_review=?,errors=? WHERE id=?""",
            (now_ms(), summary["total"], summary["processed"], summary["with_time"], summary["with_gps"],
             summary["needs_review"], summary["errors"], run_id),
        )
    else:
        stamp = now_ms()
        run_id = int(conn.execute(
            """INSERT INTO analysis_runs(source_id,analysis_type,status,started_at,updated_at,total,processed,
               with_time,with_gps,needs_review,errors) VALUES (?,'metadata','running',?,?,?,?,?,?,?,?)""",
            (sid, stamp, stamp, summary["total"], summary["processed"], summary["with_time"],
             summary["with_gps"], summary["needs_review"], summary["errors"]),
        ).lastrowid)
    conn.commit()
    return run_id


def update_run(conn: sqlite3.Connection, run_id: int, sid: int, last_path: str | None = None) -> dict:
    summary = current_summary(conn, sid)
    conn.execute(
        """UPDATE analysis_runs SET updated_at=?,total=?,processed=?,with_time=?,with_gps=?,needs_review=?,
           errors=?,last_path=coalesce(?,last_path) WHERE id=?""",
        (now_ms(), summary["total"], summary["processed"], summary["with_time"], summary["with_gps"],
         summary["needs_review"], summary["errors"], last_path, run_id),
    )
    conn.commit()
    return summary


def analyze(args: argparse.Namespace) -> int:
    db_path = Path(args.db).expanduser()
    stop = StopFlag()
    signal.signal(signal.SIGINT, lambda *_: setattr(stop, "requested", True))
    signal.signal(signal.SIGTERM, lambda *_: setattr(stop, "requested", True))

    with exclusive_lock(db_path), contextlib.closing(connect(db_path)) as conn:
        source = latest_source(conn)
        if not source:
            raise RuntimeError("请先完成文件索引")
        sid, root = int(source["id"]), Path(str(source["root"]))
        if not root.is_dir() or (os.name != "nt" and not os.access(root, os.R_OK)):
            raise RuntimeError(f"共享目录尚未挂载：{root}")
        run_id = begin_run(conn, sid)
        worker = ImageWorker()
        processed_now = 0
        try:
            while not stop.requested:
                row = conn.execute(
                    """SELECT rel_path,extension,kind,mtime_ns FROM media_files
                       WHERE source_id=? AND status='active' AND kind IN ('image','video')
                         AND (metadata_status IS NULL OR metadata_status IN ('pending','error'))
                       ORDER BY CASE kind WHEN 'image' THEN 0 ELSE 1 END, rel_path LIMIT 1""",
                    (sid,),
                ).fetchone()
                if row is None:
                    break
                rel_path = str(row["rel_path"])
                abs_path = root / rel_path
                fallback_time, time_source, confidence = infer_path_time(rel_path, int(row["mtime_ns"]))
                metadata = {}
                error = None
                if str(row["kind"]) == "image" and str(row["extension"]).lower() in IMAGE_METADATA_EXTS:
                    try:
                        metadata = worker.inspect(abs_path)
                        if not metadata.get("ok"):
                            error = str(metadata.get("error") or "没有可读取的图片元数据")
                    except Exception as exc:
                        error = str(exc)
                elif str(row["kind"]) == "video" and str(row["extension"]).lower() in QUICKTIME_EXTS:
                    video_time = quicktime_creation_time(abs_path)
                    if video_time:
                        metadata["capturedAt"] = video_time
                captured_at = metadata.get("capturedAt") or fallback_time
                if metadata.get("capturedAt"):
                    time_source = "video_container" if str(row["kind"]) == "video" else "embedded_metadata"
                    confidence = "high"
                latitude = metadata.get("latitude")
                longitude = metadata.get("longitude")
                has_gps = latitude is not None and longitude is not None
                needs_review = confidence != "high" or not has_gps
                conn.execute(
                    """UPDATE media_files SET metadata_status='done',capture_time_text=?,capture_time_source=?,
                       capture_time_confidence=?,latitude=?,longitude=?,location_source=?,camera_make=?,camera_model=?,
                       pixel_width=?,pixel_height=?,metadata_review_needed=?,metadata_error=?,metadata_updated_at=?
                       WHERE source_id=? AND rel_path=?""",
                    (captured_at, time_source, confidence, latitude, longitude, "embedded_gps" if has_gps else None,
                     metadata.get("make"), metadata.get("model"), metadata.get("width"), metadata.get("height"),
                     1 if needs_review else 0, error, now_ms(), sid, rel_path),
                )
                processed_now += 1
                if processed_now % args.commit_every == 0:
                    conn.commit()
                    summary = update_run(conn, run_id, sid, rel_path)
                    print(json.dumps({"event": "metadata_progress", "runId": run_id, "lastPath": rel_path, **summary}, ensure_ascii=False), flush=True)
                    if not root.is_dir():
                        stop.requested = True
                if args.max_entries and processed_now >= args.max_entries:
                    stop.requested = True

            conn.commit()
            summary = update_run(conn, run_id, sid)
            if stop.requested:
                conn.execute("UPDATE analysis_runs SET status='paused',updated_at=?,message=? WHERE id=?",
                             (now_ms(), "用户暂停、共享盘断开或达到本次上限", run_id))
                event = "metadata_paused"
            else:
                stamp = now_ms()
                conn.execute("UPDATE analysis_runs SET status='completed',finished_at=?,updated_at=?,message=NULL WHERE id=?",
                             (stamp, stamp, run_id))
                event = "metadata_completed"
            conn.commit()
            print(json.dumps({"event": event, "runId": run_id, **summary}, ensure_ascii=False), flush=True)
            return 0
        finally:
            worker.close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="家庭影像时间与地点元数据分析")
    parser.add_argument("--db", required=True)
    parser.add_argument("--commit-every", type=int, default=25)
    parser.add_argument("--max-entries", type=int, default=0)
    return parser


if __name__ == "__main__":
    try:
        raise SystemExit(analyze(build_parser().parse_args()))
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
