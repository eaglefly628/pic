import sys as _version_sys
from pathlib import Path as _VersionPath
_version_sys.path.insert(0,str(_VersionPath(__file__).resolve().parent))
from backup_versions import next_versions, valid as valid_backup_versions
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
我家里的一切 — 统一入口
--------------------------------------------------------------------------
一个端口、一个入口；顶部菜单进入「家庭理财 / 家庭影像 / 家庭密码 / 开发世界」等应用。
各应用仍是独立项目（project-one … project-four），此入口按路径加载它们的 dist：

    /            -> hub/index.html（入口页）
    /finance/*   -> project-one/dist（家庭理财）
    /gallery/*   -> project-two/dist（家庭影像）
    /vault/*     -> project-three/dist（家庭密码）
    /dev/*       -> project-four/dist（男主的开发世界）

直接运行：  python run.py     （或双击 start.bat）
业务数据保存在本机；影像索引可按用户操作备份到已挂载的家庭存储，不上传互联网。按 Ctrl+C 退出。
"""
import csv
import base64
import contextlib
import datetime
import hashlib
import http.server
import io
import json
import math
import mimetypes
import os
import re
import signal
import shutil
import socketserver
import sqlite3
import stat
import string
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
import webbrowser
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HUB = ROOT / "hub" / "index.html"
MOUNTS = {
    "/finance": (ROOT / "project-one" / "dist"),
    "/gallery": (ROOT / "project-two" / "dist"),
    "/vault": (ROOT / "project-three" / "dist"),
    "/dev": (ROOT / "project-four" / "dist"),
}
PORT = int(os.environ.get("HOME_PORT") or 5180)
BACKUP_KEEP = 40   # 磁盘上保留的历史备份份数（轮转）


def app_version() -> str:
    """版本号单一真源：根目录 VERSION 文件。改版本只改这一处，各处读取它。"""
    try:
        v = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        return v or "0.0.0"
    except Exception:
        return "0.0.0"


def data_dir() -> Path:
    """本机稳定数据目录——跨版本升级不变（这样新版本能读到旧版本的数据，兼容往前）。
    macOS: ~/Library/Application Support/我家里的一切
    Windows: %APPDATA%/我家里的一切     Linux: ~/.local/share/我家里的一切
    取不到系统目录时退回项目内 .home-data。
    HOME_DATA_DIR 环境变量可以强制指定目录（测试脚本用，避免碰到真实数据）。"""
    forced = os.environ.get("HOME_DATA_DIR")
    if forced:
        d = Path(forced)
        (d / "backups").mkdir(parents=True, exist_ok=True)
        return d
    home = Path.home()
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA") or (home / "AppData" / "Roaming"))
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or (home / ".local" / "share"))
    d = base / "我家里的一切"
    try:
        (d / "backups").mkdir(parents=True, exist_ok=True)
        return d
    except Exception:
        d = ROOT / ".home-data"
        (d / "backups").mkdir(parents=True, exist_ok=True)
        return d


def app_channel() -> str:
    """发布版 / 开发版分开：
    - 打成 .app 安装后（Resources/payload，没有 .git）→ release「发布版」
    - 在仓库里直接跑（python run.py / npm start，有 .git）→ dev「开发版」
    Electron 会用 HOME_CHANNEL 明确指定；直接跑时按有没有 .git 自动判断。"""
    env = os.environ.get("HOME_CHANNEL")
    if env in ("dev", "release"):
        return env
    return "dev" if (ROOT / ".git").exists() else "release"


APP_VERSION = app_version()
APP_CHANNEL = app_channel()
APP_LABEL = APP_VERSION + ("-dev" if APP_CHANNEL == "dev" else "")   # 开发版带 -dev 后缀，一眼区分
# 数据结构版本：改动数据形状（加/改字段）时 +1。配套的兼容规矩：
#   ① 存盘时打上这个版本号；
#   ② 新版写的数据，老版能「只读打开」查看（不认识的新字段忽略、不删）；
#   ③ 老版保存时，服务端拒绝用较低版本覆盖磁盘上更高版本的数据（护栏，见 backup_save）。
# 这样开发版 / 安装版即使一时新旧不一，也只会「后者只读、不互相写坏」。
DATA_VERSION = 7
# 写盘协议和数据结构版本分开：前者保证客户端带有并发基线，后者保护数据形状。
# 老安装版不会发送 syncProtocol；它的写入会被保留成冲突副本，但不能覆盖 current.home。
SYNC_PROTOCOL = 3
DATA_DIR = data_dir()

# 家庭影像的大型 Samba 目录索引保存在本机，不把工作中的 SQLite 放到网络盘上，避免
# 掉线或 SMB 文件锁导致数据库损坏。扫描/分析只读；整理必须先预演，再走独立可续跑流程。
PHOTO_INDEX_DB = DATA_DIR / "photo-index.sqlite3"
PHOTO_INDEX_LOG = DATA_DIR / "photo-index.log"
PHOTO_INDEX_SCRIPT = ROOT / "project-two" / "scripts" / "photo_index.py"
PHOTO_SELECTED_INDEX_SCRIPT = ROOT / "project-two" / "scripts" / "scan_selected_backup_dirs.py"
PHOTO_METADATA_SCRIPT = ROOT / "project-two" / "scripts" / "photo_metadata.py"
PHOTO_METADATA_LOG = DATA_DIR / "photo-metadata.log"
PHOTO_ORGANIZE_SCRIPT = ROOT / "project-two" / "scripts" / "photo_organize.py"
PHOTO_REVIEW_ORGANIZE_SCRIPT = ROOT / "project-two" / "scripts" / "photo_review_organize.py"
PHOTO_ORGANIZE_LOG = DATA_DIR / "photo-organize.log"
PHOTO_ORGANIZE_PROFILE = DATA_DIR / "photo-organize-profile.jsonl"
PHOTO_DUPLICATE_REPORTS = DATA_DIR / "reports"
PHOTO_HANDOFF_SCRIPT = ROOT / "project-two" / "scripts" / "photo_handoff.py"
PHOTO_HANDOFF_DIR_NAME = "我家里的一切-接力"
if os.environ.get("HOME_PHOTO_SOURCE"):
    PHOTO_DEFAULT_SOURCE = Path(os.environ["HOME_PHOTO_SOURCE"])
elif os.name == "nt":
    PHOTO_DEFAULT_SOURCE = Path("Z:/")
elif sys.platform == "darwin":
    PHOTO_DEFAULT_SOURCE = Path("/Volumes/PHOTO_LIBRARY")
else:
    PHOTO_DEFAULT_SOURCE = Path("/mnt/PHOTO_LIBRARY")
_PHOTO_SCAN_LOCK = threading.Lock()
_PHOTO_SCAN_PROC = None
_PHOTO_SCAN_LOG_HANDLE = None
_PHOTO_METADATA_LOCK = threading.Lock()
_PHOTO_METADATA_PROC = None
_PHOTO_METADATA_LOG_HANDLE = None
_PHOTO_ORGANIZE_LOCK = threading.Lock()
_PHOTO_ORGANIZE_PROC = None
_PHOTO_ORGANIZE_LOG_HANDLE = None
_PHOTO_ORGANIZE_PROFILE_LOCK = threading.Lock()
_PHOTO_ORGANIZE_PROFILE_CACHE = {"identity": None, "offset": 0, "runs": {}}


def _photo_source_path(value=None):
    """只允许扫描系统已确认的网络盘/外部挂载，避免网页枚举任意目录。"""
    readable = [item for item in photo_sources() if item["readable"]]
    raw = str(value or (readable[0]["path"] if readable else PHOTO_DEFAULT_SOURCE)).strip()
    if not raw:
        raise ValueError("请选择已挂载的 Samba 目录")
    source = Path(raw).expanduser().absolute() if os.name == "nt" else Path(raw).expanduser().resolve()
    if sys.platform == "darwin":
        volumes = Path("/Volumes").resolve()
        try:
            source.relative_to(volumes)
        except ValueError as exc:
            raise ValueError("只允许扫描 /Volumes 下已挂载的外部或网络目录") from exc
        allowed = source != volumes
    else:
        source_key = os.path.normcase(os.path.abspath(str(source)))
        allowed = any(os.path.normcase(os.path.abspath(item["path"])) == source_key for item in readable)
    if not allowed or not source.is_dir() or (os.name != "nt" and not os.access(source, os.R_OK)):
        raise ValueError(f"目录不可读或尚未挂载：{source}")
    return source


def _indexed_photo_roots():
    if not PHOTO_INDEX_DB.is_file():
        return []
    try:
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=2) as conn:
            return [str(row[0]) for row in conn.execute("SELECT root FROM sources ORDER BY last_seen_at DESC")]
    except (OSError, sqlite3.Error):
        return []


def photo_sources():
    """列出当前可供只读索引的网络盘/挂载卷，不递归读取其中内容。"""
    found = []
    candidates = [Path(value) for value in _indexed_photo_roots()]
    if sys.platform == "darwin":
        volumes = Path("/Volumes")
        try:
            candidates.extend(sorted(volumes.iterdir(), key=lambda p: p.name.casefold()))
        except OSError:
            pass
    elif os.name == "nt":
        try:
            import ctypes
            candidates.extend(Path(f"{letter}:/") for letter in string.ascii_uppercase
                              if ctypes.windll.kernel32.GetDriveTypeW(f"{letter}:\\") == 4)
        except Exception:
            pass
    configured = os.environ.get("HOME_PHOTO_SOURCE")
    if configured:
        candidates.insert(0, Path(configured))
    seen = set()
    for candidate in candidates:
        raw_key = os.path.normcase(os.path.abspath(str(candidate)))
        if raw_key in seen:
            continue
        seen.add(raw_key)
        try:
            exists = candidate.is_dir()
            if os.name == "nt":
                resolved = candidate.absolute()
            else:
                resolved = candidate.resolve() if exists else candidate
            if sys.platform == "darwin" and candidate.name == "Macintosh HD":
                continue
            readable = exists and os.access(resolved, os.R_OK)
            if exists and os.name == "nt":
                # Windows SMB mappings can report false from os.access; ask the
                # directory itself whether its entries can be enumerated.
                try:
                    with os.scandir(resolved) as entries:
                        next(entries, None)
                    readable = True
                except OSError:
                    readable = False
            found.append({
                "name": candidate.name or candidate.anchor or str(candidate),
                "path": str(resolved),
                "readable": readable,
                "writable": exists and os.access(resolved, os.W_OK),
            })
        except OSError:
            found.append({"name": candidate.name or str(candidate), "path": str(candidate),
                          "readable": False, "writable": False})
    return found


def photo_backup_directories(spec=None):
    """发现 S300 顶层备份目录；不递归读取原片，也不猜测嵌套目录是否有新文件。"""
    source = _photo_source_path((spec or {}).get("source"))
    counts = {}
    if PHOTO_INDEX_DB.is_file():
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=3) as conn:
            row = conn.execute("SELECT id FROM sources WHERE root=?", (str(source),)).fetchone()
            if row:
                counts = {str(name): (int(images or 0), int(videos or 0)) for name, images, videos in conn.execute(
                    """SELECT substr(rel_path,1,instr(rel_path,'/')-1) top_dir,
                              sum(CASE WHEN kind='image' THEN 1 ELSE 0 END),
                              sum(CASE WHEN kind='video' THEN 1 ELSE 0 END)
                       FROM media_files WHERE source_id=? AND status='active'
                         AND kind IN ('image','video') AND instr(rel_path,'/')>0
                       GROUP BY top_dir""", (int(row[0]),)
                )}
    directories = []
    with os.scandir(source) as entries:
        for entry in entries:
            if ("备份" not in entry.name or entry.name.startswith(".") or entry.is_symlink()
                    or entry.name in {"我家里的一切-索引备份", "我家里的一切-接力"}):
                continue
            try:
                if not entry.is_dir(follow_symlinks=False):
                    continue
                with os.scandir(entry.path):
                    pass
                readable = True
            except OSError:
                readable = False
            images, videos = counts.get(entry.name, (0, 0))
            directories.append({"name": entry.name, "relPath": entry.name,
                                "readable": readable, "indexedImages": images, "indexedVideos": videos})
    directories.sort(key=lambda item: item["name"].casefold())
    return {"ok": True, "source": str(source), "directories": directories}


def _photo_process_alive():
    global _PHOTO_SCAN_PROC, _PHOTO_SCAN_LOG_HANDLE
    with _PHOTO_SCAN_LOCK:
        alive = _PHOTO_SCAN_PROC is not None and _PHOTO_SCAN_PROC.poll() is None
        if _PHOTO_SCAN_PROC is not None and not alive:
            _PHOTO_SCAN_PROC = None
            if _PHOTO_SCAN_LOG_HANDLE is not None:
                try:
                    _PHOTO_SCAN_LOG_HANDLE.close()
                except Exception:
                    pass
                _PHOTO_SCAN_LOG_HANDLE = None
        return alive


def _photo_metadata_process_alive():
    global _PHOTO_METADATA_PROC, _PHOTO_METADATA_LOG_HANDLE
    with _PHOTO_METADATA_LOCK:
        alive = _PHOTO_METADATA_PROC is not None and _PHOTO_METADATA_PROC.poll() is None
        if _PHOTO_METADATA_PROC is not None and not alive:
            _PHOTO_METADATA_PROC = None
            if _PHOTO_METADATA_LOG_HANDLE is not None:
                with contextlib.suppress(Exception):
                    _PHOTO_METADATA_LOG_HANDLE.close()
                _PHOTO_METADATA_LOG_HANDLE = None
        return alive


def _photo_organize_process_alive():
    global _PHOTO_ORGANIZE_PROC, _PHOTO_ORGANIZE_LOG_HANDLE
    with _PHOTO_ORGANIZE_LOCK:
        alive = _PHOTO_ORGANIZE_PROC is not None and _PHOTO_ORGANIZE_PROC.poll() is None
        if _PHOTO_ORGANIZE_PROC is not None and not alive:
            _PHOTO_ORGANIZE_PROC = None
            if _PHOTO_ORGANIZE_LOG_HANDLE is not None:
                with contextlib.suppress(Exception):
                    _PHOTO_ORGANIZE_LOG_HANDLE.close()
                _PHOTO_ORGANIZE_LOG_HANDLE = None
        return alive


def _photo_organize_profile_summary(run_id):
    """Incrementally total completed batches; paused/offline time is not counted."""
    with _PHOTO_ORGANIZE_PROFILE_LOCK:
        try:
            stat = PHOTO_ORGANIZE_PROFILE.stat()
            identity = (str(PHOTO_ORGANIZE_PROFILE), stat.st_dev, stat.st_ino)
            cache = _PHOTO_ORGANIZE_PROFILE_CACHE
            if cache["identity"] != identity or stat.st_size < cache["offset"]:
                cache.update(identity=identity, offset=0, runs={})
            with PHOTO_ORGANIZE_PROFILE.open("rb") as handle:
                handle.seek(cache["offset"])
                while True:
                    line = handle.readline()
                    if not line or not line.endswith(b"\n"):
                        break  # An unfinished append will be read on the next poll.
                    cache["offset"] = handle.tell()
                    try:
                        entry = json.loads(line)
                        entry_run = int(entry["runId"])
                        succeeded = int(entry["succeeded"])
                        wall_ms = float(entry["batchWallMs"])
                        if succeeded < 0 or not math.isfinite(wall_ms) or wall_ms <= 0:
                            continue
                    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
                        continue
                    totals = cache["runs"].setdefault(entry_run, {"files": 0, "wallMs": 0.0, "batches": 0})
                    totals["files"] += succeeded
                    totals["wallMs"] += wall_ms
                    totals["batches"] += 1
            return dict(cache["runs"].get(run_id, {"files": 0, "wallMs": 0.0, "batches": 0}))
        except OSError:
            return {"files": 0, "wallMs": 0.0, "batches": 0}


def photo_organize_status():
    """返回最新整理预演/执行状态，不访问原始媒体内容。"""
    empty = {"ok": True, "status": "not_started", "processAlive": _photo_organize_process_alive()}
    if not PHOTO_INDEX_DB.is_file():
        return empty
    try:
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=3) as conn:
            conn.row_factory = sqlite3.Row
            if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='organize_runs'").fetchone():
                return empty
            row = conn.execute("SELECT * FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
            if not row:
                return empty
            status = str(row["status"])
            alive = _photo_organize_process_alive()
            if status == "running" and not alive:
                status = "paused"
            examples = conn.execute(
                """SELECT source_rel AS sourceRel,target_rel AS targetRel,status,error
                   FROM organize_entries WHERE run_id=?
                   ORDER BY CASE status WHEN 'error' THEN 0 WHEN 'planned' THEN 1 WHEN 'moving' THEN 2
                                        WHEN 'verified' THEN 3 ELSE 4 END,
                            source_rel COLLATE NOCASE LIMIT 8""",
                (int(row["id"]),),
            ).fetchall()
            review_phase = None
            if row["layout"] == "review_month_year":
                review_phase = {name: {"total": 0, "verified": 0}
                                for name in ("month", "yearOnly", "unclassified")}
                buckets = conn.execute(
                    """SELECT CASE WHEN instr(target_rel,'/未能归档，未归类/')>0 THEN 'unclassified'
                                 WHEN instr(target_rel,'/_仅确定年份/')>0 THEN 'yearOnly'
                                 ELSE 'month' END AS bucket,
                              count(*) AS total,
                              sum(CASE WHEN status='verified' THEN 1 ELSE 0 END) AS verified
                       FROM organize_entries WHERE run_id=? GROUP BY bucket""",
                    (int(row["id"]),),
                ).fetchall()
                for bucket in buckets:
                    review_phase[str(bucket["bucket"])] = {
                        "total": int(bucket["total"]), "verified": int(bucket["verified"] or 0)
                    }
            profile = _photo_organize_profile_summary(int(row["id"]))
            average_rate = profile["files"] * 1000 / profile["wallMs"] if profile["wallMs"] > 0 else 0
            remaining = max(0, int(row["total"] or 0) - int(row["verified"] or 0))
            return {
                "ok": True, "runId": int(row["id"]), "status": status, "processAlive": alive,
                "sourceRoot": row["source_root"], "targetRoot": row["target_root"],
                "layout": row["layout"] if "layout" in row.keys() else "day",
                "profileLog": str(PHOTO_ORGANIZE_PROFILE),
                "averageRate": round(average_rate, 3),
                "estimatedRemainingSeconds": round(remaining / average_rate) if average_rate > 0 else None,
                "profileBatches": profile["batches"],
                "total": int(row["total"] or 0), "moved": int(row["moved"] or 0),
                "verified": int(row["verified"] or 0), "errors": int(row["errors"] or 0),
                "bytesTotal": int(row["bytes_total"] or 0), "bytesMoved": int(row["bytes_moved"] or 0),
                "reliable": int(row["reliable"] or 0), "needsReview": int(row["needs_review"] or 0),
                "lastPath": row["last_path"], "message": row["message"],
                "reviewPhase": review_phase,
                "examples": [dict(item) for item in examples],
            }
    except (OSError, sqlite3.Error) as exc:
        return {**empty, "ok": False, "status": "error", "error": f"无法读取整理任务：{exc}"}


def photo_duplicate_status():
    """只读查询按月重复检测的进度，不返回媒体路径。"""
    work_files = sorted(PHOTO_DUPLICATE_REPORTS.glob("photo-duplicates-monthly-*.sqlite3"))
    if not work_files:
        return {"ok": True, "status": "not_started"}
    work_db = work_files[-1]
    report = work_db.with_suffix(".json")
    pid_file = work_db.with_suffix(".pid")
    alive = False
    try:
        pid = int(pid_file.read_text(encoding="ascii").strip())
        os.kill(pid, 0)
        alive = True
    except (OSError, ValueError):
        pass
    try:
        uri = work_db.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=2) as conn:
            rows = conn.execute(
                """SELECT bucket,count(*),sum(probe_status='done'),
                   sum(full_status IN ('done','skipped')),
                   sum(probe_status='error' OR full_status='error')
                   FROM items GROUP BY bucket ORDER BY bucket"""
            ).fetchall()
            confirmed = conn.execute(
                """SELECT count(*),coalesce(sum(n-1),0),coalesce(sum((n-1)*size),0)
                   FROM (SELECT bucket,size,full_hash,count(*) AS n FROM items
                         WHERE full_status='done'
                         GROUP BY bucket,size,full_hash HAVING n>1)"""
            ).fetchone()
        months = len(rows)
        completed = sum(probed == total and finished == total for _, total, probed, finished, _ in rows)
        current = next(((bucket, total, probed, finished) for bucket, total, probed, finished, _ in rows
                        if probed != total or finished != total), None)
        current_month = None
        if current:
            bucket, total, probed, finished = current
            current_month = {"month": bucket.rsplit("/", 1)[-1], "total": total,
                             "percent": round(100 * (probed + finished) / (2 * total), 1)}
        errors = sum(row[4] for row in rows)
        overall_month_percent = round(
            100 * sum((probed + finished) / (2 * total)
                      for _, total, probed, finished, _ in rows) / months, 1
        ) if months else 100
        result = {"ok": True, "status": "completed" if report.is_file() else
                  "running" if alive else "error" if errors else "paused",
                  "processAlive": alive, "months": months, "completedMonths": completed,
                  "monthPercent": overall_month_percent,
                  "currentMonth": current_month, "errors": errors,
                  "candidates": sum(row[1] for row in rows),
                  "confirmedGroups": int(confirmed[0]),
                  "confirmedDuplicateFiles": int(confirmed[1]),
                  "potentialReclaimBytes": int(confirmed[2])}
        return result
    except (OSError, sqlite3.Error) as exc:
        return {"ok": False, "status": "error", "error": f"无法读取重复检测进度：{exc}"}


def photo_duplicate_cleanup_status():
    """只读查询完全重复副本清理的持久化进度，不返回媒体路径。"""
    plan_files = sorted(PHOTO_DUPLICATE_REPORTS.glob("photo-duplicate-cleanup-*.sqlite3"))
    if not plan_files:
        return {"ok": True, "status": "not_started"}
    plan_db = plan_files[-1]
    pid_file = plan_db.with_suffix(".pid")
    alive = False
    try:
        pid = int(pid_file.read_text(encoding="ascii").strip())
        os.kill(pid, 0)
        alive = True
    except (OSError, ValueError):
        pass
    try:
        uri = plan_db.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=2) as conn:
            rows = conn.execute(
                "SELECT status,count(*),coalesce(sum(size),0) FROM actions GROUP BY status"
            ).fetchall()
        counts = {name: (int(number), int(size)) for name, number, size in rows}
        total = sum(number for number, _ in counts.values())
        total_bytes = sum(size for _, size in counts.values())
        deleted, deleted_bytes = counts.get("deleted", (0, 0))
        skipped, _ = counts.get("skipped_hardlink", (0, 0))
        planned, _ = counts.get("planned", (0, 0))
        errors, _ = counts.get("error", (0, 0))
        finished = deleted + skipped
        status = ("completed" if total and not planned and not errors else
                  "running" if alive else "error" if errors else "paused")
        return {"ok": True, "status": status, "processAlive": alive,
                "total": total, "deleted": deleted, "skippedHardlink": skipped,
                "remaining": planned, "errors": errors,
                "percent": round(100 * finished / total, 1) if total else 0,
                "deletedBytes": deleted_bytes, "totalBytes": total_bytes}
    except (OSError, sqlite3.Error) as exc:
        return {"ok": False, "status": "error", "error": f"无法读取清理进度：{exc}"}


def photo_index_status():
    """返回索引数据库的唯一文件计数；避免暂停重试导致进度累计值重复。"""
    alive = _photo_process_alive()
    metadata_alive = _photo_metadata_process_alive()
    base = {
        "ok": True,
        "status": "not_started",
        "processAlive": alive,
        "db": str(PHOTO_INDEX_DB),
        "sources": photo_sources(),
        "defaultSource": str(PHOTO_DEFAULT_SOURCE),
        "platform": "windows" if os.name == "nt" else "mac" if sys.platform == "darwin" else "linux",
        "readOnly": True,
    }
    if not PHOTO_INDEX_DB.is_file():
        return base
    try:
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=3) as conn:
            conn.row_factory = sqlite3.Row
            run = conn.execute(
                """SELECT r.*,s.root,s.label FROM scan_runs r JOIN sources s ON s.id=r.source_id
                   ORDER BY r.id DESC LIMIT 1"""
            ).fetchone()
            if not run:
                return base
            run_id, sid = int(run["id"]), int(run["source_id"])
            totals = conn.execute(
                """SELECT kind,count(*) files,coalesce(sum(size),0) bytes
                   FROM media_files WHERE source_id=? AND status='active' GROUP BY kind""",
                (sid,),
            ).fetchall()
            hints = conn.execute(
                """SELECT classification_hint,count(*) files,coalesce(sum(size),0) bytes
                   FROM media_files WHERE source_id=? AND status='active' AND classification_hint IS NOT NULL
                   GROUP BY classification_hint""",
                (sid,),
            ).fetchall()
            dirs = conn.execute(
                "SELECT status,count(*) n FROM directories WHERE run_id=? GROUP BY status", (run_id,)
            ).fetchall()
            indexed_this_run = conn.execute(
                "SELECT count(*) files FROM media_files WHERE source_id=? AND last_seen_run=?",
                (sid, run_id),
            ).fetchone()["files"]
            new_in_run = {str(r["kind"]): int(r["files"]) for r in conn.execute(
                """SELECT kind,count(*) files FROM media_files
                   WHERE source_id=? AND first_seen_run=? AND status='active'
                     AND kind IN ('image','video') GROUP BY kind""", (sid, run_id)
            )}
            pending_work = conn.execute(
                """SELECT sum(CASE WHEN kind IN ('image','video') AND metadata_status IS NOT 'done' THEN 1 ELSE 0 END) metadata_pending,
                          sum(CASE WHEN kind IN ('image','video') AND rel_path NOT LIKE '家庭影像库/%' THEN 1 ELSE 0 END) unarchived_media
                   FROM media_files WHERE source_id=? AND status='active'""", (sid,),
            ).fetchone()
            selected_scope = []
            if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='selected_scan_scopes'").fetchone():
                scope_row = conn.execute("SELECT roots_json FROM selected_scan_scopes WHERE run_id=?", (run_id,)).fetchone()
                if scope_row:
                    selected_scope = json.loads(scope_row["roots_json"])
            if not selected_scope and str(run["message"] or "").startswith(("仅扫描：", "指定备份目录扫描完成")):
                selected_scope = [str(r[0]) for r in conn.execute(
                    "SELECT rel_path FROM directories WHERE run_id=? AND instr(rel_path,'/')=0 ORDER BY rel_path",
                    (run_id,),
                )]
            top = conn.execute(
                """SELECT CASE instr(rel_path,'/') WHEN 0 THEN '(根目录)'
                          ELSE substr(rel_path,1,instr(rel_path,'/')-1) END topDir,
                          count(*) files,
                          sum(CASE WHEN kind IN ('image','video') THEN 1 ELSE 0 END) media,
                          coalesce(sum(size),0) bytes
                   FROM media_files WHERE source_id=? AND status='active'
                   GROUP BY topDir ORDER BY media DESC,files DESC LIMIT 12""",
                (sid,),
            ).fetchall()
            extensions = conn.execute(
                """SELECT CASE WHEN extension='' THEN '(无扩展名)' ELSE upper(extension) END extension,
                          kind,count(*) files,coalesce(sum(size),0) bytes
                   FROM media_files WHERE source_id=? AND status='active' AND kind IN ('image','video')
                   GROUP BY kind,extension ORDER BY files DESC LIMIT 16""",
                (sid,),
            ).fetchall()
            skipped = conn.execute(
                """SELECT rel_path,last_error FROM directories
                   WHERE run_id=? AND status='skipped' ORDER BY rel_path""",
                (run_id,),
            ).fetchall()
            media_total = sum(int(r["files"]) for r in totals if str(r["kind"]) in ("image", "video"))
            metadata_analysis = {
                "status": "running" if metadata_alive else "not_started",
                "processAlive": metadata_alive,
                "total": media_total,
                "processed": 0,
                "withTime": 0,
                "withGps": 0,
                "needsReview": 0,
                "errors": 0,
            }
            has_analysis = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='analysis_runs'"
            ).fetchone()
            if has_analysis:
                analysis = conn.execute(
                    """SELECT * FROM analysis_runs WHERE source_id=? AND analysis_type='metadata'
                       ORDER BY id DESC LIMIT 1""",
                    (sid,),
                ).fetchone()
                if analysis:
                    analysis_status = str(analysis["status"])
                    if analysis_status == "running" and not metadata_alive:
                        analysis_status = "paused"
                    metadata_analysis.update({
                        "status": analysis_status,
                        "processAlive": metadata_alive,
                        "runId": int(analysis["id"]),
                        "total": int(analysis["total"]),
                        "processed": int(analysis["processed"]),
                        "withTime": int(analysis["with_time"]),
                        "withGps": int(analysis["with_gps"]),
                        "needsReview": int(analysis["needs_review"]),
                        "errors": int(analysis["errors"]),
                        "lastPath": analysis["last_path"],
                        "message": analysis["message"],
                    })
        raw_status = str(run["status"])
        interrupted = raw_status == "running" and not alive
        base.update({
            "status": "paused" if interrupted else raw_status,
            "interrupted": interrupted,
            "runId": run_id,
            "source": str(run["root"]),
            "startedAt": run["started_at"],
            "finishedAt": run["finished_at"],
            "updatedAt": run["updated_at"],
            "indexedThisRun": indexed_this_run,
            "newInRun": new_in_run,
            "metadataPending": int(pending_work["metadata_pending"] or 0),
            "unarchivedMedia": int(pending_work["unarchived_media"] or 0),
            "scanMode": "selected" if selected_scope else "full",
            "selectedDirectories": selected_scope,
            "errors": int(run["errors"]),
            "lastPath": run["last_path"],
            "message": ("上次扫描意外中断，可以安全续跑" if interrupted else run["message"]),
            "totals": {str(r["kind"]): {"files": int(r["files"]), "bytes": int(r["bytes"])} for r in totals},
            "hints": {str(r["classification_hint"]): {"files": int(r["files"]), "bytes": int(r["bytes"])} for r in hints},
            "directories": {str(r["status"]): int(r["n"]) for r in dirs},
            "topDirectories": [dict(r) for r in top],
            "extensions": [dict(r) for r in extensions],
            "skippedDirectories": [dict(r) for r in skipped],
            "dbBytes": PHOTO_INDEX_DB.stat().st_size if PHOTO_INDEX_DB.is_file() else 0,
            "metadataAnalysis": metadata_analysis,
        })
        return base
    except (OSError, sqlite3.Error) as exc:
        base.update({"ok": False, "status": "error", "error": f"无法读取照片索引：{exc}"})
        return base


def photo_index_files(params):
    """分页浏览本机照片索引；只返回元数据，不读取或传输媒体内容。"""
    if not PHOTO_INDEX_DB.is_file():
        return {"ok": True, "total": 0, "items": []}
    try:
        limit = min(200, max(1, int((params.get("limit") or ["100"])[0])))
        offset = max(0, int((params.get("offset") or ["0"])[0]))
    except ValueError:
        limit, offset = 100, 0
    kind = str((params.get("kind") or [""])[0]).lower()
    if kind not in ("image", "video", "sidecar", "other"):
        kind = ""
    query = str((params.get("q") or [""])[0]).strip()[:100]
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    try:
        with sqlite3.connect(uri, uri=True, timeout=3) as conn:
            conn.row_factory = sqlite3.Row
            source = conn.execute("SELECT source_id FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()
            if not source:
                return {"ok": True, "total": 0, "items": []}
            where = ["source_id=?", "status='active'"]
            values = [int(source["source_id"])]
            if kind:
                where.append("kind=?")
                values.append(kind)
            if query:
                escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                where.append("rel_path LIKE ? ESCAPE '\\'")
                values.append(f"%{escaped}%")
            clause = " AND ".join(where)
            total = int(conn.execute(f"SELECT count(*) n FROM media_files WHERE {clause}", values).fetchone()["n"])
            rows = conn.execute(
                f"""SELECT rel_path AS relPath,name,kind,extension,size,mtime_ns AS mtimeNs,
                            classification_hint AS classificationHint,status
                     FROM media_files WHERE {clause}
                     ORDER BY rel_path COLLATE NOCASE LIMIT ? OFFSET ?""",
                [*values, limit, offset],
            ).fetchall()
        return {"ok": True, "total": total, "offset": offset, "limit": limit, "items": [dict(r) for r in rows]}
    except (OSError, sqlite3.Error) as exc:
        return {"ok": False, "error": f"无法读取索引记录：{exc}", "total": 0, "items": []}


def _photo_browse_source(conn):
    row = conn.execute("SELECT source_id FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()
    return int(row[0]) if row else None


def _photo_offline_place_names(conn):
    exists = conn.execute("""SELECT 1 FROM sqlite_master WHERE type='table'
                          AND name='photo_place_labels'""").fetchone()
    if not exists:
        return {}
    return {key: (label, source) for key, label, source in conn.execute(
        "SELECT key,label,source FROM photo_place_labels WHERE key LIKE 'approx:%'")}


def _photo_place_display(names, lat, lng):
    found = names.get(f"approx:{lat:.1f},{lng:.1f}")
    if not found:
        return "地点待命名"
    label, source = found
    return f"附近：{label}" if source == "geonames-city" else label


def photo_address_labels():
    """Read locally saved place names; this endpoint never contacts a map provider."""
    if not PHOTO_INDEX_DB.is_file():
        return {"ok": True, "labels": {}}
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as conn:
        exists = conn.execute("""SELECT 1 FROM sqlite_master WHERE type='table'
                              AND name='photo_place_labels'""").fetchone()
        if not exists:
            return {"ok": True, "labels": {}}
        labels = {key: {"label": label, "source": source, "distanceKm": distance}
                  for key, label, source, distance in conn.execute(
                      "SELECT key,label,source,distance_km FROM photo_place_labels")}
    return {"ok": True, "labels": labels}


def photo_address_save(spec):
    """Keep a user-requested reverse-geocoding result in the photo index."""
    lat = float(spec.get("latitude"))
    lng = float(spec.get("longitude"))
    approximate = spec.get("approximate") is True
    label = str(spec.get("label") or "").strip()
    if not (-90 <= lat <= 90 and -180 <= lng <= 180 and
            math.isfinite(lat) and math.isfinite(lng)):
        raise ValueError("坐标无效")
    if not label or len(label) > 240:
        raise ValueError("地址名称无效")
    key = (f"approx:{lat:.1f},{lng:.1f}" if approximate
           else f"exact:{lat:.5f},{lng:.5f}")
    with sqlite3.connect(PHOTO_INDEX_DB, timeout=10) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS photo_place_labels (
            key TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL,
            label TEXT NOT NULL, source TEXT NOT NULL, distance_km REAL,
            updated_at TEXT NOT NULL)""")
        conn.execute("""INSERT INTO photo_place_labels
            (key,latitude,longitude,label,source,distance_km,updated_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET
              label=excluded.label, source=excluded.source,
              distance_km=NULL, updated_at=excluded.updated_at""",
            (key, lat, lng, label, "nominatim-manual", None,
             datetime.datetime.now(datetime.timezone.utc).isoformat()))
    return {"ok": True, "key": key}


def photo_browse_summary():
    """只读聚合家庭影像库的实际目录、GPS 和可确认日期。"""
    empty = {"ok": True, "total": 0, "months": [], "yearOnly": [], "unclassified": 0,
             "places": [], "gpsTotal": 0, "events": [], "datedTotal": 0, "peopleIndexed": 0,
             "screenshotNameHints": 0, "screenRecordingNameHints": 0}
    if not PHOTO_INDEX_DB.is_file():
        return empty
    try:
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=5) as conn:
            sid = _photo_browse_source(conn)
            if sid is None:
                return empty
            rows = conn.execute(
                """SELECT rel_path,kind,size,capture_time_text,capture_time_source,
                          metadata_review_needed,latitude,longitude
                   FROM media_files WHERE source_id=? AND status='active'
                     AND kind IN ('image','video')""", (sid,)
            )
            months, years, events = {}, {}, {}
            total = unclassified = gps_total = dated_total = 0
            for path, kind, size, captured, source, review, lat, lng in rows:
                total += 1
                parts = path.split("/")
                if len(parts) >= 4 and re.fullmatch(r"\d{4}", parts[1]) and parts[2] == "_仅确定年份":
                    years[parts[1]] = years.get(parts[1], 0) + 1
                elif len(parts) >= 4 and re.fullmatch(r"\d{4}", parts[1]) and re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])", parts[2]) and parts[2][:4] == parts[1]:
                    month = parts[2]
                    current = months.setdefault(month, {"period": month, "files": 0, "images": 0, "videos": 0, "bytes": 0})
                    current["files"] += 1
                    current["images" if kind == "image" else "videos"] += 1
                    current["bytes"] += size or 0
                    if (captured and captured[:7] == month and not review
                            and source in ("embedded_metadata", "video_container", "filename_or_path", "manual_review")
                            and re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])", captured[:10])):
                        day = captured[:10]
                        try:
                            datetime.date.fromisoformat(day)
                        except ValueError:
                            pass
                        else:
                            events[day] = events.get(day, 0) + 1
                            dated_total += 1
                elif path.startswith("家庭影像库/未能归档，未归类/"):
                    unclassified += 1
                if (lat is not None and lng is not None and -90 <= lat <= 90
                        and -180 <= lng <= 180 and (lat != 0 or lng != 0)):
                    gps_total += 1
            places = []
            hints = dict(conn.execute("""SELECT classification_hint,count(*) FROM media_files
                WHERE source_id=? AND status='active' AND kind IN ('image','video')
                  AND classification_hint IN ('screenshot','screen_recording')
                GROUP BY classification_hint""", (sid,)).fetchall())
            place_names = _photo_offline_place_names(conn)
            for lat, lng, count in conn.execute(
                """SELECT round(latitude,1),round(longitude,1),count(*)
                   FROM media_files WHERE source_id=? AND status='active'
                     AND kind IN ('image','video') AND latitude BETWEEN -90 AND 90
                     AND longitude BETWEEN -180 AND 180
                     AND NOT (latitude=0 AND longitude=0)
                   GROUP BY round(latitude,1),round(longitude,1)
                   ORDER BY count(*) DESC""", (sid,)
            ):
                places.append({"key": f"{lat:.1f},{lng:.1f}", "latitude": lat,
                               "longitude": lng, "files": count,
                               "label": _photo_place_display(place_names, lat, lng)})
            return {**empty, "total": total,
                    "months": sorted(months.values(), key=lambda item: item["period"], reverse=True),
                    "yearOnly": [{"year": year, "files": count} for year, count in sorted(years.items(), reverse=True)],
                    "unclassified": unclassified, "places": places, "gpsTotal": gps_total,
                    "events": [{"day": day, "files": count} for day, count in sorted(events.items(), reverse=True)],
                    "datedTotal": dated_total, "screenshotNameHints": hints.get("screenshot", 0),
                    "screenRecordingNameHints": hints.get("screen_recording", 0)}
    except (OSError, sqlite3.Error) as exc:
        return {**empty, "ok": False, "error": f"无法读取影像分类：{exc}"}


def photo_browse_items(params):
    """分页读取索引媒体。筛选条件受控，不接受任意文件路径。"""
    empty = {"ok": True, "total": 0, "items": [], "offset": 0, "limit": 48}
    if not PHOTO_INDEX_DB.is_file():
        return empty
    scope = str((params.get("scope") or ["all"])[0])
    key = str((params.get("key") or [""])[0])
    kind = str((params.get("kind") or ["all"])[0])
    hint = str((params.get("hint") or ["all"])[0])
    sort = str((params.get("sort") or ["newest"])[0])
    query = str((params.get("q") or [""])[0]).strip()[:80]
    try:
        limit = min(80, max(1, int((params.get("limit") or ["48"])[0])))
        offset = min(200000, max(0, int((params.get("offset") or ["0"])[0])))
    except ValueError:
        return {**empty, "ok": False, "error": "分页参数无效"}
    if kind not in ("all", "image", "video"):
        return {**empty, "ok": False, "error": "媒体类型无效"}
    if hint not in ("all", "screenshot", "screen_recording"):
        return {**empty, "ok": False, "error": "线索筛选无效"}
    trusted_time = ("CASE WHEN capture_time_text IS NOT NULL "
                    "AND coalesce(metadata_review_needed,0)=0 "
                    "AND capture_time_source IN ('embedded_metadata','video_container','filename_or_path','manual_review') "
                    "THEN capture_time_text END")
    order_by = {
        "newest": f"({trusted_time}) IS NULL ASC, {trusted_time} DESC, rel_path COLLATE NOCASE DESC",
        "oldest": f"({trusted_time}) IS NULL ASC, {trusted_time} ASC, rel_path COLLATE NOCASE ASC",
        "name_asc": "name COLLATE NOCASE ASC, rel_path ASC",
        "name_desc": "name COLLATE NOCASE DESC, rel_path DESC",
        "size_desc": "size DESC, rel_path ASC",
        "size_asc": "size ASC, rel_path ASC",
    }.get(sort)
    if order_by is None:
        return {**empty, "ok": False, "error": "排序方式无效"}
    where = ["source_id=?", "status='active'", "kind IN ('image','video')"]
    values = []
    if scope == "month" and re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])", key):
        where.append("rel_path GLOB ?")
        values.append(f"家庭影像库/{key[:4]}/{key}/*")
    elif scope == "year_only" and re.fullmatch(r"\d{4}", key):
        where.append("rel_path GLOB ?")
        values.append(f"家庭影像库/{key}/_仅确定年份/*")
    elif scope == "unclassified" and not key:
        where.append("rel_path GLOB ?")
        values.append("家庭影像库/未能归档，未归类/*")
    elif scope == "place" and re.fullmatch(r"-?\d{1,2}\.\d,-?\d{1,3}\.\d", key):
        lat, lng = map(float, key.split(","))
        if abs(lat) > 90 or abs(lng) > 180:
            return {**empty, "ok": False, "error": "地点坐标无效"}
        where.extend(["round(latitude,1)=?", "round(longitude,1)=?"])
        values.extend([lat, lng])
    elif scope == "day" and re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])", key):
        try:
            datetime.date.fromisoformat(key)
        except ValueError:
            return {**empty, "ok": False, "error": "日期无效"}
        where.extend(["rel_path GLOB ?", "capture_time_text LIKE ?", "coalesce(metadata_review_needed,0)=0",
                      "capture_time_source IN ('embedded_metadata','video_container','filename_or_path','manual_review')"])
        values.extend([f"家庭影像库/{key[:4]}/{key[:7]}/*", key + "%"])
    elif scope == "person" and re.fullmatch(r"[0-9a-f]{32}", key):
        where.append("EXISTS (SELECT 1 FROM photo_person_assignments a WHERE a.source_id=media_files.source_id AND a.rel_path=media_files.rel_path AND a.person_id=?)")
        values.append(key)
    elif scope != "all" or key:
        return {**empty, "ok": False, "error": "浏览范围无效"}
    if kind != "all":
        where.append("kind=?")
        values.append(kind)
    if hint != "all":
        where.append("classification_hint=?")
        values.append(hint)
    if query:
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        where.append("name LIKE ? ESCAPE '\\'")
        values.append(f"%{escaped}%")
    clause = " AND ".join(where)
    try:
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=5) as conn:
            conn.row_factory = sqlite3.Row
            sid = _photo_browse_source(conn)
            if sid is None:
                return empty
            if scope == "person" and not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='photo_person_assignments'").fetchone():
                return empty
            args = [sid, *values]
            total = conn.execute(f"SELECT count(*) FROM media_files WHERE {clause}", args).fetchone()[0]
            rows = conn.execute(
                f"""SELECT rel_path AS relPath,name,kind,extension,size,
                           capture_time_text AS captureTime,capture_time_source AS timeSource,
                           metadata_review_needed AS needsReview,latitude,longitude
                    FROM media_files WHERE {clause}
                    ORDER BY {order_by} LIMIT ? OFFSET ?""",
                [*args, limit, offset]
            ).fetchall()
            items = []
            for row in rows:
                item = dict(row)
                path = item["relPath"]
                path_parts = path.split("/")
                if "/_仅确定年份/" in path:
                    item["timePrecision"] = "year"
                elif path.startswith("家庭影像库/未能归档，未归类/"):
                    item["timePrecision"] = "unknown"
                elif (item["timeSource"] in ("embedded_metadata", "video_container", "filename_or_path", "manual_review")
                      and not item["needsReview"] and item["captureTime"]
                      and len(path_parts) >= 3 and item["captureTime"][:7] == path_parts[2]
                      and re.fullmatch(r"\d{4}-\d{2}-\d{2}", item["captureTime"][:10])):
                    item["timePrecision"] = "day"
                else:
                    item["timePrecision"] = "month"
                items.append(item)
            return {"ok": True, "total": total, "items": items, "offset": offset, "limit": limit}
    except (OSError, sqlite3.Error) as exc:
        return {**empty, "ok": False, "error": f"无法读取影像列表：{exc}"}


PHOTO_PEOPLE_DB = DATA_DIR / "photo-people.sqlite3"


def _photo_people_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS photo_people (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS photo_person_samples (
        id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES photo_people(id),
        jpeg BLOB NOT NULL, source_name TEXT NOT NULL, created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active')""")
    if "status" not in {row[1] for row in conn.execute("PRAGMA table_info(photo_person_samples)")}:
        conn.execute("ALTER TABLE photo_person_samples ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
    conn.execute("CREATE INDEX IF NOT EXISTS photo_person_samples_person ON photo_person_samples(person_id)")


def _photo_person_assignment_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS photo_person_assignments (
        person_id TEXT NOT NULL, source_id INTEGER NOT NULL,
        rel_path TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY (person_id, source_id, rel_path))""")
    conn.execute("CREATE INDEX IF NOT EXISTS photo_person_media_idx ON photo_person_assignments(source_id,rel_path)")


def photo_people_list():
    """Reference portraits are kept locally and are not a claim that the library was scanned."""
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as conn:
        _photo_people_schema(conn)
        people = [{"id": row[0], "name": row[1], "assignedCount": 0, "samples": []}
                  for row in conn.execute("SELECT id,name FROM photo_people ORDER BY created_at,id")]
        by_id = {person["id"]: person for person in people}
        for sid, person_id, source_name, status in conn.execute(
                "SELECT id,person_id,source_name,status FROM photo_person_samples ORDER BY created_at,id"):
            if person_id in by_id:
                by_id[person_id]["samples"].append({"id": sid, "sourceName": source_name,
                                                     "status": status})
    if PHOTO_INDEX_DB.is_file():
        with sqlite3.connect(PHOTO_INDEX_DB, timeout=5) as index:
            _photo_person_assignment_schema(index)
            for pid, count in index.execute("""SELECT a.person_id,count(*) FROM photo_person_assignments a
                JOIN media_files m ON m.source_id=a.source_id AND m.rel_path=a.rel_path
                WHERE m.status='active' GROUP BY a.person_id"""):
                if pid in by_id:
                    by_id[pid]["assignedCount"] = count
    return {"ok": True, "people": people, "scannedImages": 0}


def photo_people_create(spec):
    name = spec.get("name") if isinstance(spec, dict) else None
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60:
        raise ValueError("请填写 1 到 60 字的人物名称")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    person_id = uuid.uuid4().hex
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as conn:
        _photo_people_schema(conn)
        conn.execute("INSERT INTO photo_people VALUES (?,?,?,?)", (person_id, name.strip(), now, now))
    return {"ok": True, "id": person_id}


def photo_people_rename(spec):
    person_id, name = spec.get("personId"), spec.get("name")
    if not isinstance(person_id, str) or not re.fullmatch(r"[0-9a-f]{32}", person_id):
        raise ValueError("人物记录无效")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60:
        raise ValueError("请填写 1 到 60 字的人物名称")
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as conn:
        _photo_people_schema(conn)
        updated = conn.execute("UPDATE photo_people SET name=?,updated_at=? WHERE id=?",
                               (name.strip(), datetime.datetime.now(datetime.timezone.utc).isoformat(), person_id))
        if updated.rowcount != 1:
            raise FileNotFoundError("人物记录不存在")
    return {"ok": True}


def photo_people_add_sample(spec):
    person_id, source_name, encoded = spec.get("personId"), spec.get("sourceName"), spec.get("jpegBase64")
    if not isinstance(person_id, str) or not re.fullmatch(r"[0-9a-f]{32}", person_id):
        raise ValueError("人物记录无效")
    if not isinstance(source_name, str) or len(source_name) > 160:
        raise ValueError("样本名称无效")
    if not isinstance(encoded, str) or len(encoded) > 500000:
        raise ValueError("样本图片太大")
    try:
        jpeg = base64.b64decode(encoded, validate=True)
    except (ValueError, base64.binascii.Error):
        raise ValueError("样本图片格式无效") from None
    if not 100 <= len(jpeg) <= 375000 or not jpeg.startswith(b"\xff\xd8\xff") or not jpeg.endswith(b"\xff\xd9"):
        raise ValueError("请上传 JPEG 脸部裁剪图")
    sample_id = uuid.uuid4().hex
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as conn:
        _photo_people_schema(conn)
        if not conn.execute("SELECT 1 FROM photo_people WHERE id=?", (person_id,)).fetchone():
            raise FileNotFoundError("人物记录不存在")
        active_count = conn.execute("SELECT count(*) FROM photo_person_samples WHERE person_id=? AND status='active'", (person_id,)).fetchone()[0]
        if active_count >= 3:
            raise ValueError("每个人最多保留 3 张有效特征图；可先移除旧样本")
        conn.execute("""INSERT INTO photo_person_samples
            (id,person_id,jpeg,source_name,created_at,status) VALUES (?,?,?,?,?,'active')""",
            (sample_id, person_id, jpeg, Path(source_name).name, now))
    return {"ok": True, "id": sample_id}


def photo_people_sample_image(sample_id):
    if not isinstance(sample_id, str) or not re.fullmatch(r"[0-9a-f]{32}", sample_id):
        raise ValueError("样本记录无效")
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as conn:
        _photo_people_schema(conn)
        row = conn.execute("SELECT jpeg FROM photo_person_samples WHERE id=?", (sample_id,)).fetchone()
    if not row:
        raise FileNotFoundError("样本记录不存在")
    return row[0]


def photo_people_remove_sample(spec):
    sample_id = spec.get("sampleId") if isinstance(spec, dict) else None
    if not isinstance(sample_id, str) or not re.fullmatch(r"[0-9a-f]{32}", sample_id):
        raise ValueError("样本记录无效")
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as conn:
        _photo_people_schema(conn)
        updated = conn.execute("UPDATE photo_person_samples SET status='removed' WHERE id=? AND status='active'", (sample_id,))
        if updated.rowcount != 1:
            raise FileNotFoundError("样本记录不存在")
    return {"ok": True}


def photo_people_restore_sample(spec):
    sample_id = spec.get("sampleId") if isinstance(spec, dict) else None
    if not isinstance(sample_id, str) or not re.fullmatch(r"[0-9a-f]{32}", sample_id):
        raise ValueError("样本记录无效")
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as conn:
        _photo_people_schema(conn)
        row = conn.execute("SELECT person_id FROM photo_person_samples WHERE id=? AND status='removed'", (sample_id,)).fetchone()
        if not row:
            raise FileNotFoundError("样本记录不存在")
        if conn.execute("SELECT count(*) FROM photo_person_samples WHERE person_id=? AND status='active'", (row[0],)).fetchone()[0] >= 3:
            raise ValueError("每个人最多保留 3 张有效特征图；可先移除其他样本")
        updated = conn.execute("UPDATE photo_person_samples SET status='active' WHERE id=? AND status='removed'", (sample_id,))
        if updated.rowcount != 1:
            raise FileNotFoundError("样本记录不存在")
    return {"ok": True}


def photo_people_for_media(rel_path):
    if not isinstance(rel_path, str) or not rel_path.startswith("家庭影像库/") or len(rel_path) > 1600:
        raise ValueError("影像路径无效")
    with sqlite3.connect(PHOTO_INDEX_DB, timeout=5) as index:
        sid = _photo_browse_source(index)
        _photo_person_assignment_schema(index)
        ids = [row[0] for row in index.execute("""SELECT person_id FROM photo_person_assignments
            WHERE source_id=? AND rel_path=?""", (sid, rel_path))]
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=5) as people:
        _photo_people_schema(people)
        names = dict(people.execute("SELECT id,name FROM photo_people"))
    return {"ok": True, "people": [{"id": pid, "name": names[pid]} for pid in ids if pid in names]}


def photo_people_assign(spec):
    person_id, rel_path = spec.get("personId"), spec.get("path")
    if not isinstance(person_id, str) or not re.fullmatch(r"[0-9a-f]{32}", person_id):
        raise ValueError("人物记录无效")
    if not isinstance(rel_path, str) or not rel_path.startswith("家庭影像库/") or len(rel_path) > 1600:
        raise ValueError("影像路径无效")
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as index:
        sid = _photo_browse_source(index)
        active = index.execute("""SELECT 1 FROM media_files WHERE source_id=? AND rel_path=?
            AND status='active' AND kind='image'""", (sid, rel_path)).fetchone()
    if not active:
        raise FileNotFoundError("当前索引中没有这张照片")
    with sqlite3.connect(PHOTO_PEOPLE_DB, timeout=10) as people:
        _photo_people_schema(people)
        if not people.execute("SELECT 1 FROM photo_people WHERE id=?", (person_id,)).fetchone():
            raise FileNotFoundError("人物记录不存在")
    with sqlite3.connect(PHOTO_INDEX_DB, timeout=10) as index:
        _photo_person_assignment_schema(index)
        if not index.execute("""SELECT 1 FROM media_files WHERE source_id=? AND rel_path=?
            AND status='active' AND kind='image'""", (sid, rel_path)).fetchone():
            raise FileNotFoundError("照片已移动或删除，请刷新后重试")
        index.execute("""INSERT OR IGNORE INTO photo_person_assignments
            (person_id,source_id,rel_path,created_at) VALUES (?,?,?,?)""",
            (person_id, sid, rel_path, datetime.datetime.now(datetime.timezone.utc).isoformat()))
    return {"ok": True}


def photo_people_unassign(spec):
    person_id, rel_path = spec.get("personId"), spec.get("path")
    if not isinstance(person_id, str) or not re.fullmatch(r"[0-9a-f]{32}", person_id) or not isinstance(rel_path, str):
        raise ValueError("人物或影像记录无效")
    with sqlite3.connect(PHOTO_INDEX_DB, timeout=10) as index:
        sid = _photo_browse_source(index)
        _photo_person_assignment_schema(index)
        index.execute("DELETE FROM photo_person_assignments WHERE person_id=? AND source_id=? AND rel_path=?",
                      (person_id, sid, rel_path))
    return {"ok": True}


_PHOTO_PREVIEW_LIMIT = threading.BoundedSemaphore(2)


def _photo_thumb_cache(root, sid, kind, size, mtime_ns, inode, rel_path):
    """缩略图随原文件版本变化失效；缓存位于 S300 扫描排除目录。"""
    identity = f"{sid}:{inode or rel_path}:{kind}:{size}:{mtime_ns}:384:v1"
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    return root / ".family-gallery-cache" / "thumbs-v1" / digest[:2] / f"{digest}.jpg"


_PHOTO_CACHE_SIZE_LOCK = threading.Lock()
_PHOTO_CACHE_SIZE_FILE = DATA_DIR / "photo-cache-usage.json"


def _load_photo_cache_size():
    state = {"path": None, "bytes": None, "checked_at": 0.0, "scanning": False, "error": None}
    try:
        saved = json.loads(_PHOTO_CACHE_SIZE_FILE.read_text(encoding="utf-8"))
        if isinstance(saved.get("path"), str) and isinstance(saved.get("bytes"), int) and saved["bytes"] >= 0:
            state.update({"path": saved["path"], "bytes": saved["bytes"],
                          "checked_at": float(saved.get("checkedAt") or 0)})
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return state


_PHOTO_CACHE_SIZE = _load_photo_cache_size()


def _photo_cache_size_scan(path):
    """单次后台统计 S300 缩略图占用；页面请求不等待 SMB 全目录遍历。"""
    size, error = None, None
    try:
        if not path.exists():
            size = 0
        elif os.name != "nt":
            result = subprocess.run(["du", "-sk", str(path)], capture_output=True,
                                    text=True, timeout=900)
            if result.returncode != 0:
                raise OSError(result.stderr.strip() or "无法统计缩略图缓存")
            size = int(result.stdout.split()[0]) * 1024
        else:
            size = sum((Path(folder) / name).stat().st_size
                       for folder, _, names in os.walk(path) for name in names)
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        error = str(exc)
    with _PHOTO_CACHE_SIZE_LOCK:
        if _PHOTO_CACHE_SIZE["path"] == str(path):
            _PHOTO_CACHE_SIZE.update({"bytes": size, "checked_at": time.time(),
                                      "scanning": False, "error": error})
            if error is None:
                try:
                    temporary = _PHOTO_CACHE_SIZE_FILE.with_suffix(".tmp")
                    temporary.write_text(json.dumps({"path": str(path), "bytes": size,
                                                     "checkedAt": _PHOTO_CACHE_SIZE["checked_at"]}), encoding="utf-8")
                    os.replace(temporary, _PHOTO_CACHE_SIZE_FILE)
                except OSError:
                    pass


def photo_storage_status(force=False):
    """返回本机索引数据库与 S300 缩略图缓存的容量。"""
    def file_bytes(path):
        try:
            return path.stat().st_size
        except OSError:
            return 0

    index_bytes = sum(file_bytes(Path(str(PHOTO_INDEX_DB) + suffix))
                      for suffix in ("", "-wal", "-shm"))
    people_db = DATA_DIR / "photo-people.sqlite3"
    people_bytes = sum(file_bytes(Path(str(people_db) + suffix))
                       for suffix in ("", "-wal", "-shm"))
    root = _latest_index_source_root() or PHOTO_DEFAULT_SOURCE
    cache_path = root / ".family-gallery-cache"
    available = root.is_dir()
    with _PHOTO_CACHE_SIZE_LOCK:
        state = _PHOTO_CACHE_SIZE
        now = time.time()
        if available and not state["scanning"] and (force or state["path"] != str(cache_path)
                or now - state["checked_at"] > 900):
            state.update({"path": str(cache_path), "scanning": True, "error": None})
            threading.Thread(target=_photo_cache_size_scan, args=(cache_path,), daemon=True).start()
        cache = {"bytes": state["bytes"] if state["path"] == str(cache_path) else None,
                 "status": "unavailable" if not available else "scanning" if state["scanning"] else
                           "error" if state["error"] else "ready",
                 "checkedAt": int(state["checked_at"] * 1000) if state["checked_at"] else None,
                 "error": state["error"] if state["path"] == str(cache_path) else None}
    return {"ok": True, "cache": cache,
            "database": {"indexBytes": index_bytes, "peopleBytes": people_bytes,
                         "totalBytes": index_bytes + people_bytes}}


def _write_photo_thumb(cache_path, data):
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=cache_path.parent, suffix=".tmp", delete=False) as output:
            temp_path = Path(output.name)
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temp_path, cache_path)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def _sips_jpeg(source, output, dimension):
    result = subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "68",
         "-Z", str(dimension), str(source), "--out", str(output)],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0 or not output.is_file():
        raise ValueError("无法生成这张影像的预览")


def photo_browse_preview(params):
    """生成照片预览或 S300 上的压缩缩略图；只接受索引中的活跃影像。"""
    rel_path = str((params.get("path") or [""])[0])
    thumb = str((params.get("size") or [""])[0]) == "384"
    if (params.get("size") or [""])[0] not in ("", "384"):
        raise ValueError("预览尺寸无效")
    if not rel_path.startswith("家庭影像库/") or len(rel_path) > 1600:
        raise ValueError("影像路径无效")
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as conn:
        sid = _photo_browse_source(conn)
        if sid is None:
            raise FileNotFoundError("索引为空")
        row = conn.execute(
            """SELECT sources.root,media_files.extension,media_files.kind,
                      media_files.size,media_files.mtime_ns,media_files.inode
               FROM media_files
               JOIN sources ON sources.id=media_files.source_id
               WHERE media_files.source_id=? AND rel_path=? AND status='active'
                 AND kind IN ('image','video')""",
            (sid, rel_path),
        ).fetchone()
    if not row:
        raise FileNotFoundError("索引中没有这张影像")
    root = Path(row[0]).resolve()
    if sys.platform == "darwin" and str(root).startswith("/Volumes/") and not os.path.ismount(root):
        raise FileNotFoundError("S300 当前未挂载")
    path = (root / rel_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise FileNotFoundError("原片当前不可读取")
    if not thumb and row[2] != "image":
        raise ValueError("视频目前只支持封面预览")
    current = path.stat()
    if current.st_size != row[3] or current.st_mtime_ns != row[4] or (row[5] and current.st_ino != row[5]):
        raise ValueError("原片与索引中的文件版本不一致")
    cache_path = _photo_thumb_cache(root, sid, row[2], row[3], row[4], row[5], rel_path)
    if thumb and cache_path.is_file():
        return cache_path.read_bytes(), "image/jpeg"
    if not _PHOTO_PREVIEW_LIMIT.acquire(timeout=90):
        raise RuntimeError("正在生成其他预览，请稍后重试")
    try:
        if thumb and cache_path.is_file():
            return cache_path.read_bytes(), "image/jpeg"
        if sys.platform == "darwin" and shutil.which("sips"):
            with tempfile.TemporaryDirectory(prefix="family-photo-preview-") as folder:
                temp_dir = Path(folder)
                out = temp_dir / "preview.jpg"
                if row[2] == "video":
                    if not thumb or not shutil.which("qlmanage"):
                        raise ValueError("当前电脑尚不支持此视频封面")
                    result = subprocess.run(
                        ["qlmanage", "-t", "-s", "384", "-o", str(temp_dir), str(path)],
                        capture_output=True, text=True, timeout=60,
                    )
                    covers = list(temp_dir.glob("*.png"))
                    if result.returncode != 0 or not covers:
                        raise ValueError("无法生成此视频封面")
                    _sips_jpeg(covers[0], out, 384)
                else:
                    _sips_jpeg(path, out, 384 if thumb else 1600)
                if thumb:
                    after = path.stat()
                    if (after.st_size, after.st_mtime_ns, after.st_ino) != (current.st_size, current.st_mtime_ns, current.st_ino):
                        raise ValueError("原片在生成缩略图时发生变化")
                    _write_photo_thumb(cache_path, out.read_bytes())
                elif not cache_path.is_file() and os.path.ismount(root):
                    small = temp_dir / "thumbnail.jpg"
                    _sips_jpeg(out, small, 384)
                    _write_photo_thumb(cache_path, small.read_bytes())
                return out.read_bytes(), "image/jpeg"
        if not thumb and path.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif") and current.st_size <= 25_000_000:
            return path.read_bytes(), mimetypes.guess_type(path.name)[0] or "image/jpeg"
        raise ValueError("当前电脑尚不支持此格式的预览")
    finally:
        _PHOTO_PREVIEW_LIMIT.release()


def photo_browse_video(params):
    """仅允许读取当前索引里的活跃视频，供浏览器按字节范围播放。"""
    rel_path = str((params.get("path") or [""])[0])
    if not rel_path.startswith("家庭影像库/") or len(rel_path) > 1600:
        raise ValueError("视频路径无效")
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as conn:
        sid = _photo_browse_source(conn)
        row = conn.execute(
            """SELECT sources.root,media_files.size,media_files.mtime_ns,media_files.inode
               FROM media_files JOIN sources ON sources.id=media_files.source_id
               WHERE media_files.source_id=? AND rel_path=? AND status='active' AND kind='video'""",
            (sid, rel_path),
        ).fetchone() if sid is not None else None
    if not row:
        raise FileNotFoundError("索引中没有这段视频")
    root = Path(row[0]).resolve()
    if sys.platform == "darwin" and str(root).startswith("/Volumes/") and not os.path.ismount(root):
        raise FileNotFoundError("S300 当前未挂载")
    path = (root / rel_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise FileNotFoundError("视频当前不可读取")
    current = path.stat()
    if current.st_size != row[1] or current.st_mtime_ns != row[2] or (row[3] and current.st_ino != row[3]):
        raise ValueError("视频与索引中的文件版本不一致")
    return path, current.st_size, mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _photo_trash_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS photo_trash (
        id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT NOT NULL,
        source_id INTEGER NOT NULL, original_rel_path TEXT NOT NULL,
        trash_rel_path TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
        size INTEGER NOT NULL, mtime_ns INTEGER NOT NULL,
        status TEXT NOT NULL, deleted_at TEXT NOT NULL,
        restored_at TEXT, cache_cleared_at TEXT)""")
    columns = {row[1] for row in conn.execute("PRAGMA table_info(photo_trash)")}
    if "cache_cleared_at" not in columns:
        conn.execute("ALTER TABLE photo_trash ADD COLUMN cache_cleared_at TEXT")


def _photo_trash_clear_cache(conn, batch_id=None):
    """Remove S300 previews for trashed media; unfinished removals can be retried."""
    query = """SELECT t.id,t.source_id,t.original_rel_path,m.kind,m.size,m.mtime_ns,m.inode
        FROM photo_trash t JOIN media_files m
          ON m.source_id=t.source_id AND m.rel_path=t.original_rel_path
        WHERE t.status='trashed' AND t.cache_cleared_at IS NULL"""
    args = ()
    if batch_id is not None:
        query += " AND t.batch_id=?"
        args = (batch_id,)
    cleared = 0
    pending = 0
    for row in conn.execute(query, args).fetchall():
        try:
            root = _photo_trash_root(conn, row[1])
            cache_path = _photo_thumb_cache(root, row[1], row[3], row[4], row[5], row[6], row[2])
            cache_path.unlink(missing_ok=True)
            conn.execute("UPDATE photo_trash SET cache_cleared_at=? WHERE id=?",
                         (datetime.datetime.now(datetime.timezone.utc).isoformat(), row[0]))
            cleared += 1
        except OSError:
            pending += 1
    conn.commit()
    if cleared:
        with _PHOTO_CACHE_SIZE_LOCK:
            _PHOTO_CACHE_SIZE["checked_at"] = 0.0
    return {"cleared": cleared, "pending": pending}


def _photo_trash_root(conn, sid):
    row = conn.execute("SELECT root FROM sources WHERE id=?", (sid,)).fetchone()
    if not row:
        raise ValueError("找不到影像源")
    root = Path(row[0]).resolve()
    if sys.platform == "darwin" and str(root).startswith("/Volumes/") and not os.path.ismount(root):
        raise FileNotFoundError("S300 当前未挂载")
    return root


def _photo_trash_reconcile(conn):
    """Repair a rename interrupted between the file move and its index update."""
    pending = conn.execute("""SELECT id,source_id,original_rel_path,trash_rel_path,size,mtime_ns
        FROM photo_trash WHERE status='planned'""").fetchall()
    for row in pending:
        try:
            root = _photo_trash_root(conn, row[1])
            original, trashed = root / row[2], root / row[3]
            has_original, has_trashed = os.path.lexists(original), os.path.lexists(trashed)
            if has_original and not has_trashed:
                conn.execute("DELETE FROM photo_trash WHERE id=?", (row[0],))
            elif has_trashed and not has_original:
                current = trashed.lstat()
                if stat.S_ISREG(current.st_mode) and (current.st_size, current.st_mtime_ns) == (row[4], row[5]):
                    conn.execute("UPDATE media_files SET status='trashed',updated_at=? WHERE source_id=? AND rel_path=?",
                                 (int(time.time() * 1000), row[1], row[2]))
                    conn.execute("UPDATE photo_trash SET status='trashed' WHERE id=?", (row[0],))
        except (OSError, ValueError):
            continue
    conn.commit()


def photo_trash_preview(rel_path):
    """Show the selected media and any matching Live Photo companion before moving."""
    if not isinstance(rel_path, str) or not rel_path.startswith("家庭影像库/") or len(rel_path) > 1600:
        raise ValueError("影像路径无效")
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as conn:
        conn.row_factory = sqlite3.Row
        sid = _photo_browse_source(conn)
        if sid is None:
            raise FileNotFoundError("索引为空")
        selected = conn.execute("""SELECT rel_path,name,parent_path,kind,size
            FROM media_files WHERE source_id=? AND rel_path=? AND status='active'
              AND kind IN ('image','video')""", (sid, rel_path)).fetchone()
        if not selected:
            raise FileNotFoundError("索引中没有这项影像")
        files = [dict(selected)]
        stem = Path(selected["name"]).stem.casefold()
        companion_kind = "video" if selected["kind"] == "image" else "image"
        for row in conn.execute("""SELECT rel_path,name,parent_path,kind,size
            FROM media_files WHERE source_id=? AND parent_path=? AND status='active'
              AND kind=?""", (sid, selected["parent_path"], companion_kind)):
            if Path(row["name"]).stem.casefold() == stem:
                files.append(dict(row))
        return {"ok": True, "items": [{"relPath": row["rel_path"], "name": row["name"],
                                        "kind": row["kind"], "size": row["size"]}
                                       for row in files]}


def photo_trash_preview_many(spec):
    paths = spec.get("paths")
    if not isinstance(paths, list) or not 1 <= len(paths) <= 200 or \
            any(not isinstance(path, str) for path in paths) or len(set(paths)) != len(paths):
        raise ValueError("每批请选择 1 至 200 项不重复的影像")
    files = {}
    for path in paths:
        for item in photo_trash_preview(path)["items"]:
            files[item["relPath"]] = item
    return {"ok": True, "items": list(files.values()), "selectedCount": len(paths)}


def photo_trash_move(spec):
    """Move an indexed photo and its acknowledged companion into S300's app trash."""
    if "paths" in spec:
        preview = photo_trash_preview_many(spec)
    else:
        preview = photo_trash_preview(spec.get("path"))
    expected = spec.get("expectedPaths")
    paths = [item["relPath"] for item in preview["items"]]
    if not isinstance(expected, list) or len(set(expected)) != len(expected) or sorted(expected) != sorted(paths):
        raise ValueError("关联的照片或视频发生变化，请重新确认")
    batch_id = uuid.uuid4().hex
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with sqlite3.connect(PHOTO_INDEX_DB, timeout=15) as conn:
        conn.row_factory = sqlite3.Row
        sid = _photo_browse_source(conn)
        root = _photo_trash_root(conn, sid)
        checked = []
        for rel in paths:
            row = conn.execute("""SELECT kind,size,mtime_ns,inode
                FROM media_files WHERE source_id=? AND rel_path=? AND status='active'""",
                (sid, rel)).fetchone()
            if not row:
                raise ValueError("影像索引已改变，请刷新")
            path = root / rel
            if not path.resolve().is_relative_to(root) or not path.is_file():
                raise FileNotFoundError("原片当前不可读取")
            current = path.lstat()
            if not stat.S_ISREG(current.st_mode) or current.st_size != row["size"] or \
                    current.st_mtime_ns != row["mtime_ns"] or \
                    (row["inode"] and current.st_ino != row["inode"]):
                raise ValueError("原片与索引不符，未移动")
            token = uuid.uuid4().hex
            trash_rel = f"家庭影像库/.family-gallery-trash/{token[:2]}/{token}{path.suffix.lower()}"
            target = root / trash_rel
            if target.exists():
                raise ValueError("回收站目标冲突")
            checked.append((rel, trash_rel, row["kind"], current.st_size, current.st_mtime_ns))
        _photo_trash_schema(conn)
        _photo_trash_reconcile(conn)
        for rel, trash_rel, kind, size, mtime in checked:
            conn.execute("""INSERT INTO photo_trash
                (batch_id,source_id,original_rel_path,trash_rel_path,kind,size,mtime_ns,status,deleted_at)
                VALUES (?,?,?,?,?,?,?,?,?)""",
                (batch_id, sid, rel, trash_rel, kind, size, mtime, "planned", now))
        conn.commit()
        moved = []
        for rel, trash_rel, _kind, _size, _mtime in checked:
            source, target = root / rel, root / trash_rel
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(source, target)
            with conn:
                conn.execute("UPDATE media_files SET status='trashed',updated_at=? WHERE source_id=? AND rel_path=?",
                             (int(time.time() * 1000), sid, rel))
                conn.execute("UPDATE photo_trash SET status='trashed' WHERE batch_id=? AND original_rel_path=?",
                             (batch_id, rel))
            moved.append(rel)
        cache = _photo_trash_clear_cache(conn, batch_id)
    return {"ok": True, "batchId": batch_id, "moved": moved, "cache": cache}


def photo_trash_status():
    if not PHOTO_INDEX_DB.is_file():
        return {"ok": True, "batches": []}
    with sqlite3.connect(PHOTO_INDEX_DB, timeout=10) as conn:
        _photo_trash_schema(conn)
        _photo_trash_reconcile(conn)
        cache = _photo_trash_clear_cache(conn)
        rows = conn.execute("""SELECT batch_id,max(deleted_at),count(*),sum(size),
                             group_concat(original_rel_path,'|')
            FROM photo_trash WHERE status='trashed' GROUP BY batch_id
            ORDER BY max(deleted_at) DESC LIMIT 100""").fetchall()
        pending_count = conn.execute("SELECT count(*) FROM photo_trash WHERE status='planned'").fetchone()[0]
    return {"ok": True, "pendingCount": pending_count, "cachePendingCount": cache["pending"],
            "batches": [{"batchId": r[0], "deletedAt": r[1],
                                      "count": r[2], "bytes": r[3],
                                      "paths": r[4].split("|")} for r in rows]}


def photo_trash_restore(batch_id):
    if not isinstance(batch_id, str) or not re.fullmatch(r"[0-9a-f]{32}", batch_id):
        raise ValueError("回收站记录无效")
    with sqlite3.connect(PHOTO_INDEX_DB, timeout=15) as conn:
        conn.row_factory = sqlite3.Row
        _photo_trash_schema(conn)
        rows = conn.execute("""SELECT * FROM photo_trash
            WHERE batch_id=? AND status='trashed' ORDER BY id""", (batch_id,)).fetchall()
        if not rows:
            raise FileNotFoundError("回收站里没有这项影像")
        root = _photo_trash_root(conn, rows[0]["source_id"])
        for row in rows:
            source, target = root / row["trash_rel_path"], root / row["original_rel_path"]
            if os.path.lexists(target) or not source.is_file():
                raise ValueError("原位置已有文件，或回收站文件缺失；未恢复")
            current = source.lstat()
            if not stat.S_ISREG(current.st_mode) or current.st_size != row["size"] or current.st_mtime_ns != row["mtime_ns"]:
                raise ValueError("回收站文件发生变化；未恢复")
        restored = []
        for row in rows:
            source, target = root / row["trash_rel_path"], root / row["original_rel_path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(source, target)
            with conn:
                conn.execute("UPDATE media_files SET status='active',updated_at=? WHERE source_id=? AND rel_path=?",
                             (int(time.time() * 1000), row["source_id"], row["original_rel_path"]))
                conn.execute("UPDATE photo_trash SET status='restored',restored_at=? WHERE id=?",
                             (datetime.datetime.now(datetime.timezone.utc).isoformat(), row["id"]))
            restored.append(row["original_rel_path"])
    return {"ok": True, "restored": restored}


_PHOTO_MANUAL_ARCHIVE_LOCK = threading.Lock()


def _photo_manual_archive_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS photo_manual_archive (
        id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT NOT NULL,
        source_id INTEGER NOT NULL, source_rel TEXT NOT NULL,
        target_rel TEXT NOT NULL, size INTEGER NOT NULL, mtime_ns INTEGER NOT NULL,
        inode INTEGER, precision TEXT NOT NULL, chosen_date TEXT NOT NULL,
        old_capture_time TEXT, old_capture_source TEXT, old_capture_confidence TEXT,
        status TEXT NOT NULL, created_at TEXT NOT NULL, verified_at TEXT,
        UNIQUE(batch_id, source_rel), UNIQUE(batch_id, target_rel))""")


def _photo_manual_archive_finish(conn, row):
    target = Path(row["target_rel"])
    stamp = int(time.time() * 1000)
    if row["precision"] == "day":
        conn.execute("""UPDATE media_files SET rel_path=?,parent_path=?,name=?,
            capture_time_text=?,capture_time_source='manual_review',
            capture_time_confidence='high',metadata_review_needed=0,updated_at=?
            WHERE source_id=? AND rel_path=? AND status='active'""",
            (row["target_rel"], str(target.parent), target.name, row["chosen_date"],
             stamp, row["source_id"], row["source_rel"]))
    else:
        conn.execute("""UPDATE media_files SET rel_path=?,parent_path=?,name=?,updated_at=?
            WHERE source_id=? AND rel_path=? AND status='active'""",
            (row["target_rel"], str(target.parent), target.name, stamp,
             row["source_id"], row["source_rel"]))
    if conn.execute("SELECT changes()").fetchone()[0] != 1:
        raise ValueError("索引中的原路径已变化，请人工核对")
    if row["source_rel"] != row["target_rel"]:
        _photo_person_assignment_schema(conn)
        conn.execute("""UPDATE photo_person_assignments SET rel_path=?
            WHERE source_id=? AND rel_path=?""",
            (row["target_rel"], row["source_id"], row["source_rel"]))
    conn.execute("UPDATE photo_manual_archive SET status='verified',verified_at=? WHERE id=?",
                 (datetime.datetime.now(datetime.timezone.utc).isoformat(), row["id"]))


def _photo_manual_archive_reconcile(conn):
    """Finish only moves whose target exists and source is gone after an interrupted rename."""
    _photo_manual_archive_schema(conn)
    pending = conn.execute("SELECT * FROM photo_manual_archive WHERE status='planned' ORDER BY id").fetchall()
    for row in pending:
        root = _photo_trash_root(conn, row["source_id"])
        source, target = root / row["source_rel"], root / row["target_rel"]
        if row["source_rel"] == row["target_rel"]:
            info = source.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_size != row["size"] or info.st_mtime_ns != row["mtime_ns"]:
                raise ValueError("上次日期标注的原片发生变化，请人工核对")
            _photo_manual_archive_finish(conn, row)
            continue
        old, new = os.path.lexists(source), os.path.lexists(target)
        if old and not new:
            conn.execute("DELETE FROM photo_manual_archive WHERE id=?", (row["id"],))
        elif new and not old:
            info = target.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_size != row["size"] or info.st_mtime_ns != row["mtime_ns"] or (row["inode"] and info.st_ino != row["inode"]):
                raise ValueError("上次归档的目标文件与索引不符，请人工核对")
            _photo_manual_archive_finish(conn, row)
        else:
            raise ValueError("上次归档的源和目标状态冲突，请人工核对")
    conn.commit()


def _photo_manual_archive_plan(spec):
    paths = spec.get("paths")
    precision = spec.get("precision")
    chosen = spec.get("date")
    if not isinstance(paths, list) or not 1 <= len(paths) <= 200 or any(
            not isinstance(p, str) or not p.startswith("家庭影像库/") or len(p) > 1600 for p in paths):
        raise ValueError("请选择 1 到 200 项家庭影像")
    if len(set(paths)) != len(paths) or precision not in ("year", "month", "day") or not isinstance(chosen, str):
        raise ValueError("归档选择无效")
    if precision == "year" and re.fullmatch(r"\d{4}", chosen):
        year, month = int(chosen), None
    elif precision == "month" and re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])", chosen):
        year, month = int(chosen[:4]), int(chosen[5:7])
    elif precision == "day" and re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])", chosen):
        parsed = datetime.date.fromisoformat(chosen)
        year, month = parsed.year, parsed.month
    else:
        raise ValueError("请选择有效的年份、月份或日期")
    if not 1900 <= year <= datetime.date.today().year + 1:
        raise ValueError("归档年份超出合理范围")
    target_dir = f"家庭影像库/{year:04d}/{year:04d}-{month:02d}" if month else f"家庭影像库/{year:04d}/_仅确定年份"
    if (_photo_process_alive() or _photo_metadata_process_alive() or _photo_organize_process_alive()
            or photo_duplicate_status().get("processAlive") or photo_duplicate_cleanup_status().get("processAlive")):
        raise ValueError("照片扫描或整理正在运行，请完成后再手动归档")
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=10) as conn:
        conn.row_factory = sqlite3.Row
        sid = _photo_browse_source(conn)
        if sid is None:
            raise ValueError("影像索引为空")
        root = _photo_trash_root(conn, sid)
        expanded = {}
        for path in paths:
            for item in photo_trash_preview(path)["items"]:
                expanded[item["relPath"]] = None
        if len(expanded) > 400:
            raise ValueError("关联视频过多，请减少本次选择")
        rows = []
        for path in expanded:
            row = conn.execute("""SELECT rel_path,name,kind,size,mtime_ns,inode,
                capture_time_text,capture_time_source,capture_time_confidence
                FROM media_files WHERE source_id=? AND rel_path=? AND status='active'""",
                (sid, path)).fetchone()
            if row is None:
                raise ValueError("有影像不在当前索引，请刷新")
            rows.append(row)
        used = set()
        items = []
        for row in rows:
            source_rel = row["rel_path"]
            source = root / source_rel
            if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(root):
                raise ValueError("原片当前不可安全读取")
            info = source.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_size != row["size"] or info.st_mtime_ns != row["mtime_ns"] or (row["inode"] and info.st_ino != row["inode"]):
                raise ValueError("原片与索引不符，请重新扫描后归档")
            stem, suffix = Path(row["name"]).stem, Path(row["name"]).suffix
            candidate = f"{target_dir}/{row['name']}"
            number = 2
            while (candidate != source_rel and (candidate.casefold() in used or os.path.lexists(root / candidate) or
                   conn.execute("SELECT 1 FROM media_files WHERE source_id=? AND rel_path=? AND status='active'", (sid, candidate)).fetchone())):
                candidate = f"{target_dir}/{stem}__归档{number}{suffix}"
                number += 1
            if candidate == source_rel and precision != "day":
                continue
            if not (root / candidate).resolve().is_relative_to(root):
                raise ValueError("目标路径不安全")
            used.add(candidate.casefold())
            items.append({"sourceRel": source_rel, "targetRel": candidate, "name": row["name"],
                          "kind": row["kind"], "size": row["size"], "mtimeNs": row["mtime_ns"],
                          "inode": row["inode"], "oldCaptureTime": row["capture_time_text"],
                          "oldCaptureSource": row["capture_time_source"],
                          "oldCaptureConfidence": row["capture_time_confidence"]})
    return {"ok": True, "items": items, "count": len(items), "targetDirectory": target_dir,
            "precision": precision, "date": chosen, "selectedCount": len(paths)}


def photo_manual_archive_preview(spec):
    return _photo_manual_archive_plan(spec)


def photo_manual_archive_move(spec):
    with _PHOTO_MANUAL_ARCHIVE_LOCK:
        backup = photo_index_backup()
        if not backup.get("ok"):
            raise ValueError(backup.get("error") or "无法备份影像索引")
        with sqlite3.connect(PHOTO_INDEX_DB, timeout=30) as previous:
            previous.row_factory = sqlite3.Row
            _photo_manual_archive_reconcile(previous)
        plan = _photo_manual_archive_plan(spec)
        expected = spec.get("expected")
        if not isinstance(expected, list) or expected != [
                {"sourceRel": item["sourceRel"], "targetRel": item["targetRel"]} for item in plan["items"]]:
            raise ValueError("归档清单发生变化，请重新预览")
        if not plan["items"]:
            raise ValueError("选中的影像已在目标目录")
        batch_id = uuid.uuid4().hex
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with sqlite3.connect(PHOTO_INDEX_DB, timeout=30) as conn:
            conn.row_factory = sqlite3.Row
            sid = _photo_browse_source(conn)
            root = _photo_trash_root(conn, sid)
            with conn:
                for item in plan["items"]:
                    conn.execute("""INSERT INTO photo_manual_archive
                        (batch_id,source_id,source_rel,target_rel,size,mtime_ns,inode,precision,chosen_date,
                         old_capture_time,old_capture_source,old_capture_confidence,status,created_at)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                         (batch_id, sid, item["sourceRel"], item["targetRel"], item["size"], item["mtimeNs"],
                          item["inode"], plan["precision"], plan["date"], item["oldCaptureTime"],
                          item["oldCaptureSource"], item["oldCaptureConfidence"], "planned", now))
            moved = 0
            for row in conn.execute("SELECT * FROM photo_manual_archive WHERE batch_id=? ORDER BY id", (batch_id,)).fetchall():
                source, target = root / row["source_rel"], root / row["target_rel"]
                if row["source_rel"] == row["target_rel"]:
                    info = source.lstat()
                    if not stat.S_ISREG(info.st_mode) or info.st_size != row["size"] or info.st_mtime_ns != row["mtime_ns"]:
                        raise ValueError("原片发生变化，已停止")
                    with conn:
                        _photo_manual_archive_finish(conn, row)
                    moved += 1
                    continue
                if not source.is_file() or source.is_symlink() or os.path.lexists(target):
                    raise ValueError(f"第 {moved + 1} 项的源或目标发生变化，已停止，可重新打开页面核对")
                info = source.lstat()
                if info.st_size != row["size"] or info.st_mtime_ns != row["mtime_ns"] or (row["inode"] and info.st_ino != row["inode"]):
                    raise ValueError("原片发生变化，已停止")
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.parent.resolve().is_relative_to(root):
                    raise ValueError("目标目录不在家庭影像卷内，已停止")
                if source.stat().st_dev != target.parent.stat().st_dev:
                    raise ValueError("源和目标不在同一卷，已停止")
                os.rename(source, target)
                after = target.lstat()
                if after.st_size != row["size"] or after.st_mtime_ns != row["mtime_ns"]:
                    raise ValueError("移动后文件校验失败，已停止")
                with conn:
                    _photo_manual_archive_finish(conn, row)
                moved += 1
        return {"ok": True, "batchId": batch_id, "moved": moved, "targetDirectory": plan["targetDirectory"]}


def photo_timeline(params):
    """按月聚合本机影像索引，并在选中月份后展开离线 GPS 地点簇。"""
    empty = {"ok": True, "periods": [], "places": [], "total": 0, "processed": 0,
             "withTime": 0, "withGps": 0, "suspiciousTime": 0, "analysisStatus": "not_started"}
    if not PHOTO_INDEX_DB.is_file():
        return empty
    period = str((params.get("period") or [""])[0]).strip()
    if period and not re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])", period):
        return {**empty, "ok": False, "error": "月份格式无效"}
    uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
    try:
        with sqlite3.connect(uri, uri=True, timeout=5) as conn:
            conn.row_factory = sqlite3.Row
            source = conn.execute("SELECT source_id FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()
            if not source:
                return empty
            sid = int(source["source_id"])
            columns = {str(row["name"]) for row in conn.execute("PRAGMA table_info(media_files)")}
            if "capture_time_text" not in columns:
                return empty
            summary = conn.execute(
                """SELECT count(*) total,
                          sum(CASE WHEN metadata_status='done' THEN 1 ELSE 0 END) processed,
                          sum(CASE WHEN capture_time_text IS NOT NULL THEN 1 ELSE 0 END) with_time,
                          sum(CASE WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
                                         AND NOT (latitude=0 AND longitude=0) THEN 1 ELSE 0 END) with_gps
                   FROM media_files WHERE source_id=? AND status='active' AND kind IN ('image','video')""",
                (sid,),
            ).fetchone()
            analysis = None
            if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='analysis_runs'").fetchone():
                analysis = conn.execute(
                    """SELECT status FROM analysis_runs WHERE source_id=? AND analysis_type='metadata'
                       ORDER BY id DESC LIMIT 1""", (sid,),
                ).fetchone()
            periods_raw = conn.execute(
                """SELECT substr(rel_path,12,7) period,count(*) files,
                          sum(CASE WHEN kind='image' THEN 1 ELSE 0 END) images,
                          sum(CASE WHEN kind='video' THEN 1 ELSE 0 END) videos,
                          sum(CASE WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
                                         AND NOT (latitude=0 AND longitude=0) THEN 1 ELSE 0 END) gps,
                          sum(CASE WHEN metadata_review_needed=1 THEN 1 ELSE 0 END) needs_review,
                          coalesce(sum(size),0) bytes
                   FROM media_files
                   WHERE source_id=? AND status='active' AND kind IN ('image','video')
                     AND rel_path GLOB '家庭影像库/[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]-[0-9][0-9]/*'
                   GROUP BY substr(rel_path,12,7) ORDER BY period""",
                (sid,),
            ).fetchall()
            periods = []
            suspicious_time = 0
            current_year = time.localtime().tm_year
            for row in periods_raw:
                key = str(row["period"] or "")
                if not re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])", key):
                    continue
                year = int(key[:4])
                if year < 1990 or year > current_year + 1:
                    suspicious_time += int(row["files"] or 0)
                    continue
                periods.append({
                    "period": key, "files": int(row["files"] or 0), "images": int(row["images"] or 0),
                    "videos": int(row["videos"] or 0), "gps": int(row["gps"] or 0),
                    "needsReview": int(row["needs_review"] or 0), "bytes": int(row["bytes"] or 0),
                })
            result = {
                "ok": True,
                "analysisStatus": ("running" if _photo_metadata_process_alive() else "paused")
                                  if analysis and str(analysis["status"]) == "running"
                                  else (str(analysis["status"]) if analysis else "not_started"),
                "total": int(summary["total"] or 0), "processed": int(summary["processed"] or 0),
                "withTime": int(summary["with_time"] or 0), "withGps": int(summary["with_gps"] or 0),
                "suspiciousTime": suspicious_time, "periods": periods, "places": [],
            }
            if not period:
                return result
            month_path = f"家庭影像库/{period[:4]}/{period}/*"
            place_rows = conn.execute(
                """SELECT round(latitude,1) latitude,round(longitude,1) longitude,count(*) files,
                          sum(CASE WHEN kind='image' THEN 1 ELSE 0 END) images,
                          sum(CASE WHEN kind='video' THEN 1 ELSE 0 END) videos,
                          sum(CASE WHEN metadata_review_needed=1 THEN 1 ELSE 0 END) needs_review,
                          coalesce(sum(size),0) bytes,min(rel_path) sample_path
                   FROM media_files
                   WHERE source_id=? AND status='active' AND kind IN ('image','video')
                     AND rel_path GLOB ? AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
                     AND NOT (latitude=0 AND longitude=0)
                   GROUP BY round(latitude,1),round(longitude,1)
                   ORDER BY files DESC LIMIT 24""",
                (sid, month_path),
            ).fetchall()
            selected = next((item for item in periods if item["period"] == period), None)
            places = []
            represented = 0
            place_names = _photo_offline_place_names(conn)
            for row in place_rows:
                lat, lng = float(row["latitude"]), float(row["longitude"])
                files = int(row["files"] or 0)
                represented += files
                sample = str(row["sample_path"] or "")
                top_dir = sample.split("/", 1)[0] if sample else ""
                places.append({
                    "key": f"{lat:.1f},{lng:.1f}", "label": _photo_place_display(place_names, lat, lng),
                    "latitude": lat, "longitude": lng, "files": files,
                    "images": int(row["images"] or 0), "videos": int(row["videos"] or 0),
                    "needsReview": int(row["needs_review"] or 0), "bytes": int(row["bytes"] or 0),
                    "context": top_dir,
                })
            gps_total = int(selected["gps"] if selected else represented)
            if gps_total > represented:
                places.append({"key": "other-gps", "label": "其他 GPS 地点", "files": gps_total - represented,
                               "images": 0, "videos": 0, "needsReview": 0, "bytes": 0, "context": ""})
            unknown = conn.execute(
                """SELECT count(*) files,sum(CASE WHEN kind='image' THEN 1 ELSE 0 END) images,
                          sum(CASE WHEN kind='video' THEN 1 ELSE 0 END) videos,
                          sum(CASE WHEN metadata_review_needed=1 THEN 1 ELSE 0 END) needs_review,
                          coalesce(sum(size),0) bytes
                   FROM media_files WHERE source_id=? AND status='active' AND kind IN ('image','video')
                     AND rel_path GLOB ? AND (latitude IS NULL OR longitude IS NULL
                         OR latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180
                         OR (latitude=0 AND longitude=0))""",
                (sid, month_path),
            ).fetchone()
            if unknown and int(unknown["files"] or 0):
                places.append({
                    "key": "unknown", "label": "无位置信息", "files": int(unknown["files"] or 0),
                    "images": int(unknown["images"] or 0), "videos": int(unknown["videos"] or 0),
                    "needsReview": int(unknown["needs_review"] or 0), "bytes": int(unknown["bytes"] or 0),
                    "context": "等待人工确认",
                })
            result.update({"selectedPeriod": period, "places": places})
            return result
    except (OSError, sqlite3.Error) as exc:
        return {**empty, "ok": False, "error": f"无法读取时间地点索引：{exc}"}


def photo_scan_start(spec):
    global _PHOTO_SCAN_PROC, _PHOTO_SCAN_LOG_HANDLE
    spec = spec or {}
    source = _photo_source_path(spec.get("source"))
    includes = spec.get("includes") or []
    if not isinstance(includes, list) or len(includes) > 20 or any(not isinstance(item, str) for item in includes):
        return {"ok": False, "error": "备份目录选择无效"}
    if includes:
        available = {item["relPath"] for item in photo_backup_directories({"source": str(source)})["directories"]
                     if item["readable"]}
        if len(set(includes)) != len(includes) or any(item not in available for item in includes):
            return {"ok": False, "error": "只能扫描当前 S300 中可读取的备份目录"}
    if _photo_metadata_process_alive() or _photo_organize_process_alive():
        return {"ok": False, "error": "时间分析或归档正在运行，请等待完成后再扫描"}
    script = PHOTO_SELECTED_INDEX_SCRIPT if includes else PHOTO_INDEX_SCRIPT
    if not script.is_file():
        return {"ok": False, "error": "照片索引程序缺失，请重新构建项目"}
    with _PHOTO_SCAN_LOCK:
        if _PHOTO_SCAN_PROC is not None and _PHOTO_SCAN_PROC.poll() is None:
            return {"ok": True, "status": "running", "processAlive": True, "source": str(source)}
        PHOTO_INDEX_DB.parent.mkdir(parents=True, exist_ok=True)
        log_handle = PHOTO_INDEX_LOG.open("a", encoding="utf-8")
        try:
            os.chmod(PHOTO_INDEX_LOG, 0o600)
        except OSError:
            pass
        if includes:
            cmd = [sys.executable, str(script), str(source), "--db", str(PHOTO_INDEX_DB)]
            for item in includes:
                cmd.extend(("--include", item))
        else:
            cmd = [sys.executable, str(script), "--db", str(PHOTO_INDEX_DB), "scan", str(source)]
            if bool(spec.get("newRun")):
                cmd.append("--new-run")
        try:
            _PHOTO_SCAN_PROC = subprocess.Popen(
                cmd, cwd=str(ROOT), stdout=log_handle, stderr=subprocess.STDOUT,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
            scan_proc = _PHOTO_SCAN_PROC
            _PHOTO_SCAN_LOG_HANDLE = log_handle
        except Exception:
            log_handle.close()
            raise
    threading.Thread(target=_backup_after_photo_job, args=(scan_proc, "scan"), daemon=True).start()
    result = photo_index_status()
    if result.get("status") == "not_started":
        result.update({"status": "running", "processAlive": True, "source": str(source)})
    return result


def photo_scan_pause():
    with _PHOTO_SCAN_LOCK:
        proc = _PHOTO_SCAN_PROC
        if proc is not None and proc.poll() is None:
            proc.terminate() if os.name == "nt" else proc.send_signal(signal.SIGINT)
            return {"ok": True, "status": "pausing", "processAlive": True}
    result = photo_index_status()
    result["message"] = result.get("message") or "当前没有正在运行的扫描"
    return result


def photo_metadata_start(spec):
    global _PHOTO_METADATA_PROC, _PHOTO_METADATA_LOG_HANDLE
    if _photo_process_alive():
        return {"ok": False, "error": "文件索引正在运行，请等待完成后再分析时间与地点"}
    source = _photo_source_path((spec or {}).get("source"))
    if not PHOTO_METADATA_SCRIPT.is_file():
        return {"ok": False, "error": "时间与地点分析程序缺失，请重新构建项目"}
    with _PHOTO_METADATA_LOCK:
        if _PHOTO_METADATA_PROC is not None and _PHOTO_METADATA_PROC.poll() is None:
            return {"ok": True, "metadataAnalysis": {"status": "running", "processAlive": True}}
        log_handle = PHOTO_METADATA_LOG.open("a", encoding="utf-8")
        with contextlib.suppress(OSError):
            os.chmod(PHOTO_METADATA_LOG, 0o600)
        cmd = [sys.executable, str(PHOTO_METADATA_SCRIPT), "--db", str(PHOTO_INDEX_DB)]
        try:
            _PHOTO_METADATA_PROC = subprocess.Popen(
                cmd, cwd=str(ROOT), stdout=log_handle, stderr=subprocess.STDOUT,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
            metadata_proc = _PHOTO_METADATA_PROC
            _PHOTO_METADATA_LOG_HANDLE = log_handle
        except Exception:
            log_handle.close()
            raise
    threading.Thread(target=_backup_after_photo_job, args=(metadata_proc, "metadata"), daemon=True).start()
    result = photo_index_status()
    result.setdefault("metadataAnalysis", {}).update({"status": "running", "processAlive": True})
    result["source"] = str(source)
    return result


def photo_metadata_pause():
    with _PHOTO_METADATA_LOCK:
        proc = _PHOTO_METADATA_PROC
        if proc is not None and proc.poll() is None:
            proc.terminate() if os.name == "nt" else proc.send_signal(signal.SIGINT)
            return {"ok": True, "status": "pausing"}
    return {"ok": True, "status": "paused", "message": "当前没有正在运行的时间与地点分析"}


def photo_organize_plan(spec):
    if _photo_process_alive() or _photo_metadata_process_alive() or _photo_organize_process_alive():
        return {"ok": False, "error": "请等待当前照片任务完成后再生成整理预演"}
    status = photo_index_status()
    if status.get("metadataAnalysis", {}).get("status") != "completed":
        return {"ok": False, "error": "请先完成时间与地点分析；预演不会使用未完成的日期"}
    if not PHOTO_ORGANIZE_SCRIPT.is_file():
        return {"ok": False, "error": "照片整理程序缺失，请重新构建项目"}
    target_name = str((spec or {}).get("targetName") or "家庭影像库").strip()
    result = subprocess.run(
        [sys.executable, str(PHOTO_ORGANIZE_SCRIPT), "--db", str(PHOTO_INDEX_DB),
         "plan", "--target-name", target_name],
        cwd=str(ROOT), text=True, capture_output=True, timeout=120,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    if result.returncode != 0:
        return {"ok": False, "error": (result.stderr or result.stdout or "生成整理预演失败").strip()}
    planned = photo_organize_status()
    planned["message"] = "预演已生成；尚未移动任何文件"
    photo_index_backup()
    return planned


def photo_organize_review_plan():
    """Plan the month/year/unclassified second pass for the completed first pass."""
    if _photo_process_alive() or _photo_metadata_process_alive() or _photo_organize_process_alive():
        return {"ok": False, "error": "请等待当前照片任务完成后再生成待确认项预演"}
    first_pass = photo_organize_status()
    if (first_pass.get("status") != "completed" or first_pass.get("layout") not in ("day", "month")
            or not first_pass.get("needsReview") or not first_pass.get("runId")):
        return {"ok": False, "error": "请先完成本轮可信时间文件整理"}
    if not PHOTO_REVIEW_ORGANIZE_SCRIPT.is_file():
        return {"ok": False, "error": "待确认项整理程序缺失，请重新构建项目"}
    result = subprocess.run(
        [sys.executable, str(PHOTO_REVIEW_ORGANIZE_SCRIPT), "--db", str(PHOTO_INDEX_DB),
         "--source-run-id", str(first_pass["runId"]), "plan"],
        cwd=str(ROOT), text=True, capture_output=True, timeout=120,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    if result.returncode != 0:
        return {"ok": False, "error": (result.stderr or result.stdout or "生成待确认项预演失败").strip()}
    planned = photo_organize_status()
    planned["message"] = "待确认项预演已生成；尚未移动任何文件"
    photo_index_backup()
    return planned


def photo_organize_start(spec=None):
    global _PHOTO_ORGANIZE_PROC, _PHOTO_ORGANIZE_LOG_HANDLE
    if _photo_process_alive() or _photo_metadata_process_alive():
        return {"ok": False, "error": "文件索引或时间分析仍在运行，请等待完成"}
    status = photo_organize_status()
    if status.get("status") == "not_started":
        return {"ok": False, "error": "请先生成并检查整理预演"}
    if status.get("status") == "completed":
        return status
    with _PHOTO_ORGANIZE_LOCK:
        if _PHOTO_ORGANIZE_PROC is not None and _PHOTO_ORGANIZE_PROC.poll() is None:
            return {**status, "status": "running", "processAlive": True}
        log_handle = PHOTO_ORGANIZE_LOG.open("a", encoding="utf-8")
        with contextlib.suppress(OSError):
            os.chmod(PHOTO_ORGANIZE_LOG, 0o600)
        command = [sys.executable, str(PHOTO_ORGANIZE_SCRIPT), "--db", str(PHOTO_INDEX_DB), "run",
                   "--profile-log", str(PHOTO_ORGANIZE_PROFILE)]
        try:
            max_entries = int((spec or {}).get("maxEntries") or 0)
        except (TypeError, ValueError):
            max_entries = 0
        try:
            workers = max(1, min(int((spec or {}).get("workers") or 16), 32))
            batch_size = max(workers, min(int((spec or {}).get("batchSize") or workers), 512))
        except (TypeError, ValueError):
            workers, batch_size = 16, 16
        command.extend(["--workers", str(workers), "--batch-size", str(batch_size)])
        if max_entries > 0:
            command.extend(["--max-entries", str(min(max_entries, 10_000))])
        try:
            _PHOTO_ORGANIZE_PROC = subprocess.Popen(
                command,
                cwd=str(ROOT), stdout=log_handle, stderr=subprocess.STDOUT,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
            organize_proc = _PHOTO_ORGANIZE_PROC
            _PHOTO_ORGANIZE_LOG_HANDLE = log_handle
        except Exception:
            log_handle.close()
            raise
    threading.Thread(target=_backup_after_photo_job, args=(organize_proc, "organize"), daemon=True).start()
    result = photo_organize_status()
    result.update({"status": "running", "processAlive": True})
    return result


def photo_organize_pause():
    with _PHOTO_ORGANIZE_LOCK:
        proc = _PHOTO_ORGANIZE_PROC
        if proc is not None and proc.poll() is None:
            proc.terminate() if os.name == "nt" else proc.send_signal(signal.SIGINT)
            return {"ok": True, "status": "pausing", "processAlive": True}
    result = photo_organize_status()
    result["message"] = result.get("message") or "当前没有正在运行的整理任务"
    return result


def photo_index_backup():
    """生成 SQLite 一致性快照；本机留档后，挂载可写时再复制到 S300。"""
    if not PHOTO_INDEX_DB.is_file():
        return {"ok": False, "error": "尚未建立照片索引"}
    stamp = time.strftime("%Y%m%d-%H%M%S") + f"-{int(time.time() * 1000) % 1000:03d}"
    local_dir = DATA_DIR / "backups" / "photo-index"
    local_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_dir / f"photo-index-{stamp}.sqlite3"
    temp_path = local_path.with_suffix(".tmp.sqlite3")
    try:
        with sqlite3.connect(PHOTO_INDEX_DB) as source, sqlite3.connect(temp_path) as dest:
            source.backup(dest)
        with contextlib.suppress(OSError):
            os.chmod(temp_path, 0o600)
        os.replace(temp_path, local_path)
    finally:
        with contextlib.suppress(OSError):
            if temp_path.exists():
                temp_path.unlink()

    try:
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=3) as conn:
            root_row = conn.execute(
                """SELECT s.root FROM scan_runs r JOIN sources s ON s.id=r.source_id
                   ORDER BY r.id DESC LIMIT 1"""
            ).fetchone()
        root = _photo_source_path(root_row[0] if root_row else None)
        if os.name != "nt" and not os.access(root, os.W_OK):
            raise ValueError(f"S300 当前没有写入权限：{root}")
        remote_dir = root / "我家里的一切-索引备份"
        remote_dir.mkdir(parents=True, exist_ok=True)
        remote_path = remote_dir / local_path.name
        remote_temp = remote_path.with_suffix(".uploading")
        shutil.copy2(local_path, remote_temp)
        os.replace(remote_temp, remote_path)
        return {"ok": True, "bytes": local_path.stat().st_size, "localPath": str(local_path), "remotePath": str(remote_path)}
    except Exception as exc:
        return {"ok": False, "error": f"本机备份已保存，但尚未上传到 S300：{exc}",
                "bytes": local_path.stat().st_size, "localPath": str(local_path)}


def _latest_index_source_root():
    if not PHOTO_INDEX_DB.is_file():
        return None
    try:
        uri = PHOTO_INDEX_DB.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=3) as conn:
            row = conn.execute(
                """SELECT s.root FROM scan_runs r JOIN sources s ON s.id=r.source_id
                   ORDER BY r.id DESC LIMIT 1"""
            ).fetchone()
        return Path(str(row[0])) if row and row[0] else None
    except (OSError, sqlite3.Error):
        return None


def _photo_handoff_roots():
    """Return mounted photo roots without trusting os.access on Windows SMB drives."""
    candidates = []
    indexed = _latest_index_source_root()
    if indexed:
        candidates.append(indexed)
    candidates.append(PHOTO_DEFAULT_SOURCE)
    for item in photo_sources():
        candidates.append(Path(str(item.get("path") or "")))
    seen, roots = set(), []
    for candidate in candidates:
        if not str(candidate):
            continue
        key = os.path.normcase(os.path.abspath(str(candidate)))
        if key in seen:
            continue
        seen.add(key)
        try:
            if candidate.is_dir():
                roots.append(candidate)
        except OSError:
            pass
    return roots


def _read_photo_handoff_manifest(bundle):
    with zipfile.ZipFile(bundle) as archive:
        names = set(archive.namelist())
        if names != {"photo-index.sqlite3", "handoff.json"}:
            raise ValueError("接力包内容不完整或格式不正确")
        manifest = json.loads(archive.read("handoff.json"))
    if int(manifest.get("bundleVersion", -1)) != 1:
        raise ValueError("接力包版本不受支持")
    return manifest


def _find_photo_handoff_bundle():
    matches = []
    for root in _photo_handoff_roots():
        handoff_dir = root / PHOTO_HANDOFF_DIR_NAME
        try:
            for pattern in ("photo-handoff-computer-*.zip", "photo-handoff-surface-*.zip"):
                for bundle in handoff_dir.glob(pattern):
                    if bundle.is_file():
                        matches.append((bundle.stat().st_mtime_ns, bundle, root))
        except OSError:
            continue
    return max(matches, key=lambda item: item[0]) if matches else None


def photo_handoff_status():
    found = _find_photo_handoff_bundle()
    source_root = None
    bundle = None
    manifest = None
    error = None
    if found:
        _, bundle, source_root = found
        try:
            manifest = _read_photo_handoff_manifest(bundle)
        except (OSError, ValueError, KeyError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
            error = f"接力包校验失败：{exc}"
    if source_root is None:
        source_root = _latest_index_source_root()
    return {
        "ok": error is None,
        "error": error,
        "platform": "windows" if os.name == "nt" else "mac" if sys.platform == "darwin" else "linux",
        "python": sys.executable,
        "pythonVersion": sys.version.split()[0],
        "sourceRoot": str(source_root) if source_root else None,
        "bundle": str(bundle) if bundle else None,
        "bundleBytes": bundle.stat().st_size if bundle and bundle.is_file() else 0,
        "manifest": manifest,
        "canExport": PHOTO_INDEX_DB.is_file() and bool(source_root and source_root.is_dir()),
        "canImport": bool(bundle and manifest and source_root and source_root.is_dir()),
        "indexDatabase": str(PHOTO_INDEX_DB),
    }


def _write_windows_launcher(source, destination):
    text = source.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    destination.write_bytes(text.replace("\n", "\r\n").encode("ascii"))


def photo_handoff_export():
    if _photo_process_alive() or _photo_metadata_process_alive() or _photo_organize_process_alive():
        return {"ok": False, "error": "请先暂停当前照片任务，再生成一致的接力包"}
    if not PHOTO_HANDOFF_SCRIPT.is_file():
        return {"ok": False, "error": "照片接力程序缺失，请更新代码"}
    if not PHOTO_INDEX_DB.is_file():
        return {"ok": False, "error": "尚未建立照片索引，无法生成接力包"}
    root = _latest_index_source_root()
    if not root or not root.is_dir():
        return {"ok": False, "error": "照片共享盘尚未挂载，无法保存接力包"}
    handoff_dir = root / PHOTO_HANDOFF_DIR_NAME
    handoff_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    bundle = handoff_dir / f"photo-handoff-computer-{stamp}.zip"
    result = subprocess.run(
        [sys.executable, str(PHOTO_HANDOFF_SCRIPT), "export", "--db", str(PHOTO_INDEX_DB),
         "--output", str(bundle)],
        cwd=str(ROOT), text=True, capture_output=True, timeout=1200,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    if result.returncode != 0:
        return {"ok": False, "error": (result.stderr or result.stdout or "生成接力包失败").strip()}
    launcher_sources = (
        (ROOT / "tools" / "windows" / "其他电脑一键继续照片整理.cmd", handoff_dir / "其他电脑一键继续照片整理.cmd"),
        (ROOT / "tools" / "windows" / "Surface一键继续照片整理.cmd", handoff_dir / "Surface一键继续照片整理.cmd"),
        (ROOT / "tools" / "windows" / "surface-handoff.ps1", handoff_dir / "surface-handoff.ps1"),
    )
    for source, destination in launcher_sources:
        if source.is_file():
            _write_windows_launcher(source, destination)
    status = photo_handoff_status()
    status.update({"ok": True, "action": "exported", "message": "其他电脑接力包已安全生成"})
    return status


def photo_handoff_import():
    if _photo_process_alive() or _photo_metadata_process_alive() or _photo_organize_process_alive():
        return {"ok": False, "error": "请先暂停当前照片任务，再导入接力索引"}
    if not PHOTO_HANDOFF_SCRIPT.is_file():
        return {"ok": False, "error": "照片接力程序缺失，请更新代码"}
    found = _find_photo_handoff_bundle()
    if not found:
        return {"ok": False, "error": "没有在已挂载的 S300 上找到其他电脑接力包"}
    _, bundle, root = found
    try:
        _read_photo_handoff_manifest(bundle)
    except (OSError, ValueError, KeyError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        return {"ok": False, "error": f"接力包校验失败：{exc}"}
    result = subprocess.run(
        [sys.executable, str(PHOTO_HANDOFF_SCRIPT), "import", "--bundle", str(bundle),
         "--db", str(PHOTO_INDEX_DB), "--source-root", str(root), "--replace", "--keep-newer"],
        cwd=str(ROOT), text=True, capture_output=True, timeout=1200,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    output = (result.stdout or "").strip()
    payload = None
    if output:
        with contextlib.suppress(json.JSONDecodeError):
            payload = json.loads(output.splitlines()[-1])
    if result.returncode != 0:
        detail = payload.get("error") if isinstance(payload, dict) else (result.stderr or output)
        return {"ok": False, "error": str(detail or "导入接力索引失败").strip()}
    status = photo_handoff_status()
    status.update({
        "ok": True, "action": "imported", "message": "索引已导入并重绑定到当前 S300",
        "importResult": payload, "index": photo_index_status(), "organize": photo_organize_status(),
    })
    return status


def _backup_after_photo_job(proc, phase):
    """完整扫描或元数据分析结束后自动做一致性快照；暂停不会产生冗余备份。"""
    try:
        exit_code = proc.wait()
        if exit_code != 0:
            return
        status = photo_index_status()
        completed = status.get("status") == "completed"
        if phase == "metadata":
            completed = status.get("metadataAnalysis", {}).get("status") == "completed"
        elif phase == "organize":
            completed = photo_organize_status().get("status") == "completed"
        if not completed:
            return
        result = photo_index_backup()
        line = json.dumps({"event": "automatic_index_backup", "phase": phase, **result}, ensure_ascii=False)
        with PHOTO_INDEX_LOG.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except Exception as exc:
        with contextlib.suppress(Exception):
            with PHOTO_INDEX_LOG.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps({"event": "automatic_index_backup_error", "phase": phase,
                                         "error": str(exc)}, ensure_ascii=False) + "\n")


def photo_index_reveal():
    """只在本机文件管理器中显示固定的索引数据库，不接受网页传入路径。"""
    target = PHOTO_INDEX_DB if PHOTO_INDEX_DB.is_file() else PHOTO_INDEX_DB.parent
    if sys.platform == "darwin":
        subprocess.Popen(["open", "-R", str(target)])
    elif os.name == "nt":
        subprocess.Popen(["explorer", "/select,", str(target)])
    else:
        subprocess.Popen(["xdg-open", str(target.parent if target.is_file() else target)])
    return {"ok": True, "path": str(target)}


def photo_scan_shutdown():
    """入口退出时让索引器在当前目录边界安全落盘，留下可续跑状态。"""
    with _PHOTO_SCAN_LOCK:
        proc = _PHOTO_SCAN_PROC
    if proc is not None and proc.poll() is None:
        try:
            proc.terminate() if os.name == "nt" else proc.send_signal(signal.SIGINT)
            proc.wait(timeout=8)
        except Exception:
            pass
    with _PHOTO_METADATA_LOCK:
        metadata_proc = _PHOTO_METADATA_PROC
    if metadata_proc is not None and metadata_proc.poll() is None:
        with contextlib.suppress(Exception):
            metadata_proc.terminate() if os.name == "nt" else metadata_proc.send_signal(signal.SIGINT)
            metadata_proc.wait(timeout=8)


def _atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)   # 目录被删/首次写入也能自愈
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    try:
        os.chmod(tmp, 0o600)   # 只有本人可读：文件里除了加密金库，还有其它子应用的明文数据
    except Exception:
        pass
    os.replace(tmp, path)   # 原子替换，避免写一半导致的半损坏文件


# 服务器是多线程的（ThreadingTCPServer），而 45 秒定时、页面隐藏、pagehide 的 sendBeacon
# 可能贴得很近。_atomic_write 用的是固定的 .tmp 文件名，两个请求同时进来会互相踩，
# os.replace 可能把写了一半的搬过去。整个「读旧值 → 比对 → 写新值」串行化。
_BACKUP_LOCK = threading.Lock()


def backup_save(raw: bytes) -> dict:
    """收下浏览器端打包好的「整屋备份」（各库数据已在浏览器里加密，服务端只当密文存盘）。
    写 current.home（最新），并在 backups/ 里留一份带时间戳的历史，轮转保留最近 BACKUP_KEEP 份。"""
    with _BACKUP_LOCK:
        return _backup_save_locked(raw)


def _backup_save_locked(raw: bytes) -> dict:
    bundle = json.loads(raw)
    if not isinstance(bundle, dict) or not bundle.get("__home_backup"):
        return {"ok": False, "error": "不是本系统的备份数据"}
    versions = bundle.get("backup_versions") or {}
    if isinstance(versions, dict) and isinstance(versions.get("finance"), int) and versions["finance"] > 0 and "familyvault.vault.v1" not in (bundle.get("localStorage") or {}):
        return {"ok": False, "error": "当前页面缺少已有理财库，已阻止空数据覆盖本机备份"}
    def _content(b):
        return json.dumps({"localStorage": b.get("localStorage"), "indexedDB": b.get("indexedDB")}, sort_keys=True, ensure_ascii=False)
    new_content = _content(bundle)
    old = {}
    old_raw = backup_latest()
    if old_raw is not None:
        try:
            old = json.loads(old_raw)
        except Exception:
            old = None
        if isinstance(old, dict):
            # 兼容护栏：磁盘上是更高数据版本(更新的 App)写的 → 本(旧)入口拒绝覆盖，避免写坏
            stored_dv = int(old.get("dataVersion") or 0)
            if stored_dv > DATA_VERSION:
                conflict = _save_rejected_bundle(bundle, "keep-旧版本冲突-")
                return {"ok": False, "error": "reject-downgrade", "storedDataVersion": stored_dv, "myDataVersion": DATA_VERSION,
                        "conflictCopy": conflict,
                        "hint": "磁盘上的数据是更新版本的 App 写的，本入口版本偏旧、已拒绝覆盖。请把本入口也更新到最新。"}
            # 内容没变就不更新时间戳——否则多入口会因时间戳变化互相触发无谓的“恢复”。
            # 数据版本落后时不能在这里短路：要让当前客户端把元数据升级，之后旧安装版才会被版本护栏挡住。
            if _content(old) == new_content and stored_dv >= DATA_VERSION and valid_backup_versions(old.get("backup_versions")):
                return {"ok": True, "savedAt": old.get("savedAt"), "bytes": len(old_raw), "dir": str(DATA_DIR), "unchanged": True, "backup_versions":old.get("backup_versions")}
            # 旧页面不带并发协议，无法证明它读到的是 current.home 的哪个版本。无条件拒绝覆盖，
            # 但把它想写的内容另存为安全副本，避免旧入口里刚做的编辑彻底丢失。
            if int(bundle.get("syncProtocol") or 0) != SYNC_PROTOCOL:
                conflict = _save_rejected_bundle(bundle, "keep-旧入口冲突-")
                return {"ok": False, "error": "legacy-client", "requiredSyncProtocol": SYNC_PROTOCOL,
                        "conflictCopy": conflict,
                        "hint": "这个页面版本太旧，不能安全覆盖当前数据。它的内容已另存为冲突副本；请关闭旧入口并使用最新版。"}
            # 乐观并发：客户端带上「我上次同步到的 savedAt」。磁盘上的比它新，说明另一个入口
            # （比如安装版和 VSCode 同时开着）在我之后写过——直接覆盖会把对方的改动抹掉。
            # 拒绝，让前端先把新的拉回来。老客户端不带这个字段则跳过检查（向后兼容）。
            expected=old.get("backup_versions")
            if valid_backup_versions(expected) and bundle.get("baseBackupVersions")!=expected:
                conflict=_save_rejected_bundle(bundle,"keep-版本冲突-")
                return {"ok":False,"error":"version-conflict","backup_versions":expected,"conflictCopy":conflict,"hint":"备份版本基线过期，原数据未覆盖；待写内容已另存。"}
    elif int(bundle.get("syncProtocol") or 0) != SYNC_PROTOCOL:
        return {"ok":False,"error":"legacy-client","requiredSyncProtocol":SYNC_PROTOCOL}
    try:
        bundle["backup_versions"]=next_versions(old,bundle)
    except ValueError as exc:
        return {"ok":False,"error":str(exc)}
    bundle.pop("baseBackupVersions",None)
    bundle.pop("baseBackupVersions",None)
    bundle.pop("baseSavedAt", None)   # 只用于校验，不落盘
    bundle["syncProtocol"] = SYNC_PROTOCOL
    bundle["dataVersion"] = DATA_VERSION
    bundle["appVersion"] = APP_VERSION
    bundle["appChannel"] = APP_CHANNEL
    bundle["savedAt"] = int(time.time() * 1000)
    data = json.dumps(bundle, ensure_ascii=False).encode("utf-8")
    (DATA_DIR / "backups").mkdir(parents=True, exist_ok=True)   # 运行中目录被删也能自愈
    _atomic_write(DATA_DIR / "current.home", data)
    _atomic_write(_fresh_backup_path("我家里的一切-备份-"), data)
    _prune_backups()
    try:
        (DATA_DIR / "meta.json").write_text(
            json.dumps({"appVersion": APP_VERSION, "savedAt": bundle["savedAt"], "bytes": len(data)}, ensure_ascii=False),
            encoding="utf-8")
    except Exception:
        pass
    return {"ok": True, "savedAt": bundle["savedAt"], "bytes": len(data), "dir": str(DATA_DIR), "backup_versions":bundle.get("backup_versions")}


def _save_rejected_bundle(bundle: dict, prefix: str) -> str:
    """把被拒绝覆盖的客户端状态另存为可恢复副本；调用者已经持有 _BACKUP_LOCK。"""
    copy = dict(bundle)
    copy.pop("baseSavedAt", None)
    copy.pop("baseBackupVersions",None)
    copy["rejectedAt"] = int(time.time() * 1000)
    copy["dataVersion"] = int(copy.get("dataVersion") or 0)
    data = json.dumps(copy, ensure_ascii=False).encode("utf-8")
    (DATA_DIR / "backups").mkdir(parents=True, exist_ok=True)
    path = _fresh_backup_path(prefix)
    _atomic_write(path, data)
    _prune_backups()
    return path.name


_TS_RE = re.compile(r"(\d{8})-(\d{6})")


def _fresh_backup_path(prefix: str) -> Path:
    """backups/<prefix><时间戳>.home；同一秒内连写两次（页面隐藏 + pagehide 贴得很近）不再互相覆盖，
    第二份加 -2、-3 后缀。"""
    ts = time.strftime("%Y%m%d-%H%M%S")
    d = DATA_DIR / "backups"
    p = d / f"{prefix}{ts}.home"
    i = 2
    while p.exists():
        p = d / f"{prefix}{ts}-{i}.home"
        i += 1
    return p


def _stamp_of(f: Path):
    """从文件名里取出 YYYYMMDD-HHMMSS；取不到就用 mtime。"""
    m = _TS_RE.search(f.name)
    if m:
        return m.group(1) + "-" + m.group(2)
    return time.strftime("%Y%m%d-%H%M%S", time.localtime(f.stat().st_mtime))


def _order_of(f: Path):
    """排序键。文件名只精确到秒，同一秒里写的两份（比如恢复前的安全副本和紧跟着的自动备份）
    光看名字分不出先后，再用 mtime 做次级键，顺序才是确定的。"""
    try:
        return (_stamp_of(f), f.stat().st_mtime)
    except Exception:
        return (_stamp_of(f), 0.0)


def _prune_backups():
    """分层保留，而不是只留最近 40 次。
    原来的问题：编辑得勤的时候 40 次只够半小时，一次错误状态能把所有好的历史全部滚掉。
    现在：最近 BACKUP_KEEP 次全留；再往前每天留当天最后一份、留 30 天；再往前每周留一份、留 12 周。
    手动的安全副本（keep- 开头，恢复前自动存的）单独计数，留最近 10 份，不参与上面的轮转。"""
    d = DATA_DIR / "backups"
    auto = sorted([f for f in d.glob("*.home") if not f.name.startswith("keep-")], key=_order_of)
    keep = set(auto[-BACKUP_KEEP:])
    # 按天 / 按周分桶，各桶取最后一份
    by_day, by_week = {}, {}
    for f in auto:
        st = _stamp_of(f)
        day = st[:8]
        try:
            t = time.strptime(day, "%Y%m%d")
            week = time.strftime("%G-%V", t)
        except Exception:
            week = day[:6]
        by_day[day] = f          # 同一天后面的覆盖前面的 → 留当天最后一份
        by_week[week] = f
    now = time.time()
    for day, f in by_day.items():
        try:
            age = (now - time.mktime(time.strptime(day, "%Y%m%d"))) / 86400
        except Exception:
            age = 0
        if age <= 30:
            keep.add(f)
    weeks = sorted(by_week.keys())[-12:]
    for w in weeks:
        keep.add(by_week[w])
    for f in auto:
        if f not in keep:
            try:
                f.unlink()
            except Exception:
                pass
    manual = sorted([f for f in d.glob("keep-*.home")], key=_order_of)
    for f in manual[:-10]:
        try:
            f.unlink()
        except Exception:
            pass


def backup_keep(raw: bytes) -> dict:
    """无条件把一份 bundle 存成安全副本（不动 current.home、不做过期检查）。
    用在「从备份恢复」之前：先把当前本机状态存下来，恢复错了还能回来。"""
    try:
        bundle = json.loads(raw)
    except Exception:
        return {"ok": False, "error": "不是合法的备份数据（JSON 解析失败）"}
    if not isinstance(bundle, dict) or not bundle.get("__home_backup"):
        return {"ok": False, "error": "不是本系统的备份数据"}
    bundle.pop("baseBackupVersions",None)
    bundle.pop("baseSavedAt", None)
    bundle["savedAt"] = int(time.time() * 1000)
    bundle["dataVersion"] = DATA_VERSION
    data = json.dumps(bundle, ensure_ascii=False).encode("utf-8")
    with _BACKUP_LOCK:
        p = _fresh_backup_path("keep-恢复前-")
        _atomic_write(p, data)
        _prune_backups()
    return {"ok": True, "name": p.name, "bytes": len(data)}


def backup_get(name: str):
    """按文件名取一份历史备份。只认 backups/ 里的 .home 文件名，防穿越。"""
    if not name or "/" in name or "\\" in name or name in (".", "..") or not name.endswith(".home"):
        return None
    base = (DATA_DIR / "backups").resolve()
    target = (base / name).resolve()
    if target.parent != base or not target.is_file():
        return None
    return target.read_bytes()


def backup_latest():
    p = DATA_DIR / "current.home"
    return p.read_bytes() if p.is_file() else None


def _tighten_perms():
    """启动时把旧版本留下的 644 备份文件收紧成 600（新写的文件在 _atomic_write 里已经是 600）。
    只在多用户系统上有意义；Windows 上 chmod 基本无效，失败静默。"""
    try:
        files = [DATA_DIR / "current.home", PHOTO_INDEX_DB, PHOTO_INDEX_LOG,
                 PHOTO_INDEX_DB.with_suffix(PHOTO_INDEX_DB.suffix + ".lock")] + list((DATA_DIR / "backups").glob("*.home"))
        for f in files:
            if f.is_file() and (f.stat().st_mode & 0o077):
                os.chmod(f, 0o600)
    except Exception:
        pass


def backup_list() -> dict:
    # 按时间倒序（最新在前），自动备份和 keep- 安全副本按真实时间穿插，而不是按文件名分成两堆
    files = sorted((DATA_DIR / "backups").glob("*.home"), key=_order_of, reverse=True)
    items = [{"name": f.name, "bytes": f.stat().st_size, "mtime": int(f.stat().st_mtime * 1000)} for f in files]
    cur = DATA_DIR / "current.home"
    return {"ok": True, "version": APP_VERSION, "dir": str(DATA_DIR),
            "current": (int(cur.stat().st_mtime * 1000) if cur.is_file() else None), "backups": items}


def resolve(path: str):
    p = path.split("?")[0].split("#")[0]
    if p in ("/", "/index.html"):
        return HUB
    for prefix, base in MOUNTS.items():
        if p == prefix or p.startswith(prefix + "/"):
            rel = p[len(prefix):].lstrip("/") or "index.html"
            target = (base / rel).resolve()
            if target.is_dir():
                target = target / "index.html"
            # 防目录穿越
            if str(target).startswith(str(base.resolve())) and target.is_file():
                return target
            return None
    return None


def _get_json(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def _yahoo_chart(symbol, rng="3mo"):
    """Yahoo 日线收盘：现价 + 前收 + 历史（统一收在 history[].usd 里，复用前端图表逻辑）。"""
    y = _get_json("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=1d" % (symbol, rng))
    res = y["chart"]["result"][0]
    meta = res.get("meta", {})
    ts = res.get("timestamp") or []
    closes = (res.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    hist = [{"t": ts[i] * 1000, "usd": closes[i]} for i in range(min(len(ts), len(closes))) if closes[i] is not None]
    return {"price": meta.get("regularMarketPrice") or (hist[-1]["usd"] if hist else None),
            "prevClose": meta.get("chartPreviousClose"), "history": hist}

def _usd_cny():
    """美元兑人民币（两个免费源，谁通用用谁，都不要 key）。"""
    for url in ("https://api.frankfurter.app/latest?from=USD&to=CNY", "https://open.er-api.com/v6/latest/USD"):
        try:
            return _get_json(url)["rates"]["CNY"]
        except Exception:
            continue
    return None

def fetch_gold(rng="3mo"):
    """黄金价格 + 走势（无需 API key，本机代取，避免浏览器跨域）。"""
    out = {"ok": False}
    try:  # 金价 + 历史：Yahoo 国际现货金期货 GC=F
        q = _yahoo_chart("GC=F", rng)
        out.update({"usdPerOz": q["price"], "prevClose": q["prevClose"], "history": q["history"], "src": "yahoo"})
    except Exception:
        try:  # 降级：只取现价
            g = _get_json("https://api.gold-api.com/price/XAU")
            out.update({"usdPerOz": g.get("price"), "prevClose": None, "history": [], "src": "gold-api"})
        except Exception:
            return {"ok": False, "error": "金价获取失败（需联网）"}
    out["usdCny"] = _usd_cny()
    out["ok"] = out.get("usdPerOz") is not None
    out["asOf"] = int(time.time() * 1000)
    return out

def fetch_btc(rng="3mo"):
    """比特币 BTC/USD 价格 + 走势（Yahoo BTC-USD，降级 Coinbase 现价），无需 API key。"""
    out = {"ok": False}
    try:
        q = _yahoo_chart("BTC-USD", rng)
        out.update({"usd": q["price"], "prevClose": q["prevClose"], "history": q["history"], "src": "yahoo"})
    except Exception:
        try:
            c = _get_json("https://api.coinbase.com/v2/prices/BTC-USD/spot")
            out.update({"usd": float(c["data"]["amount"]), "prevClose": None, "history": [], "src": "coinbase"})
        except Exception:
            return {"ok": False, "error": "比特币价格获取失败（需联网）"}
    out["usdCny"] = _usd_cny()
    out["ok"] = out.get("usd") is not None
    out["asOf"] = int(time.time() * 1000)
    return out

# ── 美债收益率 ──────────────────────────────────────────────
# 主源是美国财政部官方的「每日收益率曲线」CSV：整条曲线（1 月 ~ 30 年）都有，
# 不要 key、不要注册，就是个静态文件。降级用 Yahoo 的几个收益率指数。
UST_HISTORY_KEYS = ["3M", "2Y", "5Y", "10Y", "30Y"]   # 走势图只回这几档，省流量
_UST_HDR = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(mo|month|yr|year)s?\s*$", re.I)


def _ust_tenor(header):
    """把 CSV 表头（"1 Mo" / "1.5 Month" / "10 Yr"）变成 ("10Y", 120.0)。认不出来返回 None。"""
    m = _UST_HDR.match(header or "")
    if not m:
        return None
    n = float(m.group(1))
    months = n if m.group(2).lower().startswith("mo") else n * 12
    key = ("%g" % months) + "M" if months < 12 else ("%g" % (months / 12)) + "Y"
    return key, months


def _ust_year(year):
    """取某一年的每日收益率曲线。返回 (按日期升序的行, {档位: 月数})。
    行的形状：{"date": "2026-09-10", "t": 毫秒, "y": {"10Y": 4.12, ...}}"""
    url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
           "daily-treasury-rates.csv/%d/all?type=daily_treasury_yield_curve"
           "&field_tdr_date_year=%d&page&_format=csv" % (year, year))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/csv, */*"})
    with urllib.request.urlopen(req, timeout=25) as r:
        text = r.read().decode("utf-8-sig", "replace")
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 2:
        return [], {}
    # 表头里哪几列是档位（列的顺序/有无各年不同，所以按名字认，不按位置）
    cols, months_of = [], {}
    for i, h in enumerate(rows[0]):
        t = _ust_tenor(h)
        if t:
            cols.append((i, t[0]))
            months_of[t[0]] = t[1]
    out = []
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        try:
            mo, da, yr = row[0].strip().split("/")
            yr, mo, da = int(yr), int(mo), int(da)
            ms = int(time.mktime((yr, mo, da, 12, 0, 0, 0, 0, -1)) * 1000)   # 正午，避开时区把日期推偏
        except Exception:
            continue
        y = {}
        for i, key in cols:
            if i < len(row) and row[i].strip():
                try:
                    y[key] = float(row[i].strip())
                except Exception:
                    pass
        if y:
            out.append({"date": "%04d-%02d-%02d" % (yr, mo, da), "t": ms, "y": y})
    out.sort(key=lambda x: x["date"])
    return out, months_of


