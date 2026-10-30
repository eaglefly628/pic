import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { BrowseItem } from "../lib/remoteIndex";
import { card } from "../ui";

type Person = { id: string; name: string; samples: { status: string }[]; assignedCount: number };
type Tagged = { id: string; name: string };
type Rect = { x: number; y: number; w: number; h: number };
const button = { border: "1px solid var(--separator)", background: "var(--bg-elevated)", color: "var(--text-primary)", borderRadius: 8, padding: "7px 11px", cursor: "pointer" } as const;
const muted = { color: "var(--text-tertiary)", fontSize: 12 } as const;

async function post(action: string, body: object): Promise<{ ok: boolean; error?: string; id?: string }> {
  const response = await fetch(`/api/photos/people/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return response.json();
}

function point(event: PointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
}

export default function AddPersonFromPhoto({ item, onClose, onSaved }: {
  item: BrowseItem; onClose: () => void; onSaved: () => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [tagged, setTagged] = useState<Tagged[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [personId, setPersonId] = useState("");
  const [name, setName] = useState("");
  const [addSample, setAddSample] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const image = useRef<HTMLImageElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const selected = people.find((person) => person.id === personId);
  const sampleCount = selected?.samples.filter((sample) => sample.status === "active").length || 0;
  const canSample = mode === "new" || sampleCount < 3;
  const previewUrl = `/api/photos/browse/preview?${new URLSearchParams({ path: item.relPath })}`;

  const refresh = async () => {
    const [listResponse, tagsResponse] = await Promise.all([
      fetch("/api/photos/people", { cache: "no-store" }),
      fetch(`/api/photos/people/for-media?${new URLSearchParams({ path: item.relPath })}`, { cache: "no-store" }),
    ]);
    const list = await listResponse.json() as { ok: boolean; people: Person[]; error?: string };
    const tags = await tagsResponse.json() as { ok: boolean; people: Tagged[]; error?: string };
    if (!list.ok || !tags.ok) throw new Error(list.error || tags.error || "人物库读取失败");
    setPeople(list.people);
    setTagged(tags.people);
    setPersonId((previous) => previous || list.people[0]?.id || "");
    if (!list.people.length) setMode("new");
  };
  useEffect(() => { void refresh().catch((err) => setError(String(err))); }, [item.relPath]);

  const crop = async () => {
    const img = image.current;
    if (!img || !img.complete || !img.naturalWidth || !rect || rect.w < .03 || rect.h < .03) {
      throw new Error("请先在照片里框选清晰的人脸");
    }
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法裁剪脸部照片");
    const side = Math.min(Math.max(rect.w * img.naturalWidth, rect.h * img.naturalHeight) * 1.3,
      img.naturalWidth, img.naturalHeight);
    const centerX = (rect.x + rect.w / 2) * img.naturalWidth;
    const centerY = (rect.y + rect.h / 2) * img.naturalHeight;
    const x = Math.max(0, Math.min(img.naturalWidth - side, centerX - side / 2));
    const y = Math.max(0, Math.min(img.naturalHeight - side, centerY - side / 2));
    context.drawImage(img, x, y, side, side, 0, 0, 256, 256);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("裁剪失败")), "image/jpeg", .85));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let raw = "";
    for (const byte of bytes) raw += String.fromCharCode(byte);
    return btoa(raw);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (mode === "new" && !name.trim()) throw new Error("请填写人物姓名或称呼");
      if (mode === "existing" && !personId) throw new Error("请选择人物");
      if (addSample && !canSample) throw new Error("此人物已有 3 张有效特征图");
      const jpegBase64 = addSample ? await crop() : null;
      let id = personId;
      if (mode === "new") {
        const created = await post("create", { name: name.trim() });
        if (!created.ok || !created.id) throw new Error(created.error || "添加人物失败");
        id = created.id;
      }
      if (jpegBase64) {
        const result = await post("add-sample", { personId: id, sourceName: item.name, jpegBase64 });
        if (!result.ok) throw new Error(result.error || "保存特征图失败");
      }
      const assigned = await post("assign", { personId: id, path: item.relPath });
      if (!assigned.ok) throw new Error(assigned.error || "关联照片失败");
      await refresh();
      onSaved();
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); }
    finally { setBusy(false); }
  };
  const unassign = async (id: string) => {
    setBusy(true); setError("");
    try {
      const result = await post("unassign", { personId: id, path: item.relPath });
      if (!result.ok) throw new Error(result.error || "移除归类失败");
      await refresh(); onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "移除归类失败"); }
    finally { setBusy(false); }
  };

  return <div role="dialog" aria-modal="true" aria-label="为照片添加人物" onClick={() => !busy && onClose()}
    style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,.62)", display: "grid", placeItems: "center", padding: 20 }}>
    <div onClick={(event) => event.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto", padding: 22, display: "grid", gap: 12 }}>
      <strong style={{ color: "var(--text-primary)" }}>为这张照片添加人物</strong>
      <span style={muted}>{item.name} · 可给多人合照逐个添加人物；特征图最多 3 张/人。</span>
      {tagged.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tagged.map((person) => <span key={person.id} style={{ ...button, cursor: "default" }}>{person.name} <button style={{ border: 0, background: "none", color: "var(--red)", cursor: "pointer" }} disabled={busy} onClick={() => void unassign(person.id)} aria-label={`移除${person.name}归类`}>×</button></span>)}
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={{ ...button, background: mode === "existing" ? "var(--accent-soft)" : "var(--bg-elevated)" }} disabled={!people.length} onClick={() => { setMode("existing"); setRect(null); }}>添加到已有的人物</button>
        <button style={{ ...button, background: mode === "new" ? "var(--accent-soft)" : "var(--bg-elevated)" }} onClick={() => { setMode("new"); setRect(null); }}>新建人物</button>
      </div>
      {mode === "existing" ? <select value={personId} onChange={(event) => { setPersonId(event.target.value); setRect(null); }} style={button} aria-label="选择人物">
        {people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.samples.filter((sample) => sample.status === "active").length}/3 张特征图 · 已归类 {person.assignedCount} 张</option>)}
      </select> : <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="输入新人物的姓名或称呼" aria-label="新人物姓名" style={{ ...button, cursor: "text" }} />}
      <label style={{ ...muted, display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={addSample && canSample} disabled={!canSample} onChange={(event) => { setAddSample(event.target.checked); setRect(null); }} />
        同时把这张照片中的脸保存为特征图{mode === "existing" ? `（已有 ${sampleCount}/3 张）` : ""}
      </label>
      {addSample && canSample && <>
        <span style={muted}>在照片上拖出人脸框。多人合照只框本次所选的人。</span>
        <div onPointerDown={(event) => { const p = point(event); origin.current = p; event.currentTarget.setPointerCapture(event.pointerId); setRect({ ...p, w: 0, h: 0 }); }}
          onPointerMove={(event) => { if (!origin.current) return; const p = point(event), a = origin.current; setRect({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) }); }}
          onPointerUp={() => { origin.current = null; }}
          style={{ position: "relative", display: "inline-block", width: "min(100%,540px)", cursor: "crosshair", touchAction: "none" }}>
          <img ref={image} src={previewUrl} alt="待框选脸部的照片" draggable={false} style={{ display: "block", width: "100%", userSelect: "none" }} />
          {rect && <div aria-hidden style={{ position: "absolute", left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, border: "2px solid var(--accent)", background: "rgba(40,100,255,.14)", pointerEvents: "none" }} />}
        </div>
      </>}
      {error && <div role="alert" style={{ color: "var(--red)", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button style={button} disabled={busy} onClick={onClose}>取消</button>
        <button style={button} disabled={busy || (mode === "new" ? !name.trim() : !personId) || (addSample && canSample && !rect)} onClick={() => void save()}>{busy ? "保存中…" : "保存人物归类"}</button>
      </div>
    </div>
  </div>;
}
