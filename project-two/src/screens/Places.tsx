import { useMemo } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { placeKey } from "../lib/exif";
import { MediaGrid } from "../components/Media";
import { EmptyState } from "../ui";
import { IconPin } from "../icons";

export default function Places({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items } = useLibrary();
  const { groups, noGps } = useMemo(() => {
    const visible = items.filter((m) => !m.private);
    const map = new Map<string, MediaItem[]>();
    const noGps: MediaItem[] = [];
    for (const it of visible) {
      const k = placeKey(it.lat, it.lng);
      if (!k) { noGps.push(it); continue; }
      (map.get(k) ?? map.set(k, []).get(k)!).push(it);
    }
    const groups = [...map.entries()].map(([key, list]) => {
      const named = list.find((x) => x.place)?.place;
      return { key, label: named || `${list[0].lat!.toFixed(3)}, ${list[0].lng!.toFixed(3)}`, items: list };
    }).sort((a, b) => b.items.length - a.items.length);
    return { groups, noGps };
  }, [items]);

  if (groups.length === 0 && noGps.length === 0) {
    return <div style={{ padding: "40px 32px" }}><EmptyState icon={<IconPin size={28} stroke="var(--text-tertiary)" />} text="还没有可按地点归类的照片" /></div>;
  }

  return (
    <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>按照片 GPS 自动聚类（约 1 公里网格）。为保护隐私，默认不联网反查地名；可在灯箱里查看坐标。</div>
      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            <IconPin size={16} stroke="var(--accent)" />{g.label}
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)" }}>{g.items.length} 项</span>
          </div>
          <MediaGrid items={g.items} onOpenIndex={(li) => onOpen(g.items, li)} />
        </div>
      ))}
      {noGps.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>无位置信息<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>{noGps.length} 项</span></div>
          <MediaGrid items={noGps} onOpenIndex={(li) => onOpen(noGps, li)} />
        </div>
      )}
    </div>
  );
}
