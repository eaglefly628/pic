// 浏览器端 Excel 解析：把表格的某个工作表（默认 Sheet2，按月快照）转为 Dataset。
// 与 scripts/import-excel.mjs 逻辑一致，供应用内「导入数据」使用。
// xlsx 体积较大，改为按需动态加载，避免拖慢首屏。
import type { Category, Dataset } from "../data/types";

type Meta = { cat: Category; type: string; comp: string; inst: string; owner: string; color: string };

const ACCOUNT_META: Record<string, Meta> = {
  "cc招行": { cat: "liquid", type: "储蓄/活期", comp: "现金及银行", inst: "招商银行", owner: "本人", color: "#FF2D55" },
  "CC华瑞": { cat: "liquid", type: "储蓄/活期", comp: "现金及银行", inst: "华瑞银行", owner: "本人", color: "#FF6482" },
  "bb招行现金": { cat: "liquid", type: "现金/活期", comp: "现金及银行", inst: "招商银行", owner: "配偶", color: "#FF9F0A" },
  "桔子gg": { cat: "invest", type: "理财", comp: "理财/固收", inst: "—", owner: "本人", color: "#30B0C7" },
  "理财通": { cat: "invest", type: "理财", comp: "理财/固收", inst: "微信理财通", owner: "本人", color: "#34C759" },
  "光大工资卡": { cat: "liquid", type: "储蓄/工资", comp: "现金及银行", inst: "光大银行", owner: "本人", color: "#FF453A" },
  "现金外币": { cat: "liquid", type: "现金/外币", comp: "现金及银行", inst: "—", owner: "全家", color: "#8E8E93" },
  "买房": { cat: "estate", type: "房产", comp: "房产", inst: "—", owner: "全家", color: "#007AFF" },
  "装修": { cat: "estate", type: "房产/装修", comp: "房产", inst: "—", owner: "全家", color: "#0A84FF" },
  "CC理财微众": { cat: "invest", type: "理财", comp: "理财/固收", inst: "微众银行", owner: "本人", color: "#5E5CE6" },
  "汇丰": { cat: "liquid", type: "储蓄", comp: "现金及银行", inst: "汇丰银行", owner: "本人", color: "#BF5AF2" },
  "微众bb": { cat: "liquid", type: "储蓄", comp: "现金及银行", inst: "微众银行", owner: "配偶", color: "#FF375F" },
  "cc 中国银行": { cat: "liquid", type: "储蓄/活期", comp: "现金及银行", inst: "中国银行", owner: "本人", color: "#64D2FF" },
  "白白华瑞": { cat: "liquid", type: "储蓄", comp: "现金及银行", inst: "华瑞银行", owner: "本人", color: "#AC8E68" },
  "信用卡": { cat: "debt", type: "负债/信用卡", comp: "负债", inst: "—", owner: "全家", color: "#FF3B30" },
  "港股+美股": { cat: "invest", type: "证券/股票", comp: "股票", inst: "—", owner: "本人", color: "#32D74B" },
  "华通bb": { cat: "invest", type: "证券/理财", comp: "理财/固收", inst: "—", owner: "配偶", color: "#66D4CF" },
  "CC 罗氏股票": { cat: "invest", type: "证券/股票", comp: "股票", inst: "罗氏", owner: "本人", color: "#30D158" },
  "A股bb银河": { cat: "invest", type: "证券/股票", comp: "股票", inst: "银河证券", owner: "配偶", color: "#28CD41" },
  "黄金": { cat: "invest", type: "黄金", comp: "黄金", inst: "—", owner: "全家", color: "#FFD60A" },
};
const FALLBACK: Meta = { cat: "liquid", type: "其他", comp: "其他", inst: "—", owner: "全家", color: "#8E8E93" };

function excelSerialToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}
function parseDateCell(v: unknown): string | null {
  if (typeof v === "number" && isFinite(v) && v > 30000 && v < 60000) return excelSerialToISO(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const m = v.match(/(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v === "string") {
    if (v.includes("#")) return null;
    const n = Number(v.replace(/,/g, "").trim());
    return isFinite(n) ? n : null;
  }
  return null;
}

export interface ParseResult {
  dataset: Dataset;
  accountCount: number;
  snapshotCount: number;
  from?: string;
  to?: string;
}

export async function parseWorkbook(buf: ArrayBuffer, sheetName = "Sheet2"): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { cellDates: false });
  const name = wb.Sheets[sheetName] ? sheetName : wb.SheetNames.find((n) => n.toLowerCase() === sheetName.toLowerCase());
  const ws = name ? wb.Sheets[name] : undefined;
  if (!ws) throw new Error(`未找到工作表「${sheetName}」。可用：${wb.SheetNames.join(", ")}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  const header = (rows[0] || []) as unknown[];
  let totalCol = header.findIndex((h) => typeof h === "string" && h.trim().toLowerCase() === "total asset");
  if (totalCol < 0) totalCol = 21;
  const accCols: { col: number; name: string }[] = [];
  for (let c = 1; c < totalCol; c++) {
    const nm = header[c];
    if (typeof nm === "string" && nm.trim()) accCols.push({ col: c, name: nm.trim() });
  }
  const rateRow = (rows[1] || []) as unknown[];

  const accounts = accCols.map((a, i) => {
    const meta = ACCOUNT_META[a.name] || FALLBACK;
    const rate = num(rateRow[a.col]);
    return {
      id: "acc" + i, name: a.name, cat: meta.cat, type: meta.type, comp: meta.comp,
      institution: meta.inst, owner: meta.owner, color: meta.color,
      ...(rate != null ? { rate } : {}),
      _col: a.col,
    };
  });

  const snapshots: Dataset["snapshots"] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = (rows[r] || []) as unknown[];
    const date = parseDateCell(row[0]);
    if (!date) continue;
    const balances: Record<string, number | null> = {};
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

  const cleanAccounts = accounts.map(({ _col, ...rest }) => { void _col; return rest; });

  const dataset: Dataset = {
    vaultName: "junbai家专用理财软件",
    userName: "eaglefly",
    real: true,
    accounts: cleanAccounts,
    snapshots,
  };
  return {
    dataset,
    accountCount: accounts.length,
    snapshotCount: snapshots.length,
    from: snapshots[0]?.date,
    to: snapshots[snapshots.length - 1]?.date,
  };
}
