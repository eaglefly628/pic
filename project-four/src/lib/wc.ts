// 世界杯淘汰赛：大小球 / 波胆 的统计与泊松模型（纯逻辑）。
// 数据默认用 2026 世界杯 32 强淘汰赛（R32）真实 90 分钟比分——大小球、波胆都按常规时间结算。
import type { KnockoutMatch, WcModel } from "../types";

let _i = 0;
const kid = () => "k_" + (_i++).toString(36) + "_" + Math.round(performance.now?.() ?? 0).toString(36);

/** 2026 世界杯 32 强淘汰赛（R32）全部 16 场 · 90 分钟比分（来源：ESPN / 各体育媒体公开战报）。 */
export const R32_2026: KnockoutMatch[] = [
  { id: "wc_ca_za", round: "R32", date: "2026-06-28", home: "加拿大", away: "南非", hg: 1, ag: 0 },
  { id: "wc_br_jp", round: "R32", date: "2026-06-29", home: "巴西", away: "日本", hg: 2, ag: 1 },
  { id: "wc_de_py", round: "R32", date: "2026-06-29", home: "德国", away: "巴拉圭", hg: 1, ag: 1, pens: true, note: "点球 4-3，巴拉圭晋级" },
  { id: "wc_nl_ma", round: "R32", date: "2026-06-29", home: "荷兰", away: "摩洛哥", hg: 1, ag: 1, pens: true, note: "点球 3-2，摩洛哥晋级" },
  { id: "wc_no_ci", round: "R32", date: "2026-06-30", home: "挪威", away: "科特迪瓦", hg: 2, ag: 1 },
  { id: "wc_fr_se", round: "R32", date: "2026-06-30", home: "法国", away: "瑞典", hg: 3, ag: 0 },
  { id: "wc_mx_ec", round: "R32", date: "2026-06-30", home: "墨西哥", away: "厄瓜多尔", hg: 2, ag: 0 },
  { id: "wc_en_cd", round: "R32", date: "2026-07-01", home: "英格兰", away: "刚果(金)", hg: 2, ag: 1 },
  { id: "wc_be_sn", round: "R32", date: "2026-07-01", home: "比利时", away: "塞内加尔", hg: 1, ag: 1, aet: true, note: "加时 3-2，比利时晋级" },
  { id: "wc_us_ba", round: "R32", date: "2026-07-01", home: "美国", away: "波黑", hg: 2, ag: 0 },
  { id: "wc_es_at", round: "R32", date: "2026-07-02", home: "西班牙", away: "奥地利", hg: 3, ag: 0 },
  { id: "wc_pt_hr", round: "R32", date: "2026-07-02", home: "葡萄牙", away: "克罗地亚", hg: 2, ag: 1 },
  { id: "wc_ch_dz", round: "R32", date: "2026-07-02", home: "瑞士", away: "阿尔及利亚", hg: 2, ag: 0 },
  { id: "wc_eg_au", round: "R32", date: "2026-07-03", home: "埃及", away: "澳大利亚", hg: 1, ag: 1, pens: true, note: "点球 4-2，埃及晋级" },
  { id: "wc_co_gh", round: "R32", date: "2026-07-03", home: "哥伦比亚", away: "加纳", hg: 1, ag: 0 },
  { id: "wc_ar_cv", round: "R32", date: "2026-07-03", home: "阿根廷", away: "佛得角", hg: 1, ag: 1, aet: true, note: "加时 3-2，阿根廷晋级（梅西世界杯第20球）" },
];

export const DEFAULT_PRIOR_LAMBDA = 2.35; // 近几届淘汰赛 90 分钟场均总进球（低于小组赛，约 2.2~2.4）
export const DEFAULT_PRIOR_WEIGHT = 20;   // 先验等效场次（锚定强度，可调）

/** 历届世界杯淘汰赛概况（32 队时代，每届 16 场，按 ~90′）。
 *  ⚠️ 这些是整理/估计值(公开赛果，含少量加时口径差)，仅作先验；请自行核对、可在界面里改。
 *  2026 为本届 R32 真实数据(est:false)，其余为估计(est:true)。 */
