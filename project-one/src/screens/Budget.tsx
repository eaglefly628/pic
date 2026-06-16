import React, { useMemo, useRef, useState } from "react";
import { useVault } from "../vault/VaultContext";
import type { ExpenseItem } from "../vault/types";
import { buildChart, currentNetWorth, estimateAnnualInterest, netSeries, type ChartGeom } from "../lib/compute";
import { fmt } from "../lib/format";
import { Btn, Field, Modal, Select, TextField, TextArea, EmptyState, card, uid } from "../ui";
import { IconPlus, IconEdit, IconTrash } from "../icons";

const CATS = ["生活", "教育", "医疗", "房贷/房租", "车辆", "旅行", "保险", "大额采购", "其他"];
const YEAR_OPTS = [1, 2, 3, 5, 10, 15, 20, 30, 40];

function expMonthly(e: ExpenseItem): number {
  return e.period === "month" ? e.amount : e.period === "year" ? e.amount / 12 : 0;
}
const ym = (d: Date) => `${String(d.getFullYear()).slice(2)}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymISO = (iso: string) => iso.slice(2, 7).replace("-", "/");
function addMonths(d: Date, n: number) { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; }
const REAL_TAIL = 12; // 图上展示最近 12 个月真实净值

export default function Budget() {
  const { data, update } = useVault();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseItem | null>(null);
  const [withInterest, setWithInterest] = useState(true);
  const [years, setYears] = useState(3);

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
    // 真实段（最近若干个月的实际净值）
    const real = netSeries(data.dataset).slice(-REAL_TAIL).map((p) => ({ label: ymISO(p.date), v: p.v }));
    const series = [...real, ...proj.slice(1)];
    const boundary = Math.max(0, real.length - 1); // 真实/预测分界（今天）
    return { net0, monthlyIncome, recurringMonthly, monthlyInterest, monthlyNet, series, boundary, annualInterest };
  }, [data, incomes, expenses, withInterest, years]);

  if (!data || !calc) return null;
  const chart = buildChart(calc.series.map((p) => p.v), 600, 200, 56, 8, 16, 30);
  const n = calc.series.length;
  const idxs = Array.from(new Set([0, 1, 2, 3, 4, 5, 6].map((k) => Math.round((k * (n - 1)) / 6))));
  const xLabels = idxs.map((i) => ({ x: chart.pts[i].x.toFixed(1), label: calc.series[i].label }));
  const at = (m: number) => calc.series[Math.min(calc.boundary + m, calc.series.length - 1)].v;

  const remove = (id: string) => update((d) => { d.expenses = (d.expenses ?? []).filter((x) => x.id !== id); });

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        <Metric label="当前净资产" value={fmt(calc.net0)} />
        <Metric label="每月净现金流" value={fmt(calc.monthlyNet)} accent={calc.monthlyNet >= 0 ? "var(--green)" : "var(--red)"} />
        <Metric label="预计 1 年后" value={fmt(at(12))} />
        <Metric label={`预计 ${years} 年后`} value={fmt(at(years * 12))} />
      </div>

      {/* 预测图 */}
      <div style={{ ...card, padding: "18px 22px 12px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>资产预测（未来 {years} 年）</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>净资产 + 收入 − 开销{withInterest ? " + 利息" : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={withInterest} onChange={(e) => setWithInterest(e.target.checked)} />
              叠加利息（约 {fmt(calc.annualInterest / 12)}/月）
            </label>
            <Select value={String(years)} style={{ width: 92, height: 32 }} options={YEAR_OPTS.map((y) => ({ value: String(y), label: `${y} 年` }))} onChange={(e) => setYears(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)" }}><span style={{ width: 14, height: 3, borderRadius: 2, background: "var(--green)" }} />真实净值</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)" }}><span style={{ width: 14, height: 0, borderTop: "2px dashed var(--accent)" }} />预测</span>
        </div>
        <ForecastChart chart={chart} series={calc.series} xLabels={xLabels} boundary={calc.boundary} />
      </div>

      {/* 开销列表 */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>未来预期开销 · 折合每月 {fmt(calc.recurringMonthly)}</div>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => { setEditing(null); setOpen(true); }}><IconPlus />新增开销</Btn>
      </div>

      {expenses.length === 0 ? (
        <EmptyState text="还没有预期开销" action={<Btn variant="soft" onClick={() => { setEditing(null); setOpen(true); }}>添加第一项</Btn>} />
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          {expenses.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "12px 22px", borderTop: i === 0 ? "none" : "0.5px solid var(--separator)", fontSize: 13 }}>
              <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500 }}>{e.name}</span>
              <span style={{ width: 90, fontSize: 11.5, color: "var(--text-secondary)" }}>{e.category}</span>
              <span style={{ width: 110, fontSize: 11.5, color: "var(--text-tertiary)" }}>{e.period === "month" ? "每月" : e.period === "year" ? "每年" : `一次 · ${e.date ?? ""}`}</span>
              <span style={{ width: 130, textAlign: "right", fontWeight: 600, color: "var(--red)", fontVariantNumeric: "tabular-nums" }}>{fmt(e.amount)}</span>
              <span style={{ width: 70, display: "flex", justifyContent: "flex-end", gap: 4 }}>
                <button onClick={() => { setEditing(e); setOpen(true); }} title="编辑" style={mini}><IconEdit size={14} stroke="var(--text-secondary)" /></button>
                <button onClick={() => remove(e.id)} title="删除" style={mini}><IconTrash size={14} stroke="var(--red)" /></button>
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

function ForecastChart({ chart, series, xLabels, boundary }: { chart: ChartGeom; series: { label: string; v: number }[]; xLabels: { x: string; label: string }[]; boundary: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const pts = chart.pts;
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || pts.length === 0) return;
    const rect = el.getBoundingClientRect();
    const xv = ((e.clientX - rect.left) * 600) / rect.width;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - xv); if (d < bd) { bd = d; best = i; } });
    setHover({ i: best, px: (pts[best].x * rect.width) / 600, py: (pts[best].y * rect.height) / 200 });
  };
  const hp = hover ? pts[hover.i] : null;
  const tipLeft = hover ? Math.min(Math.max(hover.px, 56), (ref.current?.clientWidth ?? 600) - 56) : 0;
  const tipTop = hover ? (hover.py > 56 ? hover.py - 50 : hover.py + 14) : 0;

  const pathOf = (arr: { x: number; y: number }[]) => arr.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const realPts = pts.slice(0, boundary + 1);
  const predPts = pts.slice(boundary); // 含分界点以连接
  const bx = pts[boundary]?.x ?? 0;
  const isReal = hover ? hover.i <= boundary : false;

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: "100%", height: 200, display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="fvBudget" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {chart.grid.map((g, i) => (
          <g key={i}>
            <line x1="56" x2="600" y1={g.y} y2={g.y} stroke="var(--separator)" strokeWidth="1" />
            <text x="50" y={g.ty} textAnchor="end" fontSize="10.5" fill="var(--text-tertiary)">{g.label}</text>
          </g>
        ))}
        <path d={chart.area} fill="url(#fvBudget)" />
        {/* 今天分界线 */}
        {boundary > 0 && <line x1={bx} x2={bx} y1={16} y2={170} stroke="var(--separator-strong)" strokeWidth="1" />}
        {boundary > 0 && <text x={bx} y={13} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)">今天</text>}
        {/* 真实段（实线绿）+ 预测段（虚线蓝） */}
        {realPts.length > 1 && <path d={pathOf(realPts)} fill="none" stroke="var(--green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {predPts.length > 1 && <path d={pathOf(predPts)} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />}
        {hp && <line x1={hp.x} x2={hp.x} y1={16} y2={170} stroke="var(--separator-strong)" strokeWidth="1" strokeDasharray="3 3" />}
        {hp && <circle cx={hp.x} cy={hp.y} r="4.5" fill={isReal ? "var(--green)" : "var(--accent)"} stroke="var(--bg-card)" strokeWidth="2.5" />}
        {xLabels.map((x, i) => (
          <text key={i} x={x.x} y="198" textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{x.label}</text>
        ))}
      </svg>
      {hover && hp && (
        <div style={{ position: "absolute", left: tipLeft, top: tipTop, transform: "translateX(-50%)", pointerEvents: "none", background: "var(--bg-card)", border: "0.5px solid var(--separator-strong)", boxShadow: "var(--card-shadow)", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap", zIndex: 2 }}>
          <div style={{ fontSize: 10.5, color: isReal ? "var(--green)" : "var(--accent)", fontWeight: 600 }}>{series[hover.i].label} · {isReal ? "真实" : "预测"}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(series[hover.i].v)}</div>
        </div>
      )}
    </div>
  );
}

const mini: React.CSSProperties = { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "var(--fill-quaternary)", border: "none", cursor: "pointer" };

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 600, color: accent ?? "var(--text-primary)", marginTop: 7, fontVariantNumeric: "tabular-nums" }}>{value}</div>
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
