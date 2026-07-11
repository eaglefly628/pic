// 世界杯淘汰赛：大小球 / 波胆 的统计与泊松模型（纯逻辑）。
// 数据默认用 2026 世界杯 32 强淘汰赛（R32）真实 90 分钟比分——大小球、波胆都按常规时间结算。
import type { KnockoutMatch, WcModel, MatchOdds } from "../types";

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

/** 2026 世界杯 16 强（1/8 决赛）已完赛的 90′ 真实比分（随比赛进行补充）。 */
export const R16_2026: KnockoutMatch[] = [
  { id: "wc26_ca_ma", round: "R16", date: "2026-07-04", home: "加拿大", away: "摩洛哥", hg: 0, ag: 3 },
  { id: "wc26_py_fr", round: "R16", date: "2026-07-04", home: "巴拉圭", away: "法国", hg: 0, ag: 1 },
  { id: "wc26_br_no", round: "R16", date: "2026-07-05", home: "巴西", away: "挪威", hg: 1, ag: 2, note: "哈兰德2球" },
  { id: "wc26_mx_en", round: "R16", date: "2026-07-05", home: "墨西哥", away: "英格兰", hg: 1, ag: 2, note: "贝林厄姆2球" },
  { id: "wc26_pt_es", round: "R16", date: "2026-07-06", home: "葡萄牙", away: "西班牙", hg: 0, ag: 1, note: "梅里诺补时绝杀·C罗告别" },
  { id: "wc26_us_be", round: "R16", date: "2026-07-06", home: "美国", away: "比利时", hg: 1, ag: 4, note: "德凯特拉雷2球·卢卡库·东道主出局" },
  { id: "wc26_ar_eg", round: "R16", date: "2026-07-07", home: "阿根廷", away: "埃及", hg: 3, ag: 2, note: "0-2落后梅西领衔逆转·90+2绝杀" },
  { id: "wc26_ch_co", round: "R16", date: "2026-07-07", home: "瑞士", away: "哥伦比亚", hg: 0, ag: 0, pens: true, note: "120分钟0-0·点球4-3晋级" },
];
/** 2026 世界杯 1/4 决赛（8 强）已完赛的 90′ 真实比分（随比赛进行补充）。 */
export const QF_2026: KnockoutMatch[] = [
  { id: "wc26_fr_ma", round: "QF", date: "2026-07-09", home: "法国", away: "摩洛哥", hg: 2, ag: 0, note: "姆巴佩+登贝莱" },
  { id: "wc26_es_be", round: "QF", date: "2026-07-10", home: "西班牙", away: "比利时", hg: 2, ag: 1, note: "梅里诺绝杀·连场救主" },
];
/** 本届淘汰赛已知的全部真实比分（R32 + 已完赛的 16 强 + 8 强…），作为默认数据。 */
export const SEED_2026: KnockoutMatch[] = [...R32_2026, ...R16_2026, ...QF_2026];

export const DEFAULT_PRIOR_LAMBDA = 2.35; // 近几届淘汰赛 90 分钟场均总进球（低于小组赛，约 2.2~2.4）
export const DEFAULT_PRIOR_WEIGHT = 20;   // 先验等效场次（锚定强度，可调）

export interface HistYear { year: number; label: string; matches: number; goals: number; under: number; est: boolean }

/** 历届世界杯淘汰赛「全部逐场」（32 队时代，每届 16 场：R16+QF+SF+3P季军+F），按 90′ 常规时间。
 *  整理自公开赛果——进加时/点球的场次记「90 分钟比分」(大小球/波胆就是这么结算)。
 *  很多场 90′ 是 0-0/1-1 才拖进加时，所以 90′ 口径比“最终比分”偏小球。可核对/修改。 */
