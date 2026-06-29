import React, { useState } from "react";
import type { DevData, DevLink } from "../../types";
import { Btn, TextField, card } from "../../ui";
import { IconPlus, IconTrash, IconLink, IconGear, IconClose, IconCheck } from "../../icons";
import { uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

// 分类模板（可直接选，也可自己输入新的）
const PRESET_CATEGORIES = ["开发", "文档", "工具", "设计", "学习", "AI", "云服务", "效率", "社区", "资讯", "娱乐", "购物", "理财", "未分类"];

const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "https://" + u);
const hostOf = (u: string) => { try { return new URL(normalizeUrl(u)).hostname.replace(/^www\./, ""); } catch { return u; } };
const AV = ["#0A84FF", "#5E5CE6", "#30B0C7", "#34C759", "#FF9F0A", "#FF375F", "#BF5AF2"];
const colorFor = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export default function Bookmarks({ data, mut }: { data: DevData; mut: Mut }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState<DevLink | null>(null);

  // 现有分类（用过的）+ 模板，去重，给下拉用
  const catOptions = Array.from(new Set([...data.links.map((l) => l.category || "").filter(Boolean), ...PRESET_CATEGORIES]));

  const add = () => {
    if (!url.trim()) return;
    const link: DevLink = { id: uid("l"), title: title.trim() || hostOf(url), url: normalizeUrl(url.trim()), category: cat.trim() || "未分类", createdAt: Date.now() };
    mut((d) => { d.links.unshift(link); });
    setTitle(""); setUrl(""); setCat("");
  };
  const del = (id: string) => mut((d) => { d.links = d.links.filter((x) => x.id !== id); });
  const save = (l: DevLink) => {
    mut((d) => { const i = d.links.findIndex((x) => x.id === l.id); if (i >= 0) d.links[i] = { ...l, url: normalizeUrl(l.url.trim()), title: l.title.trim() || hostOf(l.url), category: l.category?.trim() || "未分类" }; });
    setEdit(null);
  };

  const groups = new Map<string, DevLink[]>();
  for (const l of data.links) { const k = l.category || "未分类"; (groups.get(k) ?? groups.set(k, []).get(k)!).push(l); }

  return (
    <div>
      <datalist id="bm-cats">{catOptions.map((c) => <option key={c} value={c} />)}</datalist>

      <div style={{ ...card, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <TextField value={url} onChange={(e) => setUrl(e.target.value)} placeholder="网址 URL" onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1, minWidth: 180 }} />
        <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="名称（可选）" onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ width: 150 }} />
        <input list="bm-cats" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="分类（选或输入）" onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          style={{ width: 150, height: 36, padding: "0 12px", fontSize: 14, borderRadius: 10, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" }} />
        <Btn onClick={add}><IconPlus size={15} />添加</Btn>
      </div>

      {/* 快捷分类标签：点一下填进分类框 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 2px 16px" }}>
        {PRESET_CATEGORIES.filter((c) => c !== "未分类").map((c) => (
          <button key={c} className="fv-tap" onClick={() => setCat(c)} style={{ border: "0.5px solid " + (cat === c ? "transparent" : "var(--separator)"), background: cat === c ? "var(--accent)" : "var(--bg-elevated)", color: cat === c ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 8, cursor: "pointer" }}>{c}</button>
        ))}
      </div>

      {data.links.length === 0 ? (
        <div style={{ ...card, padding: "40px 22px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>暂无书签</div>
      ) : (
        [...groups.entries()].map(([g, links]) => (
          <div key={g} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "0 2px 9px" }}>{g}<span style={{ color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 6 }}>{links.length}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {links.map((l) => (
                <div key={l.id} className="fv-row fv-rise" style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "11px 13px" }}>
                  <span style={{ width: 36, height: 36, flex: "none", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: colorFor(l.title), color: "#fff", fontSize: 15, fontWeight: 700 }}>{(l.title[0] || "#").toUpperCase()}</span>
                  <a href={l.url} target="_blank" rel="noreferrer" style={{ minWidth: 0, flex: 1, textDecoration: "none" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}><IconLink size={11} stroke="currentColor" />{hostOf(l.url)}</div>
                  </a>
                  <button className="fv-icnbtn" onClick={() => setEdit(l)} title="编辑（改分类/名称）" style={icnBtn}><IconGear size={13} stroke="currentColor" /></button>
                  <button className="fv-icnbtn" onClick={() => del(l.id)} title="删除" style={icnBtn}><IconTrash size={13} stroke="currentColor" /></button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {edit && <BookmarkEditor key={edit.id} initial={edit} options={catOptions} onClose={() => setEdit(null)} onSave={save} onDelete={() => { del(edit.id); setEdit(null); }} />}
    </div>
  );
}

function BookmarkEditor({ initial, options, onClose, onSave, onDelete }: { initial: DevLink; options: string[]; onClose: () => void; onSave: (l: DevLink) => void; onDelete: () => void }) {
  const [l, setL] = useState<DevLink>(initial);
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width: 440, maxWidth: "92%", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>编辑书签</div><div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} style={icnBtn}><IconClose size={17} stroke="currentColor" /></button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <Lbl t="名称"><TextField value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} placeholder="名称" autoFocus /></Lbl>
          <Lbl t="网址"><TextField value={l.url} onChange={(e) => setL({ ...l, url: e.target.value })} placeholder="https://…" /></Lbl>
          <Lbl t="分类">
            <input list="bm-cats" value={l.category ?? ""} onChange={(e) => setL({ ...l, category: e.target.value })} placeholder="选或输入分类"
              style={{ width: "100%", height: 36, padding: "0 12px", fontSize: 14, borderRadius: 10, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {Array.from(new Set([...options, ...PRESET_CATEGORIES])).map((c) => (
                <button key={c} className="fv-tap" onClick={() => setL({ ...l, category: c })} style={{ border: "0.5px solid " + (l.category === c ? "transparent" : "var(--separator)"), background: l.category === c ? "var(--accent)" : "var(--bg-elevated)", color: l.category === c ? "#fff" : "var(--text-secondary)", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 7, cursor: "pointer" }}>{c}</button>
              ))}
            </div>
          </Lbl>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>
          <Btn variant="danger" onClick={onDelete}><IconTrash size={14} stroke="currentColor" />删除</Btn>
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={() => onSave(l)} disabled={!l.url.trim()}><IconCheck size={15} stroke="#fff" />保存</Btn>
        </div>
      </div>
    </div>
  );
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 5, letterSpacing: ".02em" }}>{t}</div>
      {children}
    </label>
  );
}

const icnBtn: React.CSSProperties = { width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" };