def _ust_yahoo():
    """降级：Yahoo 的收益率指数，只够拼出一条很粗的曲线，没有完整历史。"""
    out = {}
    for sym, key in (("%5EIRX", "3M"), ("%5EFVX", "5Y"), ("%5ETNX", "10Y"), ("%5ETYX", "30Y")):
        try:
            v = _yahoo_chart(sym, "5d")["price"]
            if v is None:
                continue
            # Yahoo 这几个指数历史上按「收益率 ×10」报（42.5 = 4.25%），后来改成直接报。
            # 收益率不可能到 25%，据此两种口径都能兜住。
            out[key] = v / 10.0 if v > 25 else v
        except Exception:
            continue
    return out


def fetch_ust(rng="3mo"):
    """美债收益率：最新一整条曲线 + 上一交易日（算日涨跌）+ 常用几档的历史走势。"""
    days = {"1mo": 32, "3mo": 95, "6mo": 190, "1y": 370}.get(rng, 95)
    cutoff = time.time() - days * 86400
    rows, months_of, err = [], {}, None
    try:
        year = time.gmtime().tm_year
        rows, months_of = _ust_year(year)
        # 当年文件不够长（尤其年初），再补上一年
        if not rows or rows[0]["t"] / 1000.0 > cutoff:
            try:
                prev_rows, prev_months = _ust_year(year - 1)
                rows = prev_rows + rows
                for k, v in prev_months.items():
                    months_of.setdefault(k, v)
            except Exception:
                pass
    except Exception as e:
        err = str(e)

    if not rows:
        curve = _ust_yahoo()
        if not curve:
            return {"ok": False, "error": "美债收益率获取失败（需联网）" + (" · " + err if err else "")}
        tenors = [{"key": k, "months": {"3M": 3, "5Y": 60, "10Y": 120, "30Y": 360}[k]} for k in curve]
        tenors.sort(key=lambda x: x["months"])
        return {"ok": True, "src": "yahoo", "asOf": int(time.time() * 1000), "partial": True,
                "tenors": tenors, "latest": {"date": None, "y": curve}, "prev": None,
                "history": {}, "curves": [],
                "note": "只取到当前收益率，没有历史走势（财政部数据源暂时取不到）"}

    kept = [r for r in rows if r["t"] / 1000.0 >= cutoff]
    if len(kept) < 2:
        kept = rows[-60:]
    latest = rows[-1]
    prev = rows[-2] if len(rows) >= 2 else None
    tenors = sorted(({"key": k, "months": m} for k, m in months_of.items()), key=lambda x: x["months"])
    history = {}
    for k in UST_HISTORY_KEYS:
        pts = [{"t": r["t"], "usd": r["y"][k]} for r in kept if k in r["y"]]
        if len(pts) >= 2:
            history[k] = pts

    # 曲线对比：现在 / 约一个月前 / 所选区间最早那期（去重，按日期新→旧）
    def nearest(target_ms):
        return min(rows, key=lambda r: abs(r["t"] - target_ms)) if rows else None
    picks, seen = [], set()
    for r in (latest, nearest(latest["t"] - 30 * 86400000), kept[0]):
        if r and r["date"] not in seen:
            seen.add(r["date"])
            picks.append({"date": r["date"], "t": r["t"], "y": r["y"]})
    picks.sort(key=lambda x: x["date"], reverse=True)

    return {"ok": True, "src": "treasury", "asOf": int(time.time() * 1000),
            "tenors": tenors, "latest": {"date": latest["date"], "t": latest["t"], "y": latest["y"]},
            "prev": ({"date": prev["date"], "y": prev["y"]} if prev else None),
            "history": history, "curves": picks, "points": len(kept)}