export interface HistMatch { y: number; r: string; h: string; a: string; hg: number; ag: number }
export const KNOCKOUT_MATCHES: HistMatch[] = [
  // ── 2022 卡塔尔 ──
  { y: 2022, r: "R16", h: "荷兰", a: "美国", hg: 3, ag: 1 }, { y: 2022, r: "R16", h: "阿根廷", a: "澳大利亚", hg: 2, ag: 1 }, { y: 2022, r: "R16", h: "法国", a: "波兰", hg: 3, ag: 1 }, { y: 2022, r: "R16", h: "英格兰", a: "塞内加尔", hg: 3, ag: 0 },
  { y: 2022, r: "R16", h: "日本", a: "克罗地亚", hg: 1, ag: 1 }, { y: 2022, r: "R16", h: "巴西", a: "韩国", hg: 4, ag: 1 }, { y: 2022, r: "R16", h: "摩洛哥", a: "西班牙", hg: 0, ag: 0 }, { y: 2022, r: "R16", h: "葡萄牙", a: "瑞士", hg: 6, ag: 1 },
  { y: 2022, r: "QF", h: "克罗地亚", a: "巴西", hg: 1, ag: 1 }, { y: 2022, r: "QF", h: "荷兰", a: "阿根廷", hg: 2, ag: 2 }, { y: 2022, r: "QF", h: "摩洛哥", a: "葡萄牙", hg: 1, ag: 0 }, { y: 2022, r: "QF", h: "英格兰", a: "法国", hg: 1, ag: 2 },
  { y: 2022, r: "SF", h: "阿根廷", a: "克罗地亚", hg: 3, ag: 0 }, { y: 2022, r: "SF", h: "法国", a: "摩洛哥", hg: 2, ag: 0 }, { y: 2022, r: "3P", h: "克罗地亚", a: "摩洛哥", hg: 2, ag: 1 }, { y: 2022, r: "F", h: "阿根廷", a: "法国", hg: 2, ag: 2 },
  // ── 2018 俄罗斯 ──
  { y: 2018, r: "R16", h: "法国", a: "阿根廷", hg: 4, ag: 3 }, { y: 2018, r: "R16", h: "乌拉圭", a: "葡萄牙", hg: 2, ag: 1 }, { y: 2018, r: "R16", h: "西班牙", a: "俄罗斯", hg: 1, ag: 1 }, { y: 2018, r: "R16", h: "克罗地亚", a: "丹麦", hg: 1, ag: 1 },
  { y: 2018, r: "R16", h: "巴西", a: "墨西哥", hg: 2, ag: 0 }, { y: 2018, r: "R16", h: "比利时", a: "日本", hg: 3, ag: 2 }, { y: 2018, r: "R16", h: "瑞典", a: "瑞士", hg: 1, ag: 0 }, { y: 2018, r: "R16", h: "哥伦比亚", a: "英格兰", hg: 1, ag: 1 },
  { y: 2018, r: "QF", h: "乌拉圭", a: "法国", hg: 0, ag: 2 }, { y: 2018, r: "QF", h: "巴西", a: "比利时", hg: 1, ag: 2 }, { y: 2018, r: "QF", h: "瑞典", a: "英格兰", hg: 0, ag: 2 }, { y: 2018, r: "QF", h: "俄罗斯", a: "克罗地亚", hg: 1, ag: 1 },
  { y: 2018, r: "SF", h: "法国", a: "比利时", hg: 1, ag: 0 }, { y: 2018, r: "SF", h: "克罗地亚", a: "英格兰", hg: 1, ag: 1 }, { y: 2018, r: "3P", h: "比利时", a: "英格兰", hg: 2, ag: 0 }, { y: 2018, r: "F", h: "法国", a: "克罗地亚", hg: 4, ag: 2 },
  // ── 2014 巴西 ──
  { y: 2014, r: "R16", h: "巴西", a: "智利", hg: 1, ag: 1 }, { y: 2014, r: "R16", h: "哥伦比亚", a: "乌拉圭", hg: 2, ag: 0 }, { y: 2014, r: "R16", h: "荷兰", a: "墨西哥", hg: 2, ag: 1 }, { y: 2014, r: "R16", h: "哥斯达黎加", a: "希腊", hg: 1, ag: 1 },
  { y: 2014, r: "R16", h: "法国", a: "尼日利亚", hg: 2, ag: 0 }, { y: 2014, r: "R16", h: "德国", a: "阿尔及利亚", hg: 0, ag: 0 }, { y: 2014, r: "R16", h: "阿根廷", a: "瑞士", hg: 0, ag: 0 }, { y: 2014, r: "R16", h: "比利时", a: "美国", hg: 0, ag: 0 },
  { y: 2014, r: "QF", h: "法国", a: "德国", hg: 0, ag: 1 }, { y: 2014, r: "QF", h: "巴西", a: "哥伦比亚", hg: 2, ag: 1 }, { y: 2014, r: "QF", h: "阿根廷", a: "比利时", hg: 1, ag: 0 }, { y: 2014, r: "QF", h: "荷兰", a: "哥斯达黎加", hg: 0, ag: 0 },
  { y: 2014, r: "SF", h: "巴西", a: "德国", hg: 1, ag: 7 }, { y: 2014, r: "SF", h: "荷兰", a: "阿根廷", hg: 0, ag: 0 }, { y: 2014, r: "3P", h: "巴西", a: "荷兰", hg: 0, ag: 3 }, { y: 2014, r: "F", h: "德国", a: "阿根廷", hg: 0, ag: 0 },
  // ── 2010 南非 ──
  { y: 2010, r: "R16", h: "乌拉圭", a: "韩国", hg: 2, ag: 1 }, { y: 2010, r: "R16", h: "美国", a: "加纳", hg: 1, ag: 1 }, { y: 2010, r: "R16", h: "德国", a: "英格兰", hg: 4, ag: 1 }, { y: 2010, r: "R16", h: "阿根廷", a: "墨西哥", hg: 3, ag: 1 },
  { y: 2010, r: "R16", h: "荷兰", a: "斯洛伐克", hg: 2, ag: 1 }, { y: 2010, r: "R16", h: "巴西", a: "智利", hg: 3, ag: 0 }, { y: 2010, r: "R16", h: "巴拉圭", a: "日本", hg: 0, ag: 0 }, { y: 2010, r: "R16", h: "西班牙", a: "葡萄牙", hg: 1, ag: 0 },
  { y: 2010, r: "QF", h: "荷兰", a: "巴西", hg: 2, ag: 1 }, { y: 2010, r: "QF", h: "乌拉圭", a: "加纳", hg: 1, ag: 1 }, { y: 2010, r: "QF", h: "阿根廷", a: "德国", hg: 0, ag: 4 }, { y: 2010, r: "QF", h: "巴拉圭", a: "西班牙", hg: 0, ag: 1 },
  { y: 2010, r: "SF", h: "乌拉圭", a: "荷兰", hg: 2, ag: 3 }, { y: 2010, r: "SF", h: "德国", a: "西班牙", hg: 0, ag: 1 }, { y: 2010, r: "3P", h: "乌拉圭", a: "德国", hg: 2, ag: 3 }, { y: 2010, r: "F", h: "荷兰", a: "西班牙", hg: 0, ag: 0 },
  // ── 2006 德国 ──
  { y: 2006, r: "R16", h: "德国", a: "瑞典", hg: 2, ag: 0 }, { y: 2006, r: "R16", h: "阿根廷", a: "墨西哥", hg: 1, ag: 1 }, { y: 2006, r: "R16", h: "英格兰", a: "厄瓜多尔", hg: 1, ag: 0 }, { y: 2006, r: "R16", h: "葡萄牙", a: "荷兰", hg: 1, ag: 0 },
  { y: 2006, r: "R16", h: "意大利", a: "澳大利亚", hg: 1, ag: 0 }, { y: 2006, r: "R16", h: "瑞士", a: "乌克兰", hg: 0, ag: 0 }, { y: 2006, r: "R16", h: "巴西", a: "加纳", hg: 3, ag: 0 }, { y: 2006, r: "R16", h: "西班牙", a: "法国", hg: 1, ag: 3 },
  { y: 2006, r: "QF", h: "德国", a: "阿根廷", hg: 1, ag: 1 }, { y: 2006, r: "QF", h: "意大利", a: "乌克兰", hg: 3, ag: 0 }, { y: 2006, r: "QF", h: "英格兰", a: "葡萄牙", hg: 0, ag: 0 }, { y: 2006, r: "QF", h: "巴西", a: "法国", hg: 0, ag: 1 },
  { y: 2006, r: "SF", h: "德国", a: "意大利", hg: 0, ag: 0 }, { y: 2006, r: "SF", h: "葡萄牙", a: "法国", hg: 0, ag: 1 }, { y: 2006, r: "3P", h: "德国", a: "葡萄牙", hg: 3, ag: 1 }, { y: 2006, r: "F", h: "意大利", a: "法国", hg: 1, ag: 1 },
  // ── 2002 韩日 ──
  { y: 2002, r: "R16", h: "德国", a: "巴拉圭", hg: 1, ag: 0 }, { y: 2002, r: "R16", h: "英格兰", a: "丹麦", hg: 3, ag: 0 }, { y: 2002, r: "R16", h: "瑞典", a: "塞内加尔", hg: 1, ag: 1 }, { y: 2002, r: "R16", h: "西班牙", a: "爱尔兰", hg: 1, ag: 1 },
  { y: 2002, r: "R16", h: "美国", a: "墨西哥", hg: 2, ag: 0 }, { y: 2002, r: "R16", h: "巴西", a: "比利时", hg: 2, ag: 0 }, { y: 2002, r: "R16", h: "日本", a: "土耳其", hg: 0, ag: 1 }, { y: 2002, r: "R16", h: "韩国", a: "意大利", hg: 1, ag: 1 },
  { y: 2002, r: "QF", h: "英格兰", a: "巴西", hg: 1, ag: 2 }, { y: 2002, r: "QF", h: "德国", a: "美国", hg: 1, ag: 0 }, { y: 2002, r: "QF", h: "西班牙", a: "韩国", hg: 0, ag: 0 }, { y: 2002, r: "QF", h: "塞内加尔", a: "土耳其", hg: 0, ag: 0 },
  { y: 2002, r: "SF", h: "德国", a: "韩国", hg: 1, ag: 0 }, { y: 2002, r: "SF", h: "巴西", a: "土耳其", hg: 1, ag: 0 }, { y: 2002, r: "3P", h: "韩国", a: "土耳其", hg: 2, ag: 3 }, { y: 2002, r: "F", h: "德国", a: "巴西", hg: 0, ag: 2 },
  // ── 1998 法国 ──
  { y: 1998, r: "R16", h: "意大利", a: "挪威", hg: 1, ag: 0 }, { y: 1998, r: "R16", h: "巴西", a: "智利", hg: 4, ag: 1 }, { y: 1998, r: "R16", h: "法国", a: "巴拉圭", hg: 0, ag: 0 }, { y: 1998, r: "R16", h: "尼日利亚", a: "丹麦", hg: 1, ag: 4 },
  { y: 1998, r: "R16", h: "德国", a: "墨西哥", hg: 2, ag: 1 }, { y: 1998, r: "R16", h: "荷兰", a: "南斯拉夫", hg: 2, ag: 1 }, { y: 1998, r: "R16", h: "罗马尼亚", a: "克罗地亚", hg: 0, ag: 1 }, { y: 1998, r: "R16", h: "阿根廷", a: "英格兰", hg: 2, ag: 2 },
  { y: 1998, r: "QF", h: "意大利", a: "法国", hg: 0, ag: 0 }, { y: 1998, r: "QF", h: "巴西", a: "丹麦", hg: 3, ag: 2 }, { y: 1998, r: "QF", h: "荷兰", a: "阿根廷", hg: 2, ag: 1 }, { y: 1998, r: "QF", h: "德国", a: "克罗地亚", hg: 0, ag: 3 },
  { y: 1998, r: "SF", h: "巴西", a: "荷兰", hg: 1, ag: 1 }, { y: 1998, r: "SF", h: "法国", a: "克罗地亚", hg: 2, ag: 1 }, { y: 1998, r: "3P", h: "荷兰", a: "克罗地亚", hg: 1, ag: 2 }, { y: 1998, r: "F", h: "巴西", a: "法国", hg: 0, ag: 3 },
];

