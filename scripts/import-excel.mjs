#!/usr/bin/env node
/**
 * Excel 历史数据导入器
 * --------------------------------------------------------------------------
 * 把家庭理财 Excel 的 Sheet2（按月快照）转换成应用使用的 src/data/history.json。
 *
 * 用法：
 *   npm run import:excel -- /path/to/你的表格.xlsx [SheetName]
 *   （默认读取名为 "Sheet2" 的工作表）
 *
 * ⚠️ 生成的 history.json 含真实财务数据，已在 .gitignore 中排除，不会进入仓库。
 *
 * 账户的分组 / 类型 / 颜色为基于账户名的「推测」，可在下方 ACCOUNT_META 中调整。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ----- 账户元信息（按 Excel 表头精确匹配；可自行修改/补充）------------------
// cat: liquid 流动资金 / invest 投资理财 / estate 不动产 / debt 负债
// comp: 资产构成（甜甜圈）分组
const ACCOUNT_META = {
  "cc招行":        { cat: "liquid", type: "储蓄/活期", comp: "现金及银行", inst: "招商银行",   owner: "本人", color: "#FF2D55" },
  "CC华瑞":        { cat: "liquid", type: "储蓄/活期", comp: "现金及银行", inst: "华瑞银行",   owner: "本人", color: "#FF6482" },
  "bb招行现金":    { cat: "liquid", type: "现金/活期", comp: "现金及银行", inst: "招商银行",   owner: "配偶", color: "#FF9F0A" },
  "桔子gg":        { cat: "invest", type: "理财",      comp: "理财/固收", inst: "—",          owner: "本人", color: "#30B0C7" },
  "理财通":        { cat: "invest", type: "理财",      comp: "理财/固收", inst: "微信理财通", owner: "本人", color: "#34C759" },
  "光大工资卡":    { cat: "liquid", type: "储蓄/工资", comp: "现金及银行", inst: "光大银行",   owner: "本人", color: "#FF453A" },
  "现金外币":      { cat: "liquid", type: "现金/外币", comp: "现金及银行", inst: "—",          owner: "全家", color: "#8E8E93" },
  "买房":          { cat: "estate", type: "房产",      comp: "房产",       inst: "—",          owner: "全家", color: "#007AFF" },
  "装修":          { cat: "estate", type: "房产/装修", comp: "房产",       inst: "—",          owner: "全家", color: "#0A84FF" },
  "CC理财微众":    { cat: "invest", type: "理财",      comp: "理财/固收", inst: "微众银行",   owner: "本人", color: "#5E5CE6" },
  "汇丰":          { cat: "liquid", type: "储蓄",      comp: "现金及银行", inst: "汇丰银行",   owner: "本人", color: "#BF5AF2" },
  "微众bb":        { cat: "liquid", type: "储蓄",      comp: "现金及银行", inst: "微众银行",   owner: "配偶", color: "#FF375F" },
  "cc 中国银行":   { cat: "liquid", type: "储蓄/活期", comp: "现金及银行", inst: "中国银行",   owner: "本人", color: "#64D2FF" },
  "白白华瑞":      { cat: "liquid", type: "储蓄",      comp: "现金及银行", inst: "华瑞银行",   owner: "本人", color: "#AC8E68" },
  "信用卡":        { cat: "debt",   type: "负债/信用卡", comp: "负债",     inst: "—",          owner: "全家", color: "#FF3B30" },
  "港股+美股":     { cat: "invest", type: "证券/股票", comp: "股票",       inst: "—",          owner: "本人", color: "#32D74B" },
  "华通bb":        { cat: "invest", type: "证券/理财", comp: "理财/固收", inst: "—",          owner: "配偶", color: "#66D4CF" },
  "CC 罗氏股票":   { cat: "invest", type: "证券/股票", comp: "股票",       inst: "罗氏",       owner: "本人", color: "#30D158" },
  "A股bb银河":     { cat: "invest", type: "证券/股票", comp: "股票",       inst: "银河证券",   owner: "配偶", color: "#28CD41" },
  "黄金":          { cat: "invest", type: "黄金",      comp: "黄金",       inst: "—",          owner: "全家", color: "#FFD60A" },
};

function slug(name, i) {
  return "acc" + i; // 稳定、可读、避免中文 id 带来的兼容问题
}

function excelSerialToISO(serial) {
  // Excel 日期纪元为 1899-12-30（含闰年 bug 修正）
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function parseDateCell(v) {
  if (typeof v === "number" && isFinite(v) && v > 30000 && v < 60000) {
    return excelSerialToISO(v);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const m = v.match(/(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
    if (m) {
      const [, y, mo, da] = m;
      return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
    }
  }
  return null;
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v === "string") {
    if (v.includes("#REF") || v.includes("#")) return null;
    const n = Number(v.replace(/,/g, "").trim());
    return isFinite(n) ? n : null;
  }
  return null;
}

function main() {
  const file = process.argv[2];
  const sheetName = process.argv[3] || "Sheet2";
  if (!file) {
    console.error("用法: npm run import:excel -- <文件.xlsx> [工作表名=Sheet2]");
    process.exit(1);
  }
  const wb = XLSX.read(readFileSync(resolve(file)), { cellDates: false });
  const ws = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase() === sheetName.toLowerCase())];
  if (!ws) {
    console.error(`未找到工作表「${sheetName}」。可用：`, wb.SheetNames.join(", "));
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  // 表头：第 1 行；账户列 = 从第 2 列起到 "total asset" 之前
  const header = rows[0] || [];
  let totalCol = header.findIndex((h) => typeof h === "string" && h.trim().toLowerCase() === "total asset");
  if (totalCol < 0) totalCol = 21;
  const accCols = [];
  for (let c = 1; c < totalCol; c++) {
    const name = header[c];
    if (typeof name === "string" && name.trim()) accCols.push({ col: c, name: name.trim() });
  }

  // 第 2 行：年化利率（可选）
  const rateRow = rows[1] || [];

  const accounts = accCols.map((a, i) => {
    const meta = ACCOUNT_META[a.name] || { cat: "liquid", type: "其他", comp: "其他", inst: "—", owner: "全家", color: "#8E8E93" };
    const rate = num(rateRow[a.col]);
    return {
      id: slug(a.name, i),
      name: a.name,
      cat: meta.cat,
      type: meta.type,
      comp: meta.comp,
      institution: meta.inst,
      owner: meta.owner,
      color: meta.color,
      ...(rate != null ? { rate } : {}),
      _col: a.col,
    };
  });

  // 数据行
  const snapshots = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const date = parseDateCell(row[0]);
    if (!date) continue; // 跳过空行 / 注释行（如「房款」「利息可能」「houseKey」）
    const balances = {};
    let any = false;
    for (const a of accounts) {
      const v = num(row[a._col]);
      balances[a.id] = v;
      if (v != null) any = true;
    }
    if (!any) continue;
    snapshots.push({ date, balances, source: "import" });
  }
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  // 去掉内部字段 _col
  const cleanAccounts = accounts.map(({ _col, comp, ...rest }) => ({ ...rest, comp }));

  const dataset = {
    vaultName: "junbai家专用理财软件",
    userName: "eaglefly",
    real: true,
    accounts: cleanAccounts,
    snapshots,
  };

  const outDir = resolve(ROOT, "src/data");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, "history.json");
  writeFileSync(outFile, JSON.stringify(dataset, null, 2), "utf-8");

  // 摘要
  const last = snapshots[snapshots.length - 1];
  const lastTotal = last ? accounts.reduce((s, a) => s + (last.balances[a.id] || 0), 0) : 0;
  console.log("✅ 导入完成 →", outFile);
  console.log(`   账户数: ${accounts.length}`);
  console.log(`   快照数: ${snapshots.length}`);
  console.log(`   时间范围: ${snapshots[0]?.date} ~ ${last?.date}`);
  console.log(`   最新净值（按列求和）: ¥${lastTotal.toLocaleString("zh-CN")}`);
}

main();
