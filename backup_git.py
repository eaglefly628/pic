"""Upload only verified ciphertext to this family's public Git repository."""
from __future__ import annotations

import datetime
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile

from encrypted_backup import create_snapshot, create_originals_snapshot, extract, verify_originals, restore_originals
from health_archive import HealthArchive

REMOTE = 'https://github.com/eaglefly628/pic.git'
RAW = 'https://raw.githubusercontent.com/eaglefly628/pic/main/backup-data/'
CONTENTS = 'https://api.github.com/repos/eaglefly628/pic/contents/backup-data?ref=main'

def _git(args: list[str], cwd: Path | None = None) -> str:
    env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0'}
    result = subprocess.run(['git', *args], cwd=cwd, env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
    if result.returncode:
        raise RuntimeError('GitHub 上传失败：' + result.stderr.strip()[-500:])
    return result.stdout.strip()

def upload(data_dir: Path, health_root: Path) -> dict:
    compact = create_snapshot(data_dir, health_root)
    originals = create_originals_snapshot(data_dir, health_root)
    key_path = Path(compact['key_path'])
    extract(Path(compact['path']), key_path)
    verify_originals(Path(originals['path']), key_path)
    month = datetime.datetime.now().strftime('%Y-%m')
    names = [f'backup-data/{month}.homeenc', f'backup-data/{month}-health-originals.homeenc']
    for attempt in range(2):
        with tempfile.TemporaryDirectory(prefix='pic-encrypted-upload-', dir=data_dir / 'backups') as temp:
            repo = Path(temp) / 'repo'
            _git(['clone', '--depth', '1', '--branch', 'main', REMOTE, str(repo)])
            if _git(['remote', 'get-url', 'origin'], repo) != REMOTE:
                raise RuntimeError('备份仓库地址不匹配')
            for source, name in zip((compact, originals), names):
                target = repo / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source['path'], target)
            extract(repo / names[0], key_path)
            verify_originals(repo / names[1], key_path)
            _git(['add', '--', *names], repo)
            if not _git(['status', '--porcelain'], repo):
                return {'ok': True, 'unchanged': True, 'files': names,
                        'health_reports': compact['health_reports'], 'health_observations': compact['health_observations']}
            _git(['-c', 'user.name=PIC Backup', '-c', 'user.email=pic-backup@users.noreply.github.com',
                  'commit', '-m', 'Update encrypted family backup'], repo)
            try:
                _git(['push', 'origin', 'HEAD:main'], repo)
            except RuntimeError:
                if attempt == 0:
                    continue
                raise
            return {'ok': True, 'files': names, 'commit': _git(['rev-parse', 'HEAD'], repo),
                    'compact_bytes': compact['cipher_bytes'], 'originals_bytes': originals['cipher_bytes'],
                    'originals_files': originals['files'], 'health_reports': compact['health_reports'],
                    'health_observations': compact['health_observations']}
    raise RuntimeError('GitHub 上传未完成')

def _download(url: str, limit: int) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': 'PIC-Family-Backup/1'})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('云端备份文件超过安全上限')
    return data

def list_months() -> list[str]:
    entries = json.loads(_download(CONTENTS, 2 * 1024 * 1024))
    if not isinstance(entries, list):
        raise ValueError('无法读取 GitHub 备份清单')
    return sorted((name[:-8] for entry in entries if (name := entry.get('name', ''))
                   and re.fullmatch(r'\d{4}-\d{2}\.homeenc', name)), reverse=True)

