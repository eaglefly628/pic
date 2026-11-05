"""Local health archive: additive imports, source provenance and portable backups."""
import copy
import datetime as dt
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import threading
import uuid
import zipfile

_LOCK = threading.RLock()
MAX_BYTES = 100 * 1024 * 1024


def _date(value):
    if value is not None:
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("检查日期必须为 YYYY-MM-DD")
        dt.date.fromisoformat(value)


def _sample(record):
    sampled = record.get("sampled_at")
    if sampled:
        try:
            stamp = dt.datetime.fromisoformat(sampled)
        except (TypeError, ValueError):
            raise ValueError("采样时间格式无效")
        if stamp.tzinfo is None:
            raise ValueError("采样时间需要时区")
        if record.get("date_basis") == "sampled_at" and stamp.date().isoformat() != record.get("date"):
            raise ValueError("采样日期与归档日期不一致")
    elif record.get("date_basis") == "sampled_at":
        raise ValueError("缺少作为归档依据的采样时间")


def validate(data):
    if not isinstance(data, dict) or not isinstance(data.get("reports"), list) or not isinstance(data.get("observations"), list):
        raise ValueError("请选择包含 reports 和 observations 的标准化健康档案")
    if len(data["reports"]) > 10000 or len(data["observations"]) > 200000:
        raise ValueError("本次导入超过记录上限")
    reports = {}
    for report in data["reports"]:
        if not isinstance(report, dict):
            raise ValueError("报告记录格式无效")
        sid = report.get("source_id", "")
        sha = report.get("sha256", "")
        if not isinstance(sid, str) or not isinstance(sha, str) or not re.fullmatch(r"[a-f0-9]{12}", sid) or not re.fullmatch(r"[a-f0-9]{64}", sha) or not sha.startswith(sid) or sid in reports:
            raise ValueError("报告来源标识无效或重复")
        _date(report.get("date"))
        _sample(report)
        if not isinstance(report.get("filename"), str):
            raise ValueError("报告文件名缺失")
        if isinstance(report.get("pages"), bool) or not isinstance(report.get("pages"), int) or not 1 <= report["pages"] <= 10000:
            raise ValueError("报告页数无效")
        reports[sid] = report
    ids = set()
    for row in data["observations"]:
        if not isinstance(row, dict):
            raise ValueError("指标记录格式无效")
        if not isinstance(row.get("id"), str) or not row["id"] or row["id"] in ids:
            raise ValueError("指标记录 ID 缺失或重复")
        ids.add(row["id"])
        if not isinstance(row.get("source_id"), str) or not isinstance(row.get("name"), str) or not isinstance(row.get("original_value"), str):
            raise ValueError("指标缺少名称、原始结果或来源")
        report = reports.get(row.get("source_id"))
        if report is None or not isinstance(row.get("metric_key"), str) or not row["metric_key"]:
            raise ValueError("指标缺少有效报告来源或标准指标名")
        _date(row.get("date"))
        _sample(row)
        if row.get("date") != report.get("date"):
            raise ValueError("记录日期与来源检查日期不一致")
        if isinstance(row.get("source_page"), bool) or not isinstance(row.get("source_page"), int) or not 1 <= row["source_page"] <= report["pages"]:
            raise ValueError("来源页码超出报告范围")
        value = row.get("normalized_value")
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)):
            raise ValueError("标准值必须为有限数值或空")
        if row.get("trend_eligible") and (value is None or not row.get("normalized_unit") or row.get("comparator") or row.get("needs_review")):
            raise ValueError("趋势记录缺少可比数值/单位，或仍有疑点")
    return data


