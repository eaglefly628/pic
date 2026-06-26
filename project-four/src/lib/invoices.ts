// 公司 · 发票报销：类别、状态、汇总与提醒（纯逻辑）。
import type { Invoice, ReimburseStatus } from "../types";
import { daysUntil } from "./accounts";

export const INVOICE_CATEGORIES = [
  "差旅交通", "餐饮", "办公用品", "住宿", "通讯", "市场推广", "软件订阅", "快递物流", "招待", "其他",
];

export const INVOICE_EMOJI: Record<string, string> = {
  "差旅交通": "🚄", "餐饮": "🍽️", "办公用品": "🖇️", "住宿": "🏨", "通讯": "📱",
  "市场推广": "📣", "软件订阅": "🔄", "快递物流": "📦", "招待": "🥂", "其他": "🧾",
};

export const STATUS_META: Record<ReimburseStatus, { label: string; color: string }> = {
  pending: { label: "待报销", color: "var(--orange)" },
  submitted: { label: "已报销", color: "var(--accent)" },
  paid: { label: "已到账", color: "var(--green)" },
};
export const STATUS_ORDER: ReimburseStatus[] = ["pending", "submitted", "paid"];

export interface InvoiceSummary {
  pending: Record<string, number>;    // 待报销金额（按币种）
  pendingCount: number;
  submitted: Record<string, number>;  // 已报销待到账
  submittedCount: number;
  month: Record<string, number>;      // 本月开票合计
  monthCount: number;
  paidCount: number;
}

const addTo = (m: Record<string, number>, cur: string, n: number) => { m[cur] = (m[cur] ?? 0) + n; };

export function invoiceSummary(invoices: Invoice[]): InvoiceSummary {
  const s: InvoiceSummary = { pending: {}, pendingCount: 0, submitted: {}, submittedCount: 0, month: {}, monthCount: 0, paidCount: 0 };
  const now = new Date();
  const ym = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  for (const v of invoices) {
    if (v.amount == null || isNaN(v.amount)) continue;
    const cur = v.currency || "¥";
    if (v.status === "pending") { addTo(s.pending, cur, v.amount); s.pendingCount++; }
    else if (v.status === "submitted") { addTo(s.submitted, cur, v.amount); s.submittedCount++; }
    else if (v.status === "paid") { s.paidCount++; }
    if (v.date && v.date.slice(0, 7) === ym) { addTo(s.month, cur, v.amount); s.monthCount++; }
  }
  return s;
}

/** 把按币种分组的金额格式化成一行（依赖调用方传入 fmtMoney）。 */
export function joinMoney(m: Record<string, number>, fmt: (n: number, cur: string) => string): string {
  const keys = Object.keys(m);
  if (keys.length === 0) return fmt(0, "¥");
  return keys.map((c) => fmt(m[c], c)).join("  ·  ");
}

/** 待报销压了太久（默认 14 天以上）。 */
export function stalePending(invoices: Invoice[], thresholdDays = 14): { count: number; oldestDays: number } | null {
  let count = 0, oldest = 0;
  for (const v of invoices) {
    if (v.status !== "pending" || !v.date) continue;
    const d = daysUntil(v.date);
    const age = d == null ? 0 : -d;
    if (age >= thresholdDays) { count++; if (age > oldest) oldest = age; }
  }
  return count > 0 ? { count, oldestDays: oldest } : null;
}
