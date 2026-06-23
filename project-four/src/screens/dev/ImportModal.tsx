import { useMemo, useRef, useState } from "react";
import type { ParsedNote } from "../../lib/import";
import { ACCEPT, IMPORTERS, parseFiles, type FileResult } from "../../lib/import";
import { Btn, TextField, card } from "../../ui";
import { IconImport, IconClose, IconNote, IconCheck } from "../../icons";
import { Tag } from "./shared";

export default function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (notes: ParsedNote[]) => void }) {
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const flat = useMemo(() => {
    const out: { key: string; note: ParsedNote; fi: number }[] = [];
    results?.forEach((r, fi) => r.notes.forEach((note, ni) => out.push({ key: `${fi}:${ni}`, note, fi })));
    return out;
  }, [results]);
  const total = flat.length;

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const res = await parseFiles(files);
    setResults(res);
    const keys = new Set<string>();
    res.forEach((r, fi) => r.notes.forEach((_, ni) => keys.add(`${fi}:${ni}`)));
    setSel(keys);
    setBusy(false);
  };

  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allSelected = total > 0 && sel.size === total;
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(flat.map((x) => x.key)));

  const doImport = () => {
    const cat = category.trim() || undefined;
    const picked = flat.filter((x) => sel.has(x.key)).map((x) => ({ ...x.note, category: x.note.category || cat }));
    if (picked.length) onImport(picked);
    onClose();
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width: 680, maxWidth: "92%", maxHeight: "88%", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "15px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <IconImport size={17} stroke="var(--accent)" />
          <div style={{ fontSize: 15, fontWeight: 700 }}>导入笔记</div>
          <div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} title="关闭" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}><IconClose size={17} stroke="currentColor" /></button>
        </div>

        <div className="" style={{ padding: 20, overflowY: "auto" }}>
          {!results ? (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles([...e.dataTransfer.files]); }}
                style={{ border: `1.5px dashed ${drag ? "var(--accent)" : "var(--separator)"}`, background: drag ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--fill-q)", borderRadius: 14, padding: "40px 20px", textAlign: "center", cursor: "pointer", transition: "border-color .15s, background .15s" }}>
                <div style={{ width: 52, height: 52, margin: "0 auto 14px", borderRadius: 14, background: "color-mix(in srgb, var(--accent) 14%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconImport size={24} stroke="var(--accent)" /></div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)" }}>{busy ? "解析中…" : "把文件拖到这里，或点击选择"}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.6 }}>支持多选；.zip 会自动展开整库</div>
              </div>
              <input ref={fileRef} type="file" multiple accept={ACCEPT} style={{ display: "none" }}
                onChange={(e) => { handleFiles([...(e.target.files || [])]); e.currentTarget.value = ""; }} />
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>已支持的来源 / 格式</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {IMPORTERS.map((i) => <Tag key={i.id}>{i.label}</Tag>)}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 12 }}>
                  覆盖 OneNote / Evernote / Notion / Obsidian / Bear / Logseq / Joplin / Apple Notes / Google Keep 等主流笔记。
                  非主流来源：导出成 Markdown、HTML、JSON 或 CSV 即可导入；要原生支持新格式也只需加一个解析器（接口已留好）。
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>共解析出 <strong style={{ color: "var(--text-primary)" }}>{total}</strong> 篇笔记</div>
                <div style={{ flex: 1 }} />
                {total > 0 && <button onClick={toggleAll} className="fv-tap" style={linkBtn}>{allSelected ? "取消全选" : "全选"}</button>}
                <button onClick={() => { setResults(null); setSel(new Set()); }} className="fv-tap" style={linkBtn}>重新选择</button>
              </div>

              {results.map((r, fi) => (
                <div key={fi} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>{r.fileName}</span>
                    {r.importer && <Tag>{r.importer.label}</Tag>}
                    {r.error ? <span style={{ fontSize: 11.5, color: "var(--red)" }}>{r.error}</span>
                      : <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{r.notes.length} 篇</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {r.notes.map((note, ni) => {
                      const key = `${fi}:${ni}`;
                      const on = sel.has(key);
                      return (
                        <button key={key} onClick={() => toggle(key)} className="fv-tap" style={{ display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", width: "100%", padding: "9px 11px", borderRadius: 10, border: "0.5px solid var(--separator)", background: on ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--fill-q)", cursor: "pointer" }}>
                          <span style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--accent)" : "transparent", border: on ? "none" : "1.5px solid var(--text-tertiary)" }}>{on && <IconCheck size={12} stroke="#fff" />}</span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <IconNote size={13} stroke="var(--text-tertiary)" />
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note.title || "未命名笔记"}</span>
                            </span>
                            <span style={{ display: "block", fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(note.body || "（空）").replace(/\s+/g, " ").slice(0, 90)}</span>
                          </span>
                          {note.tags && note.tags.length > 0 && <span style={{ flex: "none" }}><Tag>{note.tags.length} 标签</Tag></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {results && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>
            <TextField value={category} onChange={(e) => setCategory(e.target.value)} placeholder="统一分类（可选，仅用于未带分类的笔记）" style={{ flex: 1, height: 34 }} />
            <Btn variant="ghost" onClick={onClose}>取消</Btn>
            <Btn onClick={doImport} disabled={sel.size === 0}>导入 {sel.size} 篇</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = { border: "none", background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 };
