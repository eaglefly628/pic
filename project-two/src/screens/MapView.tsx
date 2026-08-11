import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../types";
import { useLibrary } from "../lib/library";
import { loadCss, loadScript } from "../lib/cdn";
import { EmptyState } from "../ui";
import { IconMap } from "../icons";

const CSS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
const JS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
const TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function MapView({ onOpen }: { onOpen: (list: MediaItem[], i: number) => void }) {
  const { items } = useLibrary();
  const ref = useRef<HTMLDivElement>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">("loading");

  useEffect(() => {
    let map: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    let cancelled = false;
    (async () => {
      const geo = items.filter((i) => !i.private && i.lat != null && i.lng != null);
      if (geo.length === 0) { setStatus("empty"); return; }
      try {
        await loadCss(CSS);
        await loadScript(JS);
        const L = (window as any).L; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (cancelled || !ref.current) return;
        map = L.map(ref.current, { attributionControl: true }).setView([geo[0].lat, geo[0].lng], 4);
        L.tileLayer(TILE, { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        const pts: [number, number][] = [];
        for (const it of geo) {
          const m = L.circleMarker([it.lat, it.lng], { radius: 6, color: "#fff", weight: 2, fillColor: "#3b82f6", fillOpacity: 0.9 });
          m.on("click", () => onOpenRef.current([it], 0));
          m.addTo(map);
          pts.push([it.lat as number, it.lng as number]);
        }
        map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
        setStatus("ready");
      } catch { if (!cancelled) setStatus("error"); }
    })();
    return () => { cancelled = true; if (map) map.remove(); };
  }, [items]);

  const geoCount = items.filter((i) => !i.private && i.lat != null).length;

  if (status === "empty") {
    return <div style={{ padding: "40px 32px" }}><EmptyState icon={<IconMap size={28} stroke="var(--text-tertiary)" />} text="还没有带定位信息的照片" /></div>;
  }
  return (
    <div style={{ padding: "16px 32px 32px", animation: "fvFade 0.3s ease" }}>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>
        {geoCount} 张带定位的照片 · 地图瓦片来自 OpenStreetMap（需联网）。{status === "error" && "　加载失败，请检查网络。"}
      </div>
      <div ref={ref} style={{ height: "calc(100vh - 150px)", minHeight: 420, borderRadius: 14, overflow: "hidden", border: "1px solid var(--separator)", background: "var(--fill-quaternary)" }} />
    </div>
  );
}
