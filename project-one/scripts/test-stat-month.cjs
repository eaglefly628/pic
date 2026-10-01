#!/usr/bin/env node
// 统计月边界 + 一次性迁移回归测试。纯临时对象，不读取真实金库。
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");

function load(file) {
  const filename = path.join(__dirname, "..", file);
  const source = fs.readFileSync(filename, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", "__filename", "__dirname", js)(mod, mod.exports, require, filename, path.dirname(filename));
  return mod.exports;
}

const stat = load("src/lib/statMonth.ts");
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "✓" : "✗"} ${msg}`); if (!ok) fails++; };

console.log("① 月末 / 次月月初归期");
for (const [date, expected] of [
  ["2026-08-31", "2026-08"], ["2026-09-01", "2026-08"], ["2026-09-02", "2026-08"], ["2026-09-03", "2026-08"],
  ["2026-09-04", "2026-09"], ["2026-09-30", "2026-09"], ["2026-10-01", "2026-09"], ["2026-10-03", "2026-09"], ["2026-10-04", "2026-10"],
]) check(stat.statisticalMonthKey(date) === expected, `${date} → ${expected}`);

console.log("② 默认统计点");
check(stat.latestClosedMonthEnd(new Date(2026, 9, 1, 12)) === "2026-09-30", "10 月 1 日默认 9 月 30 日");
check(stat.latestClosedMonthEnd(new Date(2026, 9, 2, 12)) === "2026-09-30", "10 月 2 日默认 9 月 30 日");
check(stat.latestClosedMonthEnd(new Date(2026, 8, 30, 12)) === "2026-09-30", "9 月 30 日当天允许统计 9 月");

console.log("③ 同统计月合并（不删原记录）");
const points = [
  { date: "2026-08-31", v: 100 }, { date: "2026-09-01", v: 101 },
  { date: "2026-09-30", v: 120 }, { date: "2026-10-01", v: 125 },
];
const collapsed = stat.collapseStatisticalMonths(points);
check(collapsed.length === 2, "四条边界记录只形成 8 月、9 月两个统计期");
check(collapsed[0].date === "2026-09-01" && collapsed[1].date === "2026-10-01", "每月采用该统计期最后一次状态");
check(points.length === 4, "原始四条记录全部保留");

console.log("④ 一次性迁移标记");
const ds = { vaultName: "test", userName: "test", accounts: [], snapshots: points.map((p) => ({ date: p.date, balances: {} })) };
const first = stat.migrateStatisticalMonths(ds);
const second = stat.migrateStatisticalMonths(ds);
check(first.changed && first.assigned === 4 && first.collisions === 2, "首次扫描补齐 4 条、识别 2 条同月重叠");
check(!second.changed && second.assigned === 0, "已有版本标记时直接跳过，不再扫描历史");
check(ds.snapshots.every((s) => /^2026-(08|09)$/.test(s.period)), "统计月份已写回每条旧快照");

if (fails) { console.error(`\n✗ ${fails} 项失败`); process.exit(1); }
console.log("\n全部通过 ✓");
