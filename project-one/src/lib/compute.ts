// 计算层：Dataset + 界面状态 -> 各视图所需的数据模型。
// 对应设计稿里的 renderVals()，但数据来自统一的快照结构。

import type { AccountMeta, Category, Dataset, Snapshot } from "../data/types";
import { fmt, fmtSigned, fmtWan, fmtPct } from "./format";

export type RangeKey = "3m" | "1y" | "all";

export const CAT_TITLE: Record<Category, string> = {
  liquid: "流动资金",
  invest: "投资理财",
  estate: "家庭房产",
  fixed: "家庭其他固定资产",
  debt: "负债",
};
export const CAT_ORDER: Category[] = ["liquid", "invest", "estate", "fixed", "debt"];

// 资产构成分组的展示颜色。走 CSS 变量，跟着明暗主题各用一套（见 styles.css 的 --cat-*）。
// 核心 5 类是经 CVD/对比度校验的「全对可分」组；实际数据也正好落在这 5 类里。
// 后面几类很少与核心类同时出现，且环形图右侧有图例（名称+数值）做二次编码，故复用核心色相。
const COMP_COLOR: Record<string, string> = {
  现金及银行: "var(--cat-1)",
  "理财/固收": "var(--cat-2)",
  股票: "var(--cat-3)",
  房产: "var(--cat-4)",
  基金: "var(--cat-5)",
  黄金: "var(--cat-2)",
  养老金: "var(--cat-4)",
  公积金: "var(--cat-5)",
  其他固定资产: "var(--cat-other)",
  其他: "var(--cat-other)",
};

function lastBalance(snaps: Snapshot[], id: string): number {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const v = snaps[i].balances[id];
    if (v != null) return v;
  }
  return 0;
}

// 某账户「最后更新」是哪一期：优先看 touched（真正被改过的账户），而不是 balances 里
// 是否有值——一条快照的 balances 里，除了真正被改的账户，还会结转其它账户的上次余额
// 好保证净值算得对；touched 缺失（导入数据 / 本字段上线前的旧快照）时兜底按老逻辑。
function lastDate(snaps: Snapshot[], id: string): string | null {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const s = snaps[i];
    if (s.touched ? s.touched.includes(id) : s.balances[id] != null) return s.date;
  }
  return null;
}

/** 各账户的最新余额 */
export function latestBalances(ds: Dataset): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of ds.accounts) out[a.id] = lastBalance(ds.snapshots, a.id);
  return out;
}

/** 当前净资产（所有账户最新余额之和，含负债） */
export function currentNetWorth(ds: Dataset): number {
  const lb = latestBalances(ds);
  return ds.accounts.reduce((s, a) => s + lb[a.id], 0);
}

/** 预计年利息合计（按各账户自身年化利率，默认 0；rate 为小数） */
export function estimateAnnualInterest(ds: Dataset): number {
  const lb = latestBalances(ds);
  return ds.accounts.reduce((s, a) => s + lb[a.id] * (a.rate ?? 0), 0);
}

/** 距今多少天（用于显示账户更新的新鲜度） */
function freshness(dateISO: string): { label: string; days: number } {
  const days = Math.floor((Date.now() - new Date(dateISO + "T00:00:00").getTime()) / 86_400_000);
  const label = days <= 0 ? "今天更新" : days === 1 ? "昨天更新" : `${days} 天前更新`;
  return { label, days };
}

/** 某账户的历史序列（去掉无记录的点） */
export function accountSeries(ds: Dataset, id: string): { date: string; v: number }[] {
  const out: { date: string; v: number }[] = [];
  for (const s of ds.snapshots) {
    const v = s.balances[id];
    if (v != null) out.push({ date: s.date, v });
  }
  return out;
}

/** 每期净值（所有账户余额之和，含负债）
 *
 *  ⚠ 「这一期没记这个账户」不等于「这个账户这一期是 0」。原来写的是
 *  `s.balances[a.id] ?? 0`，于是 Excel 里某个账户的单元格一旦留空（或者某个月
 *  忘了填），那笔钱就在那个月整笔归零，曲线上出现一个假的断崖——比如账户有
 *  50 万、7 月起不再填，8 月净值就凭空少 50 万。
 *
 *  正确语义是沿用它最近一次记录的余额（跟 addSnapshot 手工建快照时的结转一致）；
 *  账户第一次出现之前才算 0（那时候它还不存在）。
 *  真要让一个账户从历史里消失，用 deleteAccount——那会把它从所有快照里删干净。 */
