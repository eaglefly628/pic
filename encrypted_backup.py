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

def _payload(home: bytes, health: bytes, raw: bytes | None) -> bytes:
    files = {'home/current.home': home, 'health/health-archive.zip': health}
    if raw:
        files['health/raw-pages.json'] = raw
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
            if _sha(health_zip.read(rel)) != report['sha256']:
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

def create_snapshot(data_dir: Path, health_root: Path, raw_pages: Path | None = None) -> dict:
    home_path = data_dir / 'current.home'
    home = home_path.read_bytes()
    if json.loads(home).get('__home_backup') != 1:
        raise ValueError('主应用备份无效')
    health = HealthArchive(health_root).export()
    raw = raw_pages.read_bytes() if raw_pages and raw_pages.is_file() else None
    key_path, key = _key(data_dir, create=True)
    encrypted = MAGIC + (nonce := secrets.token_bytes(12)) + AESGCM(key).encrypt(nonce, _payload(home, health, raw), MAGIC)
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

if __name__ == '__main__':
    app = Path.home() / 'Library/Application Support/我家里的一切'
    if len(sys.argv) > 1 and sys.argv[1] == 'create':
        raw_file = Path(sys.argv[2]) if len(sys.argv) > 2 else None
        print(json.dumps(create_snapshot(app, app / 'health', raw_file), ensure_ascii=False))
    elif len(sys.argv) > 2 and sys.argv[1] == 'verify':
        print(json.dumps(extract(Path(sys.argv[2]), app / 'backup-recovery.key'), ensure_ascii=False))
    elif len(sys.argv) > 3 and sys.argv[1] == 'extract':
        print(json.dumps(extract(Path(sys.argv[2]), app / 'backup-recovery.key', Path(sys.argv[3])), ensure_ascii=False))
    else:
        raise SystemExit('Usage: encrypted_backup.py create [raw-pages.json] | verify FILE | extract FILE NEW_DIRECTORY')