export interface HistYear { year: number; label: string; matches: number; goals: number; under: number; est: boolean }
export const WC_KNOCKOUT_HISTORY: HistYear[] = [
  { year: 1998, label: "1998 法国", matches: 16, goals: 36, under: 9, est: true },
  { year: 2002, label: "2002 韩日", matches: 16, goals: 34, under: 10, est: true },
  { year: 2006, label: "2006 德国", matches: 16, goals: 30, under: 12, est: true },
  { year: 2010, label: "2010 南非", matches: 16, goals: 32, under: 11, est: true },
  { year: 2014, label: "2014 巴西", matches: 16, goals: 39, under: 8, est: true },
  { year: 2018, label: "2018 俄罗斯", matches: 16, goals: 42, under: 7, est: true },
  { year: 2022, label: "2022 卡塔尔", matches: 16, goals: 44, under: 6, est: true },
  { year: 2026, label: "2026 本届 R32", matches: 16, goals: 36, under: 10, est: false },
];
export const histAvg = (h: HistYear) => (h.matches ? h.goals / h.matches : 0);
export const histUnderRate = (h: HistYear) => (h.matches ? h.under / h.matches : 0);

/** 汇总选中的若干届 → 池化先验 λ 与小球率。 */
export function pooledPrior(rows: HistYear[], years: number[]) {
  const sel = rows.filter((r) => years.includes(r.year));
  const matches = sel.reduce((a, r) => a + r.matches, 0);
  const goals = sel.reduce((a, r) => a + r.goals, 0);
  const under = sel.reduce((a, r) => a + r.under, 0);
  return { lambda: matches ? goals / matches : DEFAULT_PRIOR_LAMBDA, underRate: matches ? under / matches : 0.6, matches, goals, under, count: sel.length };
}
export const DEFAULT_PRIOR_YEARS = [2010, 2014, 2018, 2022]; // 默认用近四届当先验

export const total = (m: KnockoutMatch) => m.hg + m.ag;
export const scoreKey = (m: KnockoutMatch) => { const [h, l] = m.hg >= m.ag ? [m.hg, m.ag] : [m.ag, m.hg]; return `${h}-${l}`; }; // 无序比分（大-小）
export const newMatch = (round = "R16"): KnockoutMatch => ({ id: kid(), round, home: "", away: "", hg: 0, ag: 0 });

export function matchesOf(wc?: WcModel): KnockoutMatch[] {
  return wc?.matches && wc.matches.length ? wc.matches : R32_2026;
}

export interface KStats {
  n: number; goals: number; avg: number;
  over15: number; over25: number; over35: number;   // 场次
  under25: number; btts: number;
  o15r: number; o25r: number; o35r: number; u25r: number; bttsr: number; // 比率
  scores: { key: string; count: number; pct: number }[];   // 无序比分频率（降序）
  dist: number[];    // 总进球分布计数 index=进球数
  sumH: number; sumA: number;
}

export function summarize(ms: KnockoutMatch[]): KStats {
  const n = ms.length || 0;
  let goals = 0, o15 = 0, o25 = 0, o35 = 0, btts = 0, sumH = 0, sumA = 0;
  const dist: number[] = [];
  const scoreMap = new Map<string, number>();
  for (const m of ms) {
    const t = total(m); goals += t; sumH += m.hg; sumA += m.ag;
    dist[t] = (dist[t] || 0) + 1;
    if (t >= 2) o15++;
    if (t >= 3) o25++;
    if (t >= 4) o35++;
    if (m.hg > 0 && m.ag > 0) btts++;
    const k = scoreKey(m); scoreMap.set(k, (scoreMap.get(k) || 0) + 1);
  }
  for (let i = 0; i < dist.length; i++) if (dist[i] == null) dist[i] = 0;
  const scores = [...scoreMap.entries()].map(([key, count]) => ({ key, count, pct: n ? count / n : 0 })).sort((a, b) => b.count - a.count);
  const under25 = n - o25;
  return {
    n, goals, avg: n ? goals / n : 0,
    over15: o15, over25: o25, over35: o35, under25, btts,
    o15r: n ? o15 / n : 0, o25r: n ? o25 / n : 0, o35r: n ? o35 / n : 0, u25r: n ? under25 / n : 0, bttsr: n ? btts / n : 0,
    scores, dist, sumH, sumA,
  };
}

// ── 泊松 ────────────────────────────────────────────────
const fact = (k: number) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };
export const pois = (k: number, lam: number) => (Math.exp(-lam) * Math.pow(lam, k)) / fact(k);
/** 总进球分布 P(总进球=k)，k=0..max。 */
export function poisPmf(lam: number, max = 7): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let k = 0; k < max; k++) { out[k] = pois(k, lam); acc += out[k]; }
  out[max] = Math.max(0, 1 - acc); // 尾部并入
  return out;
}
export const overProb = (lam: number, line: number) => {
  // P(总进球 > line)，line 为 .5 盘（1.5/2.5/3.5）
  const thr = Math.floor(line); // 例如 2.5 → 需要 ≥3，即 1 - P(0..2)
  let under = 0;
  for (let k = 0; k <= thr; k++) under += pois(k, lam);
  return 1 - under;
};

