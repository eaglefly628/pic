// 一键导出主账户数据为 Excel（重新排布的清晰格式）。
// 表1「净资产历史」：每行一个日期 + 各账户余额 + 总资产；可被本应用再次导入。
// 表2「账户」：账户清单与当前余额、利率等。
import type { AccountMeta, Dataset } from "../data/types";
import { CAT_TITLE, latestBalances } from "./compute";

export async function exportDatasetToExcel(ds: Dataset): Promise<void> {
  const XLSX = await import("xlsx");
  const accs = ds.accounts;

  // 表1：净资产历史（行=日期，列=账户）
  const header = ["日期", ...accs.map((a) => a.name), "总资产"];
  const rows = ds.snapshots.map((s) => {
    const total = accs.reduce((t, a) => t + (s.balances[a.id] ?? 0), 0);
    return [s.date, ...accs.map((a) => s.balances[a.id] ?? null), total];
  });
  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws1["!cols"] = [{ wch: 12 }, ...accs.map((a) => ({ wch: Math.max(9, Math.min(16, a.name.length + 3)) })), { wch: 14 }];

  // 表2：账户清单
  const lb = latestBalances(ds);
  const ah = ["账户", "分类", "资产类型", "归属", "机构", "年利率(%)", "当前余额"];
  const arows = accs.map((a) => [
    a.name,
    CAT_TITLE[a.cat],
    (a as AccountMeta & { comp?: string }).comp ?? a.type,
    a.owner ?? "",
    a.institution && a.institution !== "—" ? a.institution : "",
    a.rate != null ? +(a.rate * 100).toFixed(4) : 0,
    lb[a.id],
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([ah, ...arows]);
  ws2["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "净资产历史");
  XLSX.utils.book_append_sheet(wb, ws2, "账户");
  XLSX.writeFile(wb, `junbai理财-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
