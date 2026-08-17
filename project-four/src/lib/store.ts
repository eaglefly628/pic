// 本地存储：IndexedDB 中只保存「一个加密后的保险库文件」。明文只在内存里。
import type { VaultFile } from "./crypto";

const DB = "devworld";
const VER = 1;
const S = "vault";
const KEY = "main";
const BACKUP_KEY = "backup";   // 迁移/导入等覆盖操作前，旧库先另存一份在这里，便于找回

let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(S)) db.createObjectStore(S);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function loadVaultFile(): Promise<VaultFile | undefined> {
  const db = await open();
  return reqP(db.transaction(S, "readonly").objectStore(S).get(KEY) as IDBRequest<VaultFile | undefined>);
}

export async function saveVaultFile(file: VaultFile): Promise<void> {
  const db = await open();
  const tx = db.transaction(S, "readwrite");
  tx.objectStore(S).put(file, KEY);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function loadVaultBackup(): Promise<VaultFile | undefined> {
  const db = await open();
  return reqP(db.transaction(S, "readonly").objectStore(S).get(BACKUP_KEY) as IDBRequest<VaultFile | undefined>);
}

export async function saveVaultBackup(file: VaultFile): Promise<void> {
  const db = await open();
  const tx = db.transaction(S, "readwrite");
  tx.objectStore(S).put(file, BACKUP_KEY);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function hasVault(): Promise<boolean> {
  return (await loadVaultFile()) !== undefined;
}

export async function requestPersist(): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch { /* 忽略 */ }
}
