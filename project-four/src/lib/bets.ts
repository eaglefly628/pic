// 看球：下注盈亏计算 + 赛事数据拉取（数据经本机 run.py 代取 ESPN 公开接口，无需 API key）。
import type { Bet, BetStatus } from "../types";

// ── 盈亏 ────────────────────────────────────────────────
/** 单笔已实现盈亏：赢=本金×(赔率-1)，输=-本金，取消/待结算=0。 */
export function profit(b: Bet): number {
  if (b.status === "won") return b.stake * (b.odds - 1);
  if (b.status === "lost") return -b.stake;
  return 0; // void / pending
}
/** 待结算的潜在盈亏（仅 pending 有意义）。 */
export function potential(b: Bet): number {
  return b.stake * (b.odds - 1);
}

export interface BetSummary {
  count: number;
  settled: number;       // 已结算笔数（won+lost）
  pending: number;       // 待结算笔数
  totalStaked: number;   // 总投入（所有本金）
  atRisk: number;        // 在押（pending 本金）
  won: number;           // 赢到手的盈利（正数之和）
  lost: number;          // 亏掉的（正数表示，便于显示）
  net: number;           // 净盈亏 = 赢 - 亏
  roi: number;           // 回报率 = 净盈亏 / 已结算本金
}

export function summarize(bets: Bet[]): BetSummary {
  let totalStaked = 0, atRisk = 0, won = 0, lost = 0, settledStake = 0, settled = 0, pending = 0;
  for (const b of bets) {
    totalStaked += b.stake;
    if (b.status === "pending") { atRisk += b.stake; pending++; }
    if (b.status === "won") { won += profit(b); settledStake += b.stake; settled++; }
    if (b.status === "lost") { lost += b.stake; settledStake += b.stake; settled++; }
  }
  const net = won - lost;
  return { count: bets.length, settled, pending, totalStaked, atRisk, won, lost, net, roi: settledStake > 0 ? net / settledStake : 0 };
}

export const STATUS_LABEL: Record<BetStatus, string> = { pending: "待结算", won: "赢", lost: "输", void: "取消" };

// ── 赛事数据 ──────────────────────────────────────────────
export interface SideT { name?: string; short?: string; abbr?: string; logo?: string; score?: string; winner?: boolean }
export interface MatchT {
  id?: string; date?: string; name?: string;
  state?: "pre" | "in" | "post"; completed?: boolean; detail?: string; note?: string; odds?: string;
  home?: SideT | null; away?: SideT | null;
}
export interface SportsResp { ok: boolean; league?: string; leagueName?: string; events?: MatchT[]; asOf?: number; error?: string }

export async function fetchSports(league: string, dates?: string): Promise<SportsResp> {
  const url = "/api/sports?league=" + encodeURIComponent(league) + (dates ? "&dates=" + encodeURIComponent(dates) : "");
  try {
    const r = await fetch(url);
    return await r.json();
  } catch {
    return { ok: false, error: "连不上本机服务——看球数据由 run.py（http://localhost:5180）代取，需从那里进入并联网。" };
  }
}

// ── 日期 ────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
export const ymdDash = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function addDays(d: Date, n: number): Date { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
/** ISO 时间 → 本地「6/29 21:00」 */
export function fmtKick(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
