"""Regression checks for cumulative organizer ETA accounting."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
with tempfile.TemporaryDirectory(prefix="photo-eta-import-") as _data_dir:
    os.environ.setdefault("HOME_DATA_DIR", _data_dir)
    import run


class PhotoOrganizeEtaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="photo-eta-")
        self.original_path = run.PHOTO_ORGANIZE_PROFILE
        run.PHOTO_ORGANIZE_PROFILE = Path(self.temp.name) / "profile.jsonl"
        run._PHOTO_ORGANIZE_PROFILE_CACHE.update(identity=None, offset=0, runs={})

    def tearDown(self):
        run.PHOTO_ORGANIZE_PROFILE = self.original_path
        run._PHOTO_ORGANIZE_PROFILE_CACHE.update(identity=None, offset=0, runs={})
        self.temp.cleanup()

    def append(self, record, newline=True):
        with run.PHOTO_ORGANIZE_PROFILE.open("ab") as handle:
            handle.write(json.dumps(record).encode() + (b"\n" if newline else b""))

    def test_all_completed_batches_across_polls_and_runs(self):
        self.append({"runId": 2, "succeeded": 16, "batchWallMs": 8000})
        self.append({"runId": 3, "succeeded": 4, "batchWallMs": 4000})
        self.assertEqual(run._photo_organize_profile_summary(2), {"files": 16, "wallMs": 8000.0, "batches": 1})
        self.append({"runId": 2, "succeeded": 16, "batchWallMs": 2000})
        self.assertEqual(run._photo_organize_profile_summary(2), {"files": 32, "wallMs": 10000.0, "batches": 2})
        self.assertEqual(run._photo_organize_profile_summary(3), {"files": 4, "wallMs": 4000.0, "batches": 1})

    def test_unfinished_line_is_read_when_completed(self):
        self.append({"runId": 2, "succeeded": 1, "batchWallMs": 1000}, newline=False)
        self.assertEqual(run._photo_organize_profile_summary(2)["batches"], 0)
        with run.PHOTO_ORGANIZE_PROFILE.open("ab") as handle:
            handle.write(b"\n")
        self.assertEqual(run._photo_organize_profile_summary(2)["batches"], 1)


if __name__ == "__main__":
    unittest.main()