FX_SYMBOLS = ["CNY", "EUR", "JPY", "HKD", "GBP", "KRW", "TWD", "AUD"]
def fetch_fx(rng="3mo"):
    """美元汇率：USD 兑一篮子货币（现价）+ USD/CNY 走势。frankfurter / er-api，无需 key。"""
    out = {"ok": False, "base": "USD"}
    rates = {}
    try:
        j = _get_json("https://api.frankfurter.app/latest?from=USD&to=%s" % ",".join(FX_SYMBOLS))
        rates = j.get("rates", {})
    except Exception:
        try:
            allr = _get_json("https://open.er-api.com/v6/latest/USD").get("rates", {})
            rates = {k: allr[k] for k in FX_SYMBOLS if k in allr}
        except Exception:
            return {"ok": False, "error": "汇率获取失败（需联网）"}
    out["rates"] = rates
    out["cny"] = rates.get("CNY")
    hist = []  # USD/CNY 走势（frankfurter 时间序列，开区间到今天）
    try:
        days = {"1mo": 32, "3mo": 95, "6mo": 190, "1y": 370}.get(rng, 95)
        start = time.strftime("%Y-%m-%d", time.gmtime(time.time() - days * 86400))
        r = _get_json("https://api.frankfurter.app/%s..?from=USD&to=CNY" % start).get("rates", {})
        for d in sorted(r.keys()):
            v = r[d].get("CNY")
            if v is not None:
                hist.append({"t": int(time.mktime(time.strptime(d, "%Y-%m-%d"))) * 1000, "usd": v})
    except Exception:
        pass
    out["history"] = hist
    out["ok"] = bool(rates)
    out["asOf"] = int(time.time() * 1000)
    return out


