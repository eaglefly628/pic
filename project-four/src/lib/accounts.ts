// 账户 · 余额：纯逻辑助手（金额格式化、到期计算、提醒汇总）。
import type { Account, AccountDomain } from "../types";

export const CATEGORIES: Record<AccountDomain, string[]> = {
  work: ["AI 模型", "云服务", "代码托管", "订阅服务", "域名 / 服务器", "数据 / API", "其他"],
  life: ["餐饮", "美发美容", "洗车养车", "健身", "咖啡饮品", "超市会员", "娱乐", "出行", "其他"],
};

export const CURRENCIES = ["¥", "$", "€", "£", "₩", "HK$"];

export function fmtMoney(n: number | undefined | null, cur = "¥"): string {
  if (n == null || isNaN(n)) return "—";
  const v = Math.round(n * 100) / 100;
  return cur + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** 距离某天还有几天：负=已过，0=今天，正=未来。无效返回 null。 */
export function daysUntil(date?: string): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export type Tone = "over" | "today" | "soon" | "warn" | "none";
export const toneColor = (t: Tone): string =>
  t === "over" ? "var(--red)" : t === "today" ? "var(--orange)" : t === "warn" ? "var(--orange)" : t === "soon" ? "var(--accent)" : "var(--text-tertiary)";

/** 把天数转成中文 + 语气色调（用于续费 / 到期）。 */
export function dateTone(days: number | null): { text: string; tone: Tone } {
  if (days == null) return { text: "", tone: "none" };
  if (days < 0) return { text: `已过 ${-days} 天`, tone: "over" };
  if (days === 0) return { text: "就是今天", tone: "today" };
  if (days === 1) return { text: "明天", tone: "soon" };
  if (days <= 7) return { text: `${days} 天后`, tone: "soon" };
  if (days <= 30) return { text: `${days} 天后`, tone: "none" };
  return { text: `${Math.round(days / 30)} 个月后`, tone: "none" };
}

export type AlertKind = "renew" | "expire" | "low" | "stale";
export interface AccountAlert {
  account: Account;
  kind: AlertKind;
  text: string;
  tone: Tone;
  sort: number; // 越小越紧急
}

const STALE_DAYS = 120;

/** 汇总所有需要提醒的账户：续费在即 / 即将到期 / 余额偏低 / 好久没更新。 */
export function accountAlerts(accounts: Account[]): AccountAlert[] {
  const out: AccountAlert[] = [];
  for (const a of accounts) {
    // 订阅续费在即（7 天内或已过）
    if (a.kind === "subscription" && a.renewAt) {
      const days = daysUntil(a.renewAt);
      if (days != null && days <= 7) {
        const t = dateTone(days);
        out.push({ account: a, kind: "renew", text: `续费 ${t.text}`, tone: t.tone, sort: days });
      }
    }
    // 有效期 / 到期日（14 天内或已过）
    if (a.expireAt) {
      const days = daysUntil(a.expireAt);
      if (days != null && days <= 14) {
        const t = dateTone(days);
        out.push({ account: a, kind: "expire", text: days < 0 ? `已过期 ${-days} 天` : `到期 ${t.text}`, tone: t.tone, sort: days - 0.1 });
      }
    }
    // 预付余额偏低
    if (a.kind === "prepaid" && a.balance != null && a.lowBalance != null && a.balance <= a.lowBalance) {
      out.push({ account: a, kind: "low", text: `余额仅剩 ${fmtMoney(a.balance, a.currency)}`, tone: a.balance <= 0 ? "over" : "warn", sort: -100 + a.balance });
    }
    // 余额好久没更新（有余额但 120 天没动）
    if (a.balance != null && a.balanceAt && Date.now() - a.balanceAt > STALE_DAYS * 86400000) {
      const d = Math.round((Date.now() - a.balanceAt) / 86400000);
      out.push({ account: a, kind: "stale", text: `余额 ${d} 天没更新了`, tone: "none", sort: 1000 - d });
    }
  }
  return out.sort((x, y) => x.sort - y.sort);
}

/** 某 domain 下储值总额（按币种分组），用于「外面还躺着多少钱」。 */
export function totalsByCurrency(accounts: Account[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const a of accounts) {
    if (a.balance == null || isNaN(a.balance)) continue;
    m[a.currency] = (m[a.currency] ?? 0) + a.balance;
  }
  return m;
}