const HIST_META: { year: number; label: string }[] = [
  { year: 1998, label: "1998 法国" }, { year: 2002, label: "2002 韩日" }, { year: 2006, label: "2006 德国" }, { year: 2010, label: "2010 南非" },
  { year: 2014, label: "2014 巴西" }, { year: 2018, label: "2018 俄罗斯" }, { year: 2022, label: "2022 卡塔尔" },
];
/** 逐场派生的历届概况（含季军战，共 16 场/届）+ 本届 R32。 */
export const WC_KNOCKOUT_HISTORY: HistYear[] = [
  ...HIST_META.map((m) => {
    const rows = KNOCKOUT_MATCHES.filter((x) => x.y === m.year);
    return { year: m.year, label: m.label, matches: rows.length, goals: rows.reduce((a, x) => a + x.hg + x.ag, 0), under: rows.filter((x) => x.hg + x.ag <= 2).length, est: true };
  }),
  { year: 2026, label: "2026 本届", matches: 16, goals: 36, under: 10, est: false },
];
export const histAvg = (h: HistYear) => (h.matches ? h.goals / h.matches : 0);
export const histUnderRate = (h: HistYear) => (h.matches ? h.under / h.matches : 0);

/** 用本届已录入的真实淘汰赛(90′)动态替换 2026 行——真实结果出来后自动修正、长期累积。 */
export function historyWithLive(s: { n: number; goals: number; under25: number }): HistYear[] {
  return WC_KNOCKOUT_HISTORY.map((h) => (h.year === 2026 ? { ...h, matches: s.n, goals: s.goals, under: s.under25 } : h));
}

