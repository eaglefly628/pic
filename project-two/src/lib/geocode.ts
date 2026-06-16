// 反查地名（GPS -> 地点名）。使用 OpenStreetMap Nominatim。
// 仅在用户手动触发时调用（会联网）。请遵守其使用策略：每秒最多 1 次。
export async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&accept-language=zh-CN`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return undefined;
    const j = await r.json();
    const a = j.address || {};
    const city = a.city || a.town || a.county || a.municipality || a.state;
    const area = a.suburb || a.neighbourhood || a.village || a.district;
    const name = [a.country !== "中国" && a.country ? a.country : null, a.state && a.state !== city ? a.state : null, city, area]
      .filter(Boolean)
      .slice(-2)
      .join(" · ");
    return name || (typeof j.display_name === "string" ? j.display_name.split(",").slice(0, 2).join(",") : undefined);
  } catch {
    return undefined;
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
