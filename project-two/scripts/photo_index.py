#!/usr/bin/env python3
"""家庭影像只读索引器。

第一阶段只枚举目录并记录文件系统元数据，不读取媒体内容、不生成缩略图、
不计算哈希，更不会移动或删除源文件。扫描状态按目录提交到本机 SQLite，
网络断开或进程退出后可从未完成目录继续。
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import signal
import sqlite3
import sys
import time
from pathlib import Path
from typing import Iterable

if os.name == "nt":
    import msvcrt
else:
    import fcntl


SCHEMA_VERSION = 2
IMAGE_EXTS = {
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff",
    "heic", "heif", "avif", "dng", "raw", "cr2", "cr3", "nef",
    "arw", "orf", "rw2",
}
VIDEO_EXTS = {
    "mp4", "mov", "m4v", "webm", "mkv", "avi", "3gp", "mts",
    "m2ts", "mpg", "mpeg", "wmv",
}
SIDECAR_EXTS = {"aae", "xmp", "json", "thm"}
SCREENSHOT_RE = re.compile(r"(?:screen[ _-]?(?:shot|capture)|截图|截屏|屏幕快照)", re.I)
SCREEN_RECORD_RE = re.compile(r"(?:screen[ _-]?(?:record|recording)|录屏|屏幕录制)", re.I)
DEFAULT_EXCLUDES = (
    ".Spotlight-V100", ".Trashes", ".fseventsd", ".TemporaryItems",
    "TimeMachine", "我的文档", "我的音频", "work",
)


def now_ms() -> int:
    return int(time.time() * 1000)


def default_db() -> Path:
    home = Path.home()
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA") or (home / "AppData" / "Roaming"))
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or (home / ".local" / "share"))
    return base / "我家里的一切" / "photo-index.sqlite3"


def norm_rel(value: str) -> str:
    if not value or value == ".":
        return ""
    return value.replace(os.sep, "/").strip("/")


def file_kind(name: str) -> tuple[str, str]:
    ext = Path(name).suffix.lower().lstrip(".")
    if ext in IMAGE_EXTS:
        return "image", ext
    if ext in VIDEO_EXTS:
        return "video", ext
    if ext in SIDECAR_EXTS:
        return "sidecar", ext
    return "other", ext


def classification_hint(rel_path: str, kind: str) -> str | None:
    if kind == "image" and SCREENSHOT_RE.search(rel_path):
        return "screenshot"
    if kind == "video" and SCREEN_RECORD_RE.search(rel_path):
        return "screen_recording"
    return None


def excluded(rel_path: str, patterns: Iterable[str]) -> bool:
    rel = norm_rel(rel_path)
    parts = rel.split("/") if rel else []
    for raw in patterns:
        p = norm_rel(raw)
        if not p:
            continue
        if "/" in p:
            if rel == p or rel.startswith(p + "/"):
                return True
        elif p in parts:
            return True
    return False


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30)
    try:
        os.chmod(db_path, 0o600)
    except OSError:
        pass
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    migrate(conn)
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS schema_info (
          version INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sources (
          id INTEGER PRIMARY KEY,
          root TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scan_runs (
          id INTEGER PRIMARY KEY,
          source_id INTEGER NOT NULL REFERENCES sources(id),
          status TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          finished_at INTEGER,
          updated_at INTEGER NOT NULL,
          entries_seen INTEGER NOT NULL DEFAULT 0,
          files_indexed INTEGER NOT NULL DEFAULT 0,
          media_indexed INTEGER NOT NULL DEFAULT 0,
          bytes_indexed INTEGER NOT NULL DEFAULT 0,
          errors INTEGER NOT NULL DEFAULT 0,
          last_path TEXT,
          excludes_json TEXT NOT NULL,
          message TEXT
        );
        CREATE TABLE IF NOT EXISTS directories (
          source_id INTEGER NOT NULL REFERENCES sources(id),
          rel_path TEXT NOT NULL,
          run_id INTEGER NOT NULL REFERENCES scan_runs(id),
          status TEXT NOT NULL,
          entries_seen INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (source_id, rel_path)
        );
        CREATE TABLE IF NOT EXISTS media_files (
          source_id INTEGER NOT NULL REFERENCES sources(id),
          rel_path TEXT NOT NULL,
          parent_path TEXT NOT NULL,
          name TEXT NOT NULL,
          extension TEXT NOT NULL,
          kind TEXT NOT NULL,
          size INTEGER NOT NULL,
          mtime_ns INTEGER NOT NULL,
          birthtime_ns INTEGER,
          inode INTEGER,
          classification_hint TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          first_seen_run INTEGER NOT NULL,
          last_seen_run INTEGER NOT NULL,
          reviewed_state TEXT,
          reviewed_at INTEGER,
          decision_note TEXT,
          metadata_status TEXT,
          capture_time_text TEXT,
          capture_time_source TEXT,
          capture_time_confidence TEXT,
          latitude REAL,
          longitude REAL,
          location_source TEXT,
          camera_make TEXT,
          camera_model TEXT,
          pixel_width INTEGER,
          pixel_height INTEGER,
          metadata_review_needed INTEGER NOT NULL DEFAULT 0,
          metadata_error TEXT,
          metadata_updated_at INTEGER,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (source_id, rel_path)
        );
        CREATE TABLE IF NOT EXISTS analysis_runs (
          id INTEGER PRIMARY KEY,
          source_id INTEGER NOT NULL REFERENCES sources(id),
          analysis_type TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          finished_at INTEGER,
          updated_at INTEGER NOT NULL,
          total INTEGER NOT NULL DEFAULT 0,
          processed INTEGER NOT NULL DEFAULT 0,
          with_time INTEGER NOT NULL DEFAULT 0,
          with_gps INTEGER NOT NULL DEFAULT 0,
          needs_review INTEGER NOT NULL DEFAULT 0,
          errors INTEGER NOT NULL DEFAULT 0,
          last_path TEXT,
          message TEXT
        );
        CREATE INDEX IF NOT EXISTS media_kind_idx ON media_files(source_id, kind, status);
        CREATE INDEX IF NOT EXISTS media_size_idx ON media_files(source_id, size, kind, status);
        CREATE INDEX IF NOT EXISTS media_hint_idx ON media_files(source_id, classification_hint, status);
        """
    )
    columns = {str(r["name"]) for r in conn.execute("PRAGMA table_info(media_files)").fetchall()}
    additions = {
        "metadata_status": "TEXT",
        "capture_time_text": "TEXT",
        "capture_time_source": "TEXT",
        "capture_time_confidence": "TEXT",
        "latitude": "REAL",
        "longitude": "REAL",
        "location_source": "TEXT",
        "camera_make": "TEXT",
        "camera_model": "TEXT",
        "pixel_width": "INTEGER",
        "pixel_height": "INTEGER",
        "metadata_review_needed": "INTEGER NOT NULL DEFAULT 0",
        "metadata_error": "TEXT",
        "metadata_updated_at": "INTEGER",
    }
    for name, declaration in additions.items():
        if name not in columns:
            conn.execute(f"ALTER TABLE media_files ADD COLUMN {name} {declaration}")
    row = conn.execute("SELECT version FROM schema_info LIMIT 1").fetchone()
    if row is None:
        conn.execute("INSERT INTO schema_info(version) VALUES (?)", (SCHEMA_VERSION,))
    elif int(row["version"]) > SCHEMA_VERSION:
        raise RuntimeError(f"不支持的索引版本：{row['version']}")
    elif int(row["version"]) < SCHEMA_VERSION:
        conn.execute("UPDATE schema_info SET version=?", (SCHEMA_VERSION,))
    conn.commit()


