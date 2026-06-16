import { useMemo, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { placeKey } from "../lib/exif";
import { reverseGeocode, sleep } from "../lib/geocode";
import { MediaGrid } from "../components/Media";
import { Btn, EmptyState } from "../ui";
import { IconPin } from "../icons";

export default function Places({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items, updateItem } = useLibrary();
  const [geo, setGeo] = useState<{ done: number; total: number } | null>(null);
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

  const unnamed = groups.filter((g) => !g.items.some((x) => x.place));
  const geocodeAll = async () => {
    setGeo({ done: 0, total: unnamed.length });
    for (let i = 0; i < unnamed.length; i++) {
      const g = unnamed[i];
      const it0 = g.items[0];
      const name = await reverseGeocode(it0.lat!, it0.lng!);
      if (name) for (const it of g.items) await updateItem(it.id, { place: name });
      setGeo({ done: i + 1, total: unnamed.length });
      if (i < unnamed.length - 1) await sleep(1100);
    }
    setGeo(null);
  };

  if (groups.length === 0 && noGps.length === 0) {
    return <div style={{ padding: "40px 32px" }}><EmptyState icon={<IconPin size={28} stroke="var(--text-tertiary)" />} text="还没有可按地点归类的照片" /></div>;
  }

  return (
    <div style={{ padding: "20px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, fontSize: 12, color: "var(--text-tertiary)" }}>按照片 GPS 自动聚类（约 1 公里）。默认不联网；可手动联网把坐标转成地名。</div>
        {unnamed.length > 0 && <Btn variant="ghost" onClick={geocodeAll} disabled={!!geo}><IconPin size={14} stroke="currentColor" />{geo ? `查询中 ${geo.done}/${geo.total}` : `联网查询地名（${unnamed.length}）`}</Btn>}
      </div>
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
