"""Upload only verified ciphertext to this family's public Git repository."""
from __future__ import annotations

import datetime
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from encrypted_backup import create_snapshot, create_originals_snapshot, extract, verify_originals

REMOTE = 'https://github.com/eaglefly628/pic.git'

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