class HealthArchive:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.index = self.root / "archive-index.json"

    def read(self):
        if not self.index.exists():
            return {"schema_version": "draft-0.2", "reports": [], "observations": []}
        return validate(json.loads(self.index.read_text(encoding="utf-8")))

    def _source_path(self, report):
        rel = report.get("pdf", "")
        if not isinstance(rel, str):
            raise ValueError("原件路径无效")
        path = (self.root / rel).resolve()
        if not rel or Path(rel).is_absolute() or not path.is_relative_to(self.root) or path.suffix.lower() not in (".pdf", ".jpg", ".jpeg", ".png"):
            raise ValueError("原件路径无效")
        return path

    def source(self, sid):
        report = next((r for r in self.read()["reports"] if r["source_id"] == sid), None)
        if report is None:
            raise ValueError("未找到该报告")
        path = self._source_path(report)
        content = path.read_bytes()
        if hashlib.sha256(content).hexdigest() != report["sha256"]:
            raise ValueError("原件校验不一致")
        return content

    def source_mime(self, sid):
        report = next((r for r in self.read()["reports"] if r["source_id"] == sid), None)
        if report is None:
            raise ValueError("未找到该报告")
        return {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}[self._source_path(report).suffix.lower()]

    def public(self):
        with _LOCK:
            data = copy.deepcopy(self.read())
        for report in data["reports"]:
            report["count"] = sum(r["source_id"] == report["source_id"] for r in data["observations"])
            try:
                available = self._source_path(report).is_file()
            except ValueError:
                available = False
            report["source_available"] = available
            report["pdf_url"] = "/api/health/source?id=" + report["source_id"]
            report.pop("pdf", None)
        for row in data["observations"]:
            for field in ("pdf", "original_path", "source_path"):
                row.pop(field, None)
        data["ok"] = True
        data["updated_at"] = dt.datetime.fromtimestamp(self.index.stat().st_mtime).isoformat(timespec="seconds") if self.index.exists() else None
        return data

    def import_data(self, raw):
        files = {}
        if raw.startswith(b"PK"):
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                entries = archive.infolist()
                if sum(x.file_size for x in entries) > MAX_BYTES or len(entries) > 10001 or len({x.filename for x in entries}) != len(entries):
                    raise ValueError("备份体积过大或包含重复路径")
                data = validate(json.loads(archive.read("archive-index.json")))
                for report in data["reports"]:
                    path = self._source_path(report)
                    rel = path.relative_to(self.root).as_posix()
                    if rel not in archive.namelist():
                        continue
                    content = archive.read(rel)
                    if hashlib.sha256(content).hexdigest() != report["sha256"]:
                        raise ValueError("备份原件校验失败")
                    files[rel] = content
        else:
            data = validate(json.loads(raw))
        with _LOCK:
            current = self.read()
            reports = {r["source_id"]: r for r in current["reports"]}
            rows = {r["id"]: r for r in current["observations"]}
            added = duplicate = 0
            for report in data["reports"]:
                self._source_path(report)
                sid = report["source_id"]
                if sid in reports and any(reports[sid].get(k) != report.get(k) for k in ("date", "sha256", "pages", "pdf")):
                    raise ValueError("已有报告信息发生冲突，未写入；请先核对原件和日期")
                reports.setdefault(sid, report)
            for row in data["observations"]:
                if row["id"] in rows:
                    if rows[row["id"]] != row:
                        raise ValueError("已有记录发生修订冲突，未覆盖旧值；请核对后使用新的记录 ID")
                    duplicate += 1
                else:
                    rows[row["id"]] = row
                    added += 1
            merged = {"schema_version": "draft-0.2", "reports": list(reports.values()), "observations": list(rows.values())}
            validate(merged)
            self.root.mkdir(parents=True, exist_ok=True)
            # Preflight every target before writing any attachment.
            for rel, content in files.items():
                path = (self.root / rel).resolve()
                if path.exists() and path.read_bytes() != content:
                    raise ValueError("原件目标存在不同内容，导入已拒绝")
            for rel, content in files.items():
                path = self.root / rel
                if not path.exists():
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(content)
                    path.chmod(0o600)
            if self.index.exists():
                backups = self.root / "history"
                backups.mkdir(exist_ok=True)
                backup = backups / (uuid.uuid4().hex + ".json")
                backup.write_bytes(self.index.read_bytes())
                backup.chmod(0o600)
            temp = self.root / (".archive-" + uuid.uuid4().hex + ".tmp")
            try:
                temp.write_text(json.dumps(merged, ensure_ascii=False, allow_nan=False), encoding="utf-8")
                temp.chmod(0o600)
                os.replace(temp, self.index)
            finally:
                temp.unlink(missing_ok=True)
            return {"ok": True, "added": added, "duplicates": duplicate, "reports": len(reports), "total": len(rows)}

    def export(self):
        with _LOCK:
            data = self.read()
            output = io.BytesIO()
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("archive-index.json", json.dumps(data, ensure_ascii=False, allow_nan=False))
                for report in data["reports"]:
                    path = self._source_path(report)
                    if path.is_file():
                        archive.writestr(path.relative_to(self.root).as_posix(), self.source(report["source_id"]))
            return output.getvalue()
