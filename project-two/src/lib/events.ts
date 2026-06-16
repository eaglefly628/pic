// 「事件/出行」自动归类：按拍摄时间间隔聚类，地点明显变化也切分。
import type { MediaItem } from "../types";

export interface PhotoEvent {
  id: string;
  start: number;
  end: number;
  items: MediaItem[];
  place?: string;
}

const GAP_MS = 8 * 3600 * 1000; // 间隔超过 8 小时视为新事件

function haversineKm(a: MediaItem, b: MediaItem): number {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 0;
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const la = a.lat * toR, lb = b.lat * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function topPlace(items: MediaItem[]): string | undefined {
  const c = new Map<string, number>();
  for (const it of items) if (it.place) c.set(it.place, (c.get(it.place) ?? 0) + 1);
  let best: string | undefined, n = 0;
  for (const [p, k] of c) if (k > n) { n = k; best = p; }
  return best;
}

export function buildEvents(items: MediaItem[]): PhotoEvent[] {
  const sorted = items.slice().sort((a, b) => a.takenAt - b.takenAt);
  const groups: MediaItem[][] = [];
  let cur: MediaItem[] = [];
  let lastGps: MediaItem | null = null;
  for (const it of sorted) {
    if (cur.length === 0) { cur = [it]; if (it.lat != null) lastGps = it; continue; }
    const prev = cur[cur.length - 1];
    const gap = it.takenAt - prev.takenAt > GAP_MS;
    const jump = lastGps && it.lat != null && haversineKm(lastGps, it) > 40;
    if (gap || jump) { groups.push(cur); cur = [it]; } else cur.push(it);
    if (it.lat != null) lastGps = it;
  }
  if (cur.length) groups.push(cur);
  return groups
    .map((g) => ({ id: "ev_" + g[0].takenAt, start: g[0].takenAt, end: g[g.length - 1].takenAt, items: g, place: topPlace(g) }))
    .sort((a, b) => b.start - a.start);
}

export function eventTitle(e: PhotoEvent): string {
  const s = new Date(e.start), en = new Date(e.end);
  const f = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  let when: string;
  if (s.toDateString() === en.toDateString()) when = `${s.getFullYear()}年${f(s)}`;
  else if (s.getFullYear() === en.getFullYear()) when = `${s.getFullYear()}年 ${f(s)}–${f(en)}`;
  else when = `${s.getFullYear()}年${f(s)} – ${en.getFullYear()}年${f(en)}`;
  return e.place ? `${e.place} · ${when}` : when;
}
