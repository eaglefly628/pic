"""Portable encrypted snapshot of the local home file and health archive.

Only *.homeenc is suitable for a public Git repository. The recovery key never
belongs in the repository; losing it makes these snapshots unrecoverable.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import zipfile

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from health_archive import HealthArchive, validate

MAGIC = b'FAMILY-HOME-ENC-1\n'
ORIGINALS_MAGIC = b'FAMILY-HEALTH-ORIGINALS-1\n'

def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def _key(data_dir: Path, create: bool) -> tuple[Path, bytes]:
    path = data_dir / 'backup-recovery.key'
    if not path.exists():
        if not create:
            raise FileNotFoundError('找不到备份恢复密钥')
        data_dir.mkdir(parents=True, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as file:
            file.write(secrets.token_bytes(32))
    if path.stat().st_mode & 0o077:
        raise PermissionError('恢复密钥权限过宽，请先限制为仅本人可读')
    key = path.read_bytes()
    if len(key) != 32:
        raise ValueError('备份恢复密钥格式无效')
    return path, key

def _payload(home: bytes, health: bytes) -> bytes:
    files = {'home/current.home': home, 'health/health-archive.zip': health}
    manifest = {'format': 1, 'files': {name: {'sha256': _sha(content), 'bytes': len(content)}
                                     for name, content in files.items()}}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=4) as zipfile_out:
        zipfile_out.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False))
        for name, content in files.items():
            zipfile_out.writestr(name, content)
    return buffer.getvalue()

def extract(path: Path, key_path: Path, output_dir: Path | None = None) -> dict:
    key = key_path.read_bytes()
    if len(key) != 32:
        raise ValueError('恢复密钥格式无效')
    encoded = path.read_bytes()
    if not encoded.startswith(MAGIC) or len(encoded) < len(MAGIC) + 12 + 16:
        raise ValueError('加密备份格式无效')
    body = AESGCM(key).decrypt(encoded[len(MAGIC):len(MAGIC)+12], encoded[len(MAGIC)+12:], MAGIC)
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        if archive.testzip() is not None:
            raise ValueError('备份压缩包损坏')
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('format') != 1:
            raise ValueError('备份版本不支持')
        contents = {}
        for name, expected in manifest['files'].items():
            data = archive.read(name)
            if _sha(data) != expected['sha256'] or len(data) != expected['bytes']:
                raise ValueError(f'{name} 校验失败')
            contents[name] = data
    home = json.loads(contents['home/current.home'])
    if home.get('__home_backup') != 1:
        raise ValueError('主应用备份无效')
    with zipfile.ZipFile(io.BytesIO(contents['health/health-archive.zip'])) as health_zip:
        if health_zip.testzip() is not None:
            raise ValueError('健康原件备份损坏')
        health_index = validate(json.loads(health_zip.read('archive-index.json')))
        for report in health_index['reports']:
            rel = report['pdf']
            if rel in health_zip.namelist() and _sha(health_zip.read(rel)) != report['sha256']:
                raise ValueError('健康原件哈希不一致')
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=False)
        for name, data in contents.items():
            target = output_dir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            os.chmod(target, 0o600)
    return {'files': sorted(contents), 'health_reports': len(health_index['reports']),
            'health_observations': len(health_index['observations']),
            'cipher_sha256': _sha(encoded), 'cipher_bytes': len(encoded)}

def create_snapshot(data_dir: Path, health_root: Path) -> dict:
    home_path = data_dir / 'current.home'
    home_data = json.loads(home_path.read_bytes())
    if home_data.get('__home_backup') != 1:
        raise ValueError('主应用备份无效')
    versions = home_data.get('backup_versions') or {}
    local_keys = home_data.get('localStorage') or {}
    if isinstance(versions, dict) and isinstance(versions.get('finance'), int) and versions['finance'] > 0 and 'familyvault.vault.v1' not in local_keys:
        raise ValueError('当前主应用备份缺少已有理财库，已停止云端覆盖；请先恢复本机主应用数据')
    for database in home_data.get('indexedDB', []):
        if database.get('name') == 'healtharchive':
            for source_store in database.get('stores', []):
                if source_store.get('name') == 'sources':
                    source_store['recs'] = []
                    source_store['keys'] = []
    home = json.dumps(home_data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    health = HealthArchive(health_root).export()
    key_path, key = _key(data_dir, create=True)
    encrypted = MAGIC + (nonce := secrets.token_bytes(12)) + AESGCM(key).encrypt(nonce, _payload(home, health), MAGIC)
    backup_dir = data_dir / 'backups' / 'encrypted-full'
    backup_dir.mkdir(parents=True, exist_ok=True)
    import datetime
    name = datetime.datetime.now().strftime('family-full-%Y%m%d-%H%M%S') + '.homeenc'
    target = backup_dir / name
    fd, temp_name = tempfile.mkstemp(prefix='.family-full-', dir=backup_dir)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'wb') as output:
            output.write(encrypted); output.flush(); os.fsync(output.fileno())
        os.replace(temp_name, target)
    finally:
        if os.path.exists(temp_name): os.unlink(temp_name)
    summary = extract(target, key_path)
    return {'ok': True, 'path': str(target), 'key_path': str(key_path), **summary}

def verify_originals(path: Path, key_path: Path) -> dict:
    key = key_path.read_bytes()
    if len(key) != 32:
        raise ValueError('恢复密钥格式无效')
    encoded = path.read_bytes()
    if not encoded.startswith(ORIGINALS_MAGIC) or len(encoded) < len(ORIGINALS_MAGIC) + 28:
        raise ValueError('原件加密包格式无效')
    nonce = encoded[len(ORIGINALS_MAGIC):len(ORIGINALS_MAGIC)+12]
    body = AESGCM(key).decrypt(nonce, encoded[len(ORIGINALS_MAGIC)+12:], ORIGINALS_MAGIC)
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        if archive.testzip() is not None:
            raise ValueError('原件加密包损坏')
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('format') != 1:
            raise ValueError('原件加密包版本不支持')
        entries = manifest.get('files', {})
        if set(archive.namelist()) != {'manifest.json', *entries}:
            raise ValueError('原件加密包清单不一致')
        for name, expected in entries.items():
            if not name.startswith('sources/') or '..' in Path(name).parts:
                raise ValueError('原件路径无效')
            data = archive.read(name)
            if len(data) != expected['bytes'] or _sha(data) != expected['sha256']:
                raise ValueError('原件哈希不一致')
    return {'files': len(entries), 'source_bytes': sum(v['bytes'] for v in entries.values()),
            'cipher_sha256': _sha(encoded), 'cipher_bytes': len(encoded)}

def create_originals_snapshot(data_dir: Path, health_root: Path) -> dict:
    health = HealthArchive(health_root)
    files = {}
    for report in health.read()['reports']:
        name = health._source_path(report).relative_to(health.root).as_posix()
        if name in files and _sha(files[name]) != report['sha256']:
            raise ValueError('相同路径的报告哈希不一致')
        files[name] = health.source(report['source_id'])
    if not files:
        raise ValueError('没有可备份的健康报告原件')
    manifest = {'format': 1, 'files': {name: {'sha256': _sha(data), 'bytes': len(data)}
                                      for name, data in files.items()}}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED, compresslevel=4) as archive:
        archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False))
        for name, data in files.items():
            archive.writestr(name, data)
    key_path, key = _key(data_dir, create=False)
    nonce = secrets.token_bytes(12)
    encoded = ORIGINALS_MAGIC + nonce + AESGCM(key).encrypt(nonce, buffer.getvalue(), ORIGINALS_MAGIC)
    backup_dir = data_dir / 'backups' / 'originals'
    backup_dir.mkdir(parents=True, exist_ok=True)
    import datetime
    target = backup_dir / (datetime.datetime.now().strftime('health-originals-%Y%m%d-%H%M%S') + '.homeenc')
    fd, temp_name = tempfile.mkstemp(prefix='.health-originals-', dir=backup_dir)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'wb') as output:
            output.write(encoded); output.flush(); os.fsync(output.fileno())
        os.replace(temp_name, target)
    finally:
        if os.path.exists(temp_name): os.unlink(temp_name)
    return {'ok': True, 'path': str(target), 'key_path': str(key_path), **verify_originals(target, key_path)}

if __name__ == '__main__':
    app = Path.home() / 'Library/Application Support/我家里的一切'
    if len(sys.argv) > 1 and sys.argv[1] == 'create':
        print(json.dumps(create_snapshot(app, app / 'health'), ensure_ascii=False))
    elif len(sys.argv) > 1 and sys.argv[1] == 'create-originals':
        print(json.dumps(create_originals_snapshot(app, app / 'health'), ensure_ascii=False))
    elif len(sys.argv) > 2 and sys.argv[1] == 'verify-originals':
        print(json.dumps(verify_originals(Path(sys.argv[2]), app / 'backup-recovery.key'), ensure_ascii=False))
    elif len(sys.argv) > 2 and sys.argv[1] == 'verify':
        print(json.dumps(extract(Path(sys.argv[2]), app / 'backup-recovery.key'), ensure_ascii=False))
    elif len(sys.argv) > 3 and sys.argv[1] == 'extract':
        print(json.dumps(extract(Path(sys.argv[2]), app / 'backup-recovery.key', Path(sys.argv[3])), ensure_ascii=False))
    else:
        raise SystemExit('Usage: encrypted_backup.py create | create-originals | verify FILE | verify-originals FILE | extract FILE NEW_DIRECTORY')
