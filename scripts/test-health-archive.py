"""Regression tests with synthetic health data and temporary directories only."""
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from health_archive import HealthArchive, validate

PDF = b"%PDF-1.4 synthetic test document"
SHA = hashlib.sha256(PDF).hexdigest()
SID = SHA[:12]
def fixture():
    return {"reports": [{"source_id": SID, "sha256": SHA, "date": "2020-11-18", "pages": 2, "pdf": "sources/test.pdf", "filename": "synthetic.pdf", "count": 1}], "observations": [{"id": SID + ":lipid.ldl", "source_id": SID, "metric_key": "lipid.ldl", "name": "synthetic LDL", "original_value": "3.85", "date": "2020-11-18", "source_page": 1, "normalized_value": 3.85, "normalized_unit": "mmol/L", "trend_eligible": True}]}
def pack(data, content=PDF):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("archive-index.json", json.dumps(data))
        z.writestr(data["reports"][0]["pdf"], content)
    return buf.getvalue()

class ArchiveTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = HealthArchive(self.temp.name)
    def test_empty(self):
        self.assertEqual(self.store.public()["observations"], [])
    def test_append_duplicate_export_restore(self):
        first = self.store.import_data(pack(fixture()))
        self.assertEqual(first["added"], 1)
        self.assertEqual(self.store.import_data(pack(fixture()))["duplicates"], 1)
        self.assertEqual(self.store.source(SID), PDF)
        self.assertNotIn("pdf", self.store.public()["reports"][0])
        with tempfile.TemporaryDirectory() as other:
            restored = HealthArchive(other)
            restored.import_data(self.store.export())
            self.assertEqual(restored.read(), self.store.read())
            self.assertEqual(restored.source(SID), PDF)
    def test_image_sample_provenance_backup(self):
        data = fixture()
        report, row = data["reports"][0], data["observations"][0]
        report.update(pdf="sources/test.jpg", encounter_id="same-sample", sampled_at="2020-11-18T10:13+08:00", date_basis="sampled_at", historical_references=[{"date":"2019-01-01","status":"reference_only","original_cell":"3.1"}])
        row.update(sampled_at=report["sampled_at"], date_basis="sampled_at", supporting_sources=[{"source_id":SID,"source_page":2}])
        self.store.import_data(pack(data))
        self.assertEqual(self.store.source_mime(SID), "image/jpeg")
        with tempfile.TemporaryDirectory() as other:
            restored=HealthArchive(other); restored.import_data(self.store.export())
            self.assertEqual(restored.read(),self.store.read())
            self.assertEqual(restored.import_data(self.store.export())["duplicates"],1)
        for timestamp in ["2026-11-05T10:13+08:00", "2020-11-18T10:13", "bad"]:
            bad=copy.deepcopy(data);bad["observations"][0]["sampled_at"]=timestamp
            with self.subTest(timestamp=timestamp), self.assertRaises(ValueError): validate(bad)

    def test_conflict_does_not_change_archive(self):
        self.store.import_data(pack(fixture()))
        before = self.store.index.read_bytes()
        bad = fixture(); bad["observations"][0]["normalized_value"] = 9
        with self.assertRaises(ValueError): self.store.import_data(pack(bad))
        self.assertEqual(self.store.index.read_bytes(), before)
    def test_reject_traversal_and_changed_hash(self):
        bad = fixture(); bad["reports"][0]["pdf"] = "../outside.pdf"
        with self.assertRaises(ValueError): self.store.import_data(pack(bad))
        self.assertFalse(self.store.index.exists())
        with self.assertRaises(ValueError): self.store.import_data(pack(fixture(), b"tampered"))
        self.assertFalse(self.store.index.exists())
    def test_date_page_units_and_censored_value_guards(self):
        for field, value in [("date", "2021-01-01"), ("source_page", 3), ("normalized_unit", None), ("normalized_value", float("nan")), ("comparator", "<")]:
            bad = fixture(); bad["observations"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): validate(bad)
        bad = fixture(); bad["observations"].append(copy.deepcopy(bad["observations"][0]))
        with self.assertRaises(ValueError): validate(bad)
    def test_source_symlink_outside_root_rejected(self):
        self.store.import_data(pack(fixture()))
        p = self.store.root / "sources/test.pdf"
        with tempfile.TemporaryDirectory() as outside:
            target = Path(outside) / "secret.pdf"; target.write_bytes(PDF)
            p.unlink()
            try: p.symlink_to(target)
            except OSError: self.skipTest("symlink permission unavailable")
            with self.assertRaises(ValueError): self.store.source(SID)

if __name__ == "__main__": unittest.main()
