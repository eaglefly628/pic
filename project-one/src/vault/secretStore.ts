// 「独立管理」独立加密库：与主金库完全分离，拥有自己的主密码、密钥与存储。
// 即使知道主密码也无法解开独立管理（需要独立管理自己的密码）。
import { createVault, rewrapVault, sealVault, unlockVault, type UnlockedKeys, type VaultBlob } from "../lib/crypto";
import type { Dataset } from "../data/types";
import { emptyDataset } from "./ops";

const SKEY = "familyvault.secret.v1";

export function hasSecret(): boolean {
  return localStorage.getItem(SKEY) != null;
}

export async function createSecret(pw: string, userName: string): Promise<{ data: Dataset; keys: UnlockedKeys }> {
  const ds = emptyDataset("独立管理", userName);
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

/** 修改独立管理密码：用新密码重新包裹同一数据密钥（需当前已解锁的 keys），返回新 keys */
export async function changeSecretPassword(keys: UnlockedKeys, newPw: string): Promise<UnlockedKeys> {
  const s = localStorage.getItem(SKEY);
  if (!s) throw new Error("未找到独立管理数据，无法修改密码"); // 无此库
  const cur = JSON.parse(s) as VaultBlob;
  const { blob, keys: nk } = await rewrapVault(keys, cur, newPw);
  localStorage.setItem(SKEY, JSON.stringify(blob));
  return nk;
}

/** 忘记密码时：清空独立管理（数据不可恢复），可重新创建 */
export function clearSecret(): void {
  localStorage.removeItem(SKEY);
}