export function netSeries(ds: Dataset): { date: string; v: number }[] {
  const snaps = [...ds.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const carried: Record<string, number> = {};
  return snaps.map((s) => {
    let sum = 0;
    for (const a of ds.accounts) {
      const v = s.balances[a.id];
      if (v != null) carried[a.id] = v;
      sum += carried[a.id] ?? 0;
    }
    return { date: s.date, v: sum };
  });
}

/** 最近 n 个月的月份键（"2026-09"），升序，最后一个是今天所在的月。 */
export function lastMonthKeys(n: number, end = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** 把一条净值序列对齐到给定的月份上，每月取该月最后一条记录；
 *  某个月没记就沿用上一期（跟净值的结转语义一致，不是归零）；
 *  第一条记录之前给 null——那时这本账还不存在，画成 0 会凭空多出一段假的平线。
 *  两本账（家庭账 / 独立管理）快照日期各记各的，要叠在一张图上就得先这样对齐。 */
export function alignMonthly(series: { date: string; v: number }[], months: string[]): (number | null)[] {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  let i = 0;
  let cur: number | null = null;
  return months.map((m) => {
    const end = m + "-31";   // ISO 日期是补零的，该月任何一天都 ≤ "YYYY-MM-31"
    while (i < sorted.length && sorted[i].date <= end) { cur = sorted[i].v; i++; }
    return cur;
  });
}

/** 同一个月可能记了好几笔——「每月」视图里只保留当月最后一次（最新那笔），
 *  避免一个月出现好几个节点。返回按月升序、每月一个点。 */
function collapseMonthly<T extends { date: string }>(series: T[]): T[] {
  const byMonth = new Map<string, T>();
  for (const p of series) {
    const k = p.date.slice(0, 7);
    const ex = byMonth.get(k);
    if (!ex || p.date >= ex.date) byMonth.set(k, p); // 当月日期更靠后的覆盖前面的
  }
  return [...byMonth.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function monthLabel(iso: string): string {
  const [, m] = iso.split("-");
  return parseInt(m, 10) + "月";
}
function ymLabel(iso: string): string {
  const [y, m] = iso.split("-");
  return `${y.slice(2)}/${m}`;
}

function filterRange<T extends { date: string }>(series: T[], range: RangeKey): T[] {
  if (range === "all" || series.length === 0) return series;
  const last = new Date(series[series.length - 1].date);
  const months = range === "3m" ? 3 : 12;
  const cut = new Date(last);
  cut.setMonth(cut.getMonth() - months);
  const cutIso = cut.toISOString().slice(0, 10);
  const filtered = series.filter((p) => p.date >= cutIso);
  return filtered.length >= 2 ? filtered : series.slice(-2);
}

export interface ChartGeom {
  line: string;
  area: string;
  pts: { x: number; y: number }[];
  grid: { y: string; ty: string; label: string }[];
}

export function buildChart(
  values: number[],
  w: number,
  h: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number
): ChartGeom {
  const n = values.length;
  if (n === 0) return { line: "", area: "", pts: [], grid: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.18;
  const hi = max + span * 0.18;
  const X = (i: number) => (n === 1 ? padL : padL + (i * (w - padL - padR)) / (n - 1));
  const Y = (v: number) => h - padB - ((v - lo) / (hi - lo)) * (h - padT - padB);
  const pts = values.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const area =
    line +
    " L" + pts[n - 1].x.toFixed(1) + " " + (h - padB) +
    " L" + pts[0].x.toFixed(1) + " " + (h - padB) + " Z";
  const grid: ChartGeom["grid"] = [];
  for (let k = 0; k <= 3; k++) {
    const gv = hi - ((hi - lo) * k) / 3;
    const gy = Y(gv);
    grid.push({ y: gy.toFixed(1), ty: (gy + 3.5).toFixed(1), label: fmtWan(Math.round(gv / 1000) * 1000) });
  }
  return { line, area, pts, grid };
}

export interface UIState {
  range: RangeKey;
  selectedId: string;
}

export function buildView(ds: Dataset, ui: UIState) {
  const accs = ds.accounts;
  const last = ds.snapshots[ds.snapshots.length - 1];
  const prev = ds.snapshots[ds.snapshots.length - 2];

  const latest: Record<string, number> = {};
  for (const a of accs) latest[a.id] = lastBalance(ds.snapshots, a.id);

  const totalAssets = accs.reduce((s, a) => s + Math.max(0, latest[a.id]), 0);
  const totalLiab = accs.reduce((s, a) => s + Math.min(0, latest[a.id]), 0);
  const net = totalAssets + totalLiab;

  // 较上期变化
  const netPrev = prev ? accs.reduce((s, a) => s + (prev.balances[a.id] ?? latest[a.id]), 0) : net;
  const netDelta = net - netPrev;
  const netPct = netPrev ? netDelta / Math.abs(netPrev) : 0;

  // ---- 趋势 ----
  const fullNet = netSeries(ds);
  const series = filterRange(fullNet, ui.range);
  const tc = buildChart(series.map((p) => p.v), 600, 200, 44, 8, 16, 30);
  const trendXLabels = pickXLabels(series.map((p) => ymLabel(p.date)), tc.pts);
  const trendPoints = series.map((p, i) => ({ x: tc.pts[i].x, y: tc.pts[i].y, date: p.date, value: p.v }));

  // 净资产每月变化量（近 12 个月，独立于时间范围）；同月多笔只取当月最后一笔
  const recentNet = collapseMonthly(fullNet).slice(-13);
  const mcMax = recentNet.reduce((m, p, i) => (i === 0 ? m : Math.max(m, Math.abs(p.v - recentNet[i - 1].v))), 0) || 1;
  const mNotes = ds.monthNotes || {};
  const monthlyChanges = recentNet
    .map((p, i) => (i === 0 ? null : { label: ymLabel(p.date), key: p.date.slice(0, 7), delta: p.v - recentNet[i - 1].v }))
    .filter((x): x is { label: string; key: string; delta: number } => x != null)
    .map((c) => ({
      label: c.label,
      key: c.key,
      note: mNotes[c.key] || "",
      text: c.delta >= 0 ? "+" + fmtWan(c.delta) : fmtWan(c.delta),
      up: c.delta >= 0,
      ratio: Math.abs(c.delta) / mcMax,
    }));
  const rangeCaption =
    ui.range === "3m" ? "最近 3 个月 · 按月快照"
      : ui.range === "1y" ? "最近 12 个月 · 按月快照"
        : `全部历史 · ${fullNet[0] ? fullNet[0].date.slice(0, 7) : ""} 至今`;

  // ---- 资产构成（按 comp 分组，仅资产）----
  const compMap = new Map<string, number>();
  for (const a of accs) {
    const v = latest[a.id];
    if (v <= 0) continue;
    const key = (a as AccountMeta & { comp?: string }).comp || "其他";
    compMap.set(key, (compMap.get(key) || 0) + v);
  }
  const compArr = [...compMap.entries()].sort((a, b) => b[1] - a[1]);
  const C = 2 * Math.PI * 46;
  let accLen = 0;
  const donut = compArr.map(([name, val]) => {
    const frac = totalAssets ? val / totalAssets : 0;
    const len = frac * C;
    const seg = {
      name,
      color: COMP_COLOR[name] || "#8E8E93",
      pct: fmtPct(frac),
      dash: len.toFixed(2) + " " + (C - len).toFixed(2),
      offset: (-accLen).toFixed(2),
    };
    accLen += len;
    return seg;
  });

  // ---- 最近更新（按上一期->最新期变化幅度取前 4）----
  const changed = accs
    .map((a) => {
      const cur = latest[a.id];
      const before = prev ? prev.balances[a.id] : null;
      const change = before == null ? 0 : cur - before;
      return { a, cur, change };
    })
    .filter((x) => x.change !== 0)
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change))
    .slice(0, 4);
  const recent = changed.map(({ a, cur, change }) => ({
    id: a.id,
    name: a.name,
    detail: (last ? last.date : "") + " · 月末盘点",
    amount: fmt(cur),
    color: a.color,
    change: fmtSigned(change),
    changeColor: change >= 0 ? "var(--green)" : "var(--red)",
  }));

  // ---- 账户视图映射（分组与全部排序共用）----
  const mkAcc = (a: AccountMeta, i: number) => {
    const bal = latest[a.id];
    const pct = totalAssets ? (Math.abs(bal) / totalAssets) * 100 : 0;
    const upd = lastDate(ds.snapshots, a.id);
    const wa = upd ? freshness(upd) : null;
    // 本次余额 vs 上一次余额的差值
    const series = accountSeries(ds, a.id);
    const curr = series.length ? series[series.length - 1].v : null;
    const prev = series.length >= 2 ? series[series.length - 2].v : null;
    const delta = curr != null && prev != null ? curr - prev : null;
    return {
      id: a.id,
      name: a.name,
      type: (a as AccountMeta & { comp?: string }).comp ?? a.type, // 资产类型（统一到资产构成）
      color: a.color,
      initial: a.name.slice(0, 1),
      catTitle: CAT_TITLE[a.cat],
      sub: a.institution && a.institution !== "—" ? `${a.institution} · ${a.owner ?? ""}` : a.owner ?? "",
      balance: fmt(bal),
      amountColor: bal < 0 ? "var(--red)" : "var(--text-primary)",
      pct: pct.toFixed(1) + "%",
      pctWidth: Math.min(100, pct).toFixed(1) + "%",
      border: i === 0 ? "none" : "0.5px solid var(--separator)",
      updated: upd ?? "—",
      ago: wa ? wa.label : "无记录",
      stale: wa ? wa.days >= 56 : true,
      overdue: wa ? wa.days > 30 : true, // 超过 1 个月未更新
      delta,
      deltaText: delta == null ? "首次" : delta === 0 ? "持平" : fmtSigned(delta),
      deltaColor: delta == null || delta === 0 ? "var(--text-tertiary)" : delta > 0 ? "var(--green)" : "var(--red)",
      prevDate: series.length >= 2 ? series[series.length - 2].date : null,
    };
  };
  const byAbs = (a: AccountMeta, b: AccountMeta) => Math.abs(latest[b.id]) - Math.abs(latest[a.id]);

  // ---- 账户分组 ----
  const groups = CAT_ORDER.map((cat) => {
    const list = accs.filter((a) => a.cat === cat);
    const sub = list.reduce((s, a) => s + latest[a.id], 0);
    return {
      cat,
      title: CAT_TITLE[cat],
      subtotal: fmt(sub),
      subtotalColor: sub < 0 ? "var(--red)" : "var(--text-primary)",
      accounts: list.slice().sort(byAbs).map(mkAcc),
    };
  }).filter((g) => g.accounts.length > 0);

  // ---- 全部账户（按金额排序，不分组）----
  const flatAccounts = accs.slice().sort(byAbs).map(mkAcc);
  // ---- 全部账户（按最后更新时间排序，最近的在前；没记录过的排最后）----
  const byUpdated = [...flatAccounts].sort((a, b) => {
    if (a.updated === "—" && b.updated === "—") return 0;
    if (a.updated === "—") return 1;
    if (b.updated === "—") return -1;
    return b.updated.localeCompare(a.updated);
  });

  // ---- 账户详情 ----
  const da = accs.find((a) => a.id === ui.selectedId) || accs[0] ||
    ({ id: "", name: "—", cat: "liquid", type: "", color: "#8E8E93" } as AccountMeta);
  const daComp = (da as AccountMeta & { comp?: string }).comp ?? da.type;
  const ds2 = da.id ? collapseMonthly(accountSeries(ds, da.id)) : [];
  const detailShown = ds2.slice(-6);
  const dc = buildChart(detailShown.map((p) => p.v), 600, 180, 52, 8, 14, 28);
  const detailDots = detailShown.map((p, i) => ({
    x: dc.pts[i] ? dc.pts[i].x.toFixed(1) : "0",
    y: dc.pts[i] ? dc.pts[i].y.toFixed(1) : "0",
    label: monthLabel(p.date),
  }));
  const dFirst = detailShown[0]?.v ?? 0;
  const dLast = detailShown[detailShown.length - 1]?.v ?? 0;
  const dDelta = dLast - dFirst;
  // 每期（每月）变化量，用于柱状预览
  const detailChanges = detailShown
    .map((p, i) => (i === 0 ? null : { label: monthLabel(p.date), delta: p.v - detailShown[i - 1].v }))
    .filter((x): x is { label: string; delta: number } => x != null);
  const changeMax = detailChanges.reduce((m, c) => Math.max(m, Math.abs(c.delta)), 0) || 1;
  const snapshots = ds2
    .slice()
    .reverse()
    .map((p, idx) => {
      const realIdx = ds2.length - 1 - idx;
      const change = realIdx > 0 ? ds2[realIdx].v - ds2[realIdx - 1].v : null;
      return {
        rawDate: p.date, // 原始 ISO 日期，删除这条快照时要用
        date: p.date.replace(/-/g, " / "),
        amount: fmt(p.v),
        change: change == null ? "—" : fmtSigned(change),
        changeColor: change == null ? "var(--text-tertiary)" : change >= 0 ? "var(--green)" : "var(--red)",
        source: idx === ds2.length - 1 ? "导入" : "导入",
      };
    });

  return {
    meta: { vaultName: ds.vaultName, userName: ds.userName, real: !!ds.real, accountCount: accs.length },
    totals: {
      totalAssets: fmt(totalAssets),
      totalLiabilities: fmt(totalLiab),
      netWorth: fmt(net),
      netDelta: fmtSigned(netDelta),
      netDeltaPct: (netPct >= 0 ? "↑ " : "↓ ") + fmtPct(Math.abs(netPct)),
      netUp: netDelta >= 0,
      assetsRaw: totalAssets,
      liabRaw: totalLiab,
      netRaw: net,
    },
    trend: {
      caption: rangeCaption,
      line: tc.line,
      area: tc.area,
      grid: tc.grid,
      xLabels: trendXLabels,
      lastX: tc.pts.length ? tc.pts[tc.pts.length - 1].x.toFixed(1) : "0",
      lastY: tc.pts.length ? tc.pts[tc.pts.length - 1].y.toFixed(1) : "0",
      points: trendPoints,
    },
    donut,
    recent,
    groups,
    flatAccounts,
    byUpdated,
    monthlyChanges,
    detail: {
      id: da.id,
      name: da.name,
      type: daComp,
      color: da.color,
      initial: da.name.slice(0, 1),
      sub: (da.institution && da.institution !== "—" ? da.institution + " · " : "") + "归属 " + (da.owner ?? "全家") + " · " + daComp,
      balance: fmt(dLast),
      balanceRaw: dLast,
      line: dc.line,
      area: dc.area,
      grid: dc.grid,
      dots: detailDots,
      trendLabel: fmtSigned(dDelta),
      trendColor: dDelta >= 0 ? "var(--green)" : "var(--red)",
      snapshots,
      changes: detailChanges.map((c) => ({
        label: c.label,
        text: fmtSigned(c.delta),
        up: c.delta >= 0,
        ratio: Math.abs(c.delta) / changeMax, // 0..1，用于柱高
      })),
    },
  };
}

// 趋势图 x 轴：点太多时只取约 6 个标签均匀分布
function pickXLabels(labels: string[], pts: { x: number }[]): { x: string; label: string }[] {
  const n = labels.length;
  if (n === 0) return [];
  const want = Math.min(6, n);
  const out: { x: string; label: string }[] = [];
  for (let k = 0; k < want; k++) {
    const i = Math.round((k * (n - 1)) / (want - 1 || 1));
    out.push({ x: pts[i].x.toFixed(1), label: labels[i] });
  }
  return out;
}

export type View = ReturnType<typeof buildView>;
