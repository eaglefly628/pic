// 一键导出主账户数据为 Excel（重新排布的清晰格式）。
// 表1「净资产历史」：每行一个日期 + 各账户余额 + 总资产；可被本应用再次导入。
// 表2「账户」：账户清单与当前余额、利率等。
import type { AccountMeta, Dataset } from "../data/types";
import { CAT_TITLE, latestBalances } from "./compute";

export async function exportDatasetToExcel(ds: Dataset, months = 12): Promise<void> {
  const XLSX = await import("xlsx");
  const accs = ds.accounts;

  // 表1：净资产历史（行=日期，列=账户）—— 只取最近 months 个月（months<=0 = 全部）
  const cutoff = monthsCutoff(ds.snapshots, months);
  const snaps = cutoff ? ds.snapshots.filter((s) => s.date >= cutoff) : ds.snapshots;
  const header = ["日期", ...accs.map((a) => a.name), "总资产"];
  const rows = snaps.map((s) => {
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

  // SheetJS 社区版不写冻结窗格 → 生成后给每个工作表注入「冻结首行」再下载
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const out = await freezeFirstRow(buf);
  const blob = new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `junbai理财-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** 最近 months 个月的起始日（YYYY-MM-01）；months<=0 返回空串表示「全部」。 */
function monthsCutoff(snaps: Dataset["snapshots"], months: number): string {
  if (months <= 0 || snaps.length === 0) return "";
  const [y, m] = snaps[snaps.length - 1].date.split("-").map(Number);
  let yy = y, mm = m - (months - 1);
  while (mm <= 0) { mm += 12; yy -= 1; }
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
}

/** 在生成好的 xlsx 里，给每个工作表的首行加冻结窗格（表头滚动时固定）。 */
async function freezeFirstRow(buf: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try {
    const { unzipSync, zipSync, strToU8, strFromU8 } = await import("fflate");
    const files = unzipSync(u8);
    const pane = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';
    for (const path of Object.keys(files)) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) continue;
      let xml = strFromU8(files[path]);
      if (/<sheetView\b[^>]*\/>/.test(xml)) xml = xml.replace(/<sheetView\b([^>]*?)\/>/, (_m, a) => `<sheetView${a}>${pane}</sheetView>`);
      else xml = xml.replace(/<sheetView\b([^>]*?)>(?![\s\S]*?<pane)/, (_m, a) => `<sheetView${a}>${pane}`);
      files[path] = strToU8(xml);
    }
    return zipSync(files);
  } catch {
    return u8; // 出错则回退为不冻结的原文件，至少能正常导出
  }
}
