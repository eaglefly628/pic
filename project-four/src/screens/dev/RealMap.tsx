import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const STATUS_COLOR: Record<string, string> = { wishlist: "#8e8e93", planned: "#5e5ce6", done: "#34c759" };

export interface MapSpot { id: string; name: string; country: string; lat: number; lon: number; status: string }

/** 真实世界地图（OpenStreetMap 底图，不用申请 key）。标记按状态上色，点开小气泡看名字。 */
export function RealMap({ spots, height = 360 }: { spots: MapSpot[]; height?: number }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { scrollWheelZoom: true, worldCopyJump: true }).setView([20, 10], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const s of spots) {
      const color = STATUS_COLOR[s.status] ?? "#8e8e93";
      const icon = L.divIcon({
        className: "fv-map-pin",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      L.marker([s.lat, s.lon], { icon }).addTo(layer).bindPopup(`<b>${s.name}</b><br/>${s.country}`);
    }
    if (spots.length > 0) {
      const bounds = L.latLngBounds(spots.map((s) => [s.lat, s.lon] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
    }
  }, [spots]);

  return <div ref={elRef} style={{ width: "100%", height, borderRadius: 10, overflow: "hidden" }} />;
}
