import { useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { MediaGrid } from "../components/Media";
import { Btn, EmptyState, card } from "../ui";
import { IconUser, IconChevron } from "../icons";

export default function People({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items, persons, thumbUrl, scanFaces, renamePerson } = useLibrary();
  const [sel, setSel] = useState<string | null>(null);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState("");

  const avatars = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of persons) if (p.avatar) m.set(p.id, URL.createObjectURL(p.avatar));
    return m;
  }, [persons]);

  const scanned = items.filter((i) => i.kind === "image" && i.people !== undefined).length;
  const pending = items.filter((i) => i.kind === "image" && i.people === undefined).length;
  const sorted = useMemo(() => persons.slice().sort((a, b) => b.count - a.count), [persons]);

  const run = async () => {
    setErr(null); setProg({ done: 0, total: pending });
    try { await scanFaces((d, t) => setProg({ done: d, total: t })); }
    catch { setErr("人脸库加载失败：请检查网络（首次需联网下载模型），并使用 Chrome / Edge。"); }
    setProg(null);
  };

  const ScanBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <Btn onClick={run} disabled={!!prog || pending === 0}>{prog ? `扫描中… ${prog.done}/${prog.total}` : pending > 0 ? `扫描人脸（${pending} 张待处理）` : "已全部扫描"}</Btn>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>已扫描 {scanned} 张 · 识别出 {persons.length} 人。首次需联网下载模型，识别在本地完成。</span>
    </div>
  );

  if (sel) {
    const p = persons.find((x) => x.id === sel);
    if (!p) { setSel(null); return null; }
    const list = items.filter((i) => i.people?.includes(p.id));
    return (
      <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
        <button onClick={() => setSel(null)} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13.5, fontWeight: 500, marginBottom: 14 }}>
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={16} stroke="var(--accent)" /></span>人物
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <Avatar url={avatars.get(p.id)} size={64} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input value={editing} onChange={(e) => setEditing(e.target.value)} placeholder={p.name || "未命名"} style={{ fontSize: 18, fontWeight: 600, padding: "6px 10px", border: "1px solid var(--separator)", borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-primary)" }} />
            <Btn variant="soft" onClick={() => { if (editing.trim()) renamePerson(p.id, editing.trim()); }}>保存名字</Btn>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>{list.length} 张照片</span>
        </div>
        <MediaGrid items={list} onOpenIndex={(i) => onOpen(list, i)} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      {ScanBar}
      {err && <div style={{ fontSize: 12.5, color: "var(--orange)", marginBottom: 14 }}>{err}</div>}
      {persons.length === 0 ? (
        <EmptyState icon={<IconUser size={28} stroke="var(--text-tertiary)" />} text={scanned > 0 ? "未识别到人脸" : "点上方「扫描人脸」开始按人物归类"} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
          {sorted.map((p) => {
            const cover = items.find((i) => i.people?.includes(p.id));
            return (
              <button key={p.id} onClick={() => { setSel(p.id); setEditing(p.name || ""); }} className="fv-card-int" style={{ ...card, padding: "16px 12px", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
                <Avatar url={avatars.get(p.id) || (cover ? thumbUrl(cover.id) : undefined)} size={84} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{p.name || "未命名"}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{p.count} 张</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Avatar({ url, size }: { url?: string; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "var(--fill-quaternary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconUser size={size * 0.5} stroke="var(--text-tertiary)" />}
    </div>
  );
}
