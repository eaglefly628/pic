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

/** 单序列折线趋势图（体重/血压等按日期打点）。点数 &lt;2 时显示提示而不是空图。 */
export function LineChart({ points, height = 120, color = "var(--accent)", unit = "" }: {
  points: { x: number; y: number }[]; height?: number; color?: string; unit?: string;
}) {
  const W = 640;
  if (points.length < 2) return <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "22px 0", textAlign: "center" }}>再记一次就能看到趋势线</div>;
  const padL = 40, padR = 10, padT = 12, padB = 20;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY0 = Math.min(...ys), maxY0 = Math.max(...ys);
  const pad = (maxY0 - minY0) * 0.12 || 1;
  const minY = minY0 - pad, maxY = maxY0 + pad;
  const X = (x: number) => padL + (maxX > minX ? (x - minX) / (maxX - minX) : 0.5) * (W - padL - padR);
  const Y = (y: number) => padT + (1 - (y - minY) / (maxY - minY)) * (height - padT - padB);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height, display: "block" }}>
      <line x1={padL} y1={height - padB} x2={W - padR} y2={height - padB} stroke="var(--separator)" strokeWidth={1} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {points.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={2.6} fill={color} />)}
      <text x={2} y={padT + 4} fontSize={10} fill="var(--text-tertiary)">{maxY0.toFixed(1)}{unit}</text>
      <text x={2} y={height - padB + 3} fontSize={10} fill="var(--text-tertiary)">{minY0.toFixed(1)}{unit}</text>
    </svg>
  );
}
