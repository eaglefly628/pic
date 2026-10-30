import { useEffect, useRef, useState, type PointerEvent } from "react";
import { card } from "../ui";

type Sample = { id: string; sourceName: string; status: "active" | "removed" };
type Person = { id: string; name: string; assignedCount: number; samples: Sample[] };
type Rect = { x: number; y: number; w: number; h: number };
const button = { border: "1px solid var(--separator)", background: "var(--bg-elevated)", color: "var(--text-primary)", borderRadius: 8, padding: "7px 11px", cursor: "pointer" } as const;
const muted = { color: "var(--text-tertiary)", fontSize: 12, lineHeight: 1.6 } as const;

async function post(action: string, body: object) {
  const response = await fetch(`/api/photos/people/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json() as { ok: boolean; error?: string };
  if (!result.ok) throw new Error(result.error || "保存失败");
}

function normalizedPoint(event: PointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
}

export default function PeopleReferenceLibrary({ onSelectPerson }: { onSelectPerson?: (person: { id: string; name: string } | null) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState("");
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const image = useRef<HTMLImageElement>(null);
  const section = useRef<HTMLElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const chosen = people.find((person) => person.id === selected);
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { onSelectPerson?.(chosen ? { id: chosen.id, name: chosen.name } : null); }, [chosen?.id, chosen?.name]);

  const refresh = async () => {
    const response = await fetch("/api/photos/people", { cache: "no-store" });
    const data = await response.json() as { ok: boolean; people: Person[]; error?: string };
    if (!data.ok) throw new Error(data.error || "人物样本库不可用");
    setPeople(data.people);
    if (!selected && data.people.length) setSelected(data.people[0].id);
  };
  useEffect(() => { void refresh().catch((err) => setError(String(err))); }, []);
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);
  useEffect(() => { setRename(chosen?.name || ""); }, [chosen?.id, chosen?.name]);

  const act = async (action: string, body: object) => {
    setBusy(true); setError("");
    try { await post(action, body); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "保存失败"); }
    finally { setBusy(false); }
  };
  const chooseFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("请选择照片文件"); return; }
    setPicked({ file, url: URL.createObjectURL(file) });
    setRect(null); setError("");
  };
  useEffect(() => {
    const fromGallery = async (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; name: string }>).detail;
      if (!detail?.path || !detail?.name) return;
      if (!selectedRef.current) {
        setError("请先在上方添加人物，再从图库挑选照片作为样本");
        section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      try {
        const response = await fetch(`/api/photos/browse/preview?${new URLSearchParams({ path: detail.path })}`);
        if (!response.ok) throw new Error("无法读取这张照片的预览");
        const blob = await response.blob();
        chooseFile(new File([blob], detail.name, { type: "image/jpeg" }));
        section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) { setError(err instanceof Error ? err.message : "无法选择这张照片"); }
    };
    window.addEventListener("photo-person-sample-request", fromGallery);
    return () => window.removeEventListener("photo-person-sample-request", fromGallery);
  }, []);
  const saveSample = async () => {
    const img = image.current;
    if (!img || !picked || !chosen || !rect || rect.w < 0.03 || rect.h < 0.03) {
      setError("先在照片上框选一张清晰的人脸"); return;
    }
    setBusy(true); setError("");
    try {
      const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("浏览器无法裁剪图片");
      const side = Math.max(rect.w * img.naturalWidth, rect.h * img.naturalHeight) * 1.3;
      const cx = (rect.x + rect.w / 2) * img.naturalWidth;
      const cy = (rect.y + rect.h / 2) * img.naturalHeight;
      const size = Math.min(side, img.naturalWidth, img.naturalHeight);
      const sx = Math.max(0, Math.min(img.naturalWidth - size, cx - size / 2));
      const sy = Math.max(0, Math.min(img.naturalHeight - size, cy - size / 2));
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("裁剪失败")), "image/jpeg", 0.85));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let raw = ""; for (const byte of bytes) raw += String.fromCharCode(byte);
      await post("add-sample", { personId: chosen.id, sourceName: picked.file.name, jpegBase64: btoa(raw) });
      setPicked(null); setRect(null); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "保存样本失败"); }
    finally { setBusy(false); }
  };

  return <section ref={section} style={{ ...card, padding: 20, marginBottom: 16, color: "var(--text-primary)" }}>
    <strong>建立人物样本库</strong>
    <p style={muted}>先给每个人取名，再选几张不同角度、不同年份的清晰照片，用鼠标框出对应的脸。只保存裁下的脸部样本到这台电脑；原照片保持不变。全库人脸扫描尚未启动。</p>
    <form onSubmit={(event) => { event.preventDefault(); if (newName.trim()) { void act("create", { name: newName.trim() }); setNewName(""); } }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="人物姓名或称呼" maxLength={60}
        aria-label="新人物姓名" style={{ ...button, cursor: "text", flex: "1 1 160px" }} />
      <button style={button} disabled={busy || !newName.trim()}>添加人物</button>
    </form>
    {people.length === 0 && <div style={muted}>还没有人物。添加后即可保存脸部样本。</div>}
    {people.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,180px) minmax(0,1fr)", gap: 16 }}>
      <div style={{ display: "grid", gap: 5, alignContent: "start" }}>
        {people.map((person) => <button key={person.id} onClick={() => setSelected(person.id)} style={{ ...button, textAlign: "left", background: selected === person.id ? "var(--accent-soft)" : "var(--bg-elevated)" }}>
          {person.name} <span style={muted}>· 已归类 {person.assignedCount} 张 · {person.samples.filter((sample) => sample.status === "active").length}/3 张样本</span>
        </button>)}
      </div>
      {chosen && <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input value={rename} onChange={(event) => setRename(event.target.value)} aria-label="修改人物名称" maxLength={60} style={{ ...button, cursor: "text" }} />
          <button style={button} disabled={busy || !rename.trim() || rename.trim() === chosen.name} onClick={() => void act("rename", { personId: chosen.id, name: rename.trim() })}>保存名字</button>
          <label style={{ ...button, display: "inline-block", opacity: chosen.samples.filter((sample) => sample.status === "active").length >= 3 ? .5 : 1 }}>选择照片<input type="file" accept="image/*" disabled={chosen.samples.filter((sample) => sample.status === "active").length >= 3} onChange={(event) => chooseFile(event.target.files?.[0])} style={{ display: "none" }} /></label>
        </div>
        {picked && <div>
          <div style={{ ...muted, marginBottom: 6 }}>在照片上按住鼠标，框住「{chosen.name}」的脸；多人合照只框其中一人。</div>
          <div onPointerDown={(event) => { const point = normalizedPoint(event); origin.current = point; event.currentTarget.setPointerCapture(event.pointerId); setRect({ ...point, w: 0, h: 0 }); }}
            onPointerMove={(event) => { if (!origin.current) return; const p = normalizedPoint(event); const a = origin.current; setRect({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) }); }}
            onPointerUp={() => { origin.current = null; }}
            style={{ position: "relative", display: "inline-block", width: "min(100%,520px)", cursor: "crosshair", touchAction: "none" }}>
            <img ref={image} src={picked.url} alt="待框选的人物照片" draggable={false} style={{ width: "100%", display: "block", userSelect: "none" }} />
            {rect && <div aria-hidden style={{ position: "absolute", left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, border: "2px solid var(--accent)", background: "rgba(40,100,255,.12)", pointerEvents: "none" }} />}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}><button style={button} disabled={busy || !rect} onClick={() => void saveSample()}>保存脸部样本</button><button style={button} onClick={() => setPicked(null)}>取消</button></div>
        </div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {chosen.samples.map((sample) => <div key={sample.id} style={{ width: 112, opacity: sample.status === "removed" ? 0.5 : 1 }}>
            <img src={`/api/photos/people/sample?id=${sample.id}`} alt={`${chosen.name} 的脸部样本`} style={{ width: 104, height: 104, objectFit: "cover", borderRadius: 10 }} />
            <div style={{ ...muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sample.sourceName}>{sample.sourceName}</div>
            <button style={{ ...button, padding: "3px 7px", fontSize: 11 }} disabled={busy} onClick={() => void act(sample.status === "active" ? "remove-sample" : "restore-sample", { sampleId: sample.id })}>{sample.status === "active" ? "移除样本" : "恢复样本"}</button>
          </div>)}
        </div>
      </div>}
    </div>}
    {error && <div role="alert" style={{ color: "var(--red)", fontSize: 12, marginTop: 12 }}>{error}</div>}
  </section>;
}
