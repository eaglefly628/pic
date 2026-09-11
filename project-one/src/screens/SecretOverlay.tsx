import React, { useMemo, useState } from "react";
import type { Dataset } from "../data/types";
import { alignMonthly, lastMonthKeys, netSeries } from "../lib/compute";
import { fmt, fmtWan } from "../lib/format";
import { card, Segmented, Switch } from "../ui";
import { rise } from "../lib/anim";
import { useBreakpoint } from "../lib/breakpoint";

const PREF_KEY = "familyvault.secret.ui.v1";   // 只存开关这类界面偏好，不含任何金额
const MONTHS = 12;

type Mode = "amount" | "index";
type Line = {
  key: "secret" | "main" | "total";
  label: string;
  color: string;
  dash?: string;
  width: number;
  vals: (number | null)[];
};

function readPref(): boolean {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}").showTotal !== false; } catch { return true; }
}
function writePref(showTotal: boolean) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ showTotal })); } catch { /* 存不下就算了，只是个偏好 */ }
}

const monthLabel = (m: string) => { const [y, mm] = m.split("-"); return `${y.slice(2)}/${mm}`; };
/** 一年变化：拿这条线上第一个有数的点和最后一个有数的点比 */
function span(vals: (number | null)[]): { first: number; last: number; delta: number } | null {
  const got = vals.filter((v): v is number => v != null);
  if (got.length < 2) return null;
  return { first: got[0], last: got[got.length - 1], delta: got[got.length - 1] - got[0] };
}

/** 两本账现值差 6 倍以上 = 同轴画出来小的那条基本是条平线 */
function isLopsided(a: (number | null)[], b: (number | null)[]): boolean {
  const la = span(a)?.last, lb = span(b)?.last;
  if (la == null || lb == null) return false;
  const [lo, hi] = [Math.abs(la), Math.abs(lb)].sort((x, y) => x - y);
  return lo > 0 && hi / lo >= 6;
}