def restore_files(data_dir: Path, health_root: Path, compact_path: Path, originals_path: Path) -> dict:
    key_path = data_dir / 'backup-recovery.key'
    compact_info = extract(compact_path, key_path)
    original_info = verify_originals(originals_path, key_path, include_manifest=True)
    with tempfile.TemporaryDirectory(prefix='pic-cloud-restore-', dir=data_dir / 'backups') as temp:
        extracted = Path(temp) / 'unpacked'
        extract(compact_path, key_path, extracted)
        incoming = json.loads((extracted / 'home/current.home').read_bytes())
        if incoming.get('__home_backup') != 1:
            raise ValueError('云端主应用数据无效')
        versions = incoming.get('backup_versions') or {}
        if isinstance(versions, dict) and versions.get('finance', 0) > 0 and 'familyvault.vault.v1' not in (incoming.get('localStorage') or {}):
            raise ValueError('云端备份缺少理财库，拒绝恢复')
        current_path = data_dir / 'current.home'
        if current_path.exists():
            current = json.loads(current_path.read_bytes())
            now = current.get('backup_versions') or {}
            if isinstance(now, dict) and isinstance(versions, dict) and any(versions.get(k, -1) < now.get(k, 0) for k in ('finance', 'shared', 'health')):
                raise ValueError('云端备份早于本机数据，已保留当前版本')
        health_zip = (extracted / 'health/health-archive.zip').read_bytes()
        incoming_activity_path = extracted / 'health/apple-health-activity.json'
        activity_target = health_root / 'apple-health-activity.json'
        if incoming_activity_path.exists() and activity_target.exists():
            incoming_activity = json.loads(incoming_activity_path.read_bytes())
            current_activity = json.loads(activity_target.read_bytes())
            if current_activity.get('data_cutoff_date', '') > incoming_activity.get('data_cutoff_date', ''):
                raise ValueError('云端 Apple Watch 数据早于本机，已保留本机')
        with zipfile.ZipFile(io.BytesIO(health_zip)) as archive:
            health_index = json.loads(archive.read('archive-index.json'))
        report_paths = {r['pdf']: r['sha256'] for r in health_index['reports']}
        for name, expected in original_info['manifest'].items():
            if report_paths.get(name) != expected['sha256']:
                raise ValueError('云端健康数据与原件包不匹配')
        health = HealthArchive(health_root)
        # Reject an unrelated originals archive before changing local data.
        with tempfile.TemporaryDirectory(prefix='pic-health-preview-') as preview:
            preview_health = HealthArchive(Path(preview))
            preview_health.import_data(health_zip)
            preview_index = preview_health.read()
            if len(preview_index['reports']) != compact_info['health_reports']:
                raise ValueError('云端健康记录数量不一致')
        old_index = health.read()
        old_reports = {r['source_id']: r for r in old_index['reports']}
        for report in health_index['reports']:
            prior = old_reports.get(report['source_id'])
            if prior and any(prior.get(k) != report.get(k) for k in ('date', 'sha256', 'pages', 'pdf')):
                raise ValueError('本机健康报告与云端记录冲突，已停止恢复')
        safety = data_dir / 'backups' / ('cloud-restore-before-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.home')
        if current_path.exists():
            fd = os.open(safety, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as output:
                output.write(current_path.read_bytes()); output.flush(); os.fsync(output.fileno())
        health_result = health.import_data(health_zip)
        originals_result = restore_originals(originals_path, key_path, health_root)
        if incoming_activity_path.exists():
            health_root.mkdir(parents=True, exist_ok=True)
            if activity_target.exists():
                activity_safety = data_dir / 'backups' / ('apple-activity-before-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.json')
                activity_safety.write_bytes(activity_target.read_bytes())
                activity_safety.chmod(0o600)
            replacement_activity = health_root / ('.apple-activity-' + os.urandom(8).hex() + '.tmp')
            replacement_activity.write_bytes(incoming_activity_path.read_bytes())
            replacement_activity.chmod(0o600)
            os.replace(replacement_activity, activity_target)
        replacement = data_dir / ('.cloud-restore-' + os.urandom(8).hex() + '.tmp')
        replacement.write_bytes((extracted / 'home/current.home').read_bytes())
        replacement.chmod(0o600)
        os.replace(replacement, current_path)
    return {'ok': True, 'health_reports': compact_info['health_reports'],
            'health_observations': compact_info['health_observations'],
            'originals_files': original_info['files'], 'originals_restored': originals_result['restored'],
            'health_added': health_result['added'], 'safety_copy': str(safety)}

def restore(data_dir: Path, health_root: Path, month: str | None = None) -> dict:
    if month is None:
        months = list_months()
        if not months:
            raise ValueError('GitHub 暂无可恢复的备份')
        month = months[0]
    if not re.fullmatch(r'\d{4}-\d{2}', month):
        raise ValueError('备份月份无效')
    with tempfile.TemporaryDirectory(prefix='pic-cloud-download-', dir=data_dir / 'backups') as temp:
        compact = Path(temp) / 'compact.homeenc'
        originals = Path(temp) / 'originals.homeenc'
        compact.write_bytes(_download(RAW + month + '.homeenc', 64 * 1024 * 1024))
        originals.write_bytes(_download(RAW + month + '-health-originals.homeenc', 256 * 1024 * 1024))
        compact.chmod(0o600); originals.chmod(0o600)
        return {'month': month, **restore_files(data_dir, health_root, compact, originals)}
