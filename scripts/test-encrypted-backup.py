"""Check that daily backups exclude originals while the separate ciphertext preserves them."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from encrypted_backup import create_snapshot, create_originals_snapshot, extract, verify_originals
from backup_git import restore_files
from health_archive import HealthArchive

class BackupTest(unittest.TestCase):
    def test_compact_and_originals_are_separate(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            health = HealthArchive(root / 'health')
            original = b'%PDF-1.4 synthetic sensitive report'
            sha = hashlib.sha256(original).hexdigest()
            sid = sha[:12]
            index = {'reports': [{'source_id': sid, 'sha256': sha, 'date': '2020-11-18',
                                  'pages': 1, 'pdf': f'sources/{sid}.pdf', 'filename': 'test.pdf'}],
                     'observations': [{'id': sid + ':one', 'source_id': sid, 'source_page': 1,
                                       'date': '2020-11-18', 'metric_key': 'one', 'name': 'one',
                                       'original_value': '1'}]}
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, 'w') as archive:
                archive.writestr('archive-index.json', json.dumps(index))
                archive.writestr(f'sources/{sid}.pdf', original)
            health.import_data(buf.getvalue())
            (root / 'current.home').write_text(json.dumps({'__home_backup': 1, 'indexedDB': [
                {'name': 'healtharchive', 'stores': [{'name': 'sources', 'keys': [sid], 'recs': [original.hex()]}]}]}))
            compact = create_snapshot(root, health.root)
            separate = create_originals_snapshot(root, health.root)
            self.assertEqual(extract(Path(compact['path']), Path(compact['key_path']))['health_observations'], 1)
            self.assertEqual(verify_originals(Path(separate['path']), Path(separate['key_path']))['files'], 1)
            output = root / 'restored'
            extract(Path(compact['path']), Path(compact['key_path']), output)
            with zipfile.ZipFile(output / 'health/health-archive.zip') as archive:
                self.assertEqual(archive.namelist(), ['archive-index.json'])
            self.assertEqual(json.loads((output / 'home/current.home').read_text())['indexedDB'][0]['stores'][0]['recs'], [])
            self.assertNotIn(original, Path(compact['path']).read_bytes())
            self.assertNotIn(original, Path(separate['path']).read_bytes())
            destination = root / 'new-device'
            (destination / 'backups').mkdir(parents=True)
            (destination / 'backup-recovery.key').write_bytes(Path(compact['key_path']).read_bytes())
            (destination / 'backup-recovery.key').chmod(0o600)
            result = restore_files(destination, destination / 'health', Path(compact['path']), Path(separate['path']))
            self.assertEqual(result['health_observations'], 1)
            self.assertEqual(result['originals_restored'], 1)
            self.assertEqual(HealthArchive(destination / 'health').source(sid), original)
            tampered = root / 'tampered.homeenc'
            payload = bytearray(Path(compact['path']).read_bytes()); payload[-1] ^= 1; tampered.write_bytes(payload)
            with self.assertRaises(Exception):
                restore_files(destination, destination / 'health', tampered, Path(separate['path']))

if __name__ == '__main__':
    unittest.main()
