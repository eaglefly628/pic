// 本地存储：IndexedDB。元数据、缩略图、原图、相册分库存放。纯本地，不联网。
import type { Album, MediaItem } from "../types";

const DB = "familygallery";
const VER = 1;
const S_META = "meta";
const S_THUMB = "thumbs";
const S_ORIG = "orig";
const S_ALBUM = "albums";

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(S_META)) db.createObjectStore(S_META, { keyPath: "id" });
      if (!db.objectStoreNames.contains(S_THUMB)) db.createObjectStore(S_THUMB);
      if (!db.objectStoreNames.contains(S_ORIG)) db.createObjectStore(S_ORIG);
      if (!db.objectStoreNames.contains(S_ALBUM)) db.createObjectStore(S_ALBUM, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        let out!: T;
        Promise.resolve(fn(t)).then((v) => (out = v)).catch(reject);
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const reqP = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function addItem(meta: MediaItem, thumb: Blob, orig: Blob): Promise<void> {
  await tx([S_META, S_THUMB, S_ORIG], "readwrite", (t) => {
    t.objectStore(S_META).put(meta);
    t.objectStore(S_THUMB).put(thumb, meta.id);
    t.objectStore(S_ORIG).put(orig, meta.id);
  });
}

export async function putMeta(meta: MediaItem): Promise<void> {
  await tx([S_META], "readwrite", (t) => { t.objectStore(S_META).put(meta); });
}

export async function getAllMeta(): Promise<MediaItem[]> {
  return tx([S_META], "readonly", (t) => reqP(t.objectStore(S_META).getAll() as IDBRequest<MediaItem[]>));
}

export async function getThumb(id: string): Promise<Blob | undefined> {
  return tx([S_THUMB], "readonly", (t) => reqP(t.objectStore(S_THUMB).get(id) as IDBRequest<Blob | undefined>));
}

export async function getOrig(id: string): Promise<Blob | undefined> {
  return tx([S_ORIG], "readonly", (t) => reqP(t.objectStore(S_ORIG).get(id) as IDBRequest<Blob | undefined>));
}

export async function deleteItem(id: string): Promise<void> {
  await tx([S_META, S_THUMB, S_ORIG], "readwrite", (t) => {
    t.objectStore(S_META).delete(id);
    t.objectStore(S_THUMB).delete(id);
    t.objectStore(S_ORIG).delete(id);
  });
}

export async function clearAll(): Promise<void> {
  await tx([S_META, S_THUMB, S_ORIG, S_ALBUM], "readwrite", (t) => {
    t.objectStore(S_META).clear();
    t.objectStore(S_THUMB).clear();
    t.objectStore(S_ORIG).clear();
    t.objectStore(S_ALBUM).clear();
  });
}

/** 申请持久化存储，避免库在空间紧张时被系统清理（这是真实照片库的关键） */
export async function requestPersist(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* 不支持则忽略 */ }
  return false;
}

export async function storageInfo(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  let usage = 0, quota = 0, persisted = false;
  try { const e = await navigator.storage?.estimate?.(); usage = e?.usage ?? 0; quota = e?.quota ?? 0; } catch { /* ignore */ }
  try { persisted = (await navigator.storage?.persisted?.()) ?? false; } catch { /* ignore */ }
  return { usage, quota, persisted };
}

export async function getAlbums(): Promise<Album[]> {
  return tx([S_ALBUM], "readonly", (t) => reqP(t.objectStore(S_ALBUM).getAll() as IDBRequest<Album[]>));
}
export async function putAlbum(a: Album): Promise<void> {
  await tx([S_ALBUM], "readwrite", (t) => { t.objectStore(S_ALBUM).put(a); });
}
export async function deleteAlbum(id: string): Promise<void> {
  await tx([S_ALBUM], "readwrite", (t) => { t.objectStore(S_ALBUM).delete(id); });
}