# ─────────────────────────── 看球：比分 / 赛程（本机代取，无需 API key）──────────────
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"
# 只代理这些公开联赛（白名单，避免被当任意 URL 代理）
SPORT_LEAGUES = {
    "fifa.world": "soccer/fifa.world",          # 世界杯（男足）
    "nba": "basketball/nba",                     # NBA
    "wnba": "basketball/wnba",
    "eng.1": "soccer/eng.1",                     # 英超
    "esp.1": "soccer/esp.1",                     # 西甲
    "ita.1": "soccer/ita.1",                     # 意甲
    "ger.1": "soccer/ger.1",                     # 德甲
    "uefa.champions": "soccer/uefa.champions",   # 欧冠
}

def _espn_side(c):
    t = (c or {}).get("team", {}) or {}
    return {"name": t.get("displayName"), "short": t.get("shortDisplayName") or t.get("abbreviation") or t.get("name"),
            "abbr": t.get("abbreviation"), "logo": t.get("logo"),
            "score": c.get("score"), "winner": bool(c.get("winner"))}

def _espn_event(ev):
    comp = (ev.get("competitions") or [{}])[0]
    cs = comp.get("competitors") or []
    home = next((x for x in cs if x.get("homeAway") == "home"), None)
    away = next((x for x in cs if x.get("homeAway") == "away"), None)
    st = (ev.get("status") or {}).get("type", {}) or {}
    note = ""
    notes = comp.get("notes") or []
    if isinstance(notes, list) and notes:
        note = notes[0].get("headline") or ""
    odds = None
    od = comp.get("odds") or []
    if isinstance(od, list) and od:
        odds = od[0].get("details")  # 庄家盘口，仅供参考
    return {
        "id": ev.get("id"), "date": ev.get("date"),
        "name": ev.get("shortName") or ev.get("name"),
        "state": st.get("state"),                 # pre / in / post
        "completed": bool(st.get("completed")),
        "detail": st.get("shortDetail") or st.get("detail") or "",
        "note": note, "odds": odds,
        "home": _espn_side(home) if home else None,
        "away": _espn_side(away) if away else None,
    }

