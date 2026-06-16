import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Album, MediaItem, MediaKind } from "../types";
import * as store from "./store";
import { extractMeta, makeImageThumb, makeVideoThumb } from "./exif";

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
  createAlbum: (name: string) => Promise<Album>;
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
  const [albums, setAlbums] = useState<Album[]>([]);
  const thumbs = useRef<Map<string, string>>(new Map());

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

  const thumbUrl = useCallback((id: string) => thumbs.current.get(id), []);

  const getOrigUrl = useCallback(async (id: string) => {
    const b = await store.getOrig(id);
    return b ? URL.createObjectURL(b) : undefined;
  }, []);

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
    let next: MediaItem | undefined;
    setItems((prev) => prev.map((m) => (m.id === id ? (next = { ...m, ...patch }) : m)));
    if (next) await store.putMeta(next);
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

  const createAlbum = useCallback(async (name: string) => {
    const a: Album = { id: uid("al"), name, createdAt: Date.now() };
    await store.putAlbum(a);
    setAlbums((prev) => [...prev, a]);
    return a;
  }, []);

  return (
    <Ctx.Provider value={{ ready, items, albums, thumbUrl, getOrigUrl, addFile, updateItem, removeItem, removeMany, scanHashes, createAlbum }}>
      {children}
    </Ctx.Provider>
  );
}
