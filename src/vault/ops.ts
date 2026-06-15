// 对某个 Dataset 的纯修改操作（主账户与「私房钱」独立账户复用）。
import type { AccountMeta, Dataset, Snapshot } from "../data/types";
import { uid } from "../ui";

export type AccountInput = Omit<AccountMeta, "id"> & { comp?: string };

function lastKnownOnOrBefore(snaps: Snapshot[], id: string, date: string): number | null {
  let val: number | null = null;
  for (const s of snaps) {
    if (s.date <= date && s.balances[id] != null) val = s.balances[id]!;
  }
  return val;
}

export function addAccount(ds: Dataset, meta: AccountInput, balance: number) {
  const id = uid("acc");
  ds.accounts.push({ ...meta, id } as AccountMeta);
  const snaps = ds.snapshots;
  if (snaps.length === 0) {
    snaps.push({ date: new Date().toISOString().slice(0, 10), balances: { [id]: balance }, source: "manual" });
  } else {
    snaps[snaps.length - 1].balances[id] = balance;
  }
}

export function updateAccount(ds: Dataset, id: string, meta: AccountInput) {
  const i = ds.accounts.findIndex((a) => a.id === id);
  if (i >= 0) ds.accounts[i] = { ...meta, id } as AccountMeta;
}

export function deleteAccount(ds: Dataset, id: string) {
  ds.accounts = ds.accounts.filter((a) => a.id !== id);
  for (const s of ds.snapshots) delete s.balances[id];
}

/** 为某账户在指定日期新增/更新一条余额快照（新日期会结转其它账户的上次余额，保持净值一致） */
export function addSnapshot(ds: Dataset, accId: string, date: string, amount: number) {
  const snaps = ds.snapshots;
  const existing = snaps.find((s) => s.date === date);
  if (existing) {
    existing.balances[accId] = amount;
    return;
  }
  const balances: Record<string, number | null> = {};
  for (const a of ds.accounts) balances[a.id] = lastKnownOnOrBefore(snaps, a.id, date);
  balances[accId] = amount;
  snaps.push({ date, balances, source: "manual" });
  snaps.sort((a, b) => a.date.localeCompare(b.date));
}

/** 空的「私房钱」独立数据集 */
export function emptyDataset(name: string, userName: string): Dataset {
  return { vaultName: name, userName, real: false, accounts: [], snapshots: [] };
}
