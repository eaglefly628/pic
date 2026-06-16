// 加密金库的本地持久化（localStorage）。
// 纯本地：不发起任何网络请求。后续用 Tauri/Electron 打包时可替换为本地文件。

import type { VaultBlob } from "./crypto";

const KEY = "familyvault.vault.v1";

export function hasVault(): boolean {
  return localStorage.getItem(KEY) != null;
}

export function loadBlob(): VaultBlob | null {
  const s = localStorage.getItem(KEY);
  if (!s) return null;
  try {
    return JSON.parse(s) as VaultBlob;
  } catch {
    return null;
  }
}

export function saveBlob(blob: VaultBlob): void {
  localStorage.setItem(KEY, JSON.stringify(blob));
}

export function exportBlobString(): string | null {
  return localStorage.getItem(KEY);
}

export function clearVault(): void {
  localStorage.removeItem(KEY);
}

export function importBlobString(s: string): boolean {
  try {
    const b = JSON.parse(s) as VaultBlob;
    if (b.v !== 1 || !b.data || !b.wrap) return false;
    localStorage.setItem(KEY, JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

// ---------- 程序内命名备份 ----------
const BKEY = "familyvault.backups.v1";

export interface Backup {
  id: string;
  label: string;
  createdAt: number;
  blob: VaultBlob; // 备份时的完整加密数据（用当时的主密码解锁）
}

export function listBackups(): Backup[] {
  try {
    return JSON.parse(localStorage.getItem(BKEY) || "[]") as Backup[];
  } catch {
    return [];
  }
}
function saveBackups(arr: Backup[]): void {
  localStorage.setItem(BKEY, JSON.stringify(arr));
}

/** 以当前已保存的加密数据创建一个命名备份 */
export function addBackup(label: string): boolean {
  const cur = localStorage.getItem(KEY);
  if (!cur) return false;
  let blob: VaultBlob;
  try { blob = JSON.parse(cur) as VaultBlob; } catch { return false; }
  const arr = listBackups();
  arr.unshift({ id: "bk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), label: label || "未命名备份", createdAt: Date.now(), blob });
  saveBackups(arr);
  return true;
}

/** 将主数据恢复为指定备份（之后需用该备份对应的主密码解锁） */
export function restoreBackup(id: string): boolean {
  const b = listBackups().find((x) => x.id === id);
  if (!b) return false;
  localStorage.setItem(KEY, JSON.stringify(b.blob));
  return true;
}

export function deleteBackup(id: string): void {
  saveBackups(listBackups().filter((x) => x.id !== id));
}
