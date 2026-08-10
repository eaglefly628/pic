import React from "react";
import { useBreakpoint } from "./lib/breakpoint";

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

export function Segmented<T extends string>({ value, options, onChange, style }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; style?: React.CSSProperties;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div style={{ position: "relative", display: "flex", background: "var(--fill-quaternary)", borderRadius: 8, padding: 2, ...style }}>
      <div aria-hidden style={{ position: "absolute", top: 2, bottom: 2, left: 2, width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${idx * 100}%)`, background: "var(--bg-card)", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.14)", transition: "transform .26s cubic-bezier(.3,.85,.3,1)" }} />
      {options.map((o) => (
        <button key={o.value} className="fv-tap" onClick={() => onChange(o.value)} style={{ position: "relative", zIndex: 1, flex: 1, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "5px 13px", borderRadius: 6, whiteSpace: "nowrap", color: o.value === value ? "var(--text-primary)" : "var(--text-secondary)", transition: "color .2s" }}>{o.label}</button>
      ))}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, width = 460 }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  // 仅当「按下」和「松开」都发生在遮罩空白处才关闭，避免弹窗内拖拽/选字到外面误关。
  const downOnBackdrop = React.useRef(false);
  const bp = useBreakpoint();
  const sheet = bp === "phone";   // 手机改底部抽屉，圆角只留上面两角
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); downOnBackdrop.current = false; }}
      style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", alignItems: sheet ? "flex-end" : "center", justifyContent: "center", background: "rgba(0,0,0,0.32)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}
    >
      <div
        className="fv-scroll"
        style={{
          ...card,
          width: sheet ? "100%" : width,
          maxWidth: sheet ? "100%" : "90%",
          maxHeight: sheet ? "88%" : "86%",
          borderRadius: sheet ? "18px 18px 0 0" : 14,
          overflow: "auto",
          animation: sheet ? "fvSheetUp .24s cubic-bezier(.2,.7,.3,1)" : "fvRise .18s ease",
          paddingBottom: sheet ? "env(safe-area-inset-bottom, 0px)" : undefined,
        }}>
        {sheet && <div aria-hidden style={{ width: 38, height: 4, borderRadius: 2, background: "var(--separator-strong)", margin: "8px auto 0" }} />}
        <div style={{ padding: sheet ? "12px 18px 14px" : "16px 22px", borderBottom: "0.5px solid var(--separator)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", position: "sticky", top: 0, background: "var(--bg-card)" }}>{title}</div>
        <div style={{ padding: sheet ? "16px 18px" : "18px 22px" }}>{children}</div>
        {footer && <div style={{ padding: sheet ? "10px 18px 20px" : "12px 22px 18px", display: "flex", gap: 10, justifyContent: sheet ? "stretch" : "flex-end" }}>{footer}</div>}
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
