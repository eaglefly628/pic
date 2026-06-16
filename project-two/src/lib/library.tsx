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

interface LibCtx {
  ready: boolean;
  items: MediaItem[];
  albums: Album[];
  thumbUrl: (id: string) => string | undefined;
  getOrigUrl: (id: string) => Promise<string | undefined>;
  addFile: (file: File, opts?: { isPrivate?: boolean; albums?: string[] }) => Promise<void>;
  updateItem: (id: string, patch: Partial<MediaItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
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
    const item: MediaItem = {
      id: uid(), name: file.name, kind, mime: file.type, size: file.size,
      width, height, durationSec,
      takenAt: meta.takenAt, takenSource: meta.takenSource, lat: meta.lat, lng: meta.lng,
      albums: opts?.albums ?? [], tags: [], private: opts?.isPrivate, addedAt: Date.now(),
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

  const createAlbum = useCallback(async (name: string) => {
    const a: Album = { id: uid("al"), name, createdAt: Date.now() };
    await store.putAlbum(a);
    setAlbums((prev) => [...prev, a]);
    return a;
  }, []);

  return (
    <Ctx.Provider value={{ ready, items, albums, thumbUrl, getOrigUrl, addFile, updateItem, removeItem, createAlbum }}>
      {children}
    </Ctx.Provider>
  );
}
