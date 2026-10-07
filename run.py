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
import contextlib
import http.server
import io
import json
import mimetypes
import os
import re
import signal
import shutil
import socketserver
import sqlite3
import string
import subprocess
import sys
import threading
import time
import urllib.request
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
DATA_VERSION = 4
# 写盘协议和数据结构版本分开：前者保证客户端带有并发基线，后者保护数据形状。
# 老安装版不会发送 syncProtocol；它的写入会被保留成冲突副本，但不能覆盖 current.home。
SYNC_PROTOCOL = 2
DATA_DIR = data_dir()

# 家庭影像的大型 Samba 目录索引保存在本机，不把工作中的 SQLite 放到网络盘上，避免
# 掉线或 SMB 文件锁导致数据库损坏。扫描/分析只读；整理必须先预演，再走独立可续跑流程。
PHOTO_INDEX_DB = DATA_DIR / "photo-index.sqlite3"
PHOTO_INDEX_LOG = DATA_DIR / "photo-index.log"
PHOTO_INDEX_SCRIPT = ROOT / "project-two" / "scripts" / "photo_index.py"
PHOTO_METADATA_SCRIPT = ROOT / "project-two" / "scripts" / "photo_metadata.py"
PHOTO_METADATA_LOG = DATA_DIR / "photo-metadata.log"
PHOTO_ORGANIZE_SCRIPT = ROOT / "project-two" / "scripts" / "photo_organize.py"
PHOTO_ORGANIZE_LOG = DATA_DIR / "photo-organize.log"
PHOTO_ORGANIZE_PROFILE = DATA_DIR / "photo-organize-profile.jsonl"
PHOTO_HANDOFF_SCRIPT = ROOT / "project-two" / "scripts" / "photo_handoff.py"
PHOTO_HANDOFF_DIR_NAME = "我家里的一切-接力"
if os.environ.get("HOME_PHOTO_SOURCE"):
    PHOTO_DEFAULT_SOURCE = Path(os.environ["HOME_PHOTO_SOURCE"])
elif os.name == "nt":
    PHOTO_DEFAULT_SOURCE = Path("Z:/")
elif sys.platform == "darwin":
    PHOTO_DEFAULT_SOURCE = Path("/Volumes/24684804")
else:
    PHOTO_DEFAULT_SOURCE = Path("/mnt/24684804")
_PHOTO_SCAN_LOCK = threading.Lock()
_PHOTO_SCAN_PROC = None
_PHOTO_SCAN_LOG_HANDLE = None
_PHOTO_METADATA_LOCK = threading.Lock()
_PHOTO_METADATA_PROC = None
_PHOTO_METADATA_LOG_HANDLE = None
_PHOTO_ORGANIZE_LOCK = threading.Lock()
_PHOTO_ORGANIZE_PROC = None
_PHOTO_ORGANIZE_LOG_HANDLE = None


