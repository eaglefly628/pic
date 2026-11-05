import { useState } from "react";
import type { DevData, FitnessData } from "../../types";
import { card, Btn, inputStyle } from "../../ui";
import { IconPlus, IconTrash } from "../../icons";
import { uid, LineChart } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

const todayStr = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const daysUntil = (dateStr?: string) => { if (!dateStr) return null; const t = new Date(dateStr + "T00:00:00"); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.ceil((t.getTime() - now.getTime()) / 86400000); };

function ensureFitness(d: DevData): FitnessData {
  if (!d.fitness) d.fitness = { entries: [] };
  if (!Array.isArray(d.fitness.entries)) d.fitness.entries = [];
  return d.fitness;
}

export default function Fitness({ data, mut }: { data: DevData; mut: Mut }) {
  const fd = data.fitness ?? { entries: [] };
  const entries = [...(fd.entries ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  const goal = fd.goal ?? {};

  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [date, setDate] = useState(todayStr());

  const addEntry = () => {
    const w = parseFloat(weight);
    if (!w || w <= 0) return;
    mut((d) => { ensureFitness(d).entries.unshift({ id: uid("wt"), date: date || todayStr(), weight: w, bodyFat: bodyFat ? parseFloat(bodyFat) : undefined, createdAt: Date.now() }); });
    setWeight(""); setBodyFat(""); setDate(todayStr());
  };
  const delEntry = (id: string) => mut((d) => { const f = ensureFitness(d); f.entries = f.entries.filter((x) => x.id !== id); });
  const setGoal = (patch: Partial<typeof goal>) => mut((d) => { const f = ensureFitness(d); f.goal = { ...f.goal, ...patch }; });

  const latest = entries[entries.length - 1];
  const first = entries[0];
  const bmi = goal.heightCm && latest ? latest.weight / ((goal.heightCm / 100) ** 2) : null;
  const bmiTag = bmi == null ? null : bmi < 18.5 ? { t: "偏瘦", c: "var(--accent)" } : bmi < 24 ? { t: "正常", c: "var(--green)" } : bmi < 28 ? { t: "偏重", c: "var(--orange)" } : { t: "肥胖", c: "var(--red)" };
  const toGo = goal.targetWeight != null && latest ? latest.weight - goal.targetWeight : null;
  const dLeft = daysUntil(goal.targetDate);
  const weeklyRate = toGo != null && toGo > 0 && dLeft != null && dLeft > 0 ? toGo / (dLeft / 7) : null;

  const chartPoints = entries.map((e) => ({ x: new Date(e.date).getTime(), y: e.weight }));

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>健身 · 体重管理</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.6 }}>记体重、看趋势。设身高算 BMI，设目标体重 + 日期算该多快减(周均)。</div>
      </div>

      <div style={{ ...card, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <Stat label="当前体重" value={latest ? `${latest.weight} kg` : "—"} big />
          {first && latest && entries.length > 1 && <Stat label="累计变化" value={`${latest.weight - first.weight >= 0 ? "+" : ""}${(latest.weight - first.weight).toFixed(1)} kg`} color={latest.weight - first.weight <= 0 ? "var(--green)" : "var(--orange)"} />}
          {bmi != null && <Stat label="BMI" value={bmi.toFixed(1)} color={bmiTag?.c} sub={bmiTag?.t} />}
          <div style={{ flex: 1 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5 }}>
          <span style={{ color: "var(--text-tertiary)" }}>身高</span>
          <input type="number" inputMode="decimal" defaultValue={goal.heightCm ?? ""} onBlur={(e) => setGoal({ heightCm: parseFloat(e.target.value) || undefined })} placeholder="cm" style={{ ...inputStyle, width: 80, padding: "5px 8px" }} />
          <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>目标体重</span>
          <input type="number" inputMode="decimal" defaultValue={goal.targetWeight ?? ""} onBlur={(e) => setGoal({ targetWeight: parseFloat(e.target.value) || undefined })} placeholder="kg" style={{ ...inputStyle, width: 80, padding: "5px 8px" }} />
          <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>目标日期</span>
          <input type="date" defaultValue={goal.targetDate ?? ""} onChange={(e) => setGoal({ targetDate: e.target.value || undefined })} style={{ ...inputStyle, width: 148, padding: "5px 8px" }} />
        </div>
        {toGo != null && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-secondary)" }}>
            {toGo <= 0 ? <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ 已达到目标体重</span> : dLeft == null ? (
              <span>还差 <strong>{toGo.toFixed(1)} kg</strong> 到目标（没定日期）</span>
            ) : dLeft < 0 ? (
              <span style={{ color: "var(--red)" }}>已过期 {-dLeft} 天，还差 {toGo.toFixed(1)} kg</span>
            ) : (
              <span>还差 <strong>{toGo.toFixed(1)} kg</strong> · 距目标 <strong>{dLeft}</strong> 天 · 需周均减 <strong style={{ color: (weeklyRate ?? 0) > 1 ? "var(--red)" : "var(--accent)" }}>{weeklyRate?.toFixed(2)} kg/周</strong>{(weeklyRate ?? 0) > 1 && <span style={{ color: "var(--red)" }}>（偏快，一般建议 ≤1kg/周，别硬来）</span>}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>体重趋势</div>
        <LineChart points={chartPoints} unit="kg" />
      </div>

      <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
        <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }} placeholder="体重 kg" style={{ ...inputStyle, width: 100 }} />
        <input type="number" inputMode="decimal" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }} placeholder="体脂% (可选)" style={{ ...inputStyle, width: 120 }} />
        <Btn onClick={addEntry} disabled={!weight}><IconPlus size={14} stroke="currentColor" /> 记一笔</Btn>
      </div>

      <div style={{ ...card, padding: "6px 8px" }}>
        {!entries.length && <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>还没有记录。</div>}
        {[...entries].reverse().map((e) => (
          <div key={e.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 9, borderTop: "0.5px solid var(--separator)" }}>
            <span style={{ width: 52, flex: "none", fontSize: 11.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{e.date?.slice(5)}</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{e.weight} kg{e.bodyFat != null && <span style={{ fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>体脂 {e.bodyFat}%</span>}</span>
            <button onClick={() => delEntry(e.id)} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", flex: "none", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color, big, sub }: { label: string; value: string; color?: string; big?: boolean; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: big ? 23 : 18, fontWeight: 700, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}{sub && <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6 }}>{sub}</span>}</div>
    </div>
  );
}