def fetch_sports(league, dates=None):
    path = SPORT_LEAGUES.get(league)
    if not path:
        return {"ok": False, "error": "未知联赛：%s" % league}
    url = "%s/%s/scoreboard" % (ESPN_BASE, path)
    if dates:
        url += "?dates=%s" % dates
    try:
        raw = _get_json(url, timeout=15)
    except Exception as e:
        return {"ok": False, "error": "拉取失败（需联网）：%s" % e}
    events = [_espn_event(ev) for ev in (raw.get("events") or [])]
    try:
        lname = (raw.get("leagues") or [{}])[0].get("name") or ""
    except Exception:
        lname = ""
    return {"ok": True, "league": league, "leagueName": lname, "events": events, "asOf": int(time.time() * 1000)}


# ─────────────────────────── 磁盘扫描 / 清理（本机） ───────────────────────────
HOME = os.path.expanduser("~")
def _exp(p): return os.path.expanduser(p)

def _du_bytes(path):
    try:
        out = subprocess.run(["du", "-sk", path], capture_output=True, text=True, timeout=300)
        return int(out.stdout.split("\t")[0].split()[0]) * 1024
    except Exception:
        return 0

def _disk_df():
    """整机根卷的 总量 / 已用 / 可用（df -k /，macOS 与 Linux 列位相同）。"""
    try:
        out = subprocess.run(["df", "-k", "/"], capture_output=True, text=True, timeout=15)
        f = out.stdout.strip().splitlines()[1].split()
        return {"total": int(f[1]) * 1024, "used": int(f[2]) * 1024, "free": int(f[3]) * 1024}
    except Exception:
        return None