def _photo_source_path(value=None):
    """只允许扫描系统已确认的网络盘/外部挂载，避免网页枚举任意目录。"""
    readable = [item for item in photo_sources() if item["readable"]]
    raw = str(value or (readable[0]["path"] if readable else PHOTO_DEFAULT_SOURCE)).strip()
    if not raw:
        raise ValueError("请选择已挂载的 Samba 目录")
    source = Path(raw).expanduser().resolve()
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
    if not allowed or not source.is_dir() or not os.access(source, os.R_OK):
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
            resolved = candidate.resolve() if exists else candidate
            if sys.platform == "darwin" and candidate.name == "Macintosh HD":
                continue
            found.append({
                "name": candidate.name or candidate.anchor or str(candidate),
                "path": str(resolved),
                "readable": exists and os.access(resolved, os.R_OK),
                "writable": exists and os.access(resolved, os.W_OK),
            })
        except OSError:
            found.append({"name": candidate.name or str(candidate), "path": str(candidate),
                          "readable": False, "writable": False})
    return found


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
            return {
                "ok": True, "runId": int(row["id"]), "status": status, "processAlive": alive,
                "sourceRoot": row["source_root"], "targetRoot": row["target_root"],
                "layout": row["layout"] if "layout" in row.keys() else "day",
                "profileLog": str(PHOTO_ORGANIZE_PROFILE),
                "total": int(row["total"] or 0), "moved": int(row["moved"] or 0),
                "verified": int(row["verified"] or 0), "errors": int(row["errors"] or 0),
                "bytesTotal": int(row["bytes_total"] or 0), "bytesMoved": int(row["bytes_moved"] or 0),
                "reliable": int(row["reliable"] or 0), "needsReview": int(row["needs_review"] or 0),
                "lastPath": row["last_path"], "message": row["message"],
                "examples": [dict(item) for item in examples],
            }
    except (OSError, sqlite3.Error) as exc:
        return {**empty, "ok": False, "status": "error", "error": f"无法读取整理任务：{exc}"}


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
                          sum(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) with_gps
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
                """SELECT substr(capture_time_text,1,7) period,count(*) files,
                          sum(CASE WHEN kind='image' THEN 1 ELSE 0 END) images,
                          sum(CASE WHEN kind='video' THEN 1 ELSE 0 END) videos,
                          sum(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) gps,
                          sum(CASE WHEN metadata_review_needed=1 THEN 1 ELSE 0 END) needs_review,
                          coalesce(sum(size),0) bytes
                   FROM media_files
                   WHERE source_id=? AND status='active' AND metadata_status='done'
                     AND capture_time_text IS NOT NULL
                   GROUP BY substr(capture_time_text,1,7) ORDER BY period""",
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
            like = period + "%"
            place_rows = conn.execute(
                """SELECT round(latitude,1) latitude,round(longitude,1) longitude,count(*) files,
                          sum(CASE WHEN kind='image' THEN 1 ELSE 0 END) images,
                          sum(CASE WHEN kind='video' THEN 1 ELSE 0 END) videos,
                          sum(CASE WHEN metadata_review_needed=1 THEN 1 ELSE 0 END) needs_review,
                          coalesce(sum(size),0) bytes,min(rel_path) sample_path
                   FROM media_files
                   WHERE source_id=? AND status='active' AND metadata_status='done'
                     AND capture_time_text LIKE ? AND latitude IS NOT NULL AND longitude IS NOT NULL
                   GROUP BY round(latitude,1),round(longitude,1)
                   ORDER BY files DESC LIMIT 24""",
                (sid, like),
            ).fetchall()
            selected = next((item for item in periods if item["period"] == period), None)
            places = []
            represented = 0
            for row in place_rows:
                lat, lng = float(row["latitude"]), float(row["longitude"])
                files = int(row["files"] or 0)
                represented += files
                sample = str(row["sample_path"] or "")
                top_dir = sample.split("/", 1)[0] if sample else ""
                lat_label = f"{abs(lat):.1f}°{'N' if lat >= 0 else 'S'}"
                lng_label = f"{abs(lng):.1f}°{'E' if lng >= 0 else 'W'}"
                places.append({
                    "key": f"{lat:.1f},{lng:.1f}", "label": f"{lat_label} · {lng_label}",
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
                   FROM media_files WHERE source_id=? AND status='active' AND metadata_status='done'
                     AND capture_time_text LIKE ? AND (latitude IS NULL OR longitude IS NULL)""",
                (sid, like),
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
    source = _photo_source_path((spec or {}).get("source"))
    if not PHOTO_INDEX_SCRIPT.is_file():
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
        cmd = [sys.executable, str(PHOTO_INDEX_SCRIPT), "--db", str(PHOTO_INDEX_DB), "scan", str(source)]
        if bool((spec or {}).get("newRun")):
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
        if not os.access(root, os.W_OK):
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
    def _content(b):
        return json.dumps({"localStorage": b.get("localStorage"), "indexedDB": b.get("indexedDB")}, sort_keys=True, ensure_ascii=False)
    new_content = _content(bundle)
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
            if _content(old) == new_content and stored_dv >= DATA_VERSION:
                return {"ok": True, "savedAt": old.get("savedAt"), "bytes": len(old_raw), "dir": str(DATA_DIR), "unchanged": True}
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
            base = bundle.get("baseSavedAt")
            disk_at = int(old.get("savedAt") or 0)
            if not isinstance(base, (int, float)):
                conflict = _save_rejected_bundle(bundle, "keep-无并发基线-")
                return {"ok": False, "error": "missing-base", "diskSavedAt": disk_at,
                        "conflictCopy": conflict,
                        "hint": "写入请求没有并发基线，已拒绝覆盖；内容已另存为冲突副本。"}
            if disk_at > int(base):
                conflict = _save_rejected_bundle(bundle, "keep-并发冲突-")
                return {"ok": False, "error": "stale", "diskSavedAt": disk_at, "baseSavedAt": int(base),
                        "conflictCopy": conflict,
                        "hint": "磁盘上的数据比你这个窗口上次同步到的更新（另一个入口写过），本次未覆盖。刷新页面会拉取最新数据。"}
    elif int(bundle.get("syncProtocol") or 0) != SYNC_PROTOCOL:
        return {"ok": False, "error": "legacy-client", "requiredSyncProtocol": SYNC_PROTOCOL,
                "hint": "这个页面版本太旧，不能建立新的磁盘备份。请使用最新版。"}
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
    return {"ok": True, "savedAt": bundle["savedAt"], "bytes": len(data), "dir": str(DATA_DIR)}


def _save_rejected_bundle(bundle: dict, prefix: str) -> str:
    """把被拒绝覆盖的客户端状态另存为可恢复副本；调用者已经持有 _BACKUP_LOCK。"""
    copy = dict(bundle)
    copy.pop("baseSavedAt", None)
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


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        # 子应用根路径未带斜杠时重定向，确保相对资源解析正确
        bare = self.path.split("?")[0]
        if bare in ("/finance", "/gallery", "/vault", "/dev"):
            self.send_response(301)
            self.send_header("Location", bare + "/")
            self.end_headers()
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
        if bare == "/api/photos/index/files":
            from urllib.parse import urlparse, parse_qs
            return self._send_json(photo_index_files(parse_qs(urlparse(self.path).query)))
        if bare == "/api/photos/timeline":
            from urllib.parse import urlparse, parse_qs
            return self._send_json(photo_timeline(parse_qs(urlparse(self.path).query)))
        if bare == "/api/photos/organize/status":
            return self._send_json(photo_organize_status())
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
        bare = self.path.split("?")[0]
        if bare in ("/api/photos/index/start", "/api/photos/index/pause", "/api/photos/index/reveal",
                    "/api/photos/index/backup", "/api/photos/metadata/start", "/api/photos/metadata/pause",
                    "/api/photos/organize/plan", "/api/photos/organize/start", "/api/photos/organize/pause",
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


def main() -> int:
    if not HUB.is_file():
        print("✗ 缺少 hub/index.html")
        return 1
    url = f"http://localhost:{PORT}/"   # 用 localhost：WebAuthn / Touch ID 不接受 IP 地址
    no_browser = bool(os.environ.get("HOME_NO_BROWSER"))   # 被 Mac App(Electron) 拉起时=1，不再另开系统浏览器
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
    except OSError:
        print(f"检测到 {PORT} 已被占用，直接打开：{url}")
        if not no_browser:
            webbrowser.open(url)
        return 0
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
