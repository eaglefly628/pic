import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { DevData, DevSettings } from "../types";
import { createVault, openVault, sealWithKey, isVaultFile, type VaultFile } from "./crypto";
import { sampleData } from "../data/devSample";
import * as store from "./store";

type Status = "loading" | "setup" | "locked" | "unlocked";

interface Ctx {
  status: Status;
  data: DevData;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  update: (mut: (d: DevData) => void) => Promise<void>;
  changeMaster: (oldPw: string, newPw: string) => Promise<boolean>;
  updateSettings: (s: Partial<DevSettings>) => Promise<void>;
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

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const emptyData = (): DevData => ({ tasks: [], notes: [], snippets: [], links: [], collections: [], lifeItems: [], secrets: [], accounts: [], company: {}, taxFilings: [], invoices: [], settings: { autoLockMin: 5 }, updatedAt: 0 });
function normalize(d: Partial<DevData>): DevData {
  return {
    tasks: d.tasks ?? [], notes: d.notes ?? [], snippets: d.snippets ?? [], links: d.links ?? [],
    collections: d.collections ?? [], lifeItems: d.lifeItems ?? [], secrets: d.secrets ?? [], accounts: d.accounts ?? [],
    company: d.company ?? {}, taxFilings: d.taxFilings ?? [], invoices: d.invoices ?? [],
    settings: d.settings ?? { autoLockMin: 5 }, updatedAt: d.updatedAt ?? Date.now(),
  };
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<DevData>(emptyData());
  const [toast, setToast] = useState<string | null>(null);

  const keyRef = useRef<CryptoKey | null>(null);
  const saltRef = useRef<Uint8Array | null>(null);
  const iterRef = useRef<number>(0);
  const clipTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      await store.requestPersist();
      setStatus((await store.hasVault()) ? "locked" : "setup");
    })();
  }, []);

  const persist = useCallback(async (next: DevData) => {
    if (!keyRef.current || !saltRef.current) return;
    next.updatedAt = Date.now();
    const file = await sealWithKey(keyRef.current, saltRef.current, iterRef.current, next);
    await store.saveVaultFile(file);
    setData({ ...next });
  }, []);

  const setup = useCallback(async (password: string) => {
    const d = sampleData();
    const { file, key, salt, iter } = await createVault(password, d);
    await store.saveVaultFile(file);
    keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
    setData(d); setStatus("unlocked");
  }, []);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const file = await store.loadVaultFile();
    if (!file) return false;
    try {
      const { data: d, key, salt, iter } = await openVault<Partial<DevData>>(password, file);
      keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
      setData(normalize(d)); setStatus("unlocked");
      return true;
    } catch {
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null; saltRef.current = null; iterRef.current = 0;
    setData(emptyData()); setStatus("locked");
  }, []);

  const update = useCallback(async (mut: (d: DevData) => void) => {
    const next = clone(data);
    mut(next);
    await persist(next);
  }, [data, persist]);

  const updateSettings = useCallback(async (s: Partial<DevSettings>) => {
    await persist({ ...data, settings: { ...data.settings, ...s } });
  }, [data, persist]);

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
    a.download = `devworld-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.vault`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const importVault = useCallback(async (file: File): Promise<"ok" | "bad"> => {
    try {
      const obj = JSON.parse(await file.text());
      if (!isVaultFile(obj)) return "bad";
      await store.saveVaultFile(obj as VaultFile);
      keyRef.current = null; saltRef.current = null; iterRef.current = 0;
      setData(emptyData()); setStatus("locked");
      return "ok";
    } catch {
      return "bad";
    }
  }, []);

  const copy = useCallback((text: string, label = "内容") => {
    navigator.clipboard?.writeText(text).then(() => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(`已复制${label}`);
      toastTimer.current = window.setTimeout(() => setToast(null), 1800);
      if (clipTimer.current) clearTimeout(clipTimer.current);
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
    <C.Provider value={{ status, data, setup, unlock, lock, update, changeMaster, updateSettings, exportVault, importVault, copy, toast }}>
      {children}
    </C.Provider>
  );
}
