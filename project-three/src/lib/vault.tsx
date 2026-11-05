import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { VaultData, VaultItem, VaultSettings } from "../types";
import { createVault, openVault, sealWithKey, isVaultFile, DEFAULT_ITER, type VaultFile } from "./crypto";
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
  importVault: (file: File) => Promise<"ok" | "bad">;
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
  const clipTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const dataRef = useRef<VaultData>(data);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    (async () => {
      await store.requestPersist();
      setStatus((await store.hasVault()) ? "locked" : "setup");
    })();
  }, []);

  const persist = useCallback(async (next: VaultData) => {
    if (!keyRef.current || !saltRef.current) return;
    next.updatedAt = Date.now();
    const file = await sealWithKey(keyRef.current, saltRef.current, iterRef.current, next);
    await store.saveVaultFile(file);
    dataRef.current = next;
    setData({ ...next });
  }, []);

  const setup = useCallback(async (password: string) => {
    const d = emptyData();
    const { file, key, salt, iter } = await createVault(password, d);
    await store.saveVaultFile(file);
    keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
    dataRef.current = d;
    setData(d); setStatus("unlocked");
  }, []);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const file = await store.loadVaultFile();
    if (!file) return false;
    try {
      let { data: d, key, salt, iter } = await openVault<VaultData>(password, file);
      if (!d.settings) d.settings = { autoLockMin: 5 };
      // 老保险库解锁成功后升级 KDF；覆盖前保留一份旧密文，迁移中断也可找回。
      if (iter < DEFAULT_ITER) {
        await store.saveVaultBackup(file);
        const upgraded = await createVault(password, d);
        await store.saveVaultFile(upgraded.file);
        key = upgraded.key; salt = upgraded.salt; iter = upgraded.iter;
      }
      keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
      dataRef.current = d;
      setData(d); setStatus("unlocked");
      return true;
    } catch {
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null; saltRef.current = null; iterRef.current = 0;
    dataRef.current = emptyData();
    setData(emptyData()); setStatus("locked");
  }, []);

  const mutate = useCallback((fn: (d: VaultData) => void) => {
    const run = queueRef.current.then(async () => {
      const next = structuredClone(dataRef.current);
      fn(next);
      await persist(next);
    });
    queueRef.current = run.catch(() => { /* 单次失败不阻塞后续保存 */ });
    return run;
  }, [persist]);

  const saveItem = useCallback((item: VaultItem) => mutate((d) => {
    const now = Date.now();
    const exists = d.items.some((i) => i.id === item.id);
    const it: VaultItem = { ...item, id: item.id || uid(), updatedAt: now, createdAt: item.createdAt || now };
    d.items = exists ? d.items.map((i) => (i.id === it.id ? it : i)) : [it, ...d.items];
  }), [mutate]);

  const deleteItem = useCallback((id: string) => mutate((d) => { d.items = d.items.filter((i) => i.id !== id); }), [mutate]);

  const toggleFavorite = useCallback((id: string) => mutate((d) => {
    d.items = d.items.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i));
  }), [mutate]);

  const updateSettings = useCallback((s: Partial<VaultSettings>) => mutate((d) => {
    d.settings = { ...d.settings, ...s };
  }), [mutate]);

  const changeMaster = useCallback((oldPw: string, newPw: string): Promise<boolean> => {
    const run = queueRef.current.then(async () => {
      const file = await store.loadVaultFile();
      if (!file) return false;
      try { await openVault(oldPw, file); } catch { return false; }
      await store.saveVaultBackup(file);
      const { file: nf, key, salt, iter } = await createVault(newPw, dataRef.current);
      await store.saveVaultFile(nf);
      keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
      return true;
    });
    queueRef.current = run.catch(() => { /* 同上 */ });
    return run;
  }, []);

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

  const importVault = useCallback((file: File): Promise<"ok" | "bad"> => {
    // 导入也进入同一保存队列：先收尾当前编辑，再备份并替换，避免旧写入覆盖刚导入的库。
    const run = queueRef.current.then(async () => {
      try {
        const obj = JSON.parse(await file.text());
        if (!isVaultFile(obj)) return "bad" as const;
        const current = await store.loadVaultFile();
        if (current) await store.saveVaultBackup(current);
        await store.saveVaultFile(obj as VaultFile);
        keyRef.current = null; saltRef.current = null; iterRef.current = 0;
        const empty = emptyData(); dataRef.current = empty;
        setData(empty); setStatus("locked");
        return "ok" as const;
      } catch {
        return "bad" as const;
      }
    });
    queueRef.current = run.catch(() => { /* 同上 */ });
    return run;
  }, []);

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
