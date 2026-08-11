import { useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { buildEvents, eventTitle } from "../lib/events";
import { dateLabel } from "../lib/format";
import { MediaGrid } from "../components/Media";
import { Btn, EmptyState, card } from "../ui";
import { IconCalendar, IconChevron, IconPin } from "../icons";

export default function Events({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items, thumbUrl, createAlbum, updateItem } = useLibrary();
  const visible = useMemo(() => items.filter((m) => !m.private), [items]);
  const events = useMemo(() => buildEvents(visible), [visible]);
  const [sel, setSel] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (events.length === 0) {
    return <div style={{ padding: "40px 32px" }}><EmptyState icon={<IconCalendar size={28} stroke="var(--text-tertiary)" />} text="还没有可归类的照片" /></div>;
  }

  if (sel) {
    const e = events.find((x) => x.id === sel);
    if (!e) { setSel(null); return null; }
    const saveAsAlbum = async () => {
      const a = await createAlbum(eventTitle(e));
      for (const it of e.items) await updateItem(it.id, { albums: [...new Set([...it.albums, a.id])] });
      setSaved(e.id);
      setTimeout(() => setSaved(null), 2500);
    };
    return (
      <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
        <button onClick={() => setSel(null)} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13.5, fontWeight: 500, marginBottom: 12 }}>
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={16} stroke="var(--accent)" /></span>事件
        </button>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>{eventTitle(e)}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 3 }}>{e.items.length} 项 · {dateLabel(e.start)}{e.place ? ` · ${e.place}` : ""}</div>
          </div>
          <div style={{ flex: 1 }} />
          <Btn variant="soft" onClick={saveAsAlbum}>{saved === e.id ? "已存为相册 ✓" : "存为相册"}</Btn>
        </div>
        <MediaGrid items={e.items} onOpenIndex={(i) => onOpen(e.items, i)} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>按拍摄时间与地点自动聚成 {events.length} 个事件（含定位时会按地点切分；可一键存为相册）。</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {events.map((e) => {
          const cover = e.items[0];
          const url = cover && thumbUrl(cover.id);
          return (
            <button key={e.id} onClick={() => setSel(e.id)} className="fv-card-int" style={{ ...card, padding: 0, border: "none", cursor: "pointer", overflow: "hidden", textAlign: "left" }}>
              <div style={{ aspectRatio: "4/3", background: "var(--fill-quaternary)" }}>
                {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ padding: "11px 13px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{eventTitle(e)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                  {e.place && <IconPin size={12} stroke="var(--text-tertiary)" />}{e.items.length} 项
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
