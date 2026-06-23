import type { FieldDef, FieldType, FieldValue } from "../../../types";
import { TextField, TextArea, Select } from "../../../ui";

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "单行文本" },
  { type: "longtext", label: "多行文本" },
  { type: "number", label: "数字" },
  { type: "money", label: "金额" },
  { type: "rating", label: "评分 ★" },
  { type: "date", label: "日期" },
  { type: "select", label: "单选" },
  { type: "tags", label: "标签" },
  { type: "phone", label: "电话" },
  { type: "url", label: "网址" },
  { type: "location", label: "地址" },
  { type: "email", label: "邮箱" },
  { type: "bool", label: "是 / 否" },
];
export const typeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.type === t)?.label ?? t;

const asStr = (v: FieldValue) => (v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v));
const parseTags = (s: string) => s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
export const mask = (s: string) => (s ? "•".repeat(Math.min(8, Math.max(4, s.length))) : "");

export function Stars({ value, onChange, size = 15 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={onChange ? () => onChange(value === n ? 0 : n) : undefined}
          style={{ cursor: onChange ? "pointer" : "default", color: n <= value ? "#FF9F0A" : "var(--track)", fontSize: size, lineHeight: 1 }}>★</span>
      ))}
    </span>
  );
}

/** 按字段类型渲染录入控件 */
export function FieldInput({ field, value, onChange }: { field: FieldDef; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const t = field.type;
  if (t === "longtext") return <TextArea value={asStr(value)} onChange={(e) => onChange(e.target.value)} style={{ height: 64 }} />;
  if (t === "number" || t === "money")
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {field.unit && <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{field.unit}</span>}
        <TextField type="number" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      </div>
    );
  if (t === "rating") return <div style={{ padding: "6px 0" }}><Stars value={Number(value) || 0} onChange={(n) => onChange(n)} size={20} /></div>;
  if (t === "date") return <TextField type="date" value={asStr(value)} onChange={(e) => onChange(e.target.value || undefined)} />;
  if (t === "select")
    return <Select value={asStr(value)} onChange={(e) => onChange(e.target.value || undefined)} options={[{ value: "", label: "—" }, ...(field.options ?? []).map((o) => ({ value: o, label: o }))]} />;
  if (t === "tags") return <TextField value={asStr(value)} onChange={(e) => onChange(parseTags(e.target.value))} placeholder="逗号分隔" />;
  if (t === "bool")
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {[["是", true], ["否", false]].map(([l, v]) => (
          <button key={l as string} onClick={() => onChange(value === v ? undefined : (v as boolean))} className="fv-tap"
            style={{ padding: "6px 16px", borderRadius: 8, border: "0.5px solid var(--separator)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: value === v ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--fill-q)", color: value === v ? "var(--accent)" : "var(--text-secondary)" }}>{l as string}</button>
        ))}
      </div>
    );
  return <TextField type={t === "email" ? "email" : "text"} value={asStr(value)} onChange={(e) => onChange(e.target.value || undefined)} placeholder={t === "url" ? "https://…" : t === "phone" ? "电话" : t === "location" ? "地址" : ""} />;
}

/** 只读展示一个字段值（私密打码） */
export function fieldDisplay(field: FieldDef, value: FieldValue): string {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return "";
  if (field.type === "bool") return value ? "是" : "否";
  if (field.type === "rating") return "★".repeat(Number(value) || 0);
  if (field.type === "tags") return (value as string[]).join("、");
  let s = field.type === "money" ? `${field.unit ?? ""}${value}` : String(value);
  if (field.secret) s = mask(String(value));
  return s;
}