def disk_scan():
    """默认入口：用户目录(home)下一层。复用 disk_ls 以保证与逐层下钻完全一致
    （含 home 里散落的文件、total 取 du 自身行的真实总量），避免「总量对不上」。"""
    r = disk_ls(HOME)
    if isinstance(r, dict) and r.get("ok"):
        r["asOf"] = int(time.time() * 1000)
    return r

def disk_ls(path):
    """列出某文件夹下一层（文件+子目录）及各自占用，用于逐层下钻。只读、限用户目录内。"""
    rp = os.path.realpath(_exp(path)) if path else "/"
    if not os.path.isdir(rp):
        return {"ok": False, "error": "不是文件夹或不存在"}
    partial = False
    try:
        out = subprocess.run(["du", "-k", "-a", "-d", "1", rp], capture_output=True, text=True, timeout=1800)
        stdout, stderr = out.stdout, out.stderr
    except subprocess.TimeoutExpired as e:  # 整机/超大目录可能超时——尽量用已拿到的部分结果
        stdout = (e.stdout.decode("utf-8", "replace") if isinstance(e.stdout, bytes) else e.stdout) or ""
        stderr = (e.stderr.decode("utf-8", "replace") if isinstance(e.stderr, bytes) else e.stderr) or ""
        partial = True
    except Exception as e:
        return {"ok": False, "error": str(e)}
    items, total = [], 0
    for line in stdout.splitlines():
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        kb, full = parts
        try:
            b = int(kb) * 1024
        except ValueError:
            continue
        if full == rp:
            total = b
            continue
        if os.path.dirname(full) != rp:
            continue
        items.append({"path": full, "label": os.path.basename(full), "bytes": b, "isDir": os.path.isdir(full) and not os.path.islink(full)})
    # 从 stderr 里挑出具体是哪些文件夹被拒绝的（macOS du: "du: /x/y: Operation not permitted"），
    # 给前端一个能直接点名道姓的列表，而不是一句含糊的"有权限问题"。这一步要在"items 是否为空"
    # 判断之前做——因为「这一层整个都读不到」（比如直接点进桌面/文稿）时 items 会是空的，
    # 以前会在下面提前 return 一个干巴巴的错误字符串，白白扔掉这里本能给出的具体文件夹名单。
    denied_paths = []
    for line in stderr.splitlines():
        m = re.match(r"^du:\s*(?:cannot read directory\s*)?'?([^:']+)'?\s*:?\s*(Operation not permitted|Permission denied)", line.strip())
        if m:
            p = m.group(1).strip().rstrip(":")
            if not p:
                continue
            label = "这一层本身" if p == rp else (os.path.basename(p) or p)
            if label not in denied_paths:
                denied_paths.append(label)
    if not items and stderr.strip():
        if denied_paths:
            # 整层都读不到，但至少能点名道姓——照样走"成功但受限"的返回形状，
            # 让前端画那条可操作的权限横幅，而不是丢一句用户没法照做的错误文案。
            return {"ok": True, "path": rp, "parent": os.path.dirname(rp), "home": HOME,
                    "items": [], "total": 0, "scanned": 0, "disk": _disk_df(),
                    "partial": partial, "denied": True, "deniedPaths": denied_paths[:8]}
        return {"ok": False, "error": "读取受限（可能需要在 系统设置→隐私→完全磁盘访问 授权），且没能定位到具体是哪个文件夹"}
    items.sort(key=lambda x: -x["bytes"])
    return {"ok": True, "path": rp, "parent": os.path.dirname(rp), "home": HOME,
            "items": items, "total": total or sum(i["bytes"] for i in items),
            "scanned": sum(i["bytes"] for i in items), "disk": _disk_df(),
            "partial": partial, "denied": bool(stderr.strip()), "deniedPaths": denied_paths[:8]}

