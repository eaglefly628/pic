import { useState } from "react";
import type { DevData, HealthData, MealType } from "../../types";
import { card, Btn, inputStyle, Segmented } from "../../ui";
import { IconPlus, IconTrash } from "../../icons";
import { uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;
type Sub = "bp" | "lipid" | "diet";

const todayStr = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const MEALS: MealType[] = ["早餐", "午餐", "晚餐", "加餐"];

function ensureHealth(d: DevData): HealthData {
  if (!d.health) d.health = { bp: [], lipids: [], diet: [] };
  if (!Array.isArray(d.health.bp)) d.health.bp = [];
  if (!Array.isArray(d.health.lipids)) d.health.lipids = [];
  if (!Array.isArray(d.health.diet)) d.health.diet = [];
  return d.health;
}

// 血压分级（中国高血压防治指南简化版，仅供个人参考，不是诊断）。
function classifyBP(s: number, d: number): { label: string; color: string } {
  if (s >= 180 || d >= 110) return { label: "3级高血压", color: "var(--red)" };
  if (s >= 160 || d >= 100) return { label: "2级高血压", color: "var(--red)" };
  if (s >= 140 || d >= 90) return { label: "1级高血压", color: "var(--orange)" };
  if (s >= 120 || d >= 80) return { label: "正常高值", color: "#e0b000" };
  return { label: "正常", color: "var(--green)" };
}
// 血脂参考范围(mmol/L，成人一般标准，仅供参考)。
const LIPID_REF: Record<"tc" | "tg" | "ldl" | "hdl", { high: number; lowIsBad?: boolean; label: string }> = {
  tc: { high: 5.2, label: "总胆固醇" },
  tg: { high: 1.7, label: "甘油三酯" },
  ldl: { high: 3.4, label: "低密度脂蛋白" },
  hdl: { high: 1.0, lowIsBad: true, label: "高密度脂蛋白" },
};
function lipidFlag(key: "tc" | "tg" | "ldl" | "hdl", v?: number) {
  if (v == null) return null;
  const ref = LIPID_REF[key];
  const bad = ref.lowIsBad ? v < ref.high : v > ref.high;
  return { bad, color: bad ? "var(--red)" : "var(--green)" };
}

export default function Health({ data, mut }: { data: DevData; mut: Mut }) {
  const hd = data.health ?? { bp: [], lipids: [], diet: [] };
  const [sub, setSub] = useState<Sub>("bp");

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>健康记录</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.6 }}>血压、血脂、饮食，自己记着看趋势。<strong>仅供个人参考，不是医嘱</strong>，数值异常或不舒服请就医。</div>
      </div>
      <Segmented value={sub} onChange={setSub} style={{ marginBottom: 16, maxWidth: 320 }} options={[{ value: "bp", label: "血压" }, { value: "lipid", label: "血脂" }, { value: "diet", label: "饮食" }]} />
      {sub === "bp" && <BPPanel rows={hd.bp ?? []} mut={mut} />}
      {sub === "lipid" && <LipidPanel rows={hd.lipids ?? []} mut={mut} />}
      {sub === "diet" && <DietPanel rows={hd.diet ?? []} mut={mut} />}
    </div>
  );
}

