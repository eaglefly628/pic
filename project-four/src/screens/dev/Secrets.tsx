import { useState } from "react";
import type { DevData, DevSecret, SecretEntry, SecretKind } from "../../types";
import { useVault } from "../../lib/vault";
import { Btn, TextField, TextArea, Select, card } from "../../ui";
import { IconPlus, IconTrash, IconSearch, IconEye, IconEyeOff, IconCopy, IconClose, IconGear } from "../../icons";
import { uid, Tag } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;
const KIND: Record<SecretKind, { label: string; emoji: string }> = {
  api: { label: "API Key", emoji: "🔑" }, server: { label: "服务器", emoji: "🖥️" },
  db: { label: "数据库", emoji: "🗄️" }, env: { label: "环境变量", emoji: "⚙️" }, other: { label: "其它", emoji: "🔒" },
};
const KIND_OPTS = (Object.keys(KIND) as SecretKind[]).map((k) => ({ value: k, label: KIND[k].label }));

export default function Secrets({ data, mut }: { data: DevData; mut: Mut }) {
  const { copy } = useVault();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<DevSecret | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setShown((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const ql = q.trim().toLowerCase();
  const list = (ql ? data.secrets.filter((s) => (s.title + " " + (s.tags?.join(" ") ?? "") + " " + s.entries.map((e) => e.label).join(" ")).toLowerCase().includes(ql)) : data.secrets);

  const save = (s: DevSecret) => { mut((d) => { const i = d.secrets.findIndex((x) => x.id === s.id); if (i >= 0) d.secrets[i] = { ...s, updatedAt: Date.now() }; else d.secrets.unshift(s); }); setEdit(null); };
  const del = (id: string) => { mut((d) => { d.secrets = d.secrets.filter((x) => x.id !== id); }); setEdit(null); };
  const newSecret = () => setEdit({ id: uid("k"), title: "", kind: "api", entries: [{ label: "API Key", value: "", secret: true }], createdAt: Date.now(), updatedAt: Date.now() });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 10, background: "var(--fill-q)", border: "0.5px solid var(--separator)" }}>
          <IconSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索密钥（标题 / 标签 / 字段名）" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }} />
        </div>
        <Btn onClick={newSecret}><IconPlus size={15} />新建</Btn>
      </div>

      {list.length === 0 ? (
        <div style={{ ...card, padding: "44px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>{q ? "没有匹配的密钥" : "还没有密钥，点右上「新建」。值默认打码，复制走加密剪贴板。"}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, alignItems: "start" }}>
          {list.map((s) => (
            <div key={s.id} style={{ ...card, padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>{KIND[s.kind].emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title || "未命名"}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-secondary)", background: "var(--fill-q)", border: "0.5px solid var(--separator)", padding: "1px 7px", borderRadius: 5 }}>{KIND[s.kind].label}</span>
                <button className="fv-icnbtn" onClick={() => setEdit(s)} title="编辑" style={icnBtn}><IconGear size={14} stroke="currentColor" /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {s.entries.map((e, i) => {
                  const key = s.id + ":" + i;
                  const reveal = shown.has(key) || !e.secret;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", borderRadius: 8, padding: "6px 9px" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", width: 76, flex: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.label}</span>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{reveal ? (e.value || "—") : "•".repeat(Math.min(14, Math.max(6, e.value.length)))}</span>
                      {e.secret && <button className="fv-icnbtn" onClick={() => toggle(key)} title={reveal ? "隐藏" : "显示"} style={icnBtn}>{reveal ? <IconEyeOff size={14} stroke="currentColor" /> : <IconEye size={14} stroke="currentColor" />}</button>}
                      <button className="fv-icnbtn" onClick={() => copy(e.value, e.label)} title="复制" style={icnBtn}><IconCopy size={13} stroke="currentColor" /></button>
                    </div>
                  );
                })}
              </div>
              {s.notes && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 9, lineHeight: 1.6 }}>{s.notes}</div>}
              {s.tags && s.tags.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>{s.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
            </div>
          ))}
        </div>
      )}

      {edit && <SecretEditor key={edit.id} initial={edit} isNew={!data.secrets.some((x) => x.id === edit.id)} onClose={() => setEdit(null)} onSave={save} onDelete={() => del(edit.id)} />}
    </div>
  );
}

function SecretEditor({ initial, isNew, onClose, onSave, onDelete }: { initial: DevSecret; isNew: boolean; onClose: () => void; onSave: (s: DevSecret) => void; onDelete: () => void }) {
  const [s, setS] = useState<DevSecret>(initial);
  const setEntry = (i: number, p: Partial<SecretEntry>) => setS((x) => ({ ...x, entries: x.entries.map((e, j) => (j === i ? { ...e, ...p } : e)) }));
  const addEntry = () => setS((x) => ({ ...x, entries: [...x.entries, { label: "", value: "", secret: true }] }));
  const delEntry = (i: number) => setS((x) => ({ ...x, entries: x.entries.filter((_, j) => j !== i) }));

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width: 560, maxWidth: "92%", maxHeight: "88%", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{isNew ? "新建密钥" : "编辑密钥"}</div><div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} style={icnBtn}><IconClose size={17} stroke="currentColor" /></button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <TextField value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="名称（如 OpenAI API）" autoFocus style={{ flex: 1 }} />
            <div style={{ width: 130 }}><Select value={s.kind} onChange={(e) => setS({ ...s, kind: e.target.value as SecretKind })} options={KIND_OPTS} /></div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>字段</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {s.entries.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <TextField value={e.label} onChange={(ev) => setEntry(i, { label: ev.target.value })} placeholder="名称" style={{ width: 120 }} />
                <TextField value={e.value} onChange={(ev) => setEntry(i, { value: ev.target.value })} placeholder="值" style={{ flex: 1, fontFamily: "ui-monospace, monospace" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap" }}><input type="checkbox" checked={!!e.secret} onChange={(ev) => setEntry(i, { secret: ev.target.checked })} />打码</label>
                <button className="fv-icnbtn" onClick={() => delEntry(i)} title="删除" style={icnBtn}><IconTrash size={13} stroke="currentColor" /></button>
              </div>
            ))}
          </div>
          <button onClick={addEntry} className="fv-tap" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, border: "0.5px dashed var(--separator)", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, cursor: "pointer" }}><IconPlus size={14} />加字段</button>
          <div style={{ marginTop: 14 }}>
            <TextField value={s.tags?.join(", ") ?? ""} onChange={(e) => setS({ ...s, tags: e.target.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean) })} placeholder="标签（逗号分隔）" style={{ marginBottom: 10 }} />
            <TextArea value={s.notes ?? ""} onChange={(e) => setS({ ...s, notes: e.target.value })} placeholder="备注" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>
          {!isNew && <Btn variant="danger" onClick={onDelete}>删除</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={() => onSave(s)} disabled={!s.title.trim()}>保存</Btn>
        </div>
      </div>
    </div>
  );
}

const icnBtn: React.CSSProperties = { width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" };
