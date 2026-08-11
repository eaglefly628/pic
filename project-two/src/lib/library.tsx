import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Album, MediaItem, MediaKind } from "../types";
import * as store from "./store";
import { extractMeta, makeImageThumb, makeVideoThumb } from "./exif";
import { analyzeBlob } from "./analyze";
import { fsSupported, pickDirectory, ensurePermission, walkMedia, fileByPath, type DirHandle } from "./baseDir";
import { ensureFaceModels, detectFaces, cropFace, dist, SAME_PERSON, type Person, type DetFace } from "./faces";

function uid(p = "m"): string {
  return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}
async function hashBlob(b: Blob): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await b.arrayBuffer());
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

interface LibCtx {
  ready: boolean;
  items: MediaItem[];
  albums: Album[];
  thumbUrl: (id: string) => string | undefined;
  getOrigUrl: (id: string) => Promise<string | undefined>;
  addFile: (file: File, opts?: { isPrivate?: boolean; albums?: string[] }) => Promise<void>;
  updateItem: (id: string, patch: Partial<MediaItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  removeMany: (ids: string[]) => Promise<void>;
  scanHashes: (onProgress?: (done: number, total: number) => void) => Promise<void>;
  analyze: (onProgress?: (done: number, total: number) => void) => Promise<void>;
  createAlbum: (name: string) => Promise<Album>;
  baseDir: { name: string | null; supported: boolean };
  pickBaseDir: (onProgress?: (done: number, total: number) => void) => Promise<void>;
  syncBaseDir: (onProgress?: (done: number, total: number) => void) => Promise<void>;
  disconnectBaseDir: () => Promise<void>;
  persons: Person[];
  scanFaces: (onProgress?: (done: number, total: number) => void) => Promise<void>;
  renamePerson: (id: string, name: string) => Promise<void>;
}

const Ctx = createContext<LibCtx | null>(null);
export const useLibrary = (): LibCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLibrary outside provider");
  return c;
};

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const itemsRef = useRef<MediaItem[]>([]);
  itemsRef.current = items; // 渲染期与 state 同步，供 updateItem 同步读取最新列表
  const [albums, setAlbums] = useState<Album[]>([]);
  const thumbs = useRef<Map<string, string>>(new Map());
  const baseHandle = useRef<DirHandle | null>(null);
  const [baseName, setBaseName] = useState<string | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);

  const ensureThumb = useCallback(async (id: string) => {
    if (thumbs.current.has(id)) return;
    const b = await store.getThumb(id);
    if (b) thumbs.current.set(id, URL.createObjectURL(b));
  }, []);

  const reload = useCallback(async () => {
    const [metas, als] = await Promise.all([store.getAllMeta(), store.getAlbums()]);
    metas.sort((a, b) => b.takenAt - a.takenAt);
    await Promise.all(metas.map((m) => ensureThumb(m.id)));
    setItems(metas);
    setAlbums(als);
    setReady(true);
  }, [ensureThumb]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void store.requestPersist(); }, []);
  useEffect(() => {
    (async () => {
      const h = await store.getConfig<DirHandle>("baseDir");
      if (h && (await ensurePermission(h, false))) { baseHandle.current = h; setBaseName(h.name ?? "媒体库"); }
      const ps = await store.getConfig<Person[]>("persons");
      if (ps) setPersons(ps);
    })();
  }, []);

  const thumbUrl = useCallback((id: string) => thumbs.current.get(id), []);

  const getOrigUrl = useCallback(async (id: string) => {
    const it = items.find((x) => x.id === id);
    if (it?.path && baseHandle.current) {
      const f = await fileByPath(baseHandle.current, it.path);
      return f ? URL.createObjectURL(f) : undefined;
    }
    const b = await store.getOrig(id);
    return b ? URL.createObjectURL(b) : undefined;
  }, [items]);

  const addFile = useCallback(async (file: File, opts?: { isPrivate?: boolean; albums?: string[] }) => {
    const kind = kindOf(file);
    if (!kind) return;
    const meta = await extractMeta(file, kind);
    let thumb: Blob, width: number | undefined, height: number | undefined, durationSec: number | undefined;
    if (kind === "image") {
      const t = await makeImageThumb(file);
      thumb = t.blob; width = t.width; height = t.height;
    } else {
      const t = await makeVideoThumb(file);
      thumb = t.blob; width = t.width; height = t.height; durationSec = t.durationSec;
    }
    const hash = await hashBlob(file).catch(() => undefined);
    const item: MediaItem = {
      id: uid(), name: file.name, kind, mime: file.type, size: file.size,
      width, height, durationSec,
      takenAt: meta.takenAt, takenSource: meta.takenSource, lat: meta.lat, lng: meta.lng,
      albums: opts?.albums ?? [], tags: [], private: opts?.isPrivate, hash, addedAt: Date.now(),
    };
    await store.addItem(item, thumb, file);
    thumbs.current.set(item.id, URL.createObjectURL(thumb));
    setItems((prev) => [item, ...prev].sort((a, b) => b.takenAt - a.takenAt));
  }, []);

  const updateItem = useCallback(async (id: string, patch: Partial<MediaItem>) => {
    // 不能在 setItems 的 updater 里做副作用（React 不保证同步执行，StrictMode 会跑两次）
    const cur = itemsRef.current;
    const old = cur.find((m) => m.id === id);
    if (!old) return;
    const next = { ...old, ...patch };
    const updated = cur.map((m) => (m.id === id ? next : m));
    itemsRef.current = updated; // 立即同步，保证连续调用不丢更新
    setItems(updated);
    await store.putMeta(next);
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await store.deleteItem(id);
    const u = thumbs.current.get(id);
    if (u) { URL.revokeObjectURL(u); thumbs.current.delete(id); }
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const removeMany = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await store.deleteItem(id);
      const u = thumbs.current.get(id);
      if (u) { URL.revokeObjectURL(u); thumbs.current.delete(id); }
    }
    const set = new Set(ids);
    setItems((prev) => prev.filter((m) => !set.has(m.id)));
  }, []);

  const scanHashes = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    const targets = items.filter((m) => !m.hash);
    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      const b = await store.getOrig(m.id);
      if (b) {
        const hash = await hashBlob(b).catch(() => undefined);
        if (hash) { const next = { ...m, hash }; await store.putMeta(next); setItems((prev) => prev.map((x) => (x.id === m.id ? next : x))); }
      }
      onProgress?.(i + 1, targets.length);
    }
  }, [items]);

  const analyze = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    const targets = items.filter((m) => m.phash === undefined);
    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      const b = await store.getThumb(m.id);
      if (b) {
        try {
          const a = await analyzeBlob(b);
          const next = { ...m, phash: a.phash, blur: a.blur };
          await store.putMeta(next);
          setItems((prev) => prev.map((x) => (x.id === m.id ? next : x)));
        } catch { /* 跳过无法分析的项 */ }
      }
      onProgress?.(i + 1, targets.length);
    }
  }, [items]);

  const scan = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    const h = baseHandle.current;
    if (!h) return;
    const entries: { handle: any; path: string; kind: "image" | "video" }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    for await (const e of walkMedia(h)) entries.push(e);
    const existing = new Map(items.filter((i) => i.path).map((i) => [i.path as string, i] as const));
    const seen = new Set<string>();
    const added: MediaItem[] = [];
    let done = 0;
    for (const e of entries) {
      seen.add(e.path);
      if (!existing.has(e.path)) {
        try {
          const f: File = await e.handle.getFile();
          const m = await extractMeta(f, e.kind);
          let thumb: Blob, width: number | undefined, height: number | undefined, durationSec: number | undefined;
          if (e.kind === "image") { const t = await makeImageThumb(f); thumb = t.blob; width = t.width; height = t.height; }
          else { const t = await makeVideoThumb(f); thumb = t.blob; width = t.width; height = t.height; durationSec = t.durationSec; }
          const hash = await hashBlob(f).catch(() => undefined);
          const item: MediaItem = {
            id: "disk:" + e.path, name: e.path.split("/").pop() || e.path, kind: e.kind, mime: f.type, size: f.size,
            width, height, durationSec, takenAt: m.takenAt, takenSource: m.takenSource, lat: m.lat, lng: m.lng,
            albums: [], tags: [], path: e.path, hash, addedAt: Date.now(),
          };
          await store.addIndexed(item, thumb);
          thumbs.current.set(item.id, URL.createObjectURL(thumb));
          added.push(item);
        } catch { /* 跳过无法处理的文件 */ }
      }
      onProgress?.(++done, entries.length);
    }
    const removedIds = [...existing.entries()].filter(([p]) => !seen.has(p)).map(([, it]) => it.id);
    for (const id of removedIds) {
      await store.deleteItem(id);
      const u = thumbs.current.get(id); if (u) { URL.revokeObjectURL(u); thumbs.current.delete(id); }
    }
    if (added.length || removedIds.length) {
      const rm = new Set(removedIds);
      setItems((prev) => [...added, ...prev.filter((m) => !rm.has(m.id))].sort((a, b) => b.takenAt - a.takenAt));
    }
  }, [items]);

  const pickBaseDir = useCallback(async (onProgress?: (d: number, t: number) => void) => {
    if (!fsSupported()) return;
    const h = await pickDirectory();
    if (!h || !(await ensurePermission(h, true))) return;
    baseHandle.current = h; setBaseName(h.name ?? "媒体库");
    await store.setConfig("baseDir", h);
    await scan(onProgress);
  }, [scan]);

  const syncBaseDir = useCallback(async (onProgress?: (d: number, t: number) => void) => {
    if (!baseHandle.current || !(await ensurePermission(baseHandle.current, true))) return;
    await scan(onProgress);
  }, [scan]);

  const disconnectBaseDir = useCallback(async () => {
    await store.delConfig("baseDir");
    baseHandle.current = null; setBaseName(null);
    const ids = items.filter((i) => i.path).map((i) => i.id);
    for (const id of ids) {
      await store.deleteItem(id);
      const u = thumbs.current.get(id); if (u) { URL.revokeObjectURL(u); thumbs.current.delete(id); }
    }
    const rm = new Set(ids);
    setItems((prev) => prev.filter((m) => !rm.has(m.id)));
  }, [items]);

  const scanFaces = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    await ensureFaceModels();
    const targets = items.filter((i) => i.kind === "image" && i.people === undefined);
    const ps: Person[] = persons.map((p) => ({ ...p, centroid: p.centroid.slice() }));
    const updated = new Map<string, string[]>();
    let done = 0;
    for (const it of targets) {
      try {
        const thumb = await store.getThumb(it.id);
        let people: string[] = [];
        if (thumb) {
          const { faces, img } = await detectFaces(thumb);
          const ids = new Set<string>();
          const stored: DetFace[] = [];
          for (const fc of faces) {
            let best: Person | null = null, bd = Infinity;
            for (const p of ps) { const d = dist(p.centroid, fc.descriptor); if (d < bd) { bd = d; best = p; } }
            let pid: string;
            if (best && bd < SAME_PERSON) {
              for (let k = 0; k < best.centroid.length; k++) best.centroid[k] = (best.centroid[k] * best.count + fc.descriptor[k]) / (best.count + 1);
              best.count++; pid = best.id;
            } else {
              const np: Person = { id: uid("p"), centroid: fc.descriptor.slice(), count: 1, avatar: await cropFace(img, fc.box) };
              ps.push(np); pid = np.id;
            }
            ids.add(pid);
            stored.push({ ...fc, personId: pid });
          }
          URL.revokeObjectURL(img.src);
          await store.putFaces(it.id, stored);
          people = [...ids];
        }
        await store.putMeta({ ...it, people });
        updated.set(it.id, people);
      } catch { /* 单张失败跳过 */ }
      onProgress?.(++done, targets.length);
    }
    await store.setConfig("persons", ps);
    setPersons(ps);
    if (updated.size) setItems((prev) => prev.map((m) => updated.has(m.id) ? { ...m, people: updated.get(m.id) } : m));
  }, [items, persons]);

  const renamePerson = useCallback(async (id: string, name: string) => {
    const next = persons.map((p) => (p.id === id ? { ...p, name } : p));
    setPersons(next);
    await store.setConfig("persons", next);
  }, [persons]);

  const createAlbum = useCallback(async (name: string) => {
    const a: Album = { id: uid("al"), name, createdAt: Date.now() };
    await store.putAlbum(a);
    setAlbums((prev) => [...prev, a]);
    return a;
  }, []);

  return (
    <Ctx.Provider value={{ ready, items, albums, thumbUrl, getOrigUrl, addFile, updateItem, removeItem, removeMany, scanHashes, analyze, createAlbum, baseDir: { name: baseName, supported: fsSupported() }, pickBaseDir, syncBaseDir, disconnectBaseDir, persons, scanFaces, renamePerson }}>
      {children}
    </Ctx.Provider>
  );
}
