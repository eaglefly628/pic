import React, { useState } from "react";
import type { DevData, DevTask } from "../../types";
import { card } from "../../ui";
import { rise } from "../../lib/anim";
import { IconPlus, IconList, IconCalendar, IconNote, IconCode, IconLink, IconArrowRight } from "../../icons";
import { PRIORITY, fmtDue, dueColor, SectionTitle, uid, ACCENT_SOFT } from "./shared";
import { accountAlerts, toneColor } from "../../lib/accounts";
import { taxAlerts, stalePending } from "../../lib/invoices";

type Mut = (fn: (d: DevData) => void) => void;
type Tab = "tasks" | "notes" | "snippets" | "links" | "accounts" | "company";

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
}
const isOpen = (t: DevTask) => t.status !== "done";
const dueToday = (t: DevTask) => { if (!isOpen(t) || !t.due) return false; const tone = fmtDue(t.due).tone; return tone === "today" || tone === "over"; };

export default function Overview({ data, mut, goto }: { data: DevData; mut: Mut; goto: (t: Tab) => void }) {
  const [quick, setQuick] = useState("");
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  const openTasks = data.tasks.filter(isOpen);
  const todayCount = data.tasks.filter(dueToday).length;
  const inProgress = [...data.tasks.filter((t) => t.status === "doing"), ...data.tasks.filter((t) => t.status === "todo")]
    .sort((a, b) => (a.due ? Date.parse(a.due) : Infinity) - (b.due ? Date.parse(b.due) : Infinity)).slice(0, 5);
  const recentNotes = [...data.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const alerts = accountAlerts(data.accounts ?? []);
  const taxDue = taxAlerts(data.taxFilings ?? []);
  const stale = stalePending(data.invoices ?? []);

  const quickAdd = () => {
    const t = quick.trim(); if (!t) return;
    mut((d) => { d.tasks.unshift({ id: uid("t"), title: t, status: "todo", priority: "med", createdAt: Date.now(), updatedAt: Date.now() }); });
    setQuick("");
  };

  const stats: { icon: React.ReactNode; label: string; value: number; tab: Tab; tone: string }[] = [
    { icon: <IconList size={18} stroke="var(--accent)" />, label: "未完成任务", value: openTasks.length, tab: "tasks", tone: "var(--accent)" },
    { icon: <IconCalendar size={18} stroke="var(--orange)" />, label: "今日 / 逾期", value: todayCount, tab: "tasks", tone: "var(--orange)" },
    { icon: <IconNote size={18} stroke="var(--green)" />, label: "笔记", value: data.notes.length, tab: "notes", tone: "var(--green)" },
    { icon: <IconCode size={18} stroke="var(--accent2)" />, label: "代码片段", value: data.snippets.length, tab: "snippets", tone: "var(--accent2)" },
  ];

  return (
    <div>
      <div className="fv-rise" style={{ ...rise(0), marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>👨‍💻 {greeting()}，欢迎回到开发世界</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 3 }}>{today} · 这是你的私人工作台</div>
      </div>

      {/* 快速添加 */}
      <div className="fv-rise" style={{ ...rise(60), ...card, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 16 }}>
        <IconPlus size={17} stroke="var(--accent)" />
        <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }} placeholder="快速记一个任务，回车添加…" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13.5, color: "var(--text-primary)" }} />
      </div>

      {/* 统计卡 */}
      <div className="fv-rise" style={{ ...rise(120), display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        {stats.map((s) => (
          <button key={s.label} onClick={() => goto(s.tab)} className="fv-tap fv-card-int" style={{ ...card, padding: "16px 18px", textAlign: "left", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${s.tone} 15%, transparent)` }}>{s.icon}</span>
              <IconArrowRight size={14} stroke="var(--text-tertiary)" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginTop: 12, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="fv-rise" style={{ ...rise(150), ...card, padding: "16px 18px", marginBottom: 18 }}>
          <SectionTitle note={<button onClick={() => goto("accounts")} style={linkBtn}>账户 →</button>}>💳 账户提醒 · 别忘了</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {alerts.slice(0, 5).map((al, i) => (
              <button key={i} onClick={() => goto("accounts")} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: toneColor(al.tone), flex: "none" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{al.account.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: toneColor(al.tone), flex: "none" }}>{al.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(taxDue.length > 0 || stale) && (
        <div className="fv-rise" style={{ ...rise(165), ...card, padding: "16px 18px", marginBottom: 18 }}>
          <SectionTitle note={<button onClick={() => goto("company")} style={linkBtn}>公司 →</button>}>🧾 公司 · 别忘了</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {stale && (
              <button onClick={() => goto("company")} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)", flex: "none" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)" }}>待报销发票</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--orange)", flex: "none" }}>{stale.count} 张压了 {stale.oldestDays} 天</span>
              </button>
            )}
            {taxDue.slice(0, 4).map((al, i) => (
              <button key={i} onClick={() => goto("company")} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: toneColor(al.tone), flex: "none" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{al.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: toneColor(al.tone), flex: "none" }}>{al.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fv-rise" style={{ ...rise(180), display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        {/* 待办 / 进行中 */}
        <div style={{ ...card, padding: "16px 18px" }}>
          <SectionTitle note={<button onClick={() => goto("tasks")} style={linkBtn}>全部 →</button>}>待办 · 进行中</SectionTitle>
          {inProgress.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "8px 0" }}>暂无进行中的任务 🎉</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {inProgress.map((t) => {
              const due = fmtDue(t.due);
              return (
                <div key={t.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY[t.priority].color, flex: "none" }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                  {t.status === "doing" && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent)", background: ACCENT_SOFT, padding: "1px 7px", borderRadius: 5, flex: "none" }}>进行中</span>}
                  {due.text && <span style={{ fontSize: 11.5, fontWeight: 600, color: dueColor(due.tone), flex: "none" }}>{due.text}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 最近笔记 + 书签 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, padding: "16px 18px" }}>
            <SectionTitle note={<button onClick={() => goto("notes")} style={linkBtn}>全部 →</button>}>最近笔记</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {recentNotes.map((n) => (
                <button key={n.id} onClick={() => goto("notes")} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <IconNote size={14} stroke="var(--text-tertiary)" />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title || "未命名笔记"}</span>
                </button>
              ))}
              {recentNotes.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "6px 0" }}>暂无笔记</div>}
            </div>
          </div>
          <div style={{ ...card, padding: "16px 18px" }}>
            <SectionTitle note={<button onClick={() => goto("links")} style={linkBtn}>全部 →</button>}>常用书签</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.links.slice(0, 6).map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", background: "var(--fill-q)", border: "0.5px solid var(--separator)", padding: "5px 10px", borderRadius: 8, textDecoration: "none" }}><IconLink size={12} stroke="currentColor" />{l.title}</a>
              ))}
              {data.links.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>暂无书签</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = { border: "none", background: "transparent", color: "var(--accent)", fontSize: 11.5, fontWeight: 500, cursor: "pointer", padding: 0 };
