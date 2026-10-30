#!/usr/bin/env python3
"""Read-only year clues for entries left in an organize run's review queue.

This report never reads or changes original media. A candidate is evidence for
human review, not permission to move a file.
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import json
import re
import sqlite3
from pathlib import Path, PurePosixPath


YEAR = re.compile(r"(?<!\d)(?:19\d{2}|20\d{2})(?!\d)")
YEAR_MONTH = re.compile(
    r"(?<!\d)((?:19|20)\d{2})(?:[-_.年/](0?[1-9]|1[0-2])|(0[1-9]|1[0-2]))(?:月)?(?!\d)"
)
FULL_DATE = re.compile(
    r"(?<!\d)((?:19|20)\d{2})(?:[-_.年/](0?[1-9]|1[0-2])[-_.月/](0?[1-9]|[12]\d|3[01])"
    r"|(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01]))(?!\d)"
)
SHORT_DATE_TIME = re.compile(
    r"(?<!\d)(\d{2})(0[1-9]|1[0-2])([0-3]\d)[_ -]([01]\d|2[0-3])([0-5]\d)([0-5]\d)(?!\d)"
)


def valid_date(year: int, month: int, day: int) -> bool:
    try:
        dt.date(year, month, day)
        return True
    except ValueError:
        return False


def full_date_parts(match: re.Match[str]) -> tuple[int, int, int]:
    return int(match.group(1)), int(match.group(2) or match.group(4)), int(match.group(3) or match.group(5))


def evidence_for(path: str, source: str | None, captured: str | None, current_year: int) -> tuple[list[dict], list[str]]:
    pieces = PurePosixPath(path).parts
    folders, filename = pieces[:-1], pieces[-1]
    evidence: list[dict] = []
    flags: list[str] = []

    if source == "embedded_metadata" and captured:
        try:
            parsed = dt.datetime.fromisoformat(captured.replace("Z", "+00:00"))
        except ValueError:
            flags.append("invalid_embedded_time")
        else:
            if 1990 <= parsed.year <= current_year + 1:
                evidence.append({"year": parsed.year, "month": parsed.month,
                                 "precision": "full_date", "rule": "embedded_metadata"})
            else:
                flags.append("invalid_embedded_time")

    for match in FULL_DATE.finditer(filename):
        y, m, d = full_date_parts(match)
        if 1990 <= y <= current_year + 1 and valid_date(y, m, d):
            evidence.append({"year": y, "month": m, "precision": "full_date", "rule": "filename_full_date"})

    for match in SHORT_DATE_TIME.finditer(filename):
        yy, month, day = map(int, match.group(1, 2, 3))
        year = 1900 + yy if yy >= 90 else 2000 + yy if yy <= current_year % 100 + 1 else None
        if year and valid_date(year, month, day):
            evidence.append({"year": year, "month": month,
                             "precision": "full_date", "rule": "filename_YYMMDD_HHMMSS"})
        elif year is None:
            flags.append("ambiguous_two_digit_year")

    for folder in folders:
        for match in FULL_DATE.finditer(folder):
            y, m, d = full_date_parts(match)
            if 1990 <= y <= current_year + 1 and valid_date(y, m, d):
                evidence.append({"year": y, "month": m,
                                 "precision": "full_date", "rule": "folder_full_date"})
        for match in YEAR_MONTH.finditer(folder):
            year = int(match.group(1))
            if 1990 <= year <= current_year + 1:
                # Names such as 200610_4-2 contain another date-like suffix;
                # the six digits alone are not enough to assert the month.
                if match.group(3) and re.match(r"[_-]\d", folder[match.end():]):
                    evidence.append({"year": year, "precision": "year", "rule": "ambiguous_folder_month"})
                    continue
                month = int(match.group(2) or match.group(3))
                evidence.append({"year": year, "month": month,
                                 "precision": "month", "rule": "folder_month"})
        for match in YEAR.finditer(folder):
            year = int(match.group())
            if 1990 <= year <= current_year + 1:
                evidence.append({"year": year, "precision": "year", "rule": "folder_year"})

    # De-duplicate overlapping date/month/year regex matches from one folder.
    evidence = list({(item["year"], item.get("month"), item["precision"], item["rule"]): item for item in evidence}.values())
    return evidence, sorted(set(flags))


def classify(evidence: list[dict]) -> tuple[str, str, str]:
    years = sorted({item["year"] for item in evidence})
    if not years:
        return "unknown", "", "unknown"
    if len(years) > 1:
        return "conflict", ",".join(map(str, years)), "conflict"
    rank = {"year": 1, "month": 2, "full_date": 3}
    precision = max((item["precision"] for item in evidence), key=rank.__getitem__)
    return "candidate", str(years[0]), precision


def destination_from_evidence(evidence: list[dict]) -> tuple[str, int | None, int | None]:
    """Conservative month/year decision; disagreements never choose a month."""
    years = {item["year"] for item in evidence}
    if not years:
        return "unknown", None, None
    if len(years) != 1:
        return "year_conflict", None, None
    year = next(iter(years))
    months = {item["month"] for item in evidence if item.get("month") is not None}
    if len(months) == 1:
        return "month", year, next(iter(months))
    return "year_only", year, None


def read_rows(db: Path, run_id: int | None) -> tuple[int, list[sqlite3.Row]]:
    uri = db.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA query_only=ON")
        if run_id is None:
            run = conn.execute("SELECT id,status FROM organize_runs ORDER BY id DESC LIMIT 1").fetchone()
            if not run or run["status"] != "completed":
                raise RuntimeError("最新整理任务尚未完成")
            run_id = int(run["id"])
        rows = conn.execute(
            """SELECT e.source_rel,e.target_rel,e.kind,m.capture_time_text,
                      m.capture_time_source,m.capture_time_confidence,m.latitude,m.longitude
               FROM organize_entries e
               LEFT JOIN media_files m ON m.source_id=(SELECT source_id FROM organize_runs WHERE id=e.run_id)
                    AND m.rel_path=e.source_rel
               WHERE e.run_id=? AND e.status='review' ORDER BY e.source_rel""",
            (run_id,),
        ).fetchall()
    return run_id, rows


def generate(db: Path, run_id: int | None, summary_path: Path, csv_path: Path) -> dict:
    run_id, rows = read_rows(db, run_id)
    current_year = dt.date.today().year
    counts: collections.Counter[str] = collections.Counter()
    years: collections.Counter[str] = collections.Counter()
    precisions: collections.Counter[str] = collections.Counter()
    rules: collections.Counter[str] = collections.Counter()
    flags: collections.Counter[str] = collections.Counter()
    conflict_years: collections.Counter[str] = collections.Counter()
    invalid_time_classes: collections.Counter[str] = collections.Counter()
    examples: dict[str, list[str]] = collections.defaultdict(list)
    example_keys: dict[str, set[tuple[str, str]]] = collections.defaultdict(set)
    gps_count = 0
    columns = ["source_rel", "kind", "classification", "candidate_years", "best_precision",
               "evidence", "flags", "capture_time_source", "capture_time_text", "gps_present",
               "proposed_year_only_dir"]
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            evidence, item_flags = evidence_for(
                row["source_rel"], row["capture_time_source"], row["capture_time_text"], current_year
            )
            classification, candidate_years, precision = classify(evidence)
            if row["kind"] == "sidecar":
                item_flags = sorted(set(item_flags + ["sidecar_requires_pair_review"]))
            counts[classification] += 1
            if classification == "candidate":
                years[candidate_years] += 1
                precisions[precision] += 1
            elif classification == "conflict":
                conflict_years[candidate_years] += 1
            for rule in {item["rule"] for item in evidence}:
                rules[rule] += 1
            for flag in item_flags:
                flags[flag] += 1
                if flag == "invalid_embedded_time":
                    invalid_time_classes[classification] += 1
            gps_count += int(row["latitude"] is not None and row["longitude"] is not None)
            example_key = (PurePosixPath(row["source_rel"]).parts[0], candidate_years if classification == "conflict" else precision)
            if len(examples[classification]) < 8 and example_key not in example_keys[classification]:
                examples[classification].append(row["source_rel"])
                example_keys[classification].add(example_key)
            writer.writerow({
                "source_rel": row["source_rel"], "kind": row["kind"],
                "classification": classification, "candidate_years": candidate_years,
                "best_precision": precision, "evidence": json.dumps(evidence, ensure_ascii=False),
                "flags": ",".join(item_flags), "capture_time_source": row["capture_time_source"] or "",
                "capture_time_text": row["capture_time_text"] or "",
                "gps_present": int(row["latitude"] is not None and row["longitude"] is not None),
                "proposed_year_only_dir": f"家庭影像库/{candidate_years}/_仅确定年份/" if classification == "candidate" and precision == "year" else "",
            })

    if sum(counts.values()) != len(rows):
        raise AssertionError("分类总数与待审核条目数不符")
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 待确认项目的年份线索（只读）", "",
        f"- 整理任务：runId={run_id}", f"- 待审核条目：{len(rows):,}",
        f"- 单一年份候选：{counts['candidate']:,}", f"- 多年份冲突：{counts['conflict']:,}",
        f"- 年份未知：{counts['unknown']:,}",
        f"- 带 GPS 的待审核条目：{gps_count:,}（仅作佐证，不单凭地点推年份）",
        "- 本报告只分析索引路径和已有元数据；未读取或移动原片。候选年份尚未人工确认。", "",
        "## 单一年份候选的证据精度", "",
    ]
    lines.extend(f"- {precision}: {count:,}" for precision, count in precisions.most_common())
    lines.extend(["", "## 主要规则命中", ""])
    lines.extend(f"- {rule}: {count:,}" for rule, count in rules.most_common())
    lines.extend(["", "## 异常标记", ""])
    lines.extend(f"- {flag}: {count:,}" for flag, count in flags.most_common())
    lines.extend(["", "其中异常内嵌时间的分类：", ""])
    lines.extend(f"- {category}: {count:,}" for category, count in invalid_time_classes.most_common())
    lines.extend(["", "## 常见年份冲突", ""])
    lines.extend(f"- {pair}: {count:,}" for pair, count in conflict_years.most_common(12))
    lines.extend(["", "## 候选年份", ""])
    lines.extend(f"- {year}: {count:,}" for year, count in sorted(years.items()))
    for category in ("candidate", "conflict", "unknown"):
        lines.extend(["", f"## {category} 样本", ""])
        lines.extend(f"- `{path}`" for path in examples[category])
    lines.extend(["", "逐项证据、冲突及拟议目录见同名 CSV；不得依据本报告自动搬动冲突项。", ""])
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    return {"runId": run_id, "total": len(rows), "classes": dict(counts), "flags": dict(flags),
            "summary": str(summary_path), "csv": str(csv_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--run-id", type=int)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument("--csv", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(generate(args.db, args.run_id, args.summary, args.csv), ensure_ascii=False))


if __name__ == "__main__":
    main()
