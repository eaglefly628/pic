import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { VaultData, VaultItem, VaultSettings } from "../types";
import { createVault, openVault, sealWithKey, isVaultFile } from "./crypto";
import * as store from "./store";

type Status = "loading" | "setup" | "locked" | "unlocked";

interface Ctx {
  status: Status;
  items: VaultItem[];
  settings: VaultSettings;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  saveItem: (item: VaultItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  changeMaster: (oldPw: string, newPw: string) => Promise<boolean>;
  updateSettings: (s: Partial<VaultSettings>) => Promise<void>;
  exportVault: () => Promise<void>;
  importVault: (file: File, password: string) => Promise<"ok" | "bad" | "badpass">;
  copy: (text: string, label?: string) => void;
  toast: string | null;
}

const C = createContext<Ctx | null>(null);
export const useVault = () => {
  const c = useContext(C);
  if (!c) throw new Error("useVault outside provider");
  return c;
};

const uid = () => "it_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const emptyData = (): VaultData => ({ items: [], settings: { autoLockMin: 5 }, updatedAt: Date.now() });

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<VaultData>(emptyData());
  const [toast, setToast] = useState<string | null>(null);

  const keyRef = useRef<CryptoKey | null>(null);
  const saltRef = useRef<Uint8Array | null>(null);
  const iterRef = useRef<number>(0);
  const dataRef = useRef<VaultData>(data); // 与 data 同步，避免快速连续操作读到闭包旧值
  const writeQueue = useRef<Promise<void>>(Promise.resolve()); // 串行落盘队列：前一个写完成才写下一个
  const clipTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      await store.requestPersist();
      setStatus((await store.hasVault()) ? "locked" : "setup");
    })();
  }, []);

  const setAll = useCallback((d: VaultData) => { dataRef.current = d; setData(d); }, []);

  const persist = useCallback(async (next: VaultData) => {
    next.updatedAt = Date.now();
    setAll(next); // 先更新内存态，再排队落盘
    const p = writeQueue.current.then(async () => {
      if (!keyRef.current || !saltRef.current) return;
      const file = await sealWithKey(keyRef.current, saltRef.current, iterRef.current, next);
      await store.saveVaultFile(file);
    });
    writeQueue.current = p.catch(() => {}); // 单次失败不阻塞后续写
    await p;
  }, [setAll]);

  const setup = useCallback(async (password: string) => {
    const d = emptyData();
    const { file, key, salt, iter } = await createVault(password, d);
    await store.saveVaultFile(file);
    keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
    setAll(d); setStatus("unlocked");
  }, [setAll]);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const file = await store.loadVaultFile();
    if (!file) return false;
    try {
      const { data: d, key, salt, iter } = await openVault<VaultData>(password, file);
      keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
      if (!d.settings) d.settings = { autoLockMin: 5 };
      setAll(d); setStatus("unlocked");
      return true;
    } catch {
      return false;
    }
  }, [setAll]);

  const lock = useCallback(() => {
    keyRef.current = null; saltRef.current = null; iterRef.current = 0;
    setAll(emptyData()); setStatus("locked");
  }, [setAll]);

  const saveItem = useCallback(async (item: VaultItem) => {
    const now = Date.now();
    const cur = dataRef.current;
    const exists = cur.items.some((i) => i.id === item.id);
    const it: VaultItem = { ...item, id: item.id || uid(), updatedAt: now, createdAt: item.createdAt || now };
    const items = exists ? cur.items.map((i) => (i.id === it.id ? it : i)) : [it, ...cur.items];
    await persist({ ...cur, items });
  }, [persist]);

  const deleteItem = useCallback(async (id: string) => {
    const cur = dataRef.current;
    await persist({ ...cur, items: cur.items.filter((i) => i.id !== id) });
  }, [persist]);

  const toggleFavorite = useCallback(async (id: string) => {
    const cur = dataRef.current;
    await persist({ ...cur, items: cur.items.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)) });
  }, [persist]);

  const updateSettings = useCallback(async (s: Partial<VaultSettings>) => {
    const cur = dataRef.current;
    await persist({ ...cur, settings: { ...cur.settings, ...s } });
  }, [persist]);

  const changeMaster = useCallback(async (oldPw: string, newPw: string): Promise<boolean> => {
    const file = await store.loadVaultFile();
    if (!file) return false;
    try { await openVault(oldPw, file); } catch { return false; }
    const { file: nf, key, salt, iter } = await createVault(newPw, data);
    await store.saveVaultFile(nf);
    keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
    return true;
  }, [data]);

  const exportVault = useCallback(async () => {
    const file = await store.loadVaultFile();
    if (!file) return;
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `junbai-vault-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.vault`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const importVault = useCallback(async (file: File, password: string): Promise<"ok" | "bad" | "badpass"> => {
    let obj: unknown;
    try { obj = JSON.parse(await file.text()); } catch { return "bad"; }
    if (!isVaultFile(obj)) return "bad";
    try { await openVault(password, obj); } catch { return "badpass"; } // 先用该文件的主密码试解密，失败不落盘
    const cur = await store.loadVaultFile();
    if (cur) await store.saveVaultBackup(cur); // 旧库另存备份键，导错文件也能找回
    await store.saveVaultFile(obj);
    keyRef.current = null; saltRef.current = null; iterRef.current = 0;
    setAll(emptyData()); setStatus("locked");
    return "ok";
  }, [setAll]);

  const copy = useCallback((text: string, label = "内容") => {
    navigator.clipboard?.writeText(text).then(() => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(`已复制${label}（约 25 秒后自动清空剪贴板）`);
      toastTimer.current = window.setTimeout(() => setToast(null), 2200);
      if (clipTimer.current) clearTimeout(clipTimer.current);
      clipTimer.current = window.setTimeout(() => { navigator.clipboard?.writeText("").catch(() => {}); }, 25_000);
    }).catch(() => { setToast("复制失败"); setTimeout(() => setToast(null), 1500); });
  }, []);

  // 闲置自动锁定
  useEffect(() => {
    if (status !== "unlocked" || !data.settings.autoLockMin) return;
    let timer: number;
    const reset = () => { clearTimeout(timer); timer = window.setTimeout(lock, data.settings.autoLockMin * 60_000); };
    const evts = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); evts.forEach((e) => window.removeEventListener(e, reset)); };
  }, [status, data.settings.autoLockMin, lock]);

  return (
    <C.Provider value={{ status, items: data.items, settings: data.settings, setup, unlock, lock, saveItem, deleteItem, toggleFavorite, changeMaster, updateSettings, exportVault, importVault, copy, toast }}>
      {children}
    </C.Provider>
  );
}
