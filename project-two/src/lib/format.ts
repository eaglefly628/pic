import type { MediaItem } from "../types";

export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y} 年 ${parseInt(m, 10)} 月`;
}
export function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}
export function dateTimeLabel(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtSize(bytes: number): string {
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + " GB";
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + " MB";
  if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(0) + " KB";
  return bytes + " B";
}

export interface Group<T = MediaItem> { key: string; label: string; items: T[]; }

/** 按月分组（降序） */
export function groupByMonth(items: MediaItem[]): Group[] {
  const map = new Map<string, MediaItem[]>();
  for (const it of items) {
    const k = monthKey(it.takenAt);
    (map.get(k) ?? map.set(k, []).get(k)!).push(it);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({ key, label: monthLabel(key), items: list }));
}

/** 按年分组（降序） */
export function groupByYear(items: MediaItem[]): Group[] {
  const map = new Map<string, MediaItem[]>();
  for (const it of items) {
    const k = String(new Date(it.takenAt).getFullYear());
    (map.get(k) ?? map.set(k, []).get(k)!).push(it);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({ key, label: `${key} 年`, items: list.sort((x, y) => y.takenAt - x.takenAt) }));
}

/** 往年今日：历史同月同日（不含今年） */
export function onThisDay(items: MediaItem[], ref = Date.now()): MediaItem[] {
  const d = new Date(ref), mm = d.getMonth(), dd = d.getDate(), yy = d.getFullYear();
  return items
    .filter((it) => { const t = new Date(it.takenAt); return t.getMonth() === mm && t.getDate() === dd && t.getFullYear() < yy; })
    .sort((a, b) => b.takenAt - a.takenAt);
}
