#!/usr/bin/env python3
"""Export/import a resumable photo-index handoff bundle between computers."""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from photo_index import default_db, exclusive_lock, now_ms


BUNDLE_VERSION = 1
DB_MEMBER = "photo-index.sqlite3"
MANIFEST_MEMBER = "handoff.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def integrity_check(path: Path) -> None:
    with sqlite3.connect(path) as conn:
        result = conn.execute("PRAGMA integrity_check").fetchone()
    if not result or result[0] != "ok":
        raise RuntimeError(f"索引数据库完整性检查失败：{result[0] if result else '无结果'}")


def snapshot_database(source: Path, target: Path) -> None:
    with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    integrity_check(target)


def read_manifest_data(snapshot: Path) -> dict:
    with sqlite3.connect(snapshot) as conn:
        conn.row_factory = sqlite3.Row
        source = conn.execute(
            """SELECT s.* FROM scan_runs r JOIN sources s ON s.id=r.source_id
               WHERE r.status='completed' ORDER BY r.id DESC LIMIT 1"""
        ).fetchone()
        if not source:
            raise RuntimeError("索引中没有已完成的扫描来源")
        has_organize = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='organize_runs'"
        ).fetchone()
        job = conn.execute(
            "SELECT * FROM organize_runs WHERE source_id=? ORDER BY id DESC LIMIT 1", (int(source["id"]),)
        ).fetchone() if has_organize else None
    target_name = "家庭影像库"
    if job and job["target_root"]:
        target_name = PurePosixPath(str(job["target_root"]).replace("\\", "/")).name
    return {
        "bundleVersion": BUNDLE_VERSION,
        "exportedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "sourceId": int(source["id"]),
        "sourceRoot": str(source["root"]),
        "targetName": target_name,
        "runId": int(job["id"]) if job else None,
        "status": str(job["status"]) if job else "not_started",
        "total": int(job["total"] or 0) if job else 0,
        "verified": int(job["verified"] or 0) if job else 0,
        "errors": int(job["errors"] or 0) if job else 0,
    }