export interface WcModelOut {
  lambda: number;      // 贝叶斯后验：场均总进球（未微调）
  lambdaAdj: number;   // 叠加“均值回归微调”后的期望
  recentAvg: number;   // 最近若干场的场均
  pmf: number[];       // 预测总进球分布（用 lambdaAdj）
  pUnder25: number; pOver25: number; pUnder15: number; pUnder35: number;
  lamH: number; lamA: number;   // 拆到两队的期望（按历史主客进球占比）
  grid: { h: number; a: number; p: number }[]; // 比分概率网格
  topScores: { key: string; label: string; p: number; low: boolean }[]; // 按概率排序的比分（无序合并）
}

/** 贝叶斯把历史先验和已观测淘汰赛融合，再按用户的均值回归微调，输出大小球 / 波胆的概率。 */
export function model(ms: KnockoutMatch[], wc: WcModel | undefined, recentK = 6): WcModelOut {
  const s = summarize(ms);
  const pl = wc?.priorLambda ?? DEFAULT_PRIOR_LAMBDA;
  const pw = wc?.priorWeight ?? DEFAULT_PRIOR_WEIGHT;
  const tilt = Math.max(0, Math.min(1, wc?.tilt ?? 0));
  // 后验期望（收缩到先验，避免样本少时过拟合）
  const lambda = (pl * pw + s.goals) / (pw + s.n || 1);
  // 均值回归微调：最近偏热 → 调低期望；偏冷 → 调高（用户思路；数学上这是对“均值回归”的手动倾斜，独立比赛并不真的负相关）
  const recent = ms.slice(-recentK);
  const recentAvg = recent.length ? recent.reduce((a, m) => a + total(m), 0) / recent.length : lambda;
  const lambdaAdj = Math.max(0.2, lambda - tilt * (recentAvg - lambda));
  // 拆两队（按历史主客进球占比，缺省对半）
  const shH = s.sumH + s.sumA > 0 ? s.sumH / (s.sumH + s.sumA) : 0.5;
  const lamH = lambdaAdj * shH, lamA = lambdaAdj * (1 - shH);
  const grid: { h: number; a: number; p: number }[] = [];
  for (let h = 0; h <= 5; h++) for (let a = 0; a <= 5; a++) grid.push({ h, a, p: pois(h, lamH) * pois(a, lamA) });
  // 合并成无序比分，取概率最高的若干
  const merged = new Map<string, number>();
  for (const g of grid) { const [hi, lo] = g.h >= g.a ? [g.h, g.a] : [g.a, g.h]; const k = `${hi}-${lo}`; merged.set(k, (merged.get(k) || 0) + g.p); }
  const topScores = [...merged.entries()].map(([key, p]) => { const [hi, lo] = key.split("-").map(Number); return { key, label: key, p, low: hi + lo <= 2 }; })
    .sort((a, b) => b.p - a.p).slice(0, 10);
  return {
    lambda, lambdaAdj, recentAvg,
    pmf: poisPmf(lambdaAdj),
    pUnder25: 1 - overProb(lambdaAdj, 2.5), pOver25: overProb(lambdaAdj, 2.5),
    pUnder15: 1 - overProb(lambdaAdj, 1.5), pUnder35: 1 - overProb(lambdaAdj, 3.5),
    lamH, lamA, grid, topScores,
  };
}

// ── 后续赛程（2026 R16，来源：beIN/Olympics/FOX 等公开赛程；第 8 场由对阵表推得）──
export interface Fixture { id: string; round: string; date: string; home: string; away: string }
export const R16_FIXTURES: Fixture[] = [
  { id: "f_ca_ma", round: "R16", date: "2026-07-04", home: "加拿大", away: "摩洛哥" },
  { id: "f_py_fr", round: "R16", date: "2026-07-04", home: "巴拉圭", away: "法国" },
  { id: "f_br_no", round: "R16", date: "2026-07-05", home: "巴西", away: "挪威" },
  { id: "f_mx_en", round: "R16", date: "2026-07-05", home: "墨西哥", away: "英格兰" },
  { id: "f_pt_es", round: "R16", date: "2026-07-06", home: "葡萄牙", away: "西班牙" },
  { id: "f_us_be", round: "R16", date: "2026-07-06", home: "美国", away: "比利时" },
  { id: "f_ar_eg", round: "R16", date: "2026-07-07", home: "阿根廷", away: "埃及" },
  { id: "f_ch_co", round: "R16", date: "2026-07-07", home: "瑞士", away: "哥伦比亚" },
];

