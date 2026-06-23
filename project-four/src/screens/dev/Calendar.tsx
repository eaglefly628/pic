import { useMemo, useState } from "react";
import type { DevData, DevTask } from "../../types";
import { card } from "../../ui";
import { IconBack, IconArrowRight, IconPlus } from "../../icons";
import { PRIORITY, STATUS, fmtDue, dueColor, uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;
const WD = ["一", "二", "三", "四", "五", "六", "日"];
const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = dstr(new Date());

export default function Calendar({ data, mut }: { data: DevData; mut: Mut }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState(TODAY);
  const [quick, setQuick] = useState("");

  const byDay = useMemo(() => {
    const map = new Map<string, DevTask[]>();
    for (const t of data.tasks) if (t.due) (map.get(t.due) ?? map.set(t.due, []).get(t.due)!).push(t);
    return map;
  }, [data.tasks]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = (first.getDay() + 6) % 7; // 周一为首
    const start = new Date(cursor.y, cursor.m, 1 - lead);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const selTasks = (byDay.get(sel) ?? []).slice().sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));
  const upcoming = data.tasks.filter((t) => t.due && t.status !== "done" && t.due >= TODAY).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 8);
  const overdue = data.tasks.filter((t) => t.due && t.status !== "done" && t.due < TODAY).sort((a, b) => a.due!.localeCompare(b.due!));

  const toggle = (id: string) => mut((d) => { const t = d.tasks.find((x) => x.id === id); if (t) { t.status = t.status === "done" ? "todo" : "done"; t.updatedAt = Date.now(); } });
  const quickAdd = () => { const t = quick.trim(); if (!t) return; mut((d) => { d.tasks.unshift({ id: uid("t"), title: t, status: "todo", priority: "med", due: sel, createdAt: Date.now(), updatedAt: Date.now() }); }); setQuick(""); };
  const go = (delta: number) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 312px", gap: 16, alignItems: "start" }}>
      {/* 月历 */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{cursor.y} 年 {cursor.m + 1} 月</div>
          <div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={() => go(-1)} style={navBtn} title="上个月"><IconBack size={15} stroke="currentColor" /></button>
          <button className="fv-tap" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setSel(TODAY); }} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>今天</button>
          <button className="fv-icnbtn" onClick={() => go(1)} style={navBtn} title="下个月"><IconArrowRight size={15} stroke="currentColor" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {WD.map((w) => <div key={w} style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 600, padding: "2px 0 6px" }}>{w}</div>)}
          {cells.map((d, i) => {
            const ds = dstr(d);
            const inMonth = d.getMonth() === cursor.m;
            const isToday = ds === TODAY;
            const isSel = ds === sel;
            const tasks = byDay.get(ds) ?? [];
            return (
              <button key={i} onClick={() => setSel(ds)} className="fv-tap" style={{ minHeight: 64, textAlign: "left", border: isSel ? "1.5px solid var(--accent)" : "0.5px solid var(--separator)", borderRadius: 9, padding: "5px 6px", background: isSel ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--bg-elevated)", cursor: "pointer", opacity: inMonth ? 1 : 0.4, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isToday ? "#fff" : "var(--text-primary)", background: isToday ? "var(--accent)" : "transparent", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{d.getDate()}</span>
                {tasks.slice(0, 2).map((t) => (
                  <span key={t.id} style={{ fontSize: 10, lineHeight: 1.3, color: t.status === "done" ? "var(--text-tertiary)" : "var(--text-secondary)", textDecoration: t.status === "done" ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", flex: "none", background: PRIORITY[t.priority].color }} />{t.title}
                  </span>
                ))}
                {tasks.length > 2 && <span style={{ fontSize: 9.5, color: "var(--text-tertiary)" }}>+{tasks.length - 2}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 侧栏：当天 + 即将到来 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...card, padding: "15px 17px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{sel === TODAY ? "今天" : sel}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {selTasks.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>这天没有任务</div>}
            {selTasks.map((t) => <Line key={t.id} t={t} onToggle={() => toggle(t.id)} />)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "0.5px solid var(--separator)", paddingTop: 10 }}>
            <IconPlus size={15} stroke="var(--accent)" />
            <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }} placeholder="给这天加个任务…" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--text-primary)" }} />
          </div>
        </div>

        {overdue.length > 0 && (
          <div style={{ ...card, padding: "15px 17px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>逾期 {overdue.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{overdue.slice(0, 6).map((t) => <Line key={t.id} t={t} onToggle={() => toggle(t.id)} showDue />)}</div>
          </div>
        )}

        <div style={{ ...card, padding: "15px 17px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>即将到来</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {upcoming.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>没有安排</div>}
            {upcoming.map((t) => <Line key={t.id} t={t} onToggle={() => toggle(t.id)} showDue />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ t, onToggle, showDue }: { t: DevTask; onToggle: () => void; showDue?: boolean }) {
  const done = t.status === "done";
  const due = fmtDue(t.due);
  return (
    <div className="fv-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px", borderRadius: 7 }}>
      <span onClick={onToggle} title="完成" style={{ width: 16, height: 16, flex: "none", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: done ? "none" : "1.5px solid var(--text-tertiary)", background: done ? "var(--green)" : "transparent", color: "#fff", fontSize: 11 }}>{done ? "✓" : ""}</span>
      <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: PRIORITY[t.priority].color }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: done ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
      {showDue && due.text && <span style={{ fontSize: 11, fontWeight: 600, color: dueColor(due.tone), flex: "none" }}>{due.text}</span>}
      {!showDue && t.status === "doing" && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", flex: "none" }}>{STATUS.doing.label}</span>}
    </div>
  );
}

const navBtn: React.CSSProperties = { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--text-secondary)" };
