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

/** localStorage 写满会抛 QuotaExceededError。裸抛出去的话界面表现是「点了没反应」，
 *  所以统一在这里换成一句能看懂的话，由调用处决定怎么提示。 */
export class StorageFullError extends Error {
  constructor(what: string) {
    super(`本机存储空间不够，${what}没有保存成功。请到「设置 · 程序内备份」删掉几个旧还原点，或在大厅导出一份整屋备份后清理。`);
    this.name = "StorageFullError";
  }
}
function setItemSafe(key: string, value: string, what: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    const quota = e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");
    if (quota) throw new StorageFullError(what);
    throw e;
  }
}

export function saveBlob(blob: VaultBlob): void {
  setItemSafe(KEY, JSON.stringify(blob), "这次改动");
}

export function exportBlobString(): string | null {
  return localStorage.getItem(KEY);
}

/** 只清理财主金库。想「删除全部数据」请用 clearAllVaultData()。 */
export function clearVault(): void {
  localStorage.removeItem(KEY);
}

/** 真正的「删除本机全部数据」：主金库 + 密码保险箱 + 独立管理 + 程序内还原点。
 *  以前只删了主金库，密码箱和独立管理的密文会原样留在本地，跟界面上的承诺不符。 */
export function clearAllVaultData(): void {
  for (const k of [KEY, BKEY, "familyvault.pwbox.v1", "familyvault.secret.v1"]) {
    localStorage.removeItem(k);
  }
}

export function importBlobString(s: string): boolean {
  try {
    const b = JSON.parse(s) as VaultBlob;
    if (b.v !== 1 || !b.data || !b.wrap) return false;
    setItemSafe(KEY, JSON.stringify(b), "导入的金库");
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
  setItemSafe(BKEY, JSON.stringify(arr), "还原点");
}

/** 程序内还原点的份数上限。每份是完整数据副本，不设上限迟早把 localStorage
 *  （通常 5MB 左右）写满，而写满会连带主数据都存不进去。超出就挤掉最旧的。 */
export const MAX_BACKUPS = 20;

/** 以当前已保存的加密数据创建一个命名备份 */
export function addBackup(label: string): boolean {
  const cur = localStorage.getItem(KEY);
  if (!cur) return false;
  let blob: VaultBlob;
  try { blob = JSON.parse(cur) as VaultBlob; } catch { return false; }
  const arr = listBackups();
  arr.unshift({ id: "bk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), label: label || "未命名备份", createdAt: Date.now(), blob });
  while (arr.length > MAX_BACKUPS) arr.pop();     // 挤掉最旧的，别无限堆
  saveBackups(arr);                               // 仍可能抛 StorageFullError，交给调用处提示
  return true;
}

/** 将主数据恢复为指定备份（之后需用该备份对应的主密码解锁） */
export function restoreBackup(id: string): boolean {
  const b = listBackups().find((x) => x.id === id);
  if (!b) return false;
  setItemSafe(KEY, JSON.stringify(b.blob), "恢复的数据");
  return true;
}

export function deleteBackup(id: string): void {
  saveBackups(listBackups().filter((x) => x.id !== id));
}
