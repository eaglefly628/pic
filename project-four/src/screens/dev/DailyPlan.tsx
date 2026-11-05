import { useEffect, useState } from "react";
import type { DevData } from "../../types";
import { card } from "../../ui";

type Plan = NonNullable<DevData["dailyPlan"]>;
type Module = Plan["modules"][number];
type Mut = (fn: (data: DevData) => void) => Promise<void>;
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const empty = (): Plan => ({ modules: [{ id: "reading", name: "阅读", icon: "📚", minutes: 15, target: 1, frequency: "daily" }], sessions: [], selectedDays: {} });
const ensure = (d: DevData) => d.dailyPlan ?? (d.dailyPlan = empty());
const secondsLeft = (active: Plan["active"], now: number) => active ? Math.max(0, active.remainingSeconds - (active.startedAt ? Math.floor((now - active.startedAt) / 1000) : 0)) : 0;
const nice = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const pill: React.CSSProperties = { padding: "8px 12px", border: "1px solid var(--separator)", borderRadius: 9, background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 12, fontWeight: 600 };

export default function DailyPlan({ data, mut }: { data: DevData; mut: Mut }) {
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<"today" | "stats" | "setup">("today");
  const [monthShift, setMonthShift] = useState(0);
  const [form, setForm] = useState({ name: "", icon: "✨", minutes: 15, target: 1, frequency: "daily" as Module["frequency"] });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(timer); }, []);
  const plan = data.dailyPlan ?? empty();
  const today = day(new Date(now));
  const selected = plan.selectedDays[today] ?? [];
  const visible = plan.modules.filter((m) => !m.archived && (m.frequency === "daily" || selected.includes(m.id)));
  const logs = plan.sessions.filter((s) => s.day === today);
  const count = (id: string) => logs.filter((s) => s.moduleId === id && s.completed).length;
  const completed = visible.filter((m) => count(m.id) >= m.target).length;
  const active = plan.active;
  const current = plan.modules.find((m) => m.id === active?.moduleId);
  const remaining = secondsLeft(active, now);
  const todaySeconds = logs.reduce((sum, log) => sum + log.seconds, 0);
  const finish = async (completed: boolean) => {
    if (!active) return;
    const module = plan.modules.find((m) => m.id === active.moduleId);
    if (!module) return;
    const used = Math.max(0, module.minutes * 60 - remaining);
    await mut((d) => { const p = ensure(d); p.sessions.push({ id: crypto.randomUUID(), moduleId: module.id, day: today, seconds: used, completed }); delete p.active; });
  };
  const start = (m: Module) => mut((d) => { ensure(d).active = { moduleId: m.id, remainingSeconds: m.minutes * 60, startedAt: Date.now() }; });
  const pause = () => mut((d) => { const a = ensure(d).active; if (a) { a.remainingSeconds = secondsLeft(a, Date.now()); delete a.startedAt; } });
  const resume = () => mut((d) => { const a = ensure(d).active; if (a) a.startedAt = Date.now(); });
  const mark = (m: Module) => mut((d) => { ensure(d).sessions.push({ id: crypto.randomUUID(), moduleId: m.id, day: today, seconds: 0, completed: true }); });
  const add = async () => {
    const name = form.name.trim();
    if (!name) { setError("请填写模块名称"); return; }
    if (form.minutes < 1 || form.minutes > 15 || !Number.isInteger(form.minutes)) { setError("单次时长须为 1 至 15 分钟"); return; }
    await mut((d) => { const p = ensure(d); const value = { id: editingId ?? crypto.randomUUID(), name, icon: form.icon.trim() || "✨", minutes: form.minutes, target: Math.max(1, Math.min(12, form.target)), frequency: form.frequency }; if (editingId) p.modules = p.modules.map((m) => m.id === editingId ? value : m); else p.modules.push(value); });
    setForm({ name: "", icon: "✨", minutes: 15, target: 1, frequency: "daily" }); setShowForm(false); setEditingId(null); setError("");
  };
  const month = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + monthShift, 1);
  const prefix = day(month).slice(0, 7);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthLogs = plan.sessions.filter((s) => s.day.startsWith(prefix));
  const dailyCount = Array.from({ length: days }, (_, i) => monthLogs.filter((s) => s.day === `${prefix}-${String(i + 1).padStart(2, "0")}` && s.completed).length);
  return <div style={{ display: "grid", gap: 18 }}>
    <div><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>不排固定时刻 · 按模块行动</div><h1 style={{ fontSize: 24, margin: "5px 0" }}>每日模块</h1><div style={{ color: "var(--text-secondary)", fontSize: 13 }}>每次专注最多 15 分钟；只有你点击完成，才计入完成记录。</div></div>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{([ ["today", "今天"], ["stats", "月度追踪"], ["setup", "模块设置"] ] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} style={{ ...pill, background: tab === key ? "var(--accent)" : "var(--bg-elevated)", color: tab === key ? "white" : "var(--text-primary)" }}>{label}</button>)}</div>
    {tab === "today" && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        <div style={{ ...card, padding: 20 }}><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{today}</div><h2 style={{ margin: "6px 0 12px", fontSize: 20 }}>今天想推进什么？</h2><div style={{ fontSize: 13 }}>完成模块 {completed}/{visible.length} · 专注 {Math.round(todaySeconds / 60)} 分钟 · {logs.length} 次记录</div><div style={{ marginTop: 14, height: 7, borderRadius: 8, background: "var(--fill)" }}><div style={{ width: `${visible.length ? 100 * completed / visible.length : 0}%`, height: "100%", borderRadius: 8, background: "var(--accent)" }} /></div></div>
        <div style={{ ...card, padding: 20 }}><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>当前专注</div><div style={{ fontSize: 31, fontVariantNumeric: "tabular-nums", fontWeight: 700, margin: "6px 0" }}>{nice(active ? remaining : 15 * 60)}</div><div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{current ? `${current.icon} ${current.name}${remaining === 0 ? " · 时间已到，请确认" : ""}` : "选择下方模块开始"}</div><div style={{ display: "flex", gap: 8, marginTop: 12 }}>{active && remaining > 0 && <button style={pill} onClick={active.startedAt ? pause : resume}>{active.startedAt ? "暂停" : "继续"}</button>}{active && <button style={pill} onClick={() => finish(false)}>结束本次</button>}{active && <button style={{ ...pill, background: "var(--accent)", color: "white" }} onClick={() => finish(true)}>确认完成</button>}</div></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ fontSize: 17 }}>今天的模块</h2><button style={pill} onClick={() => { setTab("setup"); setShowForm(true); }}>＋ 添加模块</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>{visible.map((m) => <div key={m.id} style={{ ...card, padding: 18 }}><div style={{ fontSize: 17, fontWeight: 600 }}>{m.icon} {m.name}</div><div style={{ color: "var(--text-secondary)", fontSize: 12, margin: "8px 0 16px" }}>今天 {count(m.id)}/{m.target} 轮 · 每轮 {m.minutes} 分钟</div><div style={{ display: "flex", gap: 8 }}><button style={{ ...pill, background: "var(--accent)", color: "white" }} disabled={!!active} onClick={() => start(m)}>开始专注</button><button style={pill} onClick={() => mark(m)}>标记一轮完成</button></div></div>)}</div>
      {!visible.length && <div style={{ ...card, padding: 20, color: "var(--text-secondary)" }}>今天还没有模块。到“模块设置”添加一个。</div>}
    </>}
    {tab === "stats" && <><div style={{ display: "flex", gap: 10, alignItems: "center" }}><button style={pill} onClick={() => setMonthShift(monthShift - 1)}>‹</button><strong>{month.getFullYear()} 年 {month.getMonth() + 1} 月</strong><button style={pill} onClick={() => setMonthShift(monthShift + 1)}>›</button></div><div style={{ ...card, padding: 20 }}><div>本月完成 {monthLogs.filter((s) => s.completed).length} 轮 · 专注 {Math.round(monthLogs.reduce((n, s) => n + s.seconds, 0) / 60)} 分钟 · 活跃 {dailyCount.filter(Boolean).length} 天</div><div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 7, marginTop: 18 }}>{dailyCount.map((n, i) => <div key={i} title={`${i + 1} 日 · ${n} 轮`} style={{ background: n >= 3 ? "var(--green)" : n ? "var(--accent)" : "var(--fill)", borderRadius: 6, height: 27, textAlign: "center", fontSize: 11, lineHeight: "27px", color: n ? "white" : "var(--text-tertiary)" }}>{i + 1}</div>)}</div></div><div style={{ ...card, padding: 20 }}>{plan.modules.map((m) => <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--separator)" }}>{m.icon} {m.name} · {monthLogs.filter((s) => s.moduleId === m.id && s.completed).length} 轮完成 · {Math.round(monthLogs.filter((s) => s.moduleId === m.id).reduce((n, s) => n + s.seconds, 0) / 60)} 分钟</div>)}</div></>}
    {tab === "setup" && <><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ fontSize: 17 }}>模块设置</h2><button style={pill} onClick={() => { setEditingId(null); setForm({ name: "", icon: "✨", minutes: 15, target: 1, frequency: "daily" }); setShowForm(true); }}>＋ 添加模块</button></div>{showForm && <div style={{ ...card, padding: 20, display: "grid", gap: 10, maxWidth: 500 }}><input placeholder="模块名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="图标" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /><label>单次分钟（最多 15）<input type="number" min={1} max={15} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} /></label><label>每日目标轮数<input type="number" min={1} max={12} value={form.target} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} /></label><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Module["frequency"] })}><option value="daily">每天出现</option><option value="manual">按需加入今天</option></select>{error && <div style={{ color: "var(--red)" }}>{error}</div>}<div><button style={pill} onClick={add}>{editingId ? "保存修改" : "保存模块"}</button> <button style={pill} onClick={() => setShowForm(false)}>取消</button></div></div>}{plan.modules.map((m) => <div key={m.id} style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 10 }}><span>{m.icon} {m.name}</span><span style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)" }}>{m.minutes} 分钟/轮 · {m.target} 轮/天 · {m.frequency === "daily" ? "每天出现" : "手动加入"}</span>{m.frequency === "manual" && <button style={pill} onClick={() => mut((d) => { const p = ensure(d); const ids = p.selectedDays[today] ?? []; p.selectedDays[today] = ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id]; })}>{selected.includes(m.id) ? "今天移除" : "加入今天"}</button>}<button style={pill} onClick={() => { setEditingId(m.id); setForm({ name: m.name, icon: m.icon, minutes: m.minutes, target: m.target, frequency: m.frequency }); setShowForm(true); }}>编辑</button><button style={pill} onClick={() => mut((d) => { const p = ensure(d); const item = p.modules.find((x) => x.id === m.id); if (item) item.archived = true; })}>归档</button></div>)}</>}
  </div>;
}
