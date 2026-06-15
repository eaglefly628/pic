// 计算层：Dataset + 界面状态 -> 各视图所需的数据模型。
// 对应设计稿里的 renderVals()，但数据来自统一的快照结构。

import type { AccountMeta, Category, Dataset, Snapshot } from "../data/types";
import { fmt, fmtSigned, fmtWan, fmtPct } from "./format";

export type RangeKey = "3m" | "1y" | "all";

const CAT_TITLE: Record<Category, string> = {
  liquid: "流动资金",
  invest: "投资理财",
  estate: "不动产",
  debt: "负债",
};
const CAT_ORDER: Category[] = ["liquid", "invest", "estate", "debt"];

// 资产构成分组的展示颜色（与设计稿色板一致）
const COMP_COLOR: Record<string, string> = {
  房产: "#007AFF",
  股票: "#34C759",
  "理财/固收": "#FF9500",
  基金: "#5E5CE6",
  现金及银行: "#FF2D55",
  黄金: "#FFD60A",
  其他: "#8E8E93",
};

function lastBalance(snaps: Snapshot[], id: string): number {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const v = snaps[i].balances[id];
    if (v != null) return v;
  }
  return 0;
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

/** 每期净值（所有账户余额之和，含负债） */
export function netSeries(ds: Dataset): { date: string; v: number }[] {
  return ds.snapshots.map((s) => {
    let sum = 0;
    for (const a of ds.accounts) sum += s.balances[a.id] ?? 0;
    return { date: s.date, v: sum };
  });
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

  // ---- 账户分组 ----
  const groups = CAT_ORDER.map((cat) => {
    const list = accs.filter((a) => a.cat === cat);
    const sub = list.reduce((s, a) => s + latest[a.id], 0);
    return {
      cat,
      title: CAT_TITLE[cat],
      subtotal: fmt(sub),
      subtotalColor: sub < 0 ? "var(--red)" : "var(--text-primary)",
      accounts: list
        .slice()
        .sort((a, b) => Math.abs(latest[b.id]) - Math.abs(latest[a.id]))
        .map((a, i) => {
          const bal = latest[a.id];
          const pct = totalAssets ? (Math.abs(bal) / totalAssets) * 100 : 0;
          return {
            id: a.id,
            name: a.name,
            type: a.type,
            color: a.color,
            initial: a.name.slice(0, 1),
            sub: a.institution && a.institution !== "—" ? `${a.institution} · ${a.owner ?? ""}` : a.owner ?? "",
            balance: fmt(bal),
            amountColor: bal < 0 ? "var(--red)" : "var(--text-primary)",
            pct: pct.toFixed(1) + "%",
            pctWidth: Math.min(100, pct).toFixed(1) + "%",
            border: i === 0 ? "none" : "0.5px solid var(--separator)",
          };
        }),
    };
  }).filter((g) => g.accounts.length > 0);

  // ---- 账户详情 ----
  const da = accs.find((a) => a.id === ui.selectedId) || accs[0];
  const ds2 = accountSeries(ds, da.id);
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
  const snapshots = ds2
    .slice()
    .reverse()
    .map((p, idx) => {
      const realIdx = ds2.length - 1 - idx;
      const change = realIdx > 0 ? ds2[realIdx].v - ds2[realIdx - 1].v : null;
      return {
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
    },
    trend: {
      caption: rangeCaption,
      line: tc.line,
      area: tc.area,
      grid: tc.grid,
      xLabels: trendXLabels,
      lastX: tc.pts.length ? tc.pts[tc.pts.length - 1].x.toFixed(1) : "0",
      lastY: tc.pts.length ? tc.pts[tc.pts.length - 1].y.toFixed(1) : "0",
    },
    donut,
    recent,
    groups,
    detail: {
      id: da.id,
      name: da.name,
      type: da.type,
      color: da.color,
      initial: da.name.slice(0, 1),
      sub: (da.institution && da.institution !== "—" ? da.institution + " · " : "") + "归属 " + (da.owner ?? "全家") + " · " + da.type,
      balance: fmt(dLast),
      line: dc.line,
      area: dc.area,
      grid: dc.grid,
      dots: detailDots,
      trendLabel: fmtSigned(dDelta),
      trendColor: dDelta >= 0 ? "var(--green)" : "var(--red)",
      snapshots,
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