/** 汇总选中的若干届 → 池化先验 λ 与小球率。 */
export function pooledPrior(rows: HistYear[], years: number[]) {
  const sel = rows.filter((r) => years.includes(r.year));
  const matches = sel.reduce((a, r) => a + r.matches, 0);
  const goals = sel.reduce((a, r) => a + r.goals, 0);
  const under = sel.reduce((a, r) => a + r.under, 0);
  return { lambda: matches ? goals / matches : DEFAULT_PRIOR_LAMBDA, underRate: matches ? under / matches : 0.6, matches, goals, under, count: sel.length };
}
export const DEFAULT_PRIOR_YEARS = [2010, 2014, 2018, 2022]; // 默认用近四届当先验

// ── 分轮次小球率（看“越往后越小球？”）──────────────────────────
export const ROUND_ORDER = ["R32", "R16", "QF", "SF", "F"];
export const ROUND_LABEL: Record<string, string> = { R32: "1/16 · 32强", R16: "1/8 · 16强", QF: "1/4 · 8强", SF: "半决赛", F: "决赛" };
export interface RoundAgg { year: number; round: string; matches: number; under: number }
/** 由逐场派生的历届各轮次 90′ 小球数（不含季军战——季军多为放开踢）。 */
export const KNOCKOUT_BY_ROUND: RoundAgg[] = (() => {
  const map = new Map<string, { matches: number; under: number }>();
  for (const x of KNOCKOUT_MATCHES) {
    if (x.r === "3P") continue;
    const k = x.y + "|" + x.r;
    const e = map.get(k) ?? { matches: 0, under: 0 };
    e.matches++; if (x.hg + x.ag <= 2) e.under++;
    map.set(k, e);
  }
  return [...map.entries()].map(([k, e]) => { const [y, r] = k.split("|"); return { year: +y, round: r, matches: e.matches, under: e.under }; });
})();
/** 汇总选中历届 → 每轮次 {场次, 小球数}。 */
export function poolByRound(years: number[]): Record<string, { matches: number; under: number }> {
  const m: Record<string, { matches: number; under: number }> = {};
  for (const r of KNOCKOUT_BY_ROUND) { if (!years.includes(r.year)) continue; const e = m[r.round] ?? { matches: 0, under: 0 }; e.matches += r.matches; e.under += r.under; m[r.round] = e; }
  return m;
}
/** 本届已录比赛按轮次统计。 */
export function roundStatsFromMatches(ms: KnockoutMatch[]): Record<string, { matches: number; under: number }> {
  const m: Record<string, { matches: number; under: number }> = {};
  for (const x of ms) { const e = m[x.round] ?? { matches: 0, under: 0 }; e.matches++; if (total(x) <= 2) e.under++; m[x.round] = e; }
  return m;
}

