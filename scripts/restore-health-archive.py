"""Restore a portable health archive with source verification before modifying local data."""
import argparse
from pathlib import Path
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from health_archive import HealthArchive, MAX_BYTES

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup',type=Path)
    parser.add_argument('--directory',type=Path,default=Path(__file__).resolve().parent.parent/'health-data.local')
    parser.add_argument('--check-only',action='store_true')
    args=parser.parse_args()
    if args.backup.stat().st_size>MAX_BYTES:parser.error('Backup exceeds 100 MB')
    payload=args.backup.read_bytes()
    with tempfile.TemporaryDirectory(prefix='health-restore-preflight-') as folder:
        test=HealthArchive(folder);test.import_data(payload)
        data=test.read()
        for report in data['reports']:test.source(report['source_id'])
        print(f"Verified {len(data['reports'])} source documents and {len(data['observations'])} observations.")
    if not args.check_only:
        result=HealthArchive(args.directory).import_data(payload)
        print(f"Restored: {result['added']} added, {result['duplicates']} duplicates. Data: {args.directory.resolve()}")
if __name__=='__main__': main()
