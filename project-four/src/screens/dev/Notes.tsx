import { useEffect, useState } from "react";
import type { DevData, DevNote } from "../../types";
import { Btn, TextField, TextArea, Segmented, card } from "../../ui";
import { IconPlus, IconTrash, IconPin, IconSearch, IconImport } from "../../icons";
import { Tag, uid, ACCENT_SOFT } from "./shared";
import ImportModal from "./ImportModal";
import { Markdown } from "./md";
import type { ParsedNote } from "../../lib/import";

type Mut = (fn: (d: DevData) => void) => void;
const parseTags = (s: string) => s.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
const sortNotes = (a: DevNote, b: DevNote) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt;

export default function Notes({ data, mut }: { data: DevData; mut: Mut }) {
  const list = [...data.notes].sort(sortNotes);
  const [sel, setSel] = useState<string | null>(list[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<DevNote | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const onImport = (notes: ParsedNote[]) => {
    const now = Date.now();
    const mapped: DevNote[] = notes.map((n) => ({
      id: uid("n"), title: n.title || "未命名笔记", body: n.body || "",
      category: n.category, tags: n.tags && n.tags.length ? n.tags : undefined,
      createdAt: n.createdAt || now, updatedAt: n.updatedAt || now,
    }));
    mut((d) => { d.notes.unshift(...mapped); });
    if (mapped[0]) setSel(mapped[0].id);
  };

  useEffect(() => {
    const n = data.notes.find((x) => x.id === sel) ?? null;
    setDraft(n);
    setTagsText(n?.tags?.join(", ") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  // 自动保存（防抖）
  useEffect(() => {
    if (!draft) return;
    const id = setTimeout(() => {
      mut((d) => {
        const n = d.notes.find((x) => x.id === draft.id);
        if (!n) return;
        n.title = draft.title; n.body = draft.body; n.category = draft.category; n.tags = draft.tags; n.pinned = draft.pinned; n.updatedAt = Date.now();
      });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const filtered = q.trim()
    ? list.filter((n) => (n.title + n.body + (n.tags?.join(" ") ?? "")).toLowerCase().includes(q.trim().toLowerCase()))
    : list;

  const create = () => {
    const n: DevNote = { id: uid("n"), title: "未命名笔记", body: "", createdAt: Date.now(), updatedAt: Date.now() };
    mut((d) => { d.notes.unshift(n); });
    setSel(n.id);
  };
  const del = () => {
    if (!draft) return;
    const id = draft.id;
    const rest = list.filter((n) => n.id !== id);
    mut((d) => { d.notes = d.notes.filter((n) => n.id !== id); });
    setSel(rest[0]?.id ?? null);
  };
  const patch = (p: Partial<DevNote>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, height: 600 }}>
      {/* 列表 */}
      <div style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: 10, display: "flex", gap: 8, borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)" }}>
            <IconSearch />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索笔记" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--text-primary)" }} />
          </div>
          <button className="fv-icnbtn" onClick={() => setShowImport(true)} title="导入笔记" style={{ width: 32, height: 32, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--text-secondary)" }}><IconImport size={15} /></button>
          <button className="fv-icnbtn" onClick={create} title="新建笔记" style={{ width: 32, height: 32, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: ACCENT_SOFT, border: "none", cursor: "pointer", color: "var(--accent)" }}><IconPlus size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map((n) => (
            <button key={n.id} onClick={() => setSel(n.id)} className="fv-row" style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: "0.5px solid var(--separator)", cursor: "pointer", padding: "10px 12px", background: sel === n.id ? "var(--fill-q)" : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {n.pinned && <IconPin size={12} stroke="var(--accent)" />}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title || "未命名笔记"}</span>
                {n.category && <span style={{ marginLeft: "auto", flex: "none" }}><Tag>{n.category}</Tag></span>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.body.split("\n")[0] || "（空）"}</div>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--text-tertiary)" }}>没有笔记</div>}
        </div>
      </div>

      {/* 编辑器 */}
      <div style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!draft ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-tertiary)" }}>
            <IconPlus size={26} stroke="var(--text-tertiary)" />
            <div style={{ fontSize: 13 }}>选择左侧笔记，或新建一篇</div>
            <Btn variant="soft" onClick={create}>新建笔记</Btn>
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "0.5px solid var(--separator)" }}>
              <input value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="标题" style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                <TextField value={draft.category ?? ""} onChange={(e) => patch({ category: e.target.value || undefined })} placeholder="分类" style={{ width: 120, height: 30, fontSize: 12.5 }} />
                <TextField value={tagsText} onChange={(e) => { setTagsText(e.target.value); patch({ tags: parseTags(e.target.value) }); }} placeholder="标签（逗号分隔）" style={{ flex: 1, height: 30, fontSize: 12.5 }} />
                <div style={{ width: 124, flex: "none" }}><Segmented value={mode} onChange={(v) => setMode(v as "edit" | "preview")} options={[{ value: "edit", label: "编辑" }, { value: "preview", label: "预览" }]} /></div>
                <button className="fv-tap" onClick={() => patch({ pinned: !draft.pinned })} title="置顶" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 30, padding: "0 10px", borderRadius: 8, border: "0.5px solid var(--separator)", cursor: "pointer", background: draft.pinned ? ACCENT_SOFT : "var(--fill-q)", color: draft.pinned ? "var(--accent)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}><IconPin size={13} stroke="currentColor" />{draft.pinned ? "已置顶" : "置顶"}</button>
                <button className="fv-icnbtn" onClick={del} title="删除笔记" style={{ width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--fill-q)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--red)" }}><IconTrash size={14} stroke="currentColor" /></button>
              </div>
            </div>
            {mode === "edit" ? (
              <TextArea value={draft.body} onChange={(e) => patch({ body: e.target.value })} placeholder="开始记录…（支持 Markdown：# 标题、- 列表、**加粗**、`代码`、> 引用、```代码块```）" style={{ flex: 1, border: "none", borderRadius: 0, background: "transparent", resize: "none", fontSize: 13.5, lineHeight: 1.7, padding: "14px 16px", height: "auto" }} />
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>{draft.body.trim() ? <Markdown text={draft.body} /> : <div style={{ color: "var(--text-tertiary)", fontSize: 13, paddingTop: 8 }}>（空）切到「编辑」开始写。</div>}</div>
            )}
          </>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={onImport} />}
    </div>
  );
}
