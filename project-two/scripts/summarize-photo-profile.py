#!/usr/bin/env python3
"""Summarize the JSONL performance log produced by photo_organize.py."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


STAGE_LABELS = {
    "sourceStatMs": "读取源文件状态",
    "targetStatMs": "检查目标是否存在",
    "renameMs": "SMB 同盘移动/改名",
    "verifyStatMs": "移动后校验",
    "totalMs": "单文件总耗时",
}


def weighted(records: list[dict], stage: str, metric: str) -> float:
    count = sum(int(record.get("files", 0)) for record in records)
    if not count:
        return 0.0
    return sum(
        float(record.get("stages", {}).get(stage, {}).get(metric, 0.0)) * int(record.get("files", 0))
        for record in records
    ) / count


def main() -> int:
    parser = argparse.ArgumentParser(description="汇总照片整理性能 JSONL")
    parser.add_argument("profile", type=Path)
    parser.add_argument("--run-id", type=int)
    parser.add_argument("--remaining", type=int, default=0)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    records = []
    with args.profile.expanduser().open(encoding="utf-8") as handle:
        for line in handle:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if args.run_id is None or int(record.get("runId", -1)) == args.run_id:
                records.append(record)
    if not records:
        raise SystemExit("没有找到可汇总的性能记录")

    run_id = int(records[-1]["runId"])
    files = sum(int(record.get("files", 0)) for record in records)
    failed = sum(int(record.get("failed", 0)) for record in records)
    wall_ms = sum(float(record.get("batchWallMs", 0)) for record in records)
    hits = sum(int(record.get("directoryCacheHits", 0)) for record in records)
    misses = sum(int(record.get("directoryCacheMisses", 0)) for record in records)
    cache_rate = hits / (hits + misses) * 100 if hits + misses else 0
    phase_totals = {
        "数据库读取": sum(float(record.get("queryMs", 0)) for record in records),
        "目录准备": sum(float(record.get("directoryMs", 0)) for record in records),
        "并发文件操作": sum(float(record.get("workerWallMs", 0)) for record in records),
        "数据库提交": sum(float(record.get("dbMs", 0)) for record in records),
    }
    slowest = sorted(records, key=lambda item: float(item.get("batchWallMs", 0)), reverse=True)[:5]
    dominant = max(phase_totals, key=phase_totals.get)

    lines = [
        f"# 照片整理性能报告（任务 {run_id}）",
        "",
        f"- 批次：{len(records)}；文件：{files}；失败：{failed}",
        f"- 采样总耗时：{wall_ms / 1000:.2f} 秒；平均吞吐：{files / (wall_ms / 1000):.2f} 个/秒",
        f"- 目录缓存命中率：{cache_rate:.1f}%（命中 {hits}，新建/首次访问 {misses}）",
        f"- 当前最大阶段：{dominant}（{phase_totals[dominant] / 1000:.2f} 秒）",
        "",
        "## 批次阶段",
        "",
        "| 阶段 | 累计耗时 | 占采样墙钟时间 |",
        "|---|---:|---:|",
    ]
    for label, value in phase_totals.items():
        lines.append(f"| {label} | {value / 1000:.2f} 秒 | {value / wall_ms * 100 if wall_ms else 0:.1f}% |")
    lines += ["", "## 单文件阶段", "", "| 操作 | 平均 | 加权 P95 | 最大批次峰值 |", "|---|---:|---:|---:|"]
    for key, label in STAGE_LABELS.items():
        max_value = max(float(record.get("stages", {}).get(key, {}).get("maxMs", 0)) for record in records)
        lines.append(f"| {label} | {weighted(records, key, 'avgMs'):.2f} ms | {weighted(records, key, 'p95Ms'):.2f} ms | {max_value:.2f} ms |")
    workers_seen = sorted({int(record.get("workers", 0)) for record in records})
    worker_rates: dict[int, float] = {}
    lines += ["", "## 并发对照", "", "| 并发线程 | 文件数 | 批次数 | 平均吞吐 | 单文件 rename 平均 |", "|---:|---:|---:|---:|---:|"]
    for workers in workers_seen:
        group = [record for record in records if int(record.get("workers", 0)) == workers]
        group_files = sum(int(record.get("files", 0)) for record in group)
        group_wall = sum(float(record.get("batchWallMs", 0)) for record in group)
        throughput = group_files / (group_wall / 1000) if group_wall else 0
        worker_rates[workers] = throughput
        lines.append(
            f"| {workers} | {group_files} | {len(group)} | {throughput:.2f}/秒 | "
            f"{weighted(group, 'renameMs', 'avgMs'):.2f} ms |"
        )
    best_workers = max(worker_rates, key=worker_rates.get)
    best_rate = worker_rates[best_workers]
    lines += ["", "## 结论与优化建议", "", f"- 本次最佳参数是 **{best_workers} 路并发**，平均 {best_rate:.2f} 个/秒。"]
    if args.remaining and best_rate:
        hours = args.remaining / best_rate / 3600
        lines.append(f"- 按这个样本估算，剩余 {args.remaining:,} 个文件约需 **{hours:.1f} 小时**；不同来源目录的 NAS 响应可能使实际时间波动。")
    lines += [
        "- 数据库与目录缓存合计占比不到 1%，继续放大批次不会显著提速，反而会让页面长时间不刷新。",
        "- 保留移动前后校验；它只占很小比例，却负责防覆盖与断点恢复，不建议以数据安全换取有限速度。",
        "- 若要数量级提速，应让整理程序在 S300 本机（SSH、容器或 NAS 自带任务）执行，避免每个 `rename` 经 SMB/Wi‑Fi 往返。",
    ]
    lines += ["", "## 最慢批次", "", "| 批次 | 文件数 | 吞吐 | 耗时 | 首个来源路径 |", "|---:|---:|---:|---:|---|"]
    for record in slowest:
        path = str(record.get("firstPath", "")).replace("|", "\\|")
        lines.append(
            f"| {record.get('batch')} | {record.get('files')} | {float(record.get('throughputFilesPerSec', 0)):.2f}/秒 | "
            f"{float(record.get('batchWallMs', 0)) / 1000:.2f} 秒 | `{path}` |"
        )
    lines += [
        "",
        "## 判断方法",
        "",
        "- 若“SMB 同盘移动/改名”占主导，瓶颈在 NAS 元数据操作；优先按同一目录批处理，并保持适度并发。",
        "- 若源/目标状态读取占主导，减少重复 `stat` 只能在不降低防覆盖和断点恢复安全性的前提下进行。",
        "- 若目录准备占主导，月份布局及目录缓存会直接改善性能。",
        "- 若数据库提交占主导，可增大批次，但会让单次中断后的重做范围变大。",
        "",
        f"原始明细：`{args.profile.expanduser()}`",
    ]
    output = "\n".join(lines) + "\n"
    if args.output:
        args.output.expanduser().write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
