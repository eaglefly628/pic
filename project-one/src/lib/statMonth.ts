import type { Dataset, Snapshot } from "../data/types";

/** 月初 1–3 日通常是在补录刚结束的上月；统一归到上一个统计月。 */
export const EARLY_MONTH_GRACE_DAYS = 3;
export const STAT_MONTH_MIGRATION_VERSION = 1;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const KEY_RE = /^\d{4}-\d{2}$/;

export function statisticalMonthKey(dateISO: string): string {
  const m = ISO_RE.exec(dateISO);
  if (!m) return dateISO.slice(0, 7);
  let year = Number(m[1]);
  let month = Number(m[2]);
  const day = Number(m[3]);
  if (day <= EARLY_MONTH_GRACE_DAYS) {
    month--;
    if (month === 0) { month = 12; year--; }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function snapshotMonth(snapshot: Pick<Snapshot, "date" | "period">): string {
  return snapshot.period && KEY_RE.test(snapshot.period) ? snapshot.period : statisticalMonthKey(snapshot.date);
}

export function periodOf(point: { date: string; period?: string }): string {
  return point.period && KEY_RE.test(point.period) ? point.period : statisticalMonthKey(point.date);
}

/** 同一统计月只留原始日期最晚的一条；原记录不删除，只返回计算用的月度视图。 */
export function collapseStatisticalMonths<T extends { date: string; period?: string }>(series: T[]): T[] {
  const byMonth = new Map<string, T>();
  for (const point of series) {
    const key = periodOf(point);
    const existing = byMonth.get(key);
    if (!existing || point.date >= existing.date) byMonth.set(key, point);
  }
  return [...byMonth.values()].sort((a, b) => periodOf(a).localeCompare(periodOf(b)) || a.date.localeCompare(b.date));
}

export function monthEndISO(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const end = new Date(year, month, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

/** 最近一个已经完成的统计月；恰逢月末当天时允许记录本月。 */
export function latestClosedMonthEnd(now = new Date()): string {
  const endThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (now.getDate() === endThisMonth.getDate()) return monthEndISO(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const prev = new Date(now.getFullYear(), now.getMonth(), 0);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
}

export interface StatisticalMonthMigrationResult {
  changed: boolean;
  assigned: number;
  collisions: number;
  invalidDates: number;
}

/**
 * 旧数据一次性补齐统计月份。完成标记写在 Dataset 内；以后启动只读标记，O(1) 返回。
 * 原始 date 永远保留。一个统计月有多条记录时也不删，展示/计算层按该月最后状态合并。
 */
export function migrateStatisticalMonths(ds: Dataset): StatisticalMonthMigrationResult {
  if ((ds.migrations?.statisticalMonth?.version ?? 0) >= STAT_MONTH_MIGRATION_VERSION) {
    return { changed: false, assigned: 0, collisions: 0, invalidDates: 0 };
  }
  let assigned = 0;
  let invalidDates = 0;
  const counts = new Map<string, number>();
  for (const snapshot of ds.snapshots) {
    if (!ISO_RE.test(snapshot.date)) { invalidDates++; continue; }
    const period = snapshotMonth(snapshot);
    if (snapshot.period !== period) { snapshot.period = period; assigned++; }
    counts.set(period, (counts.get(period) ?? 0) + 1);
  }
  const collisions = [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  ds.migrations = {
    ...ds.migrations,
    statisticalMonth: { version: STAT_MONTH_MIGRATION_VERSION, migratedAt: Date.now(), assigned, collisions, invalidDates },
  };
  return { changed: true, assigned, collisions, invalidDates };
}