@contextlib.contextmanager
def exclusive_lock(db_path: Path):
    lock_path = db_path.with_suffix(db_path.suffix + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+b") as handle:
        try:
            os.chmod(lock_path, 0o600)
        except OSError:
            pass
        if os.name == "nt":
            handle.seek(0, os.SEEK_END)
            if handle.tell() == 0:
                handle.write(b"\0")
                handle.flush()
            handle.seek(0)
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise RuntimeError("已有一个照片索引任务正在运行") from exc
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise RuntimeError("已有一个照片索引任务正在运行") from exc
            yield


def source_id(conn: sqlite3.Connection, root: Path) -> int:
    root_text = str(root)
    stamp = now_ms()
    conn.execute(
        """INSERT INTO sources(root, label, created_at, last_seen_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(root) DO UPDATE SET label=excluded.label, last_seen_at=excluded.last_seen_at""",
        (root_text, root.name or root_text, stamp, stamp),
    )
    conn.commit()
    return int(conn.execute("SELECT id FROM sources WHERE root=?", (root_text,)).fetchone()["id"])


def begin_or_resume_run(
    conn: sqlite3.Connection, sid: int, excludes: tuple[str, ...], force_new: bool
) -> tuple[int, bool]:
    if not force_new:
        row = conn.execute(
            """SELECT * FROM scan_runs
               WHERE source_id=? AND status IN ('running','paused','error')
               ORDER BY id DESC LIMIT 1""",
            (sid,),
        ).fetchone()
        if row:
            run_id = int(row["id"])
            saved = tuple(json.loads(row["excludes_json"]))
            if saved != excludes:
                raise RuntimeError("未完成扫描的排除规则不同；请使用相同 --exclude，或加 --new-run")
            conn.execute("UPDATE scan_runs SET status='running', updated_at=?, message=NULL WHERE id=?", (now_ms(), run_id))
            conn.execute(
                "UPDATE directories SET status='pending', updated_at=? WHERE run_id=? AND status='scanning'",
                (now_ms(), run_id),
            )
            conn.commit()
            return run_id, True

    stamp = now_ms()
    cur = conn.execute(
        """INSERT INTO scan_runs(source_id,status,started_at,updated_at,excludes_json)
           VALUES (?, 'running', ?, ?, ?)""",
        (sid, stamp, stamp, json.dumps(excludes, ensure_ascii=False)),
    )
    run_id = int(cur.lastrowid)
    conn.execute(
        """INSERT INTO directories(source_id,rel_path,run_id,status,updated_at)
           VALUES (?, '', ?, 'pending', ?)
           ON CONFLICT(source_id,rel_path) DO UPDATE SET
             run_id=excluded.run_id,status='pending',entries_seen=0,last_error=NULL,updated_at=excluded.updated_at""",
        (sid, run_id, stamp),
    )
    conn.commit()
    return run_id, False


def upsert_directory(conn: sqlite3.Connection, sid: int, run_id: int, rel_path: str) -> None:
    stamp = now_ms()
    conn.execute(
        """INSERT INTO directories(source_id,rel_path,run_id,status,updated_at)
           VALUES (?, ?, ?, 'pending', ?)
           ON CONFLICT(source_id,rel_path) DO UPDATE SET
             run_id=CASE WHEN directories.run_id=excluded.run_id THEN directories.run_id ELSE excluded.run_id END,
             status=CASE WHEN directories.run_id=excluded.run_id THEN directories.status ELSE 'pending' END,
             entries_seen=CASE WHEN directories.run_id=excluded.run_id THEN directories.entries_seen ELSE 0 END,
             last_error=CASE WHEN directories.run_id=excluded.run_id THEN directories.last_error ELSE NULL END,
             updated_at=excluded.updated_at""",
        (sid, rel_path, run_id, stamp),
    )


def upsert_file(
    conn: sqlite3.Connection,
    sid: int,
    run_id: int,
    rel_path: str,
    stat: os.stat_result,
) -> tuple[str, int]:
    rel = norm_rel(rel_path)
    parent = norm_rel(str(Path(rel).parent))
    if parent == ".":
        parent = ""
    name = Path(rel).name
    kind, ext = file_kind(name)
    hint = classification_hint(rel, kind)
    stamp = now_ms()
    birthtime_ns = int(getattr(stat, "st_birthtime", 0) * 1_000_000_000) or None
    conn.execute(
        """INSERT INTO media_files(
             source_id,rel_path,parent_path,name,extension,kind,size,mtime_ns,birthtime_ns,inode,
             classification_hint,status,first_seen_run,last_seen_run,updated_at
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?)
           ON CONFLICT(source_id,rel_path) DO UPDATE SET
             parent_path=excluded.parent_path,name=excluded.name,extension=excluded.extension,
             kind=excluded.kind,size=excluded.size,mtime_ns=excluded.mtime_ns,
             birthtime_ns=excluded.birthtime_ns,inode=excluded.inode,
             classification_hint=excluded.classification_hint,status='active',
             metadata_status=CASE WHEN media_files.size<>excluded.size OR media_files.mtime_ns<>excluded.mtime_ns
                                  THEN NULL ELSE media_files.metadata_status END,
             last_seen_run=excluded.last_seen_run,updated_at=excluded.updated_at""",
        (
            sid, rel, parent, name, ext, kind, int(stat.st_size), int(stat.st_mtime_ns),
            birthtime_ns, int(getattr(stat, "st_ino", 0)) or None, hint,
            run_id, run_id, stamp,
        ),
    )
    return kind, int(stat.st_size)


class StopFlag:
    requested = False


def scan(args: argparse.Namespace) -> int:
    root = Path(args.source).expanduser().resolve()
    if not root.is_dir() or (os.name != "nt" and not os.access(root, os.R_OK)):
        print(f"共享目录不可读或尚未挂载：{root}", file=sys.stderr)
        return 2
    db_path = Path(args.db).expanduser()
    excludes = tuple(dict.fromkeys(args.exclude))
    stop = StopFlag()

    def ask_stop(_signum, _frame):
        stop.requested = True

    signal.signal(signal.SIGINT, ask_stop)
    signal.signal(signal.SIGTERM, ask_stop)

    with exclusive_lock(db_path), contextlib.closing(connect(db_path)) as conn:
        sid = source_id(conn, root)
        run_id, resumed = begin_or_resume_run(conn, sid, excludes, args.new_run)
        print(json.dumps({
            "event": "scan_started", "runId": run_id, "resumed": resumed,
            "source": str(root), "db": str(db_path), "readOnly": True,
            "excludes": excludes,
        }, ensure_ascii=False), flush=True)

        operations = 0
        last_report = time.monotonic()
        try:
            while not stop.requested:
                row = conn.execute(
                    """SELECT rel_path FROM directories
                       WHERE source_id=? AND run_id=? AND status='pending'
                       ORDER BY length(rel_path), rel_path LIMIT 1""",
                    (sid, run_id),
                ).fetchone()
                if row is None:
                    break
                rel_dir = str(row["rel_path"])
                abs_dir = root / rel_dir
                conn.execute(
                    "UPDATE directories SET status='scanning',last_error=NULL,updated_at=? WHERE source_id=? AND rel_path=?",
                    (now_ms(), sid, rel_dir),
                )
                conn.commit()
                dir_entries = 0
                try:
                    with os.scandir(abs_dir) as entries:
                        for entry in entries:
                            if stop.requested:
                                break
                            rel = norm_rel(f"{rel_dir}/{entry.name}" if rel_dir else entry.name)
                            if excluded(rel, excludes) or entry.is_symlink():
                                continue
                            dir_entries += 1
                            operations += 1
                            try:
                                if entry.is_dir(follow_symlinks=False):
                                    upsert_directory(conn, sid, run_id, rel)
                                elif entry.is_file(follow_symlinks=False):
                                    st = entry.stat(follow_symlinks=False)
                                    kind, size = upsert_file(conn, sid, run_id, rel, st)
                                    conn.execute(
                                        """UPDATE scan_runs SET entries_seen=entries_seen+1,
                                           files_indexed=files_indexed+1,
                                           media_indexed=media_indexed+?,bytes_indexed=bytes_indexed+?,
                                           last_path=?,updated_at=? WHERE id=?""",
                                        (1 if kind in ("image", "video") else 0, size, rel, now_ms(), run_id),
                                    )
                            except OSError as exc:
                                conn.execute(
                                    "UPDATE scan_runs SET errors=errors+1,last_path=?,updated_at=?,message=? WHERE id=?",
                                    (rel, now_ms(), str(exc), run_id),
                                )
                            if operations % args.commit_every == 0:
                                conn.commit()
                            if time.monotonic() - last_report >= args.report_every:
                                print_status(conn, run_id, event="progress")
                                last_report = time.monotonic()
                            if args.max_entries and operations >= args.max_entries:
                                stop.requested = True
                                break
                    if stop.requested:
                        conn.execute(
                            "UPDATE directories SET status='pending',entries_seen=?,updated_at=? WHERE source_id=? AND rel_path=?",
                            (dir_entries, now_ms(), sid, rel_dir),
                        )
                    else:
                        conn.execute(
                            "UPDATE directories SET status='done',entries_seen=?,updated_at=? WHERE source_id=? AND rel_path=?",
                            (dir_entries, now_ms(), sid, rel_dir),
                        )
                    conn.commit()
                except PermissionError as exc:
                    # NAS 常见按目录授权：单个无权限目录只记录并跳过，不能阻塞其它照片目录。
                    conn.execute(
                        """UPDATE directories SET status='skipped',last_error=?,updated_at=?
                           WHERE source_id=? AND rel_path=?""",
                        (str(exc), now_ms(), sid, rel_dir),
                    )
                    conn.execute(
                        "UPDATE scan_runs SET errors=errors+1,message=?,updated_at=? WHERE id=?",
                        (f"已跳过无权限目录：{rel_dir or '/'}", now_ms(), run_id),
                    )
                    conn.commit()
                    print(json.dumps({"event": "directory_skipped", "path": rel_dir, "reason": str(exc)}, ensure_ascii=False), flush=True)
                except OSError as exc:
                    # 网络断开或共享盘消失：保留为 pending，下次从该目录重试。
                    conn.execute(
                        """UPDATE directories SET status='pending',last_error=?,updated_at=?
                           WHERE source_id=? AND rel_path=?""",
                        (str(exc), now_ms(), sid, rel_dir),
                    )
                    conn.execute(
                        "UPDATE scan_runs SET errors=errors+1,status='paused',message=?,updated_at=? WHERE id=?",
                        (f"{rel_dir or '/'}: {exc}", now_ms(), run_id),
                    )
                    conn.commit()
                    print_status(conn, run_id, event="paused")
                    return 3

            if stop.requested:
                conn.execute(
                    "UPDATE scan_runs SET status='paused',message='用户暂停或达到本次扫描上限',updated_at=? WHERE id=?",
                    (now_ms(), run_id),
                )
                conn.commit()
                print_status(conn, run_id, event="paused")
                return 0

            # 只有完整遍历成功后才标记缺失，断网/暂停绝不把未看到的文件误判为已删除。
            conn.execute(
                """UPDATE media_files AS m SET status='missing',updated_at=?
                   WHERE m.source_id=? AND m.status='active' AND m.last_seen_run<>?
                     AND NOT EXISTS (
                       SELECT 1 FROM directories d
                       WHERE d.source_id=m.source_id AND d.run_id=? AND d.status='skipped'
                         AND (m.parent_path=d.rel_path OR m.parent_path LIKE d.rel_path || '/%')
                     )""",
                (now_ms(), sid, run_id, run_id),
            )
            stamp = now_ms()
            conn.execute(
                "UPDATE scan_runs SET status='completed',finished_at=?,updated_at=?,message=NULL WHERE id=?",
                (stamp, stamp, run_id),
            )
            conn.commit()
            print_status(conn, run_id, event="completed")
            print_summary(conn, sid)
            return 0
        except Exception as exc:
            conn.execute(
                "UPDATE scan_runs SET status='error',message=?,updated_at=? WHERE id=?",
                (str(exc), now_ms(), run_id),
            )
            conn.commit()
            raise


def print_status(conn: sqlite3.Connection, run_id: int, event: str = "status") -> None:
    row = conn.execute("SELECT * FROM scan_runs WHERE id=?", (run_id,)).fetchone()
    if not row:
        return
    pending = conn.execute(
        "SELECT count(*) AS n FROM directories WHERE run_id=? AND status='pending'", (run_id,)
    ).fetchone()["n"]
    done = conn.execute(
        "SELECT count(*) AS n FROM directories WHERE run_id=? AND status='done'", (run_id,)
    ).fetchone()["n"]
    payload = {
        "event": event,
        "runId": run_id,
        "status": row["status"],
        "entriesSeen": row["entries_seen"],
        "filesIndexed": row["files_indexed"],
        "mediaIndexed": row["media_indexed"],
        "bytesIndexed": row["bytes_indexed"],
        "errors": row["errors"],
        "directoriesDone": done,
        "directoriesPending": pending,
        "lastPath": row["last_path"],
        "message": row["message"],
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def print_summary(conn: sqlite3.Connection, sid: int) -> None:
    totals = conn.execute(
        """SELECT kind,count(*) AS files,coalesce(sum(size),0) AS bytes
           FROM media_files WHERE source_id=? AND status='active'
           GROUP BY kind ORDER BY files DESC""",
        (sid,),
    ).fetchall()
    hints = conn.execute(
        """SELECT classification_hint,count(*) AS files,coalesce(sum(size),0) AS bytes
           FROM media_files WHERE source_id=? AND status='active' AND classification_hint IS NOT NULL
           GROUP BY classification_hint ORDER BY files DESC""",
        (sid,),
    ).fetchall()
    top = conn.execute(
        """SELECT CASE instr(rel_path,'/') WHEN 0 THEN '(根目录)'
                  ELSE substr(rel_path,1,instr(rel_path,'/')-1) END AS top_dir,
                  count(*) AS files,
                  sum(CASE WHEN kind IN ('image','video') THEN 1 ELSE 0 END) AS media,
                  coalesce(sum(size),0) AS bytes
           FROM media_files WHERE source_id=? AND status='active'
           GROUP BY top_dir ORDER BY media DESC,files DESC LIMIT 50""",
        (sid,),
    ).fetchall()
    print(json.dumps({
        "event": "summary",
        "totals": [dict(r) for r in totals],
        "classificationHints": [dict(r) for r in hints],
        "topDirectories": [dict(r) for r in top],
    }, ensure_ascii=False), flush=True)


def status(args: argparse.Namespace) -> int:
    db_path = Path(args.db).expanduser()
    if not db_path.exists():
        print(json.dumps({"event": "status", "status": "not_started", "db": str(db_path)}, ensure_ascii=False))
        return 0
    with contextlib.closing(connect(db_path)) as conn:
        row = conn.execute("SELECT id FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()
        if not row:
            print(json.dumps({"event": "status", "status": "not_started", "db": str(db_path)}, ensure_ascii=False))
            return 0
        print_status(conn, int(row["id"]))
        src = conn.execute("SELECT source_id FROM scan_runs WHERE id=?", (row["id"],)).fetchone()
        print_summary(conn, int(src["source_id"]))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="家庭影像只读、可续跑索引器")
    parser.add_argument("--db", default=str(default_db()), help="本机 SQLite 索引路径")
    sub = parser.add_subparsers(dest="command", required=True)

    scan_p = sub.add_parser("scan", help="开始或继续扫描")
    scan_p.add_argument("source", help="已挂载的照片根目录")
    scan_p.add_argument("--exclude", action="append", default=list(DEFAULT_EXCLUDES), help="排除的目录名或相对路径，可重复")
    scan_p.add_argument("--new-run", action="store_true", help="忽略未完成任务，开始新一轮扫描")
    scan_p.add_argument("--commit-every", type=int, default=100, help="每多少个目录项提交一次")
    scan_p.add_argument("--report-every", type=float, default=10.0, help="进度输出间隔（秒）")
    scan_p.add_argument("--max-entries", type=int, default=0, help="本次最多处理多少个目录项；0 表示不限")
    scan_p.set_defaults(func=scan)

    status_p = sub.add_parser("status", help="查看最近扫描状态和索引摘要")
    status_p.set_defaults(func=status)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return int(args.func(args))
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
