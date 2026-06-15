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
