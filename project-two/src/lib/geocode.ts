// 只响应用户主动查询；串行限速，避免超过 Nominatim 的每秒 1 次限制。
let nextRequest = Promise.resolve();
let lastRequestAt = 0;

export async function reverseGeocode(lat: number, lng: number, approximate = false): Promise<string | undefined> {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
    const previous = nextRequest;
    let release!: () => void;
    nextRequest = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    let r: Response;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=${approximate ? 12 : 18}&addressdetails=1&accept-language=zh-CN`;
      r = await fetch(url, { headers: { Accept: "application/json" }, referrerPolicy: "strict-origin-when-cross-origin" });
    } finally { release(); }
    if (!r.ok) return undefined;
    const j = await r.json();
    const a = j.address || {};
    const city = a.city || a.town || a.county || a.municipality || a.state;
    const district = a.city_district || a.suburb || a.neighbourhood || a.village || a.district;
    const road = approximate ? null : (a.road || a.pedestrian || a.residential || a.hamlet);
    const number = approximate ? null : a.house_number;
    const parts = [a.country, a.state, city, district, road, number].filter(Boolean) as string[];
    const deduped = parts.filter((part, index) => part !== parts[index - 1]);
    return deduped.join(" · ") || (typeof j.display_name === "string" ? j.display_name : undefined);
  } catch {
    return undefined;
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
