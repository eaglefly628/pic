import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVault } from "../vault/VaultContext";
import type { ExpenseItem } from "../vault/types";
import { currentNetWorth, estimateAnnualInterest, netSeries } from "../lib/compute";
import { fmt, fmtWan } from "../lib/format";
import { Btn, Field, Modal, Select, TextField, TextArea, EmptyState, card, uid } from "../ui";
import { useCountUp, rise } from "../lib/anim";
import { IconPlus, IconEdit, IconTrash } from "../icons";
import { useBreakpoint } from "../lib/breakpoint";

const CATS = ["生活", "教育", "医疗", "房贷/房租", "车辆", "旅行", "保险", "大额采购", "其他"];
const YEAR_OPTS = [1, 2, 3, 5, 10, 15, 20, 30, 40];

function expMonthly(e: ExpenseItem): number {
  return e.period === "month" ? e.amount : e.period === "year" ? e.amount / 12 : 0;
}
const ym = (d: Date) => `${String(d.getFullYear()).slice(2)}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymISO = (iso: string) => iso.slice(2, 7).replace("-", "/");
function addMonths(d: Date, n: number) { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; }
const REAL_TAIL = 12; // 图上展示最近 12 个月真实净值
const SNAPSHOT_HORIZON_MONTHS = 24; // 只把未来 24 个月内的预测存成快照留作对比，太远的猜测没意义、也不用无限堆积

export default function Budget() {
  const { data, update } = useVault();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseItem | null>(null);
  const [withInterest, setWithInterest] = useState(true);
  const [years, setYears] = useState(3);

  const phone = useBreakpoint() === "phone";
  const incomes = data?.incomes ?? [];
  const expenses = data?.expenses ?? [];

  const calc = useMemo(() => {
    if (!data) return null;
    const H = years * 12;
    const net0 = currentNetWorth(data.dataset);
    const monthlyIncome = incomes.reduce((s, it) => s + (it.period === "month" ? it.amount : it.amount / 12), 0);
    const recurringMonthly = expenses.reduce((s, e) => s + expMonthly(e), 0);
    const annualInterest = estimateAnnualInterest(data.dataset);
    const monthlyInterest = withInterest ? annualInterest / 12 : 0;
    const once = expenses.filter((e) => e.period === "once" && e.date);
    const monthlyNet = monthlyIncome - recurringMonthly + monthlyInterest;

    const now = new Date();
    // 预测段（从今天起 H 个月）
    const proj: { label: string; v: number }[] = [{ label: ym(now), v: net0 }];
    let v = net0;
    for (let m = 1; m <= H; m++) {
      const d = addMonths(now, m);
      v += monthlyNet;
      for (const e of once) {
        const [y, mo] = e.date!.split("-");
        if (Number(y) === d.getFullYear() && Number(mo) === d.getMonth() + 1) v -= e.amount;
      }
      proj.push({ label: ym(d), v });
    }
    // 真实段（最近若干个月的实际净值）；同时把这个月「当初预测过」的值(如果有)一起带上，
    // 好在真实值旁边画出那条本该保留的历史虚线，而不是被真实值一覆盖就消失。
    const predMap = new Map((data.forecastHistory ?? []).map((f) => [f.forMonth, f.predictedNet] as const));
    const real = netSeries(data.dataset).slice(-REAL_TAIL).map((p) => {
      const label = ymISO(p.date);
      return { label, real: p.v, pred: predMap.get(label) };
    });
    // 预测段（未来、且还没有真实值的月份）。proj 是按"今天"往后算的，不会管某个月是不是
    // 已经补录过真实值——万一提前给未来某个月记过真实余额(比如把 real 补到了比系统日期更晚)，
    // 这个月要从"未来预测"里排掉，不然会跟 real 里那个月重复出现，还会在下面 toPersist 那一步
    // 用重新算出来的"新预测"把已经冻结的历史预测值覆盖掉。
    const realLabels = new Set(real.map((p) => p.label));
    const futureProj = proj.slice(1).filter((p) => !realLabels.has(p.label));
    const future = futureProj.map((p) => ({ label: p.label, real: undefined as number | undefined, pred: p.v }));
    const series = [...real, ...future];
    const boundary = Math.max(0, real.length - 1); // 真实/预测分界（今天）
    // 只有「未来、还没变成现实」的部分才值得存成快照——存太远的没意义，见 SNAPSHOT_HORIZON_MONTHS
    const toPersist = futureProj.slice(0, SNAPSHOT_HORIZON_MONTHS);
    return { net0, monthlyIncome, recurringMonthly, monthlyInterest, monthlyNet, series, boundary, annualInterest, toPersist };
  }, [data, incomes, expenses, withInterest, years]);

  // 把「未来若干月」的预测冻结存盘：该月还没有真实记录时持续用最新假设覆写；
  // 一旦这个月有了真实记录，proj 就不会再生成它，写入自然停止——最后一次的值就此冻结，
  // 留作跟真实值对比的历史虚线（不再像以前那样，实际值一出现，旧预测就凭空消失）。
  useEffect(() => {
    if (!data || !calc) return;
    const existing = data.forecastHistory ?? [];
    const changed = calc.toPersist.filter((p) => {
      const ex = existing.find((f) => f.forMonth === p.label);
      return !ex || ex.predictedNet !== p.v;
    });
    if (!changed.length) return;
    update((d) => {
      d.forecastHistory = d.forecastHistory ?? [];
      const now = Date.now();
      for (const p of changed) {
        const ex = d.forecastHistory.find((f) => f.forMonth === p.label);
        if (ex) { ex.predictedNet = p.v; ex.updatedAt = now; }
        else d.forecastHistory.push({ forMonth: p.label, predictedNet: p.v, updatedAt: now });
      }
    });
  }, [calc, data, update]);

  if (!data || !calc) return null;
  const n = calc.series.length;
  const xAt = (i: number) => (n <= 1 ? 56 : 56 + (i * (600 - 56 - 8)) / (n - 1));
  const idxs = Array.from(new Set([0, 1, 2, 3, 4, 5, 6].map((k) => Math.round((k * (n - 1)) / 6))));
  const xLabels = idxs.map((i) => ({ x: xAt(i).toFixed(1), label: calc.series[i].label }));
  const at = (m: number) => { const p = calc.series[Math.min(calc.boundary + m, calc.series.length - 1)]; return p.pred ?? p.real ?? 0; };

  const remove = (id: string) => update((d) => { d.expenses = (d.expenses ?? []).filter((x) => x.id !== id); });

  return (
    <div style={{ padding: phone ? "16px 14px 28px" : "24px 32px 40px" }}>
      <div className="fv-rise" style={{ ...rise(0), display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        <Metric label="当前净资产" value={calc.net0} />
        <Metric label="每月净现金流" value={calc.monthlyNet} accent={calc.monthlyNet >= 0 ? "var(--green)" : "var(--red)"} />
        <Metric label="预计 1 年后" value={at(12)} />
        <Metric label={`预计 ${years} 年后`} value={at(years * 12)} />
      </div>

      {/* 预测图 */}
      <div className="fv-rise" style={{ ...rise(80), ...card, padding: phone ? "16px 16px 10px" : "18px 22px 12px", marginBottom: phone ? 14 : 18 }}>
        <div style={{ display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "center", justifyContent: "space-between", gap: phone ? 10 : 0, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>资产预测（未来 {years} 年）</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>净资产 + 收入 − 开销{withInterest ? " + 利息" : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: phone ? 10 : 14, justifyContent: phone ? "space-between" : "flex-start", flex: "none" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer", minWidth: 0 }}>
              <input type="checkbox" checked={withInterest} onChange={(e) => setWithInterest(e.target.checked)} />
              叠加利息（约 {fmt(calc.annualInterest / 12)}/月）
            </label>
            <Select value={String(years)} style={{ width: 92, height: 32 }} options={YEAR_OPTS.map((y) => ({ value: String(y), label: `${y} 年` }))} onChange={(e) => setYears(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)" }}><span style={{ width: 14, height: 3, borderRadius: 2, background: "var(--green)" }} />真实净值</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)" }}><span style={{ width: 14, height: 0, borderTop: "2px dashed var(--accent)" }} />预测（含历史对比）</span>
        </div>
        <ForecastChart series={calc.series} xLabels={xLabels} boundary={calc.boundary} />
      </div>

      {/* 开销列表 */}
      <div className="fv-rise" style={{ ...rise(160), display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>未来预期开销 · 折合每月 {fmt(calc.recurringMonthly)}</div>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => { setEditing(null); setOpen(true); }}><IconPlus />新增开销</Btn>
      </div>

      {expenses.length === 0 ? (
        <EmptyState text="还没有预期开销" action={<Btn variant="soft" onClick={() => { setEditing(null); setOpen(true); }}>添加第一项</Btn>} />
      ) : (
        <div className="fv-rise" style={{ ...rise(220), ...card, overflow: "hidden" }}>
          {expenses.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "12px 22px", borderTop: i === 0 ? "none" : "0.5px solid var(--separator)", fontSize: 13 }}>
              <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500 }}>{e.name}</span>
              <span style={{ width: 90, fontSize: 11.5, color: "var(--text-secondary)" }}>{e.category}</span>
              <span style={{ width: 110, fontSize: 11.5, color: "var(--text-tertiary)" }}>{e.period === "month" ? "每月" : e.period === "year" ? "每年" : `一次 · ${e.date ?? ""}`}</span>
              <span style={{ width: 130, textAlign: "right", fontWeight: 600, color: "var(--red)", fontVariantNumeric: "tabular-nums" }}>{fmt(e.amount)}</span>
              <span style={{ width: 70, display: "flex", justifyContent: "flex-end", gap: 4 }}>
                <button onClick={() => { setEditing(e); setOpen(true); }} title="编辑" className="fv-icnbtn" style={mini}><IconEdit size={14} stroke="var(--text-secondary)" /></button>
                <button onClick={() => remove(e.id)} title="删除" className="fv-icnbtn" style={mini}><IconTrash size={14} stroke="var(--red)" /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Editor open={open} initial={editing} onClose={() => setOpen(false)} onSave={(vals) => {
        update((d) => {
          d.expenses = d.expenses ?? [];
          if (editing) { const it = d.expenses.find((x) => x.id === editing.id); if (it) Object.assign(it, vals, { updatedAt: Date.now() }); }
          else { const now = Date.now(); d.expenses.push({ id: uid("exp"), ...vals, createdAt: now, updatedAt: now }); }
        });
        setOpen(false);
      }} />
    </div>
  );
}

type FPoint = { label: string; real?: number; pred?: number };

// 净资产预测图：真实值(实线) + 预测值(虚线)。跟以前不一样的地方——预测虚线不再是
// "还没发生的部分才画"，而是只要存过预测快照，哪怕这个月已经有真实值了，虚线也继续画在
// 真实线旁边，方便直接对比"当初预测的"和"后来实际发生的"。两条线的取值可能不同，
// 所以坐标系要按两条线的值一起算，不能只按其中一条来定量程范围。
function ForecastChart({ series, xLabels, boundary }: { series: FPoint[]; xLabels: { x: string; label: string }[]; boundary: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = 200, padL = 56, padR = 8, padT = 16, padB = 30;
  const n = series.length;

  const X = (i: number) => (n <= 1 ? padL : padL + (i * (W - padL - padR)) / (n - 1));
  const allVals = series.flatMap((p) => [p.real, p.pred]).filter((v): v is number => v != null);
  const min = allVals.length ? Math.min(...allVals) : 0;
  const max = allVals.length ? Math.max(...allVals) : 0;
  const span = max - min || 1;
  const lo = min - span * 0.18, hi = max + span * 0.18;
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

  // 真实段：0..boundary，天然连续
  const realPath = series.slice(0, boundary + 1).map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.real!).toFixed(1)).join(" ");
  // 预测虚线：全区间里只要有 pred 就连，中间断档(没存过快照的月份)就断开另起一段，不瞎连
  let predPath = "", prevI: number | null = null;
  series.forEach((p, i) => {
    if (p.pred == null) return;
    predPath += (prevI === null || i !== prevI + 1 ? "M" : "L") + X(i).toFixed(1) + " " + Y(p.pred).toFixed(1) + " ";
    prevI = i;
  });
  // 面积底色：真实段 + 未来预测段（历史对比虚线不重复参与填色，避免视觉上叠两层）
  const areaMain = series.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(i <= boundary ? p.real! : p.pred!).toFixed(1)).join(" ");
  const area = n ? areaMain + ` L${X(n - 1).toFixed(1)} ${H - padB} L${X(0).toFixed(1)} ${H - padB} Z` : "";
  const bx = X(boundary);

  const hp = hover != null ? series[hover] : null;
  const hx = hover != null ? X(hover) : 0;
  const tipLeft = hover != null ? Math.min(Math.max((hx * (ref.current?.clientWidth ?? W)) / W, 56), (ref.current?.clientWidth ?? W) - 56) : 0;
  const hy = hp ? Y(hp.real ?? hp.pred ?? 0) : 0;
  const tipTop = hover != null ? (((hy * (ref.current?.clientHeight ?? H)) / H) > 56 ? ((hy * (ref.current?.clientHeight ?? H)) / H) - (hp?.real != null && hp?.pred != null ? 66 : 50) : ((hy * (ref.current?.clientHeight ?? H)) / H) + 14) : 0;

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="fvBudget" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W} y1={g.y} y2={g.y} stroke="var(--separator)" strokeWidth="1" />
            <text x={padL - 6} y={g.y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-tertiary)">{g.label}</text>
          </g>
        ))}
        {area && <path key={"a" + area} className="fv-fade-in" d={area} fill="url(#fvBudget)" />}
        {/* 今天分界线 */}
        {boundary > 0 && <line x1={bx} x2={bx} y1={16} y2={170} stroke="var(--separator-strong)" strokeWidth="1" />}
        {boundary > 0 && <text x={bx} y={13} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)">今天</text>}
        {/* 真实段（实线绿）+ 预测（虚线蓝，历史对比 + 未来投影都在内） */}
        {boundary > 0 && <path key={"r" + realPath} className="fv-draw-line" pathLength={1} d={realPath} fill="none" stroke="var(--green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {predPath && <path key={"p" + predPath} className="fv-fade-in" d={predPath} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />}
        {hp && hp.real != null && <circle cx={hx} cy={Y(hp.real)} r="4.5" fill="var(--green)" stroke="var(--bg-card)" strokeWidth="2.5" />}
        {hp && hp.pred != null && <circle cx={hx} cy={Y(hp.pred)} r="4.5" fill="var(--accent)" stroke="var(--bg-card)" strokeWidth="2.5" />}
        {hover != null && <line x1={hx} x2={hx} y1={16} y2={170} stroke="var(--separator-strong)" strokeWidth="1" strokeDasharray="3 3" />}
        {xLabels.map((x, i) => (
          <text key={i} x={x.x} y="198" textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{x.label}</text>
        ))}
      </svg>
      {hp && (
        <div style={{ position: "absolute", left: tipLeft, top: tipTop, transform: "translateX(-50%)", pointerEvents: "none", background: "var(--bg-card)", border: "0.5px solid var(--separator-strong)", boxShadow: "var(--card-shadow)", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap", zIndex: 2 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 2 }}>{hp.label}</div>
          {hp.real != null && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>真实 {fmt(hp.real)}</div>}
          {hp.pred != null && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>预测{hp.real != null ? "(当时)" : ""} {fmt(hp.pred)}</div>}
        </div>
      )}
    </div>
  );
}

const mini: React.CSSProperties = { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "var(--fill-quaternary)", border: "none", cursor: "pointer" };

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const n = useCountUp(value);
  const phone = useBreakpoint() === "phone";
  return (
    <div style={{ ...card, padding: phone ? "14px 14px" : "16px 20px", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontSize: phone ? 17 : 21, fontWeight: 600, color: accent ?? "var(--text-primary)", marginTop: 7, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmt(n)}</div>
    </div>
  );
}

type Vals = Omit<ExpenseItem, "id" | "createdAt" | "updatedAt">;
function Editor({ open, initial, onClose, onSave }: { open: boolean; initial: ExpenseItem | null; onClose: () => void; onSave: (v: Vals) => void }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [period, setPeriod] = useState<"month" | "year" | "once">("month");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [category, setCategory] = useState(CATS[0]); const [note, setNote] = useState("");
  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? ""); setAmount(initial ? String(initial.amount) : ""); setPeriod(initial?.period ?? "month");
    setDate(initial?.date ?? new Date().toISOString().slice(0, 10)); setCategory(initial?.category ?? CATS[0]); setNote(initial?.note ?? "");
  }, [open, initial]);
  const submit = () => { if (!name.trim()) return; onSave({ name: name.trim(), amount: parseFloat(amount.replace(/[^0-9.\-]/g, "")) || 0, period, date: period === "once" ? date : undefined, category, note }); };
  return (
    <Modal open={open} title={initial ? "编辑开销" : "新增开销"} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>取消</Btn><Btn onClick={submit}>保存</Btn></>}>
      <Field label="名称"><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="如 房贷月供" autoFocus /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
        <Field label="金额"><TextField value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} inputMode="decimal" placeholder="0" /></Field>
        <Field label="周期"><Select value={period} options={[{ value: "month", label: "每月" }, { value: "year", label: "每年" }, { value: "once", label: "一次性" }]} onChange={(e) => setPeriod(e.target.value as "month" | "year" | "once")} /></Field>
        <Field label="分类"><Select value={category} options={CATS.map((c) => ({ value: c, label: c }))} onChange={(e) => setCategory(e.target.value)} /></Field>
      </div>
      {period === "once" && <Field label="发生日期"><TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
      <Field label="备注（可选）"><TextArea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}