export default function SecretOverlay({ secret, main }: { secret: Dataset; main: Dataset }) {
  const phone = useBreakpoint() === "phone";
  const [showTotal, setShowTotal] = useState(readPref);
  const [hover, setHover] = useState<number | null>(null);

  const months = useMemo(() => lastMonthKeys(MONTHS), []);
  const sVals = useMemo(() => alignMonthly(netSeries(secret), months), [secret, months]);
  const mVals = useMemo(() => alignMonthly(netSeries(main), months), [main, months]);
  // 两本账量级差得远是常态（私房钱几万、家里几百万）。这时候一上来就用金额同轴，
  // 小的那条会贴着底变成一条平线，图看着像坏了。默认先给指数，金额留给想看真实占比的时候。
  const [mode, setMode] = useState<Mode>(() => (isLopsided(sVals, mVals) ? "index" : "amount"));
  const tVals = useMemo(() => sVals.map((s, i) => (s != null && mVals[i] != null ? s + (mVals[i] as number) : null)), [sVals, mVals]);

  const lines: Line[] = useMemo(() => {
    const all: Line[] = [
      { key: "secret", label: "独立管理", color: "var(--accent)", width: 2.4, vals: sVals },
      { key: "main", label: "家庭理财", color: "var(--cat-3)", dash: "7 4", width: 2, vals: mVals },
      { key: "total", label: "家庭总资产", color: "var(--text-tertiary)", dash: "2 3.5", width: 1.8, vals: tVals },
    ];
    return all.filter((l) => (l.key === "total" ? showTotal : true)).filter((l) => l.vals.some((v) => v != null));
  }, [sVals, mVals, tVals, showTotal]);

  // 指数模式：每条线各自从「第一个有数的月份 = 100」起算，纯看涨跌幅。
  // 两本账量级差很多时，金额同轴会把小的那条压成一条平线，这时候看指数才看得出各自走势。
  const plotted = useMemo(() => lines.map((l) => {
    if (mode === "amount") return { ...l, plot: l.vals };
    const base = l.vals.find((v): v is number => v != null);
    if (!base) return { ...l, plot: l.vals.map(() => null) };
    return { ...l, plot: l.vals.map((v) => (v == null ? null : (v / base) * 100)) };
  }), [lines, mode]);

  const geom = useMemo(() => {
    const vals = plotted.flatMap((l) => l.plot).filter((v): v is number => v != null);
    if (vals.length < 2) return null;
    const W = 600, H = 210, L = 52, R = 10, T = 14, B = 30;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const padv = (mx - mn) * 0.1 || Math.abs(mx || 1) * 0.1;
    // 上下各留一点余量，但全是正数时纵轴不越过 0——否则会标出一个根本不存在的负数刻度
    const lo = mn >= 0 ? Math.max(0, mn - padv) : mn - padv;
    const hi = mx + padv;
    const X = (i: number) => (months.length === 1 ? L : L + (i / (months.length - 1)) * (W - L - R));
    const Y = (v: number) => H - B - ((v - lo) / (hi - lo)) * (H - T - B);
    const paths = plotted.map((l) => {
      let d = "", pen = false;
      l.plot.forEach((v, i) => {
        if (v == null) { pen = false; return; }        // 断档就抬笔，不要把缺的月份连成直线
        d += (pen ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " ";
        pen = true;
      });
      return { ...l, d: d.trim(), dots: l.plot.map((v, i) => (v == null ? null : { x: X(i), y: Y(v) })) };
    });
    const grid = [0, 1, 2, 3].map((k) => {
      const gv = hi - ((hi - lo) * k) / 3;
      return { y: Y(gv), label: mode === "amount" ? fmtWan(Math.round(gv / 1000) * 1000) : gv.toFixed(0) };
    });
    const xLabels = months.map((m, i) => ({ x: X(i), label: monthLabel(m), i }))
      .filter((_, i) => i % (phone ? 3 : 2) === 0 || i === months.length - 1);
    return { W, H, L, R, T, B, X, Y, paths, grid, xLabels };
  }, [plotted, months, mode, phone]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geom) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * geom.W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < months.length; i++) { const d = Math.abs(geom.X(i) - px); if (d < bd) { bd = d; best = i; } }
    setHover(best);
  };

  const focus = hover ?? months.length - 1;
  const hasBoth = sVals.some((v) => v != null) && mVals.some((v) => v != null);
  // 量级差 6 倍以上时，金额同轴基本看不出小的那条在动，提示一句
  const lopsided = mode === "amount" && isLopsided(sVals, mVals);

  return (
    <div className="fv-rise" data-card="secret-overlay" style={{ ...rise(150), ...card, padding: phone ? "16px 14px" : "20px 24px", margin: phone ? "0 14px 16px" : "0 32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>一年资产走势</div>
        <div style={{ flex: 1, minWidth: 0 }} />
        <Switch checked={showTotal} onChange={(v) => { setShowTotal(v); writePref(v); }} label="合计家庭总资产" />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginBottom: 14 }}>
        近 12 个月，按月末对齐；某个月没记就沿用上一期。两本账只有在这里才看得到合在一起的数。
      </div>

      {/* 统计：两本账各自的现值和一年变化，开关打开时再加一行合计 */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${phone ? 130 : 160}px, 1fr))`, gap: phone ? "12px 14px" : "14px 24px", marginBottom: 16 }}>
        {lines.map((l) => {
          const s = span(l.vals);
          const cur = l.vals.filter((v): v is number => v != null).slice(-1)[0];
          return (
            <div key={l.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-tertiary)" }}>
                <svg width="18" height="8" style={{ flex: "none" }} aria-hidden><line x1="0" y1="4" x2="18" y2="4" stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dash} /></svg>
                {l.label}
              </div>
              <div style={{ fontSize: phone ? 17 : 19, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{cur == null ? "—" : fmt(cur)}</div>
              {s && (
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, fontVariantNumeric: "tabular-nums", color: s.delta >= 0 ? "var(--green)" : "var(--red)" }}>
                  {s.delta >= 0 ? "↑ " : "↓ "}{fmtWan(Math.abs(s.delta))}
                  <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                    {s.first !== 0 ? ` · ${s.delta >= 0 ? "+" : "−"}${Math.abs((s.delta / Math.abs(s.first)) * 100).toFixed(1)}%` : ""} 近一年
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasBoth && (
        <div style={{ fontSize: 12, color: "var(--orange)", lineHeight: 1.7, background: "var(--fill-quaternary)", borderRadius: 9, padding: "9px 12px", marginBottom: 14 }}>
          {sVals.every((v) => v == null) ? "独立管理这边还没有快照，先记一笔就能看到走势。" : "家庭理财那边近一年没有快照，暂时只画得出独立管理这一条。"}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", minHeight: 18 }}>
          {geom && <>
            <span style={{ color: "var(--text-tertiary)" }}>{monthLabel(months[focus])}</span>
            {plotted.map((l) => (
              <span key={l.key} style={{ marginLeft: 12 }}>
                <span style={{ color: l.color, fontWeight: 600 }}>{l.label}</span>
                {" "}
                {l.vals[focus] == null ? "—" : mode === "amount" ? fmtWan(l.vals[focus] as number) : (l.plot[focus] as number).toFixed(1)}
              </span>
            ))}
          </>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }} />
        <Segmented value={mode} onChange={(v) => setMode(v as Mode)} style={{ width: phone ? "100%" : 186 }}
          options={[{ value: "amount", label: "金额" }, { value: "index", label: "指数" }]} />
      </div>

      {geom ? (
        <svg viewBox={`0 0 ${geom.W} ${geom.H}`} style={{ width: "100%", height: phone ? 180 : 210, display: "block", overflow: "visible", touchAction: "pan-y" }}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {geom.grid.map((g, i) => (
            <g key={i}>
              <line x1={geom.L} x2={geom.W - geom.R} y1={g.y} y2={g.y} stroke="var(--separator)" strokeWidth="1" />
              <text x={geom.L - 6} y={g.y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-tertiary)">{g.label}</text>
            </g>
          ))}
          {hover != null && (
            <line x1={geom.X(hover)} x2={geom.X(hover)} y1={geom.T} y2={geom.H - geom.B} stroke="var(--separator-strong)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {geom.paths.map((l) => (
            <path key={l.key} d={l.d} fill="none" stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dash}
              strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {geom.paths.map((l) => l.dots[focus] && (
            <circle key={l.key} cx={l.dots[focus]!.x} cy={l.dots[focus]!.y} r="3.4" fill="var(--bg-card)" stroke={l.color} strokeWidth="2" />
          ))}
          {geom.xLabels.map((t) => (
            <text key={t.i} x={t.x} y={geom.H - 10} textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{t.label}</text>
          ))}
        </svg>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "40px 0", textAlign: "center" }}>近一年还没有足够的快照，记满两期就能画出走势。</div>
      )}

      {lopsided && (
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 10 }}>
          两本账量级差得多，同轴看小的那条几乎是平的；切到「指数」各自从 100 起算，涨跌幅就看得出来了。
        </div>
      )}
      {mode === "index" && (
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 10 }}>
          指数：每条线各自以最早那个月为 100，只比涨跌幅，不比金额大小。
        </div>
      )}
    </div>
  );
}
