// 密码保险箱的「二次验证」独立加密库：可选启用。启用后密码条目用单独的密码加密，
// 与主密码相互独立；进入密码保险箱需再输入这道独立密码。
import { createVault, rewrapVault, sealVault, unlockVault, type UnlockedKeys, type VaultBlob } from "../lib/crypto";
import type { PasswordItem } from "./types";

const KEY = "familyvault.pwbox.v1";

export function hasPwBox(): boolean {
  return localStorage.getItem(KEY) != null;
}

export async function createPwBox(pw: string, seed: PasswordItem[]): Promise<{ items: PasswordItem[]; keys: UnlockedKeys }> {
  const { blob, keys } = await createVault(pw, seed);
  localStorage.setItem(KEY, JSON.stringify(blob));
  return { items: seed, keys };
}

export async function unlockPwBox(pw: string): Promise<{ items: PasswordItem[]; keys: UnlockedKeys } | null> {
  const s = localStorage.getItem(KEY);
  if (!s) return null;
  try {
    const { data, keys } = await unlockVault<PasswordItem[]>(pw, JSON.parse(s));
    return { items: data, keys };
  } catch {
    return null;
  }
}

export async function savePwBox(keys: UnlockedKeys, items: PasswordItem[]): Promise<void> {
  const blob = await sealVault(keys, items);
  localStorage.setItem(KEY, JSON.stringify(blob));
}

export async function changePwBoxPassword(keys: UnlockedKeys, newPw: string): Promise<void> {
  const s = localStorage.getItem(KEY);
  if (!s) throw new Error("未找到密码保险箱数据，无法修改密码"); // 无此库
  const cur = JSON.parse(s) as VaultBlob;
  const { blob } = await rewrapVault(keys, cur, newPw);
  localStorage.setItem(KEY, JSON.stringify(blob));
}

export function clearPwBox(): void {
  localStorage.removeItem(KEY);
}

// 会话缓存：解锁后本次会话内复用，主金库锁定时清空。
let session: { keys: UnlockedKeys; items: PasswordItem[] } | null = null;
export const pwSession = {
  get: () => session,
  set: (s: { keys: UnlockedKeys; items: PasswordItem[] } | null) => { session = s; },
};
