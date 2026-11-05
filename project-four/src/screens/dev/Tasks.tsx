import React, { useState } from "react";
import type { DevData, DevTask, TaskPriority } from "../../types";
import { Btn, TextField, Select, card } from "../../ui";
import { IconPlus, IconTrash, IconBack, IconArrowRight } from "../../icons";
import { PRIORITY, STATUS, STATUS_ORDER, fmtDue, dueTimeSuffix, dueColor, Tag, IconBtn, uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

export default function Tasks({ data, mut }: { data: DevData; mut: Mut }) {
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<TaskPriority>("med");
  const [due, setDue] = useState("");
  const [dueTime, setDueTime] = useState("");

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const task: DevTask = { id: uid("t"), title: t, status: "todo", priority: prio, due: due || undefined, dueTime: due && dueTime ? dueTime : undefined, createdAt: Date.now(), updatedAt: Date.now() };
    mut((d) => { d.tasks.unshift(task); });
    setTitle(""); setDue(""); setDueTime("");
  };
  const move = (id: string, dir: -1 | 1) =>
    mut((d) => { const t = d.tasks.find((x) => x.id === id); if (!t) return; const i = STATUS_ORDER.indexOf(t.status) + dir; if (i >= 0 && i < STATUS_ORDER.length) { t.status = STATUS_ORDER[i]; t.updatedAt = Date.now(); } });
  const del = (id: string) => mut((d) => { d.tasks = d.tasks.filter((x) => x.id !== id); });

  return (
    <div>
      <div style={{ ...card, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="新建任务…" onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1, minWidth: 160 }} />
        <div style={{ width: 100 }}><Select value={prio} onChange={(e) => setPrio(e.target.value as TaskPriority)} options={[{ value: "high", label: "高优先" }, { value: "med", label: "中优先" }, { value: "low", label: "低优先" }]} /></div>
        <TextField type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 150 }} />
        {due && <TextField type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} title="到期具体时间（可选）" style={{ width: 110 }} />}
        <Btn onClick={add}><IconPlus size={15} />添加</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, alignItems: "start" }}>
        {STATUS_ORDER.map((st) => {
          const items = data.tasks.filter((t) => t.status === st);
          return (
            <div key={st} style={{ ...card, padding: "12px 12px 8px", minHeight: 120 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px 10px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS[st].color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{STATUS[st].label}</span>
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((t) => <TaskCard key={t.id} t={t} onMove={move} onDel={del} />)}
                {items.length === 0 && <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "14px 0" }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ t, onMove, onDel }: { t: DevTask; onMove: (id: string, d: -1 | 1) => void; onDel: (id: string) => void }) {
  const due = fmtDue(t.due);
  const done = t.status === "done";
  const i = STATUS_ORDER.indexOf(t.status);
  return (
    <div className="fv-rise" style={{ background: "var(--fill-q)", border: "0.5px solid var(--separator)", borderRadius: 10, padding: "10px 11px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span title={`优先级：${PRIORITY[t.priority].label}`} style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY[t.priority].color, marginTop: 5, flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: done ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: done ? "line-through" : "none", lineHeight: 1.4 }}>{t.title}</div>
        <IconBtn onClick={() => onDel(t.id)} title="删除"><IconTrash size={13} stroke="currentColor" /></IconBtn>
      </div>
      {(due.text || (t.tags && t.tags.length > 0)) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "8px 0 0 16px" }}>
          {due.text && !done && <span style={{ fontSize: 11, fontWeight: 600, color: dueColor(due.tone) }}>{due.text}{dueTimeSuffix(t)}</span>}
          {t.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 4, marginTop: 8, marginLeft: 12 }}>
        {i > 0 && <button className="fv-tap" onClick={() => onMove(t.id, -1)} style={moveBtn}><IconBack size={12} stroke="currentColor" />{STATUS[STATUS_ORDER[i - 1]].label}</button>}
        {i < 2 && <button className="fv-tap" onClick={() => onMove(t.id, 1)} style={moveBtn}>{STATUS[STATUS_ORDER[i + 1]].label}<IconArrowRight size={12} stroke="currentColor" /></button>}
      </div>
    </div>
  );
}

const moveBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11, fontWeight: 500, color: "var(--text-secondary)",
  background: "var(--bg-elevated)", border: "0.5px solid var(--separator)", borderRadius: 6, padding: "3px 7px", cursor: "pointer",
};
