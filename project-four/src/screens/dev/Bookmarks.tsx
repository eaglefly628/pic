import { useState } from "react";
import type { DevData, DevLink } from "../../types";
import { Btn, TextField, card } from "../../ui";
import { IconPlus, IconTrash, IconLink } from "../../icons";
import { uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "https://" + u);
const hostOf = (u: string) => { try { return new URL(normalizeUrl(u)).hostname.replace(/^www\./, ""); } catch { return u; } };
const AV = ["#0A84FF", "#5E5CE6", "#30B0C7", "#34C759", "#FF9F0A", "#FF375F", "#BF5AF2"];
const colorFor = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export default function Bookmarks({ data, mut }: { data: DevData; mut: Mut }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState("");

  const add = () => {
    if (!url.trim()) return;
    const link: DevLink = { id: uid("l"), title: title.trim() || hostOf(url), url: normalizeUrl(url.trim()), category: cat.trim() || "未分类", createdAt: Date.now() };
    mut((d) => { d.links.unshift(link); });
    setTitle(""); setUrl(""); setCat("");
  };
  const del = (id: string) => mut((d) => { d.links = d.links.filter((x) => x.id !== id); });

  const groups = new Map<string, DevLink[]>();
  for (const l of data.links) { const k = l.category || "未分类"; (groups.get(k) ?? groups.set(k, []).get(k)!).push(l); }

  return (
    <div>
      <div style={{ ...card, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <TextField value={url} onChange={(e) => setUrl(e.target.value)} placeholder="网址 URL" onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1, minWidth: 180 }} />
        <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="名称（可选）" onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ width: 150 }} />
        <TextField value={cat} onChange={(e) => setCat(e.target.value)} placeholder="分类（可选）" onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ width: 130 }} />
        <Btn onClick={add}><IconPlus size={15} />添加</Btn>
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
                  <button className="fv-icnbtn" onClick={() => del(l.id)} title="删除" style={{ width: 28, height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><IconTrash size={13} stroke="currentColor" /></button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
