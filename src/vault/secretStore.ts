// 「私房钱」独立加密库：与主金库完全分离，拥有自己的主密码、密钥与存储。
// 即使知道主密码也无法解开私房钱（需要私房钱自己的密码）。
import { createVault, sealVault, unlockVault, type UnlockedKeys } from "../lib/crypto";
import type { Dataset } from "../data/types";
import { emptyDataset } from "./ops";

const SKEY = "familyvault.secret.v1";

export function hasSecret(): boolean {
  return localStorage.getItem(SKEY) != null;
}

export async function createSecret(pw: string, userName: string): Promise<{ data: Dataset; keys: UnlockedKeys }> {
  const ds = emptyDataset("私房钱", userName);
  const { blob, keys } = await createVault(pw, ds);
  localStorage.setItem(SKEY, JSON.stringify(blob));
  return { data: ds, keys };
}

export async function unlockSecret(pw: string): Promise<{ data: Dataset; keys: UnlockedKeys } | null> {
  const s = localStorage.getItem(SKEY);
  if (!s) return null;
  try {
    const blob = JSON.parse(s);
    const { data, keys } = await unlockVault<Dataset>(pw, blob);
    return { data, keys };
  } catch {
    return null; // 密码错误
  }
}

export async function saveSecret(keys: UnlockedKeys, ds: Dataset): Promise<void> {
  const blob = await sealVault(keys, ds);
  localStorage.setItem(SKEY, JSON.stringify(blob));
}
