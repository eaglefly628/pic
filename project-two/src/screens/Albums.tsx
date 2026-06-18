import { useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { MediaGrid } from "../components/Media";
import { Btn, EmptyState, Modal, Field, TextField, card } from "../ui";
import { IconAlbum, IconChevron } from "../icons";

export default function Albums({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items, albums, createAlbum, thumbUrl } = useLibrary();
  const [sel, setSel] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");

  const byAlbum = useMemo(() => {
    const m = new Map<string, MediaItem[]>();
    for (const it of items) if (!it.private) for (const a of it.albums) (m.get(a) ?? m.set(a, []).get(a)!).push(it);
    return m;
  }, [items]);

  if (sel) {
    const album = albums.find((a) => a.id === sel);
    const list = byAlbum.get(sel) ?? [];
    return (
      <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
        <button onClick={() => setSel(null)} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13.5, fontWeight: 500, marginBottom: 14 }}>
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={16} stroke="var(--accent)" /></span>相册
        </button>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>{album?.name}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 10 }}>{list.length} 项</span></div>
        {list.length ? <MediaGrid items={list} onOpenIndex={(i) => onOpen(list, i)} /> : <EmptyState text="这个相册还没有内容（导入时可选择加入相册）" />}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>共 {albums.length} 个相册</div>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => { setName(""); setNewOpen(true); }}>新建相册</Btn>
      </div>
      {albums.length === 0 ? (
        <EmptyState icon={<IconAlbum size={28} stroke="var(--text-tertiary)" />} text="还没有相册" action={<Btn variant="soft" onClick={() => setNewOpen(true)}>新建相册</Btn>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          {albums.map((a) => {
            const list = byAlbum.get(a.id) ?? [];
            const cover = list[0];
            const url = cover && thumbUrl(cover.id);
            return (
              <button key={a.id} onClick={() => setSel(a.id)} className="fv-card-int" style={{ ...card, padding: 0, border: "none", cursor: "pointer", overflow: "hidden", textAlign: "left" }}>
                <div style={{ aspectRatio: "4/3", background: "var(--fill-quaternary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {url ? <img src={url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconAlbum size={26} stroke="var(--text-tertiary)" />}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{list.length} 项</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={newOpen} title="新建相册" onClose={() => setNewOpen(false)} width={380}
        footer={<><Btn variant="ghost" onClick={() => setNewOpen(false)}>取消</Btn><Btn onClick={async () => { if (name.trim()) { await createAlbum(name.trim()); setNewOpen(false); } }}>创建</Btn></>}>
        <Field label="相册名称"><TextField value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="如 2024 三亚之行" /></Field>
      </Modal>
    </div>
  );
}
