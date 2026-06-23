import { useEffect, useState } from "react";
import type { CollectionDef, DevData, FieldDef, FieldValue, LifeItem } from "../../types";
import { presetCollections } from "../../data/lifeSample";
import { Btn, TextField, TextArea, Select, card } from "../../ui";
import { IconPlus, IconTrash, IconSearch, IconClose, IconGear } from "../../icons";
import { uid, Tag } from "./shared";
import { FIELD_TYPES, FieldInput, Stars, fieldDisplay, typeLabel } from "./life/fields";

type Mut = (fn: (d: DevData) => void) => void;
const COLORS = ["#0A84FF", "#5E5CE6", "#34C759", "#FF9500", "#FF375F", "#30B0C7", "#BF5AF2", "#8E8E93"];

export default function Life({ data, mut }: { data: DevData; mut: Mut }) {
  const cols = data.collections;
  const [selId, setSelId] = useState<string | null>(cols[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [editItem, setEditItem] = useState<LifeItem | null>(null);
  const [editCol, setEditCol] = useState<CollectionDef | null>(null);

  // 首次进入且为空：载入预置集合
  useEffect(() => {
    if (data.collections.length === 0 && data.lifeItems.length === 0) {
      const p = presetCollections();
      mut((d) => { d.collections = p.collections; d.lifeItems = p.items; });
      setSelId(p.collections[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const col = cols.find((c) => c.id === selId) ?? cols[0] ?? null;
  const items = data.lifeItems.filter((i) => i.collectionId === col?.id);
  const ql = q.trim().toLowerCase();
  const shown = ql
    ? items.filter((i) => (i.title + " " + (i.tags?.join(" ") ?? "") + " " + col!.fields.map((fd) => fieldDisplay(fd, i.values[fd.id])).join(" ")).toLowerCase().includes(ql))
    : items;

  const newCollection = () => setEditCol({ id: uid("c"), name: "新集合", emoji: "📦", color: "#0A84FF", fields: [], createdAt: Date.now(), updatedAt: Date.now() });
  const newItem = () => col && setEditItem({ id: uid("i"), collectionId: col.id, title: "", values: {}, createdAt: Date.now(), updatedAt: Date.now() });

  const saveItem = (it: LifeItem) => {
    mut((d) => { const i = d.lifeItems.findIndex((x) => x.id === it.id); if (i >= 0) d.lifeItems[i] = { ...it, updatedAt: Date.now() }; else d.lifeItems.unshift(it); });
  };
  const delItem = (idv: string) => mut((d) => { d.lifeItems = d.lifeItems.filter((x) => x.id !== idv); });
  const toggleFav = (it: LifeItem) => mut((d) => { const x = d.lifeItems.find((y) => y.id === it.id); if (x) x.favorite = !x.favorite; });

  const saveCollection = (c: CollectionDef) => {
    mut((d) => { const i = d.collections.findIndex((x) => x.id === c.id); if (i >= 0) d.collections[i] = { ...c, updatedAt: Date.now() }; else d.collections.push(c); });
    setSelId(c.id);
  };
  const delCollection = (c: CollectionDef) => {
    if (!confirm(`删除集合「${c.name}」及其 ${data.lifeItems.filter((i) => i.collectionId === c.id).length} 条内容？`)) return;
    mut((d) => { d.collections = d.collections.filter((x) => x.id !== c.id); d.lifeItems = d.lifeItems.filter((i) => i.collectionId !== c.id); });
    setSelId(cols.find((x) => x.id !== c.id)?.id ?? null);
  };

  const sortedItems = [...shown].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || b.updatedAt - a.updatedAt);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "212px 1fr", gap: 14, alignItems: "start" }}>
      {/* 集合侧栏 */}
      <div style={{ ...card, padding: 8 }}>
        {cols.map((c) => (
          <button key={c.id} onClick={() => setSelId(c.id)} className="fv-nav" style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 9, background: col?.id === c.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent", color: col?.id === c.id ? "var(--accent)" : "var(--text-primary)", marginBottom: 1 }}>
            <span style={{ fontSize: 16 }}>{c.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{data.lifeItems.filter((i) => i.collectionId === c.id).length}</span>
          </button>
        ))}
        <button onClick={newCollection} className="fv-nav" style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 9, background: "transparent", color: "var(--text-secondary)", marginTop: 2 }}>
          <IconPlus size={14} /><span style={{ fontSize: 12.5 }}>新建集合</span>
        </button>
      </div>

      {/* 内容区 */}
      <div>
        {!col ? (
          <div style={{ ...card, padding: "50px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>
            还没有集合 —— 点左侧「新建集合」开始，给它定义你自己的字段。
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 20 }}>{col.emoji}</span>{col.name}<span style={{ fontSize: 12.5, fontWeight: 400, color: "var(--text-tertiary)" }}>{items.length}</span></div>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, width: 180, height: 34, padding: "0 11px", borderRadius: 9, background: "var(--fill-q)", border: "0.5px solid var(--separator)" }}>
                <IconSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }} />
              </div>
              <Btn variant="ghost" onClick={() => setEditCol(col)}><IconGear size={14} stroke="currentColor" />字段</Btn>
              <Btn onClick={newItem}><IconPlus size={15} />添加</Btn>
            </div>

            {sortedItems.length === 0 ? (
              <div style={{ ...card, padding: "44px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>{q ? "没有匹配的条目" : `「${col.name}」还没有内容，点右上「添加」`}</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, alignItems: "start" }}>
                {sortedItems.map((it) => (
                  <button key={it.id} onClick={() => setEditItem(it)} className="fv-card-int" style={{ ...card, padding: "13px 15px", textAlign: "left", cursor: "pointer", border: "0.5px solid var(--separator)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title || "未命名"}</span>
                      {it.rating ? <Stars value={it.rating} size={13} /> : null}
                      <span onClick={(e) => { e.stopPropagation(); toggleFav(it); }} title="收藏" style={{ fontSize: 15, color: it.favorite ? "#FF9F0A" : "var(--track)", cursor: "pointer" }}>★</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: it.title ? 9 : 0 }}>
                      {col.fields.map((fd) => { const s = fieldDisplay(fd, it.values[fd.id]); return s ? (
                        <span key={fd.id} style={{ fontSize: 11.5, color: "var(--text-secondary)" }}><span style={{ color: "var(--text-tertiary)" }}>{fd.label}</span> {s}</span>
                      ) : null; })}
                    </div>
                    {it.tags && it.tags.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>{it.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editItem && col && <ItemEditor key={editItem.id} col={col} initial={editItem} onClose={() => setEditItem(null)} onSave={(it) => { saveItem(it); setEditItem(null); }} onDelete={() => { delItem(editItem.id); setEditItem(null); }} />}
      {editCol && <CollectionEditor key={editCol.id} initial={editCol} isNew={!cols.some((c) => c.id === editCol.id)} onClose={() => setEditCol(null)} onSave={(c) => { saveCollection(c); setEditCol(null); }} onDelete={() => { delCollection(editCol); setEditCol(null); }} />}
    </div>
  );
}

// ── 条目编辑 ──────────────────────────────────────────────
function ItemEditor({ col, initial, onClose, onSave, onDelete }: { col: CollectionDef; initial: LifeItem; onClose: () => void; onSave: (it: LifeItem) => void; onDelete: () => void }) {
  const [it, setIt] = useState<LifeItem>(initial);
  const isNew = !initial.title && Object.keys(initial.values).length === 0;
  const setVal = (fid: string, v: FieldValue) => setIt((s) => ({ ...s, values: { ...s.values, [fid]: v } }));
  const setTags = (s: string) => setIt((x) => ({ ...x, tags: s.split(/[,，]/).map((t) => t.trim()).filter(Boolean) }));

  return (
    <Overlay onClose={onClose} title={`${col.emoji} ${isNew ? "添加" : "编辑"}`} width={560}
      footer={<>
        {!isNew && <Btn variant="danger" onClick={onDelete}>删除</Btn>}
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onClose}>取消</Btn>
        <Btn onClick={() => onSave(it)} disabled={!it.title.trim()}>保存</Btn>
      </>}>
      <Lbl t="名称">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TextField value={it.title} onChange={(e) => setIt({ ...it, title: e.target.value })} placeholder="主名" autoFocus style={{ flex: 1 }} />
          <span title="收藏" onClick={() => setIt({ ...it, favorite: !it.favorite })} style={{ fontSize: 20, cursor: "pointer", color: it.favorite ? "#FF9F0A" : "var(--track)" }}>★</span>
        </div>
      </Lbl>
      <Lbl t="评分"><Stars value={it.rating ?? 0} onChange={(n) => setIt({ ...it, rating: n })} size={22} /></Lbl>
      {col.fields.map((fd) => (
        <Lbl key={fd.id} t={fd.label + (fd.secret ? " 🔒" : "")}>
          <FieldInput field={fd} value={it.values[fd.id]} onChange={(v) => setVal(fd.id, v)} />
        </Lbl>
      ))}
      <Lbl t="标签"><TextField value={it.tags?.join(", ") ?? ""} onChange={(e) => setTags(e.target.value)} placeholder="逗号分隔" /></Lbl>
      <Lbl t="备注"><TextArea value={it.notes ?? ""} onChange={(e) => setIt({ ...it, notes: e.target.value })} /></Lbl>
    </Overlay>
  );
}

// ── 集合 / 字段编辑（定义数据格式）─────────────────────────
function CollectionEditor({ initial, isNew, onClose, onSave, onDelete }: { initial: CollectionDef; isNew: boolean; onClose: () => void; onSave: (c: CollectionDef) => void; onDelete: () => void }) {
  const [c, setC] = useState<CollectionDef>(initial);
  const setField = (id: string, p: Partial<FieldDef>) => setC((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, ...p } : f)) }));
  const addField = () => setC((s) => ({ ...s, fields: [...s.fields, { id: uid("f"), label: "新字段", type: "text" }] }));
  const delField = (id: string) => setC((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== id) }));

  return (
    <Overlay onClose={onClose} title={isNew ? "新建集合" : "编辑集合 / 字段"} width={600}
      footer={<>
        {!isNew && <Btn variant="danger" onClick={onDelete}>删除集合</Btn>}
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onClose}>取消</Btn>
        <Btn onClick={() => onSave(c)} disabled={!c.name.trim()}>保存</Btn>
      </>}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 6 }}>
        <Lbl t="图标" style={{ marginBottom: 0 }}><TextField value={c.emoji} onChange={(e) => setC({ ...c, emoji: e.target.value.slice(0, 2) })} style={{ width: 64, textAlign: "center", fontSize: 18 }} /></Lbl>
        <Lbl t="集合名称" style={{ flex: 1, marginBottom: 0 }}><TextField value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Lbl>
      </div>
      <Lbl t="颜色">
        <div style={{ display: "flex", gap: 8 }}>{COLORS.map((col) => (
          <span key={col} onClick={() => setC({ ...c, color: col })} style={{ width: 22, height: 22, borderRadius: "50%", background: col, cursor: "pointer", boxShadow: c.color === col ? "0 0 0 2px var(--bg-elevated), 0 0 0 4px " + col : "none" }} />
        ))}</div>
      </Lbl>

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "16px 0 8px" }}>字段（这就是它的数据格式）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {c.fields.map((f) => (
          <div key={f.id} style={{ border: "0.5px solid var(--separator)", borderRadius: 10, padding: "9px 11px", background: "var(--fill-q)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <TextField value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} placeholder="字段名" style={{ flex: 1 }} />
              <div style={{ width: 120 }}><Select value={f.type} onChange={(e) => setField(f.id, { type: e.target.value as FieldDef["type"] })} options={FIELD_TYPES.map((t) => ({ value: t.type, label: t.label }))} /></div>
              <button onClick={() => delField(f.id)} className="fv-icnbtn" title="删除字段" style={{ width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><IconTrash size={14} stroke="currentColor" /></button>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
                <input type="checkbox" checked={!!f.secret} onChange={(e) => setField(f.id, { secret: e.target.checked })} /> 私密（打码）
              </label>
              {(f.type === "number" || f.type === "money") && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>单位<TextField value={f.unit ?? ""} onChange={(e) => setField(f.id, { unit: e.target.value })} style={{ width: 70, height: 28 }} /></span>}
              {f.type === "select" && <span style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, fontSize: 12, color: "var(--text-secondary)" }}>选项<TextField value={f.options?.join(", ") ?? ""} onChange={(e) => setField(f.id, { options: e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) })} placeholder="逗号分隔" style={{ flex: 1, height: 28 }} /></span>}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>{typeLabel(f.type)}</span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addField} className="fv-tap" style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, border: "0.5px dashed var(--separator)", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 9, cursor: "pointer" }}><IconPlus size={14} />添加字段</button>
    </Overlay>
  );
}

// ── 通用弹层 / 表单行 ─────────────────────────────────────
function Overlay({ title, width = 560, onClose, children, footer }: { title: string; width?: number; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{ ...card, width, maxWidth: "92%", maxHeight: "88%", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fvPop .18s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <div style={{ flex: 1 }} />
          <button className="fv-icnbtn" onClick={onClose} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}><IconClose size={17} stroke="currentColor" /></button>
        </div>
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "0.5px solid var(--separator)" }}>{footer}</div>
      </div>
    </div>
  );
}
function Lbl({ t, children, style }: { t: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "block", marginBottom: 13, ...style }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 5 }}>{t}</div>
      {children}
    </label>
  );
}