function BPPanel({ rows, mut }: { rows: HealthData["bp"]; mut: Mut }) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const [date, setDate] = useState(todayStr());
  const [sys, setSys] = useState(""); const [dia, setDia] = useState(""); const [pulse, setPulse] = useState("");
  const add = () => { const s = parseFloat(sys), d = parseFloat(dia); if (!s || !d) return; mut((dd) => { ensureHealth(dd).bp.unshift({ id: uid("bp"), date: date || todayStr(), systolic: s, diastolic: d, pulse: pulse ? parseFloat(pulse) : undefined, createdAt: Date.now() }); }); setSys(""); setDia(""); setPulse(""); setDate(todayStr()); };
  const del = (id: string) => mut((dd) => { const h = ensureHealth(dd); h.bp = h.bp.filter((x) => x.id !== id); });
  const latest = sorted[0];
  const chartRows = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div>
      {latest && (
        <div style={{ ...card, padding: "16px 18px", marginBottom: 14, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Stat label="最近一次" value={`${latest.systolic}/${latest.diastolic}`} sub="mmHg" big />
          <Tag {...classifyBP(latest.systolic, latest.diastolic)} />
          {latest.pulse != null && <Stat label="脉搏" value={`${latest.pulse}`} sub="次/分" />}
        </div>
      )}
      {chartRows.length >= 2 && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>血压趋势（红=高压 · 蓝=低压）</div>
          <BPChart rows={chartRows} />
        </div>
      )}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
        <input type="number" inputMode="decimal" value={sys} onChange={(e) => setSys(e.target.value)} placeholder="高压" style={{ ...inputStyle, width: 80 }} />
        <input type="number" inputMode="decimal" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="低压" style={{ ...inputStyle, width: 80 }} />
        <input type="number" inputMode="decimal" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="脉搏(可选)" style={{ ...inputStyle, width: 110 }} />
        <Btn onClick={add} disabled={!sys || !dia}><IconPlus size={13} stroke="currentColor" /> 记一笔</Btn>
      </div>
      <ListCard rows={sorted.map((r) => ({ id: r.id, date: r.date, main: `${r.systolic}/${r.diastolic} mmHg${r.pulse != null ? ` · ${r.pulse}次/分` : ""}`, tag: classifyBP(r.systolic, r.diastolic) }))} onDel={del} />
    </div>
  );
}

