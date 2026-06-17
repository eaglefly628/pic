import React from "react";

export const card: React.CSSProperties = {
  background: "var(--bg-card)", borderRadius: 14, boxShadow: "var(--card-shadow)",
};

type BtnVariant = "primary" | "soft" | "ghost" | "danger";
export function Btn({ variant = "primary", children, style, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 34, padding: "0 15px", borderRadius: 9, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff", boxShadow: "0 2px 6px var(--accent-soft)" },
    soft: { background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 },
    ghost: { background: "var(--fill-quaternary)", color: "var(--text-primary)", border: "0.5px solid var(--separator)" },
    danger: { background: "color-mix(in srgb, var(--red) 14%, transparent)", color: "var(--red)", fontWeight: 600 },
  };
  return (
    <button {...rest} className={"fv-btn" + (className ? " " + className : "")} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 12px", borderRadius: 9,
  background: "var(--fill-quaternary)", border: "0.5px solid var(--separator-strong)",
  color: "var(--text-primary)", fontSize: 13.5, outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" };

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 13 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, height: 72, padding: "8px 12px", resize: "vertical", ...props.style }} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} style={{ ...inputStyle, ...props.style }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Modal({ open, title, onClose, children, footer, width = 460 }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  // 仅当「按下」和「松开」都发生在遮罩空白处才关闭，避免弹窗内拖拽/选字到外面误关。
  const downOnBackdrop = React.useRef(false);
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); downOnBackdrop.current = false; }}
      style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.32)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}
    >
      <div style={{ ...card, width, maxWidth: "90%", maxHeight: "86%", overflow: "auto", animation: "fvRise .18s ease" }} className="fv-scroll">
        <div style={{ padding: "16px 22px", borderBottom: "0.5px solid var(--separator)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", position: "sticky", top: 0, background: "var(--bg-card)" }}>{title}</div>
        <div style={{ padding: "18px 22px" }}>{children}</div>
        {footer && <div style={{ padding: "12px 22px 18px", display: "flex", gap: 10, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, text, action }: { icon?: React.ReactNode; text: string; action?: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: "48px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "var(--text-tertiary)" }}>
      {icon}
      <div style={{ fontSize: 13.5 }}>{text}</div>
      {action}
    </div>
  );
}

export function uid(prefix = "id"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
