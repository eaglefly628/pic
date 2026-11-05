import { useEffect, useState } from "react";

type SavedName = { label: string; source: string; distanceKm?: number | null };
const STORE = "family-gallery-addresses-v1";
const key = (lat: number, lng: number, approximate: boolean) =>
  `${approximate ? "approx" : "exact"}:${lat.toFixed(approximate ? 1 : 5)},${lng.toFixed(approximate ? 1 : 5)}`;
let savedNames: Record<string, SavedName> | null = null;
let loadingNames: Promise<Record<string, SavedName>> | null = null;

function oldCached(lat: number, lng: number): string | undefined {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}")[`${lat.toFixed(5)},${lng.toFixed(5)}`]; }
  catch { return undefined; }
}

async function loadNames(): Promise<Record<string, SavedName>> {
  if (savedNames) return savedNames;
  if (!loadingNames) loadingNames = fetch("/api/photos/addresses", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("地址缓存不可用");
      const data = await response.json();
      savedNames = data.labels || {};
      return savedNames!;
    }).catch(() => { loadingNames = null; return {}; });
  return loadingNames;
}

function fromCache(names: Record<string, SavedName>, lat: number, lng: number, approximate: boolean): SavedName | undefined {
  return names[key(lat, lng, approximate)] ||
    (!approximate ? names[key(lat, lng, true)] : undefined);
}

export default function AddressLookup({ latitude, longitude, compact = false, approximate = false }: {
  latitude: number; longitude: number; compact?: boolean; approximate?: boolean;
}) {
  const [entry, setEntry] = useState<SavedName | undefined>(() =>
    (savedNames && fromCache(savedNames, latitude, longitude, approximate)) ||
    (oldCached(latitude, longitude) ? { label: oldCached(latitude, longitude)!, source: "browser-cache" } : undefined));
  useEffect(() => {
    let active = true;
    setEntry((savedNames && fromCache(savedNames, latitude, longitude, approximate)) ||
      (oldCached(latitude, longitude) ? { label: oldCached(latitude, longitude)!, source: "browser-cache" } : undefined));
    void loadNames().then((names) => {
      const name = fromCache(names, latitude, longitude, approximate);
      if (active && name) setEntry(name);
    });
    return () => { active = false; };
  }, [latitude, longitude, approximate]);
  const nearby = entry && entry.source === "geonames-city";
  return <span title={nearby ? "GeoNames 离线推测的附近地名，并非街道地址" : "已保存的地点名称"}>
    {entry ? (compact ? `（${nearby ? "附近：" : ""}${entry.label}）` : `${nearby ? "附近：" : ""}${entry.label}`) : "地点待命名"}
  </span>;
}