export const total = (m: KnockoutMatch) => m.hg + m.ag;
export const scoreKey = (m: KnockoutMatch) => { const [h, l] = m.hg >= m.ag ? [m.hg, m.ag] : [m.ag, m.hg]; return `${h}-${l}`; }; // 无序比分（大-小）
export const newMatch = (round = "R16"): KnockoutMatch => ({ id: kid(), round, home: "", away: "", hg: 0, ag: 0 });

export function matchesOf(wc?: WcModel): KnockoutMatch[] {
  const user = wc?.matches;
  if (!user || !user.length) return SEED_2026;
  // 合并官方新增(按 id)：我后续补录的真实比分/新场次，即使你本地已有数据也能显示；你改过的(同 id)以你为准。
  const ids = new Set(user.map((m) => m.id));
  const extra = SEED_2026.filter((m) => !ids.has(m.id));
  return extra.length ? [...user, ...extra] : user;
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
/** 1/4 决赛（8 强）赛程。前两场已完赛，后两场今日进行。 */
export const QF_FIXTURES: Fixture[] = [
  { id: "f_fr_ma", round: "QF", date: "2026-07-09", home: "法国", away: "摩洛哥" },
  { id: "f_es_be", round: "QF", date: "2026-07-10", home: "西班牙", away: "比利时" },
  { id: "f_no_en", round: "QF", date: "2026-07-11", home: "挪威", away: "英格兰" },
  { id: "f_ar_ch", round: "QF", date: "2026-07-11", home: "阿根廷", away: "瑞士" },
];
/** 全部有盘口/预测意义的赛程（16 强 + 8 强），供赛程板与成绩单统一遍历。 */
export const ALL_FIXTURES: Fixture[] = [...R16_FIXTURES, ...QF_FIXTURES];

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
/** 单场拆成主/客期望进球（给波胆用）。 */
export function matchSplit(base: number, home: string, away: string, str: ReturnType<typeof teamStrengths>, w = 0.35) {
  const avg = base / 2 || 1;
  const A = str.get(home), B = str.get(away);
  const aAtt = A && A.n ? A.gf / A.n : avg, aDef = A && A.n ? A.ga / A.n : avg;
  const bAtt = B && B.n ? B.gf / B.n : avg, bDef = B && B.n ? B.ga / B.n : avg;
  const lamH = Math.max(0.15, Math.min(4, avg * (1 - w) + (aAtt * bDef / avg) * w));
  const lamA = Math.max(0.15, Math.min(4, avg * (1 - w) + (bAtt * aDef / avg) * w));
  return { lam: lamH + lamA, lamH, lamA };
}
/** 该场最可能的若干个「有序」比分（主-客），给波胆推荐。 */
export function topScorelinesFor(lamH: number, lamA: number, n = 3) {
  const out: { key: string; h: number; a: number; p: number }[] = [];
  for (let h = 0; h <= 5; h++) for (let a = 0; a <= 5; a++) out.push({ key: `${h}-${a}`, h, a, p: pois(h, lamH) * pois(a, lamA) });
  return out.sort((x, y) => y.p - x.p).slice(0, n);
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

// ── 盘口去水头 + 每场最佳选择（小球 base） ─────────────────────
/** 一组赔率去掉水头(overround) → 归一化隐含概率。 */
export function deVig(odds: number[]): number[] {
  const inv = odds.map((o) => (o > 0 ? 1 / o : 0));
  const s = inv.reduce((a, b) => a + b, 0);
  return s > 0 ? inv.map((x) => x / s) : odds.map(() => 0);
}
export const OU_LINES = ["1.5", "2", "2.5", "3", "3.5"];
export const CS_KEYS = ["0-0", "1-0", "0-1", "1-1", "2-0", "0-2", "2-1", "1-2", "2-2", "3-0", "0-3", "3-1", "1-3"];

export interface MatchPick {
  favorite?: string; favP?: number;
  under25?: number;          // 盘口去水后的小球(<2.5)概率
  overLean?: boolean;        // 盘口偏大球
  bestUnder?: { line: string; odds: number; p: number };  // 推荐小球盘
  bestCS?: { key: string; odds: number; p: number; win: string };  // 推荐小波胆
}
/** 从录入的盘口，按“小球 base”给出每场最佳选择（全部基于盘口去水头，不靠naive模型）。 */
export function analyzeOdds(o: MatchOdds, home: string, away: string): MatchPick {
  const out: MatchPick = {};
  if (o.win && (o.win.h || o.win.a)) {
    const [ph, , pa] = deVig([o.win.h || 1e6, o.win.d || 1e6, o.win.a || 1e6]);
    if (ph >= pa) { out.favorite = home; out.favP = ph; } else { out.favorite = away; out.favP = pa; }
  }
  const lineProb: { line: string; odds: number; p: number }[] = [];
  for (const ln of OU_LINES) { const l = o.ou?.[ln]; if (l?.o && l?.u) { const [pu] = deVig([l.u, l.o]); lineProb.push({ line: ln, odds: l.u, p: pu }); } }
  const l25 = lineProb.find((x) => x.line === "2.5");
  if (l25) { out.under25 = l25.p; out.overLean = l25.p < 0.5; }
  if (lineProb.length) {
    if (l25 && l25.p >= 0.52) out.bestUnder = l25;                    // 盘口自己偏小 → 小2.5
    else out.bestUnder = lineProb.filter((x) => x.p >= 0.53).sort((a, b) => parseFloat(a.line) - parseFloat(b.line))[0] || l25 || lineProb[lineProb.length - 1];
  }
  if (o.cs) {
    const keys = Object.keys(o.cs).filter((k) => (o.cs![k] || 0) > 0);
    const probs = deVig(keys.map((k) => o.cs![k]));
    let bestK = "", bestP = -1;
    keys.forEach((k, i) => { const [h, a] = k.split("-").map(Number); if (h + a <= 2 && probs[i] > bestP) { bestP = probs[i]; bestK = k; } });
    if (bestK) { const [h, a] = bestK.split("-").map(Number); out.bestCS = { key: bestK, odds: o.cs[bestK], p: bestP, win: h > a ? home : a > h ? away : "平" }; }
  }
  return out;
}

/** 今晚两场的真实盘口（HK 盘口已换算成十进制：大小球/让球=显示值+1；独赢/波胆本就是十进制）。 */
export const DEFAULT_MATCH_ODDS: Record<string, MatchOdds> = {
  f_ca_ma: {
    ou: { "1.5": { o: 1.36, u: 3.04 }, "2": { o: 1.63, u: 2.29 }, "2.5": { o: 2.20, u: 1.69 } },
    win: { h: 5.10, d: 3.40, a: 1.79 },
    cs: { "1-0": 10.5, "2-0": 29, "2-1": 16, "0-0": 8.5, "1-1": 6.9, "2-2": 18, "0-1": 6.5, "0-2": 8.4, "1-2": 7.9, "0-3": 18, "1-3": 16 },
  },
  f_py_fr: {
    ou: { "2.5": { o: 1.63, u: 2.28 }, "3": { o: 2.07, u: 1.78 }, "3.5": { o: 2.72, u: 1.45 } },
    win: { h: 18.0, d: 6.80, a: 1.19 },
    cs: { "1-0": 36, "2-0": 121, "2-1": 56, "0-0": 16, "1-1": 13.5, "2-2": 41, "0-1": 6.8, "0-2": 5.3, "1-2": 10.5, "0-3": 6.3, "1-3": 11.5, "2-3": 46 },
  },
  f_br_no: {
    ou: { "2.5": { o: 1.67, u: 2.23 }, "3": { o: 2.12, u: 1.75 }, "3.5": { o: 2.66, u: 1.47 } },
    cs: { "1-0": 9.0, "2-0": 9.2, "2-1": 7.2, "3-0": 17.5, "3-1": 11.5, "3-2": 21, "0-0": 15.0, "1-1": 7.8, "2-2": 11.0, "0-1": 17.0, "0-2": 31, "1-2": 15.0 },
  },
  f_mx_en: {
    ou: { "1.5": { o: 1.42, u: 2.81 }, "2": { o: 1.77, u: 2.09 }, "2.5": { o: 2.36, u: 1.59 } },
    cs: { "1-0": 8.0, "2-0": 16.5, "2-1": 12.5, "3-0": 46, "3-1": 36, "0-0": 7.9, "1-1": 6.0, "2-2": 17.0, "0-1": 6.5, "0-2": 11.0, "1-2": 9.0 },
  },
  f_pt_es: {
    ou: { "2": { o: 1.39, u: 2.92 }, "2.5": { o: 1.84, u: 2.02 }, "3": { o: 2.42, u: 1.57 }, "3.5": { o: 2.75, u: 1.44 } },
    win: { h: 3.95, d: 3.70, a: 1.92 },
    cs: { "1-0": 14.0, "2-0": 29, "2-1": 12.5, "3-0": 71, "3-1": 31, "3-2": 31, "0-0": 13.5, "1-1": 7.6, "2-2": 13.0, "0-1": 8.8, "0-2": 9.5, "1-2": 7.5 },
  },
  f_us_be: {
    ou: { "2.5": { o: 1.71, u: 2.17 }, "3": { o: 2.19, u: 1.70 }, "3.5": { o: 2.69, u: 1.46 } },
    cs: { "1-0": 10.0, "2-0": 14.5, "2-1": 8.5, "3-0": 29, "3-1": 18.0, "3-2": 21, "0-0": 14.5, "1-1": 7.0, "2-2": 11.5, "0-1": 12.0, "0-2": 18.5, "1-2": 10.5 },
  },
  f_ar_eg: {
    ou: { "2": { o: 1.43, u: 2.78 }, "2.5": { o: 1.92, u: 1.94 }, "3": { o: 2.58, u: 1.50 } },
    win: { h: 1.33, d: 5.10, a: 10.5 },
    cs: { "1-0": 6.1, "2-0": 5.5, "2-1": 8.8, "3-0": 7.5, "3-1": 12.0, "3-2": 41, "0-0": 12.0, "1-1": 10.0, "2-2": 31, "0-1": 23, "0-2": 66, "1-2": 31 },
  },
  f_ch_co: {
    ou: { "1.5": { o: 1.39, u: 2.92 }, "2": { o: 1.69, u: 2.20 }, "2.5": { o: 2.28, u: 1.64 } },
    win: { h: 3.50, d: 3.15, a: 2.28 },
    cs: { "1-0": 9.5, "2-0": 20, "2-1": 12.0, "3-0": 61, "3-1": 31, "0-0": 8.0, "1-1": 6.5, "2-2": 15.5, "0-1": 7.0, "0-2": 11.0, "1-2": 9.0, "1-3": 19.0 },
  },
  // 1/4 决赛 · 挪威 vs 英格兰（大小球=HK+1；独赢/波胆本就是十进制）
  f_no_en: {
    ou: { "2.5": { o: 1.67, u: 2.23 }, "3": { o: 2.13, u: 1.74 }, "3.5": { o: 2.72, u: 1.46 } },
    win: { h: 3.80, d: 3.80, a: 1.94 },
    cs: { "1-0": 16.0, "2-0": 26, "2-1": 11.0, "3-0": 61, "3-1": 29, "3-2": 26, "0-0": 15.0, "1-1": 7.0, "2-2": 12.0, "0-1": 10.0, "0-2": 12.0, "1-2": 7.2, "0-3": 21, "1-3": 12.0, "2-3": 21 },
  },
  // 1/4 决赛 · 阿根廷 vs 瑞士 —— 暂无 hag050 盘口，先用 DraftKings/FanDuel 市场均价换算
  // (独赢十进制；大小球总盘 2.5、Under≈1.67/Over≈2.25)。等你发 hag050 的线我再覆盖。
  f_ar_ch: {
    ou: { "2.5": { o: 2.25, u: 1.67 } },
    win: { h: 1.69, d: 3.55, a: 5.50 },
  },
};

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
