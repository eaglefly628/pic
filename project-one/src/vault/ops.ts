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
    snaps.push({ date: new Date().toISOString().slice(0, 10), balances: { [id]: balance }, source: "manual", touched: [id] });
  } else {
    const last = snaps[snaps.length - 1];
    last.balances[id] = balance;
    if (last.touched) last.touched.push(id); // 该期已经区分过"谁是真正被改的"，这个新账户也算
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

/** 为某账户在指定日期新增/更新一条余额快照（新日期会结转其它账户的上次余额，保持净值一致）。
 *  结转进来的其它账户不算"这期更新过"——只有 accId 自己被记进 touched，
 *  这样"最后更新日期"才不会因为别的账户改了一下就被一起刷新。 */
export function addSnapshot(ds: Dataset, accId: string, date: string, amount: number) {
  const snaps = ds.snapshots;
  const existing = snaps.find((s) => s.date === date);
  if (existing) {
    existing.balances[accId] = amount;
    // 第一次给这条旧快照区分 touched 时，把它当时已有的账户都当"确实记录过"兜底，
    // 不然这次编辑会让同一期里其它账户的"最后更新"莫名回退到更早的一条快照。
    if (!existing.touched) existing.touched = Object.keys(existing.balances).filter((k) => existing.balances[k] != null);
    if (!existing.touched.includes(accId)) existing.touched.push(accId);
    return;
  }
  const balances: Record<string, number | null> = {};
  for (const a of ds.accounts) balances[a.id] = lastKnownOnOrBefore(snaps, a.id, date);
  balances[accId] = amount;
  snaps.push({ date, balances, source: "manual", touched: [accId] });
  snaps.sort((a, b) => a.date.localeCompare(b.date));
}

/** 删除某账户在指定日期的一条快照记录（比如手滑记错了、想撤销）。只删这个账户在
 *  这一期的数据，不影响同一期里结转的其它账户；如果这一期删完后不再有任何账户的
 *  数据了，这条快照本身也顺手清掉，不留空壳。 */
export function deleteSnapshotEntry(ds: Dataset, accId: string, date: string) {
  const snap = ds.snapshots.find((s) => s.date === date);
  if (!snap) return;
  delete snap.balances[accId];
  if (snap.touched) snap.touched = snap.touched.filter((id) => id !== accId);
  const hasAny = Object.values(snap.balances).some((v) => v != null);
  if (!hasAny) ds.snapshots = ds.snapshots.filter((s) => s !== snap);
}

/** 空的「私房钱」独立数据集 */
export function emptyDataset(name: string, userName: string): Dataset {
  return { vaultName: name, userName, real: false, accounts: [], snapshots: [] };
}