CLEAN_TARGETS = [
    {"id": "user-caches", "label": "用户缓存（各 App）", "desc": "~/Library/Caches，会自动重建", "paths": ["~/Library/Caches"], "contents": True},
    {"id": "user-logs", "label": "用户日志", "desc": "~/Library/Logs", "paths": ["~/Library/Logs"], "contents": True},
    {"id": "xcode-derived", "label": "Xcode DerivedData", "desc": "编译中间产物，可重建", "paths": ["~/Library/Developer/Xcode/DerivedData"], "contents": True},
    {"id": "xcode-dev", "label": "Xcode 调试缓存", "desc": "iOS DeviceSupport / 模拟器缓存", "paths": ["~/Library/Developer/Xcode/iOS DeviceSupport", "~/Library/Developer/CoreSimulator/Caches"], "contents": True},
    {"id": "npm", "label": "npm 缓存", "desc": "~/.npm/_cacache", "paths": ["~/.npm/_cacache"], "contents": True},
    {"id": "pip", "label": "pip 缓存", "desc": "~/Library/Caches/pip", "paths": ["~/Library/Caches/pip"], "contents": True},
    {"id": "brew", "label": "Homebrew 缓存", "desc": "~/Library/Caches/Homebrew", "paths": ["~/Library/Caches/Homebrew"], "contents": True},
    {"id": "trash", "label": "清空废纸篓", "desc": "永久清空 ~/.Trash（不可恢复）", "paths": ["~/.Trash"], "contents": True, "permanentOnly": True},
]

