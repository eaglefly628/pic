import React from "react";
import type { TaskPriority, TaskStatus } from "../../types";

export const ACCENT_SOFT = "color-mix(in srgb, var(--accent) 15%, transparent)";

export const PRIORITY: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "高", color: "var(--red)" },
  med: { label: "中", color: "var(--orange)" },
  low: { label: "低", color: "var(--text-tertiary)" },
};

export const STATUS: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "待办", color: "var(--text-tertiary)" },
  doing: { label: "进行中", color: "var(--accent)" },
  done: { label: "已完成", color: "var(--green)" },
};
export const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "done"];

export function fmtDue(due?: string): { text: string; tone: "over" | "today" | "soon" | "none" } {
  if (!due) return { text: "", tone: "none" };
  const d = new Date(due + "T00:00:00");
  if (isNaN(d.getTime())) return { text: "", tone: "none" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `逾期 ${-diff} 天`, tone: "over" };
  if (diff === 0) return { text: "今天到期", tone: "today" };
  if (diff === 1) return { text: "明天", tone: "soon" };
  if (diff <= 6) return { text: `${diff} 天后`, tone: "soon" };
  return { text: `${d.getMonth() + 1}月${d.getDate()}日`, tone: "none" };
}
export const dueColor = (tone: string) =>
  tone === "over" ? "var(--red)" : tone === "today" ? "var(--orange)" : tone === "soon" ? "var(--accent)" : "var(--text-tertiary)";

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--fill-q)", border: "0.5px solid var(--separator)", padding: "1px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{children}</span>
  );
}

export function IconBtn({ onClick, title, children, color }: { onClick: () => void; title: string; children: React.ReactNode; color?: string }) {
  return (
    <button className="fv-icnbtn" onClick={onClick} title={title} style={{ width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: color ?? "var(--text-tertiary)" }}>{children}</button>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
      {children}{note != null && <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>{note}</span>}
    </div>
  );
}

export const uid = (p: string): string => p + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
