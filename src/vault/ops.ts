// 对金库数据的纯修改操作（在 vault.update(d => ...) 内调用）。
import type { AccountMeta, Snapshot } from "../data/types";
import type { VaultData } from "./types";
import { uid } from "../ui";

export type AccountInput = Omit<AccountMeta, "id"> & { comp?: string };

function lastKnownOnOrBefore(snaps: Snapshot[], id: string, date: string): number | null {
  let val: number | null = null;
  for (const s of snaps) {
    if (s.date <= date && s.balances[id] != null) val = s.balances[id]!;
  }
  return val;
}

export function addAccount(d: VaultData, meta: AccountInput, balance: number) {
  const id = uid("acc");
  d.dataset.accounts.push({ ...meta, id } as AccountMeta);
  const snaps = d.dataset.snapshots;
  if (snaps.length === 0) {
    snaps.push({ date: new Date().toISOString().slice(0, 10), balances: { [id]: balance }, source: "manual" });
  } else {
    snaps[snaps.length - 1].balances[id] = balance;
  }
}

export function updateAccount(d: VaultData, id: string, meta: AccountInput) {
  const i = d.dataset.accounts.findIndex((a) => a.id === id);
  if (i >= 0) d.dataset.accounts[i] = { ...meta, id } as AccountMeta;
}

export function deleteAccount(d: VaultData, id: string) {
  d.dataset.accounts = d.dataset.accounts.filter((a) => a.id !== id);
  for (const s of d.dataset.snapshots) delete s.balances[id];
}

/** 为某账户在指定日期新增/更新一条余额快照（新日期会结转其它账户的上次余额，保持净值一致） */
export function addSnapshot(d: VaultData, accId: string, date: string, amount: number) {
  const snaps = d.dataset.snapshots;
  const existing = snaps.find((s) => s.date === date);
  if (existing) {
    existing.balances[accId] = amount;
    return;
  }
  const balances: Record<string, number | null> = {};
  for (const a of d.dataset.accounts) balances[a.id] = lastKnownOnOrBefore(snaps, a.id, date);
  balances[accId] = amount;
  snaps.push({ date, balances, source: "manual" });
  snaps.sort((a, b) => a.date.localeCompare(b.date));
}