def disk_targets():
    out = []
    for t in CLEAN_TARGETS:
        size, exists = 0, False
        for p in t["paths"]:
            ep = _exp(p)
            if os.path.exists(ep):
                exists = True
                size += _du_bytes(ep)
        out.append({"id": t["id"], "label": t["label"], "desc": t.get("desc", ""), "bytes": size, "exists": exists, "permanentOnly": t.get("permanentOnly", False)})
    return {"ok": True, "targets": out}

_BLOCK = {os.path.realpath(p) for p in ["/", HOME, "/System", "/Library", "/Users", "/Applications", "/usr", "/bin", "/sbin", "/etc", "/private", "/var", "/opt",
         os.path.join(HOME, "Documents"), os.path.join(HOME, "Desktop"), os.path.join(HOME, "Downloads"), os.path.join(HOME, "Pictures"), os.path.join(HOME, "Movies"), os.path.join(HOME, "Music"), os.path.join(HOME, "Library")]}

def _safe_custom(path):
    rp = os.path.realpath(_exp(path))
    if rp in _BLOCK or not os.path.exists(rp):
        return None
    if not rp.startswith(HOME + os.sep):
        return None  # 只允许清理 home 下
    if len(rp.rstrip(os.sep).split(os.sep)) < 4:
        return None  # 太靠近根，拒绝
    return rp

def _to_trash(item):
    trash = _exp("~/.Trash")
    os.makedirs(trash, exist_ok=True)
    base = os.path.basename(item.rstrip(os.sep)) or "item"
    dest = os.path.join(trash, base)
    n = 1
    while os.path.exists(dest):
        dest = os.path.join(trash, "%s %d" % (base, n)); n += 1
    shutil.move(item, dest)

def _rm(item):
    if os.path.isdir(item) and not os.path.islink(item):
        shutil.rmtree(item)
    else:
        os.remove(item)

def disk_clean(spec):
    mode = "delete" if spec.get("mode") == "delete" else "trash"
    tid = spec.get("id")
    if tid:
        t = next((x for x in CLEAN_TARGETS if x["id"] == tid), None)
        if not t:
            return {"ok": False, "error": "未知清理项"}
        paths = [_exp(p) for p in t["paths"]]
        contents = t.get("contents", True)
        if t.get("permanentOnly"):
            mode = "delete"  # 废纸篓只能永久清
    elif spec.get("path"):
        rp = _safe_custom(spec["path"])
        if not rp:
            return {"ok": False, "error": "该路径不允许清理（关键目录 / 不在用户目录下 / 不存在）"}
        paths, contents = [rp], bool(spec.get("contents", False))
    else:
        return {"ok": False, "error": "缺少清理目标"}
    freed, count, errs = 0, 0, []
    for base in paths:
        if not os.path.exists(base):
            continue
        try:
            items = [os.path.join(base, c) for c in os.listdir(base)] if contents else [base]
        except Exception as e:
            errs.append(str(e)); continue
        for it in items:
            try:
                sz = _du_bytes(it)
                _rm(it) if (mode == "delete") else _to_trash(it)
                freed += sz; count += 1
            except Exception as e:
                errs.append(str(e))
    return {"ok": True, "freed": freed, "count": count, "mode": mode, "errors": errs[:5]}


# Health archives live outside the browser workspace backup. Manual full backups
# package both stores together and encrypt them before they can be copied offsite.
# Also support importlib-based regression scripts launched from scripts/.
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from health_archive import HealthArchive, MAX_BYTES as HEALTH_MAX_BYTES
from apple_health_activity import import_zip as import_apple_health, public as apple_activity_public
_HEALTH_SEED = ROOT / "health-data.local"
_HEALTH_ROOT = Path(os.environ.get("HOME_HEALTH_DIR") or (str(_HEALTH_SEED) if (_HEALTH_SEED / "archive-index.json").exists() else str(DATA_DIR / "health")))
HEALTH_ARCHIVE = HealthArchive(_HEALTH_ROOT)


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _trusted_local_host(self):
        host = self.headers.get("Host", "")
        return bool(re.fullmatch(r"(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?", host, re.I))

    def do_GET(self):
        if not self._trusted_local_host():
            self.send_error(403)
            return
        # 子应用根路径未带斜杠时重定向，确保相对资源解析正确
        bare = self.path.split("?")[0]
        if bare in ("/finance", "/gallery", "/vault", "/dev"):
            self.send_response(301)
            self.send_header("Location", bare + "/")
            self.end_headers()
            return
        if bare in ("/api/health/archive", "/api/health/source", "/api/health/export"):
            from urllib.parse import urlparse, parse_qs
            try:
                if bare == "/api/health/archive":
                    return self._send_json(HEALTH_ARCHIVE.public())
                if bare == "/api/health/source":
                    sid = (parse_qs(urlparse(self.path).query).get("id") or [""])[0]
                    body = HEALTH_ARCHIVE.source(sid)
                    mime = HEALTH_ARCHIVE.source_mime(sid)
                else:
                    body = HEALTH_ARCHIVE.export()
                    mime = "application/zip"
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "private, no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                if mime == "application/zip":
                    self.send_header("Content-Disposition", 'attachment; filename="health-archive.zip"')
                self.end_headers()
                self.wfile.write(body)
            except (ValueError, OSError, KeyError) as exc:
                return self._send_json({"ok": False, "error": str(exc)})
            return
        if bare == "/api/health/activity":
            return self._send_json(apple_activity_public(_HEALTH_ROOT))
        if bare == "/api/health/activity/export":
            body = json.dumps(apple_activity_public(_HEALTH_ROOT), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="apple-watch-activity.json"')
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers(); self.wfile.write(body)
            return
        if bare == "/api/gold":
            from urllib.parse import urlparse, parse_qs
            rng = (parse_qs(urlparse(self.path).query).get("range") or ["3mo"])[0]
            if rng not in ("1mo", "3mo", "6mo", "1y"):
                rng = "3mo"
            try:
                body = json.dumps(fetch_gold(rng)).encode("utf-8")
            except Exception as e:
                body = json.dumps({"ok": False, "error": str(e)}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if bare in ("/api/btc", "/api/fx", "/api/ust"):
            from urllib.parse import urlparse, parse_qs
            rng = (parse_qs(urlparse(self.path).query).get("range") or ["3mo"])[0]
            if rng not in ("1mo", "3mo", "6mo", "1y"):
                rng = "3mo"
            fn = {"/api/btc": fetch_btc, "/api/fx": fetch_fx, "/api/ust": fetch_ust}[bare]
            try:
                body = fn(rng)
            except Exception as e:
                body = {"ok": False, "error": str(e)}
            return self._send_json(body)
        if bare == "/api/sports":
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            league = (q.get("league") or ["fifa.world"])[0]
            raw_dates = (q.get("dates") or [""])[0]
            dates = "".join(ch for ch in raw_dates if ch.isdigit() or ch == "-") or None
            try:
                body = fetch_sports(league, dates)
            except Exception as e:
                body = {"ok": False, "error": str(e)}
            return self._send_json(body)
        if bare == "/api/version":
            return self._send_json({"ok": True, "version": APP_VERSION, "channel": APP_CHANNEL,
                                    "label": APP_LABEL, "dataVersion": DATA_VERSION,
                                    "syncProtocol": SYNC_PROTOCOL, "dir": str(DATA_DIR)})
        if bare == "/api/backup/latest":
            data = backup_latest()
            if not data:
                self.send_response(204)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        if bare == "/api/backup/get":
            from urllib.parse import urlparse, parse_qs, unquote
            q = parse_qs(urlparse(self.path).query)
            name = unquote((q.get("name") or [""])[0])
            data = backup_get(name)
            if data is None:
                self.send_error(404); return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if bare == "/api/backup/list":
            return self._send_json(backup_list())
        if bare == "/api/disk/scan":
            return self._send_json(disk_scan())
        if bare == "/api/disk/targets":
            return self._send_json(disk_targets())
        if bare == "/api/disk/ls":
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self._send_json(disk_ls((q.get("path") or [""])[0]))
        if bare == "/api/photos/index/status":
            return self._send_json(photo_index_status())
        if bare == "/api/photos/index/backup-directories":
            from urllib.parse import urlparse, parse_qs
            try:
                source = (parse_qs(urlparse(self.path).query).get("source") or [None])[0]
                result = photo_backup_directories({"source": source})
            except (ValueError, OSError, sqlite3.Error) as exc:
                result = {"ok": False, "error": str(exc), "directories": []}
            return self._send_json(result)
        if bare == "/api/photos/index/files":
            from urllib.parse import urlparse, parse_qs
            return self._send_json(photo_index_files(parse_qs(urlparse(self.path).query)))
        if bare == "/api/photos/browse/summary":
            return self._send_json(photo_browse_summary())
        if bare == "/api/photos/storage":
            from urllib.parse import urlparse, parse_qs
            refresh = (parse_qs(urlparse(self.path).query).get("refresh") or ["0"])[0] == "1"
            return self._send_json(photo_storage_status(force=refresh))
        if bare == "/api/photos/people":
            return self._send_json(photo_people_list())
        if bare == "/api/photos/people/for-media":
            from urllib.parse import urlparse, parse_qs
            try:
                path = (parse_qs(urlparse(self.path).query).get("path") or [""])[0]
                return self._send_json(photo_people_for_media(path))
            except (ValueError, FileNotFoundError, sqlite3.Error) as exc:
                return self._send_json({"ok": False, "error": str(exc)})
        if bare == "/api/photos/people/sample":
            from urllib.parse import urlparse, parse_qs
            try:
                sample_id = (parse_qs(urlparse(self.path).query).get("id") or [""])[0]
                data = photo_people_sample_image(sample_id)
            except (ValueError, FileNotFoundError):
                self.send_error(404); return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)
            return
        if bare == "/api/photos/addresses":
            return self._send_json(photo_address_labels())
        if bare == "/api/photos/browse/items":
            from urllib.parse import urlparse, parse_qs
            return self._send_json(photo_browse_items(parse_qs(urlparse(self.path).query)))
        if bare == "/api/photos/browse/trash/preview":
            from urllib.parse import urlparse, parse_qs
            try:
                path = (parse_qs(urlparse(self.path).query).get("path") or [""])[0]
                return self._send_json(photo_trash_preview(path))
            except (ValueError, FileNotFoundError, OSError, sqlite3.Error) as exc:
                return self._send_json({"ok": False, "error": str(exc)})
        if bare == "/api/photos/browse/trash/status":
            return self._send_json(photo_trash_status())
        if bare == "/api/photos/browse/preview":
            from urllib.parse import urlparse, parse_qs
            try:
                data, content_type = photo_browse_preview(parse_qs(urlparse(self.path).query))
            except FileNotFoundError:
                self.send_error(404); return
            except (ValueError, RuntimeError, subprocess.TimeoutExpired, OSError, sqlite3.Error):
                self.send_error(422); return
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)
            return
        if bare == "/api/photos/browse/video":
            from urllib.parse import urlparse, parse_qs
            try:
                path, size, content_type = photo_browse_video(parse_qs(urlparse(self.path).query))
            except FileNotFoundError:
                self.send_error(404); return
            except (ValueError, OSError, sqlite3.Error):
                self.send_error(422); return
            if size < 1:
                self.send_error(416); return
            start, end = 0, size - 1
            requested = self.headers.get("Range")
            if requested:
                match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested.strip())
                if not match or (not match[1] and not match[2]):
                    self.send_error(416); return
                if match[1]:
                    start = int(match[1])
                    end = min(size - 1, int(match[2])) if match[2] else size - 1
                else:
                    start = max(0, size - int(match[2]))
                if start >= size or end < start:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
            self.send_response(206 if requested else 200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(end - start + 1))
            if requested:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            try:
                with path.open("rb") as media:
                    media.seek(start)
                    remaining = end - start + 1
                    while remaining:
                        block = media.read(min(1024 * 1024, remaining))
                        if not block:
                            break
                        self.wfile.write(block)
                        remaining -= len(block)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if bare == "/api/photos/timeline":
            from urllib.parse import urlparse, parse_qs
            return self._send_json(photo_timeline(parse_qs(urlparse(self.path).query)))
        if bare == "/api/photos/organize/status":
            return self._send_json(photo_organize_status())
        if bare == "/api/photos/duplicates/status":
            return self._send_json(photo_duplicate_status())
        if bare == "/api/photos/duplicates/cleanup/status":
            return self._send_json(photo_duplicate_cleanup_status())
        if bare == "/api/photos/handoff/status":
            return self._send_json(photo_handoff_status())
        target = resolve(self.path)
        if not target:
            self.send_error(404)
            return
        data = Path(target).read_bytes()
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self._trusted_local_host():
            self.send_error(403)
            return
        bare = self.path.split("?")[0]
        if bare == "/api/health/import":
            if self.headers.get("Origin", "") != "http://" + self.headers.get("Host", ""):
                self.send_error(403); return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= HEALTH_MAX_BYTES:
                    raise ValueError("请选择不超过 100 MB 的健康档案 JSON 或 ZIP")
                result = HEALTH_ARCHIVE.import_data(self.rfile.read(length))
            except (ValueError, OSError, KeyError, zipfile.BadZipFile) as exc:
                result = {"ok": False, "error": str(exc)}
            return self._send_json(result)
        if bare == "/api/health/activity/import":
            if self.headers.get("Origin", "") != "http://" + self.headers.get("Host", ""):
                self.send_error(403); return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= HEALTH_MAX_BYTES:
                    raise ValueError("请选择不超过 100 MB 的 Apple 健康 ZIP")
                result = import_apple_health(self.rfile.read(length), _HEALTH_ROOT)
            except (ValueError, OSError, KeyError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
                result = {"ok": False, "error": str(exc)}
            return self._send_json(result)
        if bare in ("/api/photos/addresses/save", "/api/photos/browse/archive/preview",
                    "/api/photos/browse/archive/move", "/api/photos/browse/trash/move",
                    "/api/photos/browse/trash/preview-many",
                    "/api/photos/browse/trash/restore", "/api/photos/people/create",
                    "/api/photos/people/rename", "/api/photos/people/add-sample",
                    "/api/photos/people/assign", "/api/photos/people/unassign",
                    "/api/photos/people/remove-sample", "/api/photos/people/restore-sample"):
            origin = self.headers.get("Origin", "")
            if origin and not re.fullmatch(r"http://(?:localhost|127\.0\.0\.1):\d+", origin):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                if not 0 < ln <= (500000 if bare == "/api/photos/people/add-sample" else 100000):
                    raise ValueError("请求长度无效")
                spec = json.loads(self.rfile.read(ln))
                if bare == "/api/photos/addresses/save":
                    res = photo_address_save(spec)
                elif bare == "/api/photos/browse/archive/preview":
                    res = photo_manual_archive_preview(spec)
                elif bare == "/api/photos/browse/archive/move":
                    res = photo_manual_archive_move(spec)
                elif bare == "/api/photos/browse/trash/move":
                    res = photo_trash_move(spec)
                elif bare == "/api/photos/browse/trash/preview-many":
                    res = photo_trash_preview_many(spec)
                elif bare == "/api/photos/browse/trash/restore":
                    res = photo_trash_restore(spec.get("batchId"))
                elif bare == "/api/photos/people/create":
                    res = photo_people_create(spec)
                elif bare == "/api/photos/people/rename":
                    res = photo_people_rename(spec)
                elif bare == "/api/photos/people/add-sample":
                    res = photo_people_add_sample(spec)
                elif bare == "/api/photos/people/assign":
                    res = photo_people_assign(spec)
                elif bare == "/api/photos/people/unassign":
                    res = photo_people_unassign(spec)
                elif bare == "/api/photos/people/restore-sample":
                    res = photo_people_restore_sample(spec)
                else:
                    res = photo_people_remove_sample(spec)
            except (ValueError, TypeError, FileNotFoundError, OSError, sqlite3.Error) as exc:
                res = {"ok": False, "error": str(exc)}
            return self._send_json(res)
        if bare in ("/api/photos/index/start", "/api/photos/index/pause", "/api/photos/index/reveal",
                    "/api/photos/index/backup", "/api/photos/metadata/start", "/api/photos/metadata/pause",
                    "/api/photos/organize/plan", "/api/photos/organize/review-plan",
                    "/api/photos/organize/start", "/api/photos/organize/pause",
                    "/api/photos/handoff/export", "/api/photos/handoff/import"):
            origin = self.headers.get("Origin", "")
            # localhost/127.0.0.1 的开发端口也允许；服务本身只监听环回地址。
            if origin and not re.match(r"^http://(?:localhost|127\.0\.0\.1):\d+$", origin):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                spec = json.loads(self.rfile.read(ln) or b"{}") if ln else {}
                if bare == "/api/photos/index/start":
                    res = photo_scan_start(spec)
                elif bare == "/api/photos/index/pause":
                    res = photo_scan_pause()
                elif bare == "/api/photos/metadata/start":
                    res = photo_metadata_start(spec)
                elif bare == "/api/photos/metadata/pause":
                    res = photo_metadata_pause()
                elif bare == "/api/photos/organize/plan":
                    res = photo_organize_plan(spec)
                elif bare == "/api/photos/organize/review-plan":
                    res = photo_organize_review_plan()
                elif bare == "/api/photos/organize/start":
                    res = photo_organize_start(spec)
                elif bare == "/api/photos/organize/pause":
                    res = photo_organize_pause()
                elif bare == "/api/photos/index/backup":
                    res = photo_index_backup()
                elif bare == "/api/photos/handoff/export":
                    res = photo_handoff_export()
                elif bare == "/api/photos/handoff/import":
                    res = photo_handoff_import()
                else:
                    res = photo_index_reveal()
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        if bare == "/api/backup/keep":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                raw = self.rfile.read(ln) if ln else b""
                res = backup_keep(raw)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        if bare == "/api/backup/save":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                raw = self.rfile.read(ln) if ln else b""
                res = backup_save(raw)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        if bare == "/api/backup/full/create":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                from encrypted_backup import create_snapshot as create_encrypted_snapshot
                res = create_encrypted_snapshot(DATA_DIR, _HEALTH_ROOT)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        if bare == "/api/backup/full/cloud":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                from backup_git import upload as upload_encrypted_backup
                res = upload_encrypted_backup(DATA_DIR, _HEALTH_ROOT)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        if bare == "/api/backup/full/restore-cloud":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                from backup_git import restore as restore_encrypted_backup
                res = restore_encrypted_backup(DATA_DIR, _HEALTH_ROOT)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        if bare == "/api/disk/clean":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                spec = json.loads(self.rfile.read(ln) or b"{}")
                res = disk_clean(spec)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        self.send_error(404)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def _existing_server_matches():
    """Only reuse the port when it serves this exact backend version and photo API."""
    base = f"http://127.0.0.1:{PORT}"
    try:
        with urllib.request.urlopen(base + "/api/version", timeout=2) as response:
            info = json.load(response)
        if info.get("version") != APP_VERSION or info.get("channel") != APP_CHANNEL:
            return False, f"当前服务版本 {info.get('label') or info.get('version') or '未知'}，本次代码为 {APP_LABEL}"
        with urllib.request.urlopen(base + "/api/photos/handoff/status", timeout=2) as response:
            if response.status != 200:
                return False, "当前服务缺少照片接力接口"
        return True, ""
    except Exception:
        return False, "占用端口的服务不是当前版本的统一入口，或照片接口不可用"


def main() -> int:
    if not HUB.is_file():
        print("✗ 缺少 hub/index.html")
        return 1
    url = f"http://localhost:{PORT}/"   # 用 localhost：WebAuthn / Touch ID 不接受 IP 地址
    no_browser = bool(os.environ.get("HOME_NO_BROWSER"))   # 被 Mac App(Electron) 拉起时=1，不再另开系统浏览器
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
    except OSError as exc:
        matches, reason = _existing_server_matches()
        if matches:
            print(f"当前版本已在 {PORT} 端口运行，打开：{url}")
            if not no_browser:
                webbrowser.open(url)
            return 0
        print(f"✗ 无法启动 v{APP_LABEL}：{PORT} 端口已被占用。{reason}")
        print("  请先关闭旧的运行窗口或占用 5180 的程序，再重新启动本项目。")
        print(f"  端口错误：{exc}")
        return 1
    with httpd:
        # Electron 关闭窗口时发送 SIGTERM；转成正常退出，先让正在扫描的目录安全落盘。
        if hasattr(signal, "SIGTERM"):
            def _handle_term(_signum, _frame):
                raise KeyboardInterrupt
            signal.signal(signal.SIGTERM, _handle_term)
        _tighten_perms()
        _tag = f"v{APP_LABEL}  ·  {'开发版' if APP_CHANNEL == 'dev' else '发布版'}"
        print("┌──────────────────────────────────────────────┐")
        print(f"│  我家里的一切  {_tag:<28}│")
        print(f"│  已启动：{url:<36}│")
        print("│  顶部菜单进入：理财 / 影像 / 密码 / 开发       │")
        print("│  数据本地保存 · 按 Ctrl+C 退出                 │")
        print("└──────────────────────────────────────────────┘")
        print(f"  自动备份目录：{DATA_DIR}")
        if not no_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已退出。")
        finally:
            photo_scan_shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
