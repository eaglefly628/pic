// 公司 · 发票：类别归类 + 按月归档（纯逻辑，不做记账）。
import type { Invoice } from "../types";

export const INVOICE_CATEGORIES = [
  "差旅交通", "餐饮", "办公用品", "住宿", "通讯", "市场推广", "软件订阅", "快递物流", "招待", "其他",
];

export const INVOICE_EMOJI: Record<string, string> = {
  "差旅交通": "🚄", "餐饮": "🍽️", "办公用品": "🖇️", "住宿": "🏨", "通讯": "📱",
  "市场推广": "📣", "软件订阅": "🔄", "快递物流": "📦", "招待": "🥂", "其他": "🧾",
};

/** 取 YYYY-MM。 */
export const monthOf = (date?: string): string => (date || "").slice(0, 7);

/** YYYY-MM → 中文「2026年6月」。 */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return y && m ? `${y}年${+m}月` : ym;
}

export interface MonthGroup { ym: string; label: string; items: Invoice[]; }

/** 按月份分组（新月在前，组内新日期在前），用于「月底拿出来」。 */
export function groupByMonth(invoices: Invoice[]): MonthGroup[] {
  const map = new Map<string, Invoice[]>();
  for (const v of invoices) {
    const k = monthOf(v.date) || "未注明";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(v);
  }
  return [...map.keys()].sort().reverse().map((k) => ({
    ym: k,
    label: k === "未注明" ? "未注明日期" : monthLabel(k),
    items: map.get(k)!.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt),
  }));
}
