import { useMemo, useRef, useState } from "react";
import { currentNetWorth, estimateAnnualInterest } from "../lib/compute";
import { fmt, fmtWan } from "../lib/format";
import type { Dataset, RetirementPlan } from "../data/types";
import { card, Field, TextField } from "../ui";
import { useCountUp, rise } from "../lib/anim";

const HORIZON_CAP_MONTHS = 40 * 12; // 净消耗为正时最多往后画 40 年，避免极小消耗速度把图撑到离谱
const FLAT_HORIZON_MONTHS = 36; // 净消耗 <= 0（利息抵消得掉）时，没有归零点可算，只画 3 年示意

function ym2(d: Date) { return `${String(d.getFullYear()).slice(2)}/${String(d.getMonth() + 1).padStart(2, "0")}`; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; }

/** 可复用的退休消耗预测视图（主账户与私房钱共用，跟 InterestView 一个思路） */
export function RetirementView({ dataset, onSave }: { dataset: Dataset; onSave: (plan: RetirementPlan) => void }) {
  const plan = dataset.retirement ?? {};
  const [date, setDate] = useState(plan.date ?? "");
  const [spentStr, setSpentStr] = useState(plan.spentSinceRetire != null ? String(plan.spentSinceRetire) : "");
  const [withInterest, setWithInterest] = useState(plan.withInterest ?? false);

  const net0 = currentNetWorth(dataset);
  const annualInterest = estimateAnnualInterest(dataset);

  const saveDate = (v: string) => { setDate(v); onSave({ date: v || undefined, spentSinceRetire: spentStr ? parseFloat(spentStr) : undefined, withInterest }); };
  const saveSpent = (v: string) => onSave({ date: date || undefined, spentSinceRetire: v ? parseFloat(v) || undefined : undefined, withInterest });
  const saveWithInterest = (v: boolean) => { setWithInterest(v); onSave({ date: date || undefined, spentSinceRetire: spentStr ? parseFloat(spentStr) : undefined, withInterest: v }); };

  const calc = useMemo(() => {
    const spentNum = parseFloat(spentStr);
    if (!date || !spentNum || spentNum <= 0) return null;
    const retireDate = new Date(date + "T00:00:00");
    const now = new Date();
    const daysSince = (now.getTime() - retireDate.getTime()) / 86_400_000;
    if (daysSince <= 0) return null; // 退休日期还没到，算不出"已经花了多少速度"
    const monthsSince = Math.max(daysSince / 30.44, 1); // 不到一个月的数据，先按一个月折算，避免极端外推
    const monthlyBurn = spentNum / monthsSince;
    const monthlyInterest = withInterest ? annualInterest / 12 : 0;
    const netMonthlyBurn = monthlyBurn - monthlyInterest;

    const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
    const willDeplete = netMonthlyBurn > 0;
    const cap = willDeplete ? Math.min(HORIZON_CAP_MONTHS, Math.ceil(net0 / netMonthlyBurn) + 2) : FLAT_HORIZON_MONTHS;

    const series: { label: string; v: number }[] = [];
    let zeroAt: number | null = null;
    for (let m = 0; m <= cap; m++) {
      const d = addMonths(base, m);
      const raw = net0 - netMonthlyBurn * m;
      const v = willDeplete ? Math.max(0, raw) : raw;
      series.push({ label: ym2(d), v });
      if (zeroAt == null && willDeplete && v <= 0) zeroAt = m;
    }
    const zeroDate = zeroAt != null ? addMonths(base, zeroAt) : null;
    return { monthlyBurn, monthlyInterest, netMonthlyBurn, series, zeroAt, zeroDate, monthsSince: daysSince / 30.44, willDeplete };
  }, [date, spentStr, withInterest, net0, annualInterest]);

  const n = calc?.series.length ?? 0;
  const xAt = (i: number) => (n <= 1 ? 56 : 56 + (i * (600 - 56 - 8)) / (n - 1));
  const idxs = calc ? Array.from(new Set([0, 1, 2, 3, 4, 5, 6].map((k) => Math.round((k * (n - 1)) / 6)))) : [];
  const xLabels = calc ? idxs.map((i) => ({ x: xAt(i).toFixed(1), label: calc.series[i].label })) : [];

  const yearsMonths = (m: number) => { const y = Math.floor(m / 12), r = Math.round(m % 12); return y > 0 ? `${y} 年${r > 0 ? ` ${r} 个月` : ""}` : `${r} 个月`; };

  return (
    <div style={{ padding: "24px 32px 40px" }}>
      <div className="fv-rise" style={{ ...rise(0), ...card, padding: "18px 22px", marginBottom: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>退休消耗设定</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 14 }}>填退休日期 + 从退休到现在一共花了多少，倒推月均消耗速度，往后画一条预测曲线</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12, alignItems: "end" }}>
          <Field label="退休日期"><TextField type="date" value={date} onChange={(e) => saveDate(e.target.value)} /></Field>
          <Field label="从退休到现在一共花了多少">
            <TextField inputMode="decimal" value={spentStr} onChange={(e) => setSpentStr(e.target.value)} onBlur={(e) => saveSpent(e.target.value)} placeholder="0" />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer", height: 36 }}>
            <input type="checkbox" checked={withInterest} onChange={(e) => saveWithInterest(e.target.checked)} />
            叠加账户利率抵消一部分消耗（约 {fmt(annualInterest / 12)}/月）
          </label>
        </div>
        {calc && calc.monthsSince < 1 && (
          <div style={{ fontSize: 11, color: "var(--orange)", marginTop: 10 }}>退休还不到一个月，月均消耗速度先按一个月折算，之后数据多了会更准。</div>
        )}
      </div>

      {!calc ? (
        <div style={{ ...card, padding: "40px 22px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
          填好上面的退休日期和已花费金额，这里会自动算出消耗速度和预测曲线。
        </div>
      ) : (
        <>
          <div className="fv-rise" style={{ ...rise(80), display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
            <Metric label="当前净资产" value={net0} />
            <Metric label="月均消耗速度" value={calc.monthlyBurn} accent="var(--red)" />
            {withInterest && <Metric label="扣除利息后净消耗/月" value={calc.netMonthlyBurn} accent={calc.netMonthlyBurn >= 0 ? "var(--red)" : "var(--green)"} />}
            <div style={{ ...card, padding: "16px 20px", gridColumn: withInterest ? undefined : "span 2" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>预计耗尽时间</div>
              {calc.willDeplete && calc.zeroDate ? (
                <>
                  <div style={{ fontSize: 21, fontWeight: 600, color: "var(--red)", marginTop: 7 }}>{calc.zeroDate.getFullYear()} 年 {calc.zeroDate.getMonth() + 1} 月</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3 }}>约还能维持 {yearsMonths(calc.zeroAt!)}</div>
                </>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--green)", marginTop: 9 }}>按目前速度不会耗尽</div>
              )}
            </div>
          </div>

          <div className="fv-rise" style={{ ...rise(140), ...card, padding: "18px 22px 12px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
              消耗预测曲线{!calc.willDeplete && <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--text-tertiary)" }}>（示意 {FLAT_HORIZON_MONTHS / 12} 年，利息 ≥ 消耗，暂无归零点）</span>}
            </div>
            <DepletionChart series={calc.series} xLabels={xLabels} zeroAt={calc.zeroAt} />
          </div>
        </>
      )}
    </div>
  );
}

function DepletionChart({ series, xLabels, zeroAt }: { series: { label: string; v: number }[]; xLabels: { x: string; label: string }[]; zeroAt: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = 200, padL = 56, padR = 8, padT = 16, padB = 30;
  const n = series.length;

  const X = (i: number) => (n <= 1 ? padL : padL + (i * (W - padL - padR)) / (n - 1));
  const vals = series.map((p) => p.v);
  const min = Math.min(0, ...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const lo = min - span * 0.08, hi = max + span * 0.18;
  const Y = (v: number) => H - padB - ((v - lo) / (hi - lo)) * (H - padT - padB);
  const grid = [0, 1, 2, 3].map((k) => { const gv = hi - ((hi - lo) * k) / 3; return { y: Y(gv), label: fmtWan(Math.round(gv / 1000) * 1000) }; });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const xv = ((e.clientX - rect.left) * W) / rect.width;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(X(i) - xv); if (d < bd) { bd = d; best = i; } }
    setHover(best);
  };

  const path = series.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
  const area = n ? path + ` L${X(n - 1).toFixed(1)} ${H - padB} L${X(0).toFixed(1)} ${H - padB} Z` : "";
  const zx = zeroAt != null ? X(zeroAt) : null;

  const hp = hover != null ? series[hover] : null;
  const hx = hover != null ? X(hover) : 0;
  const hy = hp ? Y(hp.v) : 0;
  const tipLeft = hover != null ? Math.min(Math.max((hx * (ref.current?.clientWidth ?? W)) / W, 56), (ref.current?.clientWidth ?? W) - 56) : 0;
  const tipTop = hover != null ? (((hy * (ref.current?.clientHeight ?? H)) / H) > 56 ? ((hy * (ref.current?.clientHeight ?? H)) / H) - 46 : ((hy * (ref.current?.clientHeight ?? H)) / H) + 14) : 0;

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="fvRetire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W} y1={g.y} y2={g.y} stroke="var(--separator)" strokeWidth="1" />
            <text x={padL - 6} y={g.y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-tertiary)">{g.label}</text>
          </g>
        ))}
        {area && <path key={"a" + area} className="fv-fade-in" d={area} fill="url(#fvRetire)" />}
        {zx != null && <line x1={zx} x2={zx} y1={16} y2={170} stroke="var(--red)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />}
        {zx != null && <text x={zx} y={13} textAnchor="middle" fontSize="10" fill="var(--red)">归零</text>}
        {path && <path key={"p" + path} className="fv-draw-line" pathLength={1} d={path} fill="none" stroke="var(--red)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {hp && <circle cx={hx} cy={Y(hp.v)} r="4.5" fill="var(--red)" stroke="var(--bg-card)" strokeWidth="2.5" />}
        {hover != null && <line x1={hx} x2={hx} y1={16} y2={170} stroke="var(--separator-strong)" strokeWidth="1" strokeDasharray="3 3" />}
        {xLabels.map((x, i) => (
          <text key={i} x={x.x} y="198" textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{x.label}</text>
        ))}
      </svg>
      {hp && (
        <div style={{ position: "absolute", left: tipLeft, top: tipTop, transform: "translateX(-50%)", pointerEvents: "none", background: "var(--bg-card)", border: "0.5px solid var(--separator-strong)", boxShadow: "var(--card-shadow)", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap", zIndex: 2 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 2 }}>{hp.label}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--red)", fontVariantNumeric: "tabular-nums" }}>{fmt(hp.v)}</div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const n = useCountUp(value);
  return (
    <div style={{ ...card, padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 600, color: accent ?? "var(--text-primary)", marginTop: 7, fontVariantNumeric: "tabular-nums" }}>{fmt(n)}</div>
    </div>
  );
}
