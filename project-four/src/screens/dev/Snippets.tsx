import React, { useState } from "react";
import type { DevData, DevSnippet } from "../../types";
import { Btn, TextField, TextArea, card } from "../../ui";
import { IconPlus, IconTrash, IconCopy, IconCheck, IconSearch, IconCode } from "../../icons";
import { Tag, uid, ACCENT_SOFT } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;
const parseTags = (s: string) => s.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);

export default function Snippets({ data, mut }: { data: DevData; mut: Mut }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("");
  const [code, setCode] = useState("");
  const [tags, setTags] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const add = () => {
    if (!title.trim() || !code.trim()) return;
    const s: DevSnippet = { id: uid("s"), title: title.trim(), lang: lang.trim() || undefined, code, tags: parseTags(tags), createdAt: Date.now(), updatedAt: Date.now() };
    mut((d) => { d.snippets.unshift(s); });
    setTitle(""); setLang(""); setCode(""); setTags(""); setOpen(false);
  };
  const del = (id: string) => mut((d) => { d.snippets = d.snippets.filter((x) => x.id !== id); });
  const copy = async (s: DevSnippet) => {
    try { await navigator.clipboard.writeText(s.code); setCopied(s.id); setTimeout(() => setCopied((c) => (c === s.id ? null : c)), 1400); } catch { /* ignore */ }
  };

  const items = q.trim()
    ? data.snippets.filter((s) => (s.title + s.code + (s.lang ?? "") + (s.tags?.join(" ") ?? "")).toLowerCase().includes(q.trim().toLowerCase()))
    : data.snippets;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 10, background: "var(--fill-q)", border: "0.5px solid var(--separator)" }}>
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索片段（标题 / 代码 / 标签）" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }} />
        </div>
        <Btn onClick={() => setOpen((v) => !v)} variant={open ? "ghost" : "primary"}><IconPlus size={15} />{open ? "收起" : "新建片段"}</Btn>
      </div>

      {open && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" style={{ flex: 1 }} />
            <TextField value={lang} onChange={(e) => setLang(e.target.value)} placeholder="语言 (bash/ts…)" style={{ width: 150 }} />
          </div>
          <TextArea value={code} onChange={(e) => setCode(e.target.value)} placeholder="粘贴代码 / 命令…" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, height: 120 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <TextField value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签（逗号分隔）" style={{ flex: 1 }} />
            <Btn onClick={add}>保存</Btn>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ ...card, padding: "40px 22px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>暂无代码片段</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, alignItems: "start" }}>
          {items.map((s) => (
            <div key={s.id} className="fv-rise" style={{ ...card, padding: "12px 14px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <IconCode size={15} stroke="var(--accent)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</span>
                {s.lang && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent)", background: ACCENT_SOFT, padding: "1px 7px", borderRadius: 5, flex: "none" }}>{s.lang}</span>}
                <span style={{ marginLeft: "auto", display: "flex", gap: 2, flex: "none" }}>
                  <button className="fv-icnbtn" onClick={() => copy(s)} title="复制" style={iconBtn(copied === s.id ? "var(--green)" : "var(--text-tertiary)")}>{copied === s.id ? <IconCheck size={14} stroke="currentColor" /> : <IconCopy size={14} stroke="currentColor" />}</button>
                  <button className="fv-icnbtn" onClick={() => del(s.id)} title="删除" style={iconBtn("var(--text-tertiary)")}><IconTrash size={13} stroke="currentColor" /></button>
                </span>
              </div>
              <pre style={{ margin: 0, padding: "10px 12px", borderRadius: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.6, color: "var(--text-primary)", overflow: "auto", maxHeight: 180, whiteSpace: "pre" }}>{s.code}</pre>
              {s.tags && s.tags.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>{s.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn = (color: string): React.CSSProperties => ({ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color });