def export_bundle(args: argparse.Namespace) -> int:
    source = Path(args.db).expanduser()
    output = Path(args.output).expanduser()
    if not source.is_file():
        raise RuntimeError(f"索引数据库不存在：{source}")
    if output.suffix.lower() != ".zip":
        raise RuntimeError("接力包文件名必须以 .zip 结尾")
    output.parent.mkdir(parents=True, exist_ok=True)
    temp_output = output.with_suffix(output.suffix + ".creating")
    with exclusive_lock(source), tempfile.TemporaryDirectory(prefix="photo-handoff-") as temp_dir:
        snapshot = Path(temp_dir) / DB_MEMBER
        snapshot_database(source, snapshot)
        manifest = read_manifest_data(snapshot)
        manifest["databaseBytes"] = snapshot.stat().st_size
        manifest["databaseSha256"] = sha256_file(snapshot)
        with zipfile.ZipFile(temp_output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            archive.write(snapshot, DB_MEMBER)
            archive.writestr(MANIFEST_MEMBER, json.dumps(manifest, ensure_ascii=False, indent=2))
        os.replace(temp_output, output)
    with contextlib.suppress(OSError):
        os.chmod(output, 0o600)
    print(json.dumps({"ok": True, "bundle": str(output), **manifest}, ensure_ascii=False))
    return 0


def read_bundle(bundle: Path, destination: Path) -> dict:
    with zipfile.ZipFile(bundle) as archive:
        if set(archive.namelist()) != {DB_MEMBER, MANIFEST_MEMBER}:
            raise RuntimeError("接力包内容不符合预期，已拒绝解压")
        manifest = json.loads(archive.read(MANIFEST_MEMBER))
        if int(manifest.get("bundleVersion", -1)) != BUNDLE_VERSION:
            raise RuntimeError("不支持的接力包版本")
        with archive.open(DB_MEMBER) as source, destination.open("wb") as target:
            shutil.copyfileobj(source, target, length=1024 * 1024)
    if sha256_file(destination) != manifest.get("databaseSha256"):
        raise RuntimeError("接力包数据库校验失败，文件可能未完整复制")
    integrity_check(destination)
    return manifest


def rebind_database(path: Path, manifest: dict, root: Path, target_name: str) -> None:
    with sqlite3.connect(path) as conn:
        conn.row_factory = sqlite3.Row
        source_id = int(manifest["sourceId"])
        conflict = conn.execute("SELECT id FROM sources WHERE root=? AND id<>?", (str(root), source_id)).fetchone()
        if conflict:
            raise RuntimeError("目标路径已属于索引中的另一个来源，已拒绝合并")
        target_root = root / target_name
        stamp = now_ms()
        result = conn.execute(
            "UPDATE sources SET root=?,label=?,last_seen_at=? WHERE id=?",
            (str(root), root.name or str(root), stamp, source_id),
        )
        if result.rowcount != 1:
            raise RuntimeError("找不到接力包对应的扫描来源")
        if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='organize_runs'").fetchone():
            conn.execute(
                """UPDATE organize_runs SET source_root=?,target_root=?,
                   status=CASE WHEN status='running' THEN 'paused' ELSE status END,
                   updated_at=?,message=CASE WHEN status='running' THEN '已导入到新电脑，等待继续' ELSE message END
                   WHERE source_id=?""",
                (str(root), str(target_root), stamp, source_id),
            )
        conn.commit()
    integrity_check(path)


def existing_organize_state(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        with sqlite3.connect(path) as conn:
            conn.row_factory = sqlite3.Row
            if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='organize_runs'").fetchone():
                return None
            row = conn.execute("SELECT id,total,verified,source_root FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
            return dict(row) if row else None
    except sqlite3.Error:
        return None


def import_bundle(args: argparse.Namespace) -> int:
    bundle = Path(args.bundle).expanduser()
    destination = Path(args.db).expanduser()
    root = Path(args.source_root).expanduser()
    if not bundle.is_file():
        raise RuntimeError(f"接力包不存在：{bundle}")
    if not root.is_dir() or not os.access(root, os.R_OK | os.W_OK):
        raise RuntimeError(f"Surface 上的 S300 路径不可读写：{root}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and not args.replace and not args.keep_newer:
        raise RuntimeError(f"目标索引已存在：{destination}；确认替换时加 --replace")
    with exclusive_lock(destination), tempfile.TemporaryDirectory(prefix="photo-handoff-import-") as temp_dir:
        imported = Path(temp_dir) / DB_MEMBER
        manifest = read_bundle(bundle, imported)
        target_name = args.target_name or str(manifest.get("targetName") or "家庭影像库")
        if target_name in ("", ".", "..") or "/" in target_name or "\\" in target_name:
            raise RuntimeError("目标目录名必须是安全的单层名称")
        current = existing_organize_state(destination)
        expected_root = os.path.normcase(os.path.abspath(str(root.resolve())))
        if args.keep_newer and current and int(current.get("id") or -1) == int(manifest.get("runId") or -2):
            current_root = os.path.normcase(os.path.abspath(str(current.get("source_root") or "")))
            if int(current.get("verified") or 0) >= int(manifest.get("verified") or 0) and current_root == expected_root:
                print(json.dumps({
                    "ok": True, "unchanged": True, "database": str(destination),
                    "sourceRoot": str(root.resolve()), "runId": current["id"],
                    "verified": current["verified"], "total": current["total"],
                    "message": "本机已有相同或更新的整理进度，未用旧接力包覆盖",
                }, ensure_ascii=False))
                return 0
        rebind_database(imported, manifest, root.resolve(), target_name)
        backup = None
        if destination.exists():
            backup_dir = destination.parent / "backups" / "photo-index"
            backup_dir.mkdir(parents=True, exist_ok=True)
            stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
            backup = backup_dir / f"photo-index-before-handoff-{stamp}.sqlite3"
            os.replace(destination, backup)
        incoming = destination.with_suffix(destination.suffix + ".importing")
        # SQLite may keep the rebind transaction in a WAL sidecar. A second
        # SQLite backup folds it into one self-contained database file.
        snapshot_database(imported, incoming)
        os.replace(incoming, destination)
    with contextlib.suppress(OSError):
        os.chmod(destination, 0o600)
    print(json.dumps({
        "ok": True, "database": str(destination), "backup": str(backup) if backup else None,
        "sourceRoot": str(root.resolve()), "targetRoot": str(root.resolve() / target_name),
        "runId": manifest.get("runId"), "verified": manifest.get("verified"), "total": manifest.get("total"),
    }, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="在 Mac 与 Surface 之间安全接力照片索引和整理进度")
    sub = parser.add_subparsers(dest="command", required=True)
    export = sub.add_parser("export", help="生成不含照片的索引接力包")
    export.add_argument("--db", default=str(default_db()))
    export.add_argument("--output", required=True)
    export.set_defaults(func=export_bundle)
    restore = sub.add_parser("import", help="导入接力包并重绑 Surface 上的 S300 路径")
    restore.add_argument("--bundle", required=True)
    restore.add_argument("--db", default=str(default_db()))
    restore.add_argument("--source-root", required=True)
    restore.add_argument("--target-name", default="")
    restore.add_argument("--replace", action="store_true")
    restore.add_argument("--keep-newer", action="store_true", help="本机已有相同或更新进度时保留本机数据库")
    restore.set_defaults(func=import_bundle)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return int(args.func(args))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
