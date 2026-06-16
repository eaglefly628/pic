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

// ----- 账户元信息映射（账户名 -> 分类等）。默认留空，不内置任何真实账户名；
// 未匹配的账户会用下方默认值，导入后可在应用内编辑。可按需自行补充。
// cat: liquid 流动资金 / invest 投资理财 / estate 不动产 / fixed 其他固定资产 / debt 负债
const ACCOUNT_META = {};

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