/** 各队在已录淘汰赛里的攻防（进球/失球每场），用于给每场比赛做轻度队伍微调。 */
export function teamStrengths(ms: KnockoutMatch[]) {
  const m = new Map<string, { gf: number; ga: number; n: number }>();
  const bump = (t: string, gf: number, ga: number) => { const e = m.get(t) ?? { gf: 0, ga: 0, n: 0 }; e.gf += gf; e.ga += ga; e.n++; m.set(t, e); };
  for (const x of ms) { bump(x.home, x.hg, x.ag); bump(x.away, x.ag, x.hg); }
  return m;
}
/** 单场期望总进球：以模型 λ 为基准，按两队攻防做轻度微调（样本少→大幅收缩到基准）。 */
export function matchLambda(base: number, home: string, away: string, str: ReturnType<typeof teamStrengths>, w = 0.35) {
  const avg = base / 2 || 1;
  const A = str.get(home), B = str.get(away);
  const aAtt = A && A.n ? A.gf / A.n : avg, aDef = A && A.n ? A.ga / A.n : avg;
  const bAtt = B && B.n ? B.gf / B.n : avg, bDef = B && B.n ? B.ga / B.n : avg;
  const raw = (aAtt * bDef / avg) + (bAtt * aDef / avg);   // 攻×对方防 / 平均
  return Math.max(0.4, Math.min(6, base * (1 - w) + raw * w));
}

/** 最小二乘线性回归：给 (x,y) 点，返回斜率/截距/R² 与预测函数。 */
export function linreg(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: pts[0]?.y ?? 0, r2: 0, predict: (_x: number) => pts[0]?.y ?? 0 };
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept, r2, predict: (x: number) => slope * x + intercept };
}

// ── EV 优选（正期望 + 均分/凯利） ──────────────────────────────
export interface EvRow { key: string; p: number; odds: number; fair: number; edge: number; kelly: number }
export function evRows(topScores: WcModelOut["topScores"], odds: Record<string, number>): EvRow[] {
  return topScores.map((t) => {
    const o = odds[t.key] ?? 0;
    const fair = t.p > 0 ? 1 / t.p : Infinity;
    const edge = o > 0 ? t.p * o - 1 : 0;                 // 期望边际：>0 才有价值
    const kelly = o > 1 && edge > 0 ? edge / (o - 1) : 0; // 单注凯利分数（近似）
    return { key: t.key, p: t.p, odds: o, fair, edge, kelly };
  });
}
/** 自动挑正期望比分，按 均分 / 凯利(近似) 分配筹码，算命中率与期望盈亏。 */
export function optimize(rows: EvRow[], stakeTotal: number, mode: "even" | "kelly", kellyScale = 0.5) {
  const sel = rows.filter((r) => r.edge > 0 && r.odds > 0);
  const stakes: Record<string, number> = {};
  if (mode === "kelly") {
    const tot = sel.reduce((a, r) => a + r.kelly, 0);
    for (const r of sel) stakes[r.key] = tot > 0 ? stakeTotal * kellyScale * (r.kelly / tot) + (stakeTotal * (1 - kellyScale)) / (sel.length || 1) : 0;
  } else {
    for (const r of sel) stakes[r.key] = sel.length ? stakeTotal / sel.length : 0;
  }
  const spent = Object.values(stakes).reduce((a, s) => a + s, 0);
  const hitProb = sel.reduce((a, r) => a + r.p, 0);
  const ev = sel.reduce((a, r) => a + r.p * (stakes[r.key] * r.odds), 0) - spent;
  return { sel, stakes, hitProb, ev, spent };
}

/** 波胆组合：均分筹码到选中的比分，用手填赔率算命中率与期望盈亏。 */
export function portfolio(picks: string[], stakeTotal: number, odds: Record<string, number>, topScores: WcModelOut["topScores"]) {
  const pMap = new Map(topScores.map((t) => [t.key, t.p]));
  const each = picks.length ? stakeTotal / picks.length : 0;
  const rows = picks.map((k) => {
    const p = pMap.get(k) ?? 0;
    const o = odds[k] ?? 0;
    return { key: k, p, odds: o, stake: each, ret: each * o, evOne: p * (each * o) };
  });
  const hitProb = rows.reduce((a, r) => a + r.p, 0);        // 至少一个命中（比分互斥）
  const ev = rows.reduce((a, r) => a + r.evOne, 0) - stakeTotal; // 期望盈亏
  return { each, rows, hitProb, ev };
}