function BPChart({ rows }: { rows: HealthData["bp"] }) {
  const W = 640, H = 130, padL = 32, padR = 10, padT = 10, padB = 20;
  const xs = rows.map((r) => new Date(r.date).getTime());
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const allY = rows.flatMap((r) => [r.systolic, r.diastolic]);
  const minY = Math.min(...allY) - 5, maxY = Math.max(...allY) + 5;
  const X = (x: number) => padL + (maxX > minX ? (x - minX) / (maxX - minX) : 0.5) * (W - padL - padR);
  const Y = (y: number) => padT + (1 - (y - minY) / (maxY - minY)) * (H - padT - padB);
  const lineOf = (key: "systolic" | "diastolic") => rows.map((r, i) => `${i === 0 ? "M" : "L"}${X(new Date(r.date).getTime()).toFixed(1)},${Y(r[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--separator)" strokeWidth={1} />
      <path d={lineOf("systolic")} fill="none" stroke="var(--red)" strokeWidth={2} />
      <path d={lineOf("diastolic")} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {rows.map((r, i) => <circle key={"s" + i} cx={X(new Date(r.date).getTime())} cy={Y(r.systolic)} r={2.4} fill="var(--red)" />)}
      {rows.map((r, i) => <circle key={"d" + i} cx={X(new Date(r.date).getTime())} cy={Y(r.diastolic)} r={2.4} fill="var(--accent)" />)}
    </svg>
  );
}

function LipidPanel({ rows, mut }: { rows: HealthData["lipids"]; mut: Mut }) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const [date, setDate] = useState(todayStr());
  const [tc, setTc] = useState(""); const [tg, setTg] = useState(""); const [ldl, setLdl] = useState(""); const [hdl, setHdl] = useState("");
  const add = () => {
    if (!tc && !tg && !ldl && !hdl) return;
    mut((dd) => { ensureHealth(dd).lipids.unshift({ id: uid("lp"), date: date || todayStr(), tc: tc ? parseFloat(tc) : undefined, tg: tg ? parseFloat(tg) : undefined, ldl: ldl ? parseFloat(ldl) : undefined, hdl: hdl ? parseFloat(hdl) : undefined, createdAt: Date.now() }); });
    setTc(""); setTg(""); setLdl(""); setHdl(""); setDate(todayStr());
  };
  const del = (id: string) => mut((dd) => { const h = ensureHealth(dd); h.lipids = h.lipids.filter((x) => x.id !== id); });
  const latest = sorted[0];

  return (
    <div>
      {latest && (
        <div style={{ ...card, padding: "16px 18px", marginBottom: 14, display: "flex", gap: 22, flexWrap: "wrap" }}>
          {(["tc", "tg", "ldl", "hdl"] as const).map((k) => {
            const v = latest[k]; const flag = lipidFlag(k, v);
            return <Stat key={k} label={LIPID_REF[k].label} value={v != null ? `${v}` : "—"} sub="mmol/L" color={flag ? flag.color : undefined} />;
          })}
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", alignSelf: "flex-end" }}>参考：TC&lt;5.2 · TG&lt;1.7 · LDL&lt;3.4 · HDL&gt;1.0（一般成人标准，仅供参考）</div>
        </div>
      )}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
        <input type="number" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} placeholder="总胆固醇" style={{ ...inputStyle, width: 100 }} />
        <input type="number" inputMode="decimal" value={tg} onChange={(e) => setTg(e.target.value)} placeholder="甘油三酯" style={{ ...inputStyle, width: 100 }} />
        <input type="number" inputMode="decimal" value={ldl} onChange={(e) => setLdl(e.target.value)} placeholder="LDL" style={{ ...inputStyle, width: 90 }} />
        <input type="number" inputMode="decimal" value={hdl} onChange={(e) => setHdl(e.target.value)} placeholder="HDL" style={{ ...inputStyle, width: 90 }} />
        <Btn onClick={add}><IconPlus size={13} stroke="currentColor" /> 记一笔</Btn>
      </div>
      <ListCard rows={sorted.map((r) => ({ id: r.id, date: r.date, main: (["tc", "tg", "ldl", "hdl"] as const).filter((k) => r[k] != null).map((k) => `${LIPID_REF[k].label.slice(0, 2)} ${r[k]}`).join(" · ") || "—" }))} onDel={del} />
    </div>
  );
}

function DietPanel({ rows, mut }: { rows: HealthData["diet"]; mut: Mut }) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const [date, setDate] = useState(todayStr());
  const [meal, setMeal] = useState<MealType>("早餐");
  const [items, setItems] = useState("");
  const add = () => { if (!items.trim()) return; mut((dd) => { ensureHealth(dd).diet.unshift({ id: uid("dt"), date: date || todayStr(), meal, items: items.trim(), createdAt: Date.now() }); }); setItems(""); };
  const del = (id: string) => mut((dd) => { const h = ensureHealth(dd); h.diet = h.diet.filter((x) => x.id !== id); });

  return (
    <div>
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
        <Segmented value={meal} onChange={setMeal} style={{ width: 220 }} options={MEALS.map((m) => ({ value: m, label: m }))} />
        <input value={items} onChange={(e) => setItems(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="吃了什么" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <Btn onClick={add} disabled={!items.trim()}><IconPlus size={13} stroke="currentColor" /> 记一笔</Btn>
      </div>
      <div style={{ ...card, padding: "6px 8px" }}>
        {!sorted.length && <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>还没有记录。</div>}
        {sorted.map((r) => (
          <div key={r.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 9, borderTop: "0.5px solid var(--separator)" }}>
            <span style={{ width: 46, flex: "none", fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{r.date?.slice(5)}</span>
            <span style={{ width: 40, flex: "none", fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>{r.meal}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.items}</span>
            <button onClick={() => del(r.id)} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", flex: "none", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListCard({ rows, onDel }: { rows: { id: string; date: string; main: string; tag?: { label: string; color: string } }[]; onDel: (id: string) => void }) {
  return (
    <div style={{ ...card, padding: "6px 8px" }}>
      {!rows.length && <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>还没有记录。</div>}
      {rows.map((r) => (
        <div key={r.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 9, borderTop: "0.5px solid var(--separator)" }}>
          <span style={{ width: 52, flex: "none", fontSize: 11.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{r.date?.slice(5)}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.main}</span>
          {r.tag && <span style={{ fontSize: 11, fontWeight: 700, color: r.tag.color, background: `color-mix(in srgb, ${r.tag.color} 14%, transparent)`, padding: "2px 8px", borderRadius: 6, flex: "none" }}>{r.tag.label}</span>}
          <button onClick={() => onDel(r.id)} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", flex: "none", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color, big, sub }: { label: string; value: string; color?: string; big?: boolean; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: big ? 23 : 17, fontWeight: 700, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}{sub && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)", marginLeft: 5 }}>{sub}</span>}</div>
    </div>
  );
}
function Tag({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 12, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 14%, transparent)`, padding: "3px 10px", borderRadius: 7 }}>{label}</span>;
}
