import React from "react";

export const card: React.CSSProperties = {
  background: "var(--bg-elevated)", border: "0.5px solid var(--separator)",
  borderRadius: 16, boxShadow: "var(--shadow)",
};

export function Btn({ children, onClick, variant = "primary", disabled, type = "button", full, style }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "soft" | "ghost" | "danger";
  disabled?: boolean; type?: "button" | "submit"; full?: boolean; style?: React.CSSProperties;
}) {
  const v: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff" },
    soft: { background: "var(--fill)", color: "var(--text-primary)" },
    ghost: { background: "transparent", color: "var(--text-secondary)", border: "0.5px solid var(--separator)" },
    danger: { background: "rgba(255,59,48,0.12)", color: "var(--red)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="fv-btn" style={{
      ...v[variant], border: v[variant].border ?? "none", borderRadius: 10, padding: "9px 16px",
      fontSize: 13.5, fontWeight: 600, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer",
      width: full ? "100%" : undefined, transition: "filter .15s, opacity .15s", ...style,
    }}>{children}</button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 5, letterSpacing: ".02em" }}>{label}</div>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 10,
  border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)",
};

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}
// 与理财/相册一致的别名与控件
export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, height: 36, padding: "0 12px", ...props.style }} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, height: 80, padding: "8px 12px", resize: "vertical", lineHeight: 1.6, ...props.style }} />;
}
export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} style={{ ...inputStyle, height: 36, padding: "0 10px", ...props.style }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Segmented<T extends string>({ value, options, onChange, style }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; style?: React.CSSProperties;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div style={{ position: "relative", display: "flex", background: "var(--fill-q)", borderRadius: 9, padding: 3, ...style }}>
      <div aria-hidden style={{ position: "absolute", top: 3, bottom: 3, left: 3, width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${idx * 100}%)`, background: "var(--bg-elevated)", borderRadius: 7, boxShadow: "0 1px 3px rgba(0,0,0,0.16)", transition: "transform .26s cubic-bezier(.3,.85,.3,1)" }} />
      {options.map((o) => (
        <button key={o.value} className="fv-tap" onClick={() => onChange(o.value)} style={{ position: "relative", zIndex: 1, flex: 1, border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "6px 14px", borderRadius: 7, whiteSpace: "nowrap", color: o.value === value ? "var(--text-primary)" : "var(--text-secondary)", transition: "color .2s" }}>{o.label}</button>
      ))}
    </div>
  );
}
export const uid = (p = "id"): string => p + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px", textAlign: "center", gap: 10 }}>
      {icon && <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--fill-q)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>}
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
      {text && <div style={{ fontSize: 13, color: "var(--text-tertiary)", maxWidth: 320, lineHeight: 1.6 }}>{text}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
