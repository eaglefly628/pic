import { useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { groupByYear, groupByMonth, onThisDay } from "../lib/format";
import { MediaGrid } from "../components/Media";
import { EmptyState } from "../ui";
import { IconCalendar, IconChevron } from "../icons";

export default function Timeline({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items, thumbUrl } = useLibrary();
  const visible = useMemo(() => items.filter((m) => !m.private), [items]);
  const years = useMemo(() => groupByYear(visible), [visible]);
  const memories = useMemo(() => onThisDay(visible), [visible]);
  const [sel, setSel] = useState<string | null>(null);
  const nowY = new Date().getFullYear();

  if (visible.length === 0) {
    return <div style={{ padding: "40px 32px" }}><EmptyState icon={<IconCalendar size={28} stroke="var(--text-tertiary)" />} text="还没有照片/视频" /></div>;
  }

  if (sel) {
    const y = years.find((g) => g.key === sel);
    if (!y) { setSel(null); return null; }
    const months = groupByMonth(y.items);
    return (
      <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
        <button onClick={() => setSel(null)} style={backBtn}>
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={16} stroke="var(--accent)" /></span>时间
        </button>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{y.label}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 18 }}>{y.items.length} 项</div>
        {months.map((m) => (
          <div key={m.key} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 9 }}>{m.label}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 9 }}>{m.items.length} 项</span></div>
            <MediaGrid items={m.items} onOpenIndex={(i) => onOpen(y.items, y.items.findIndex((x) => x.id === m.items[i].id))} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
      {memories.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>往年今日</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>{new Date().getMonth() + 1} 月 {new Date().getDate()} 日 · 历史上的今天 {memories.length} 张</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
            {memories.map((it, i) => {
              const url = thumbUrl(it.id);
              const ago = nowY - new Date(it.takenAt).getFullYear();
              return (
                <button key={it.id} onClick={() => onOpen(memories, i)} style={{ position: "relative", flexShrink: 0, width: 138, height: 138, borderRadius: 12, overflow: "hidden", border: "none", cursor: "pointer", padding: 0, background: "var(--fill-quaternary)" }}>
                  {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 9px 7px", background: "linear-gradient(transparent, rgba(0,0,0,.65))", color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "left" }}>{ago} 年前</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>按年浏览</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
        {years.map((y) => {
          const cover = y.items[0];
          const url = cover && thumbUrl(cover.id);
          return (
            <button key={y.key} onClick={() => setSel(y.key)} style={{ border: "none", cursor: "pointer", padding: 0, background: "none", textAlign: "left" }}>
              <div style={{ position: "relative", aspectRatio: "1/1", borderRadius: 14, overflow: "hidden", background: "var(--fill-quaternary)" }}>
                {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 55%, rgba(0,0,0,.6))" }} />
                <div style={{ position: "absolute", left: 14, bottom: 11, color: "#fff" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{y.key}</div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{y.items.length} 项</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13.5, fontWeight: 500, marginBottom: 14 };
