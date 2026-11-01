import type { AccountMeta, Dataset, LiquidityPlan } from "../data/types";

export interface LiquidityRow {
  account: AccountMeta;
  entry: LiquidityPlan;
  entryIndex: number;
  available: number;
  arrivalDays?: number;
  arrivalDerived: boolean;
  remainingDays?: number;
  termDays?: number;
  remindDays: number;
}

function validDate(value?: string): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : undefined;
}

function todayUTC(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function validateLiquidityPlan(plan: LiquidityPlan): string | null {
  if (plan.label !== undefined && plan.label.length > 80) return "资金名称不能超过 80 字";
  if (plan.amount !== undefined && (!Number.isFinite(plan.amount) || plan.amount < 0)) return "可调金额须为非负数";
  if (plan.arrivalDays !== undefined && (!Number.isInteger(plan.arrivalDays) || plan.arrivalDays < 0)) return "到账天数须为非负整数";
  if (plan.remindDays !== undefined && (!Number.isInteger(plan.remindDays) || plan.remindDays < 0)) return "提前提醒天数须为非负整数";
  const start = plan.depositedOn ? validDate(plan.depositedOn) : undefined;
  const end = plan.maturesOn ? validDate(plan.maturesOn) : undefined;
  if (plan.depositedOn && start === undefined) return "存入日期无效";
  if (plan.maturesOn && end === undefined) return "到期日期无效";
  if (start !== undefined && end !== undefined && end < start) return "到期日期不能早于存入日期";
  return null;
}

export function liquidityRows(ds: Dataset, now = new Date()): LiquidityRow[] {
  return ds.accounts.flatMap((account) => {
    const plans = account.liquidity ?? [];
    if (!Array.isArray(plans)) return [];
    return plans.flatMap((plan, entryIndex) => {
      if (validateLiquidityPlan(plan)) return [];
      const available = plan.amount ?? 0;
      const end = validDate(plan.maturesOn);
      const start = validDate(plan.depositedOn);
      const remainingDays = end === undefined ? undefined : Math.round((end - todayUTC(now)) / 86_400_000);
      return [{
        account, entry: plan, entryIndex, available,
        arrivalDays: plan.arrivalDays ?? (remainingDays === undefined ? undefined : Math.max(0, remainingDays)),
        arrivalDerived: plan.arrivalDays === undefined && remainingDays !== undefined,
        remainingDays,
        termDays: start === undefined || end === undefined ? undefined : Math.round((end - start) / 86_400_000),
        remindDays: plan.remindDays ?? 30,
      }];
    });
  });
}

export function liquidityTotals(rows: LiquidityRow[]) {
  const total = rows.reduce((sum, row) => sum + row.available, 0);
  const within = (days: number) => rows.reduce((sum, row) =>
    sum + (row.arrivalDays !== undefined && row.arrivalDays <= days ? row.available : 0), 0);
  const unknown = rows.reduce((sum, row) => sum + (row.arrivalDays === undefined ? row.available : 0), 0);
  return { total, today: within(0), week: within(7), month: within(30), unknown };
}
