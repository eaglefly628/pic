import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { DevData, DevSettings } from "../types";
import { createVault, openVault, sealWithKey, isVaultFile, type VaultFile } from "./crypto";
import { sampleData } from "../data/devSample";
import * as store from "./store";

type Status = "loading" | "setup" | "locked" | "unlocked" | "migrate";

interface Ctx {
  status: Status;
  data: DevData;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  migrateLegacy: (password: string) => Promise<boolean>;
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
const emptyData = (): DevData => ({ tasks: [], notes: [], snippets: [], links: [], collections: [], lifeItems: [], secrets: [], accounts: [], company: {}, invoices: [], bets: [], settings: { autoLockMin: 5 }, updatedAt: 0 });
function normalize(d: Partial<DevData>): DevData {
  return {
    tasks: d.tasks ?? [], notes: d.notes ?? [], snippets: d.snippets ?? [], links: d.links ?? [],
    collections: d.collections ?? [], lifeItems: d.lifeItems ?? [], secrets: d.secrets ?? [], accounts: d.accounts ?? [],
    company: d.company ?? {}, invoices: d.invoices ?? [], bets: d.bets ?? [], wc: d.wc, spend: d.spend,
    settings: d.settings ?? { autoLockMin: 5 }, updatedAt: d.updatedAt ?? Date.now(),
  };
}

// 历史遗留：0.4.0 之前开发世界用这个写死在源码里的固定口令加密——等于没有加密。
// 现在只用于「认出旧库」并把数据迁移到用户自己设的主密码上，之后不再有任何地方用它加密。
const LEGACY_PW = "dev-world::no-password";

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<DevData>(emptyData());
  const [toast, setToast] = useState<string | null>(null);

  const keyRef = useRef<CryptoKey | null>(null);
  const saltRef = useRef<Uint8Array | null>(null);
  const iterRef = useRef<number>(0);
  const clipTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  // 始终指向「最新已落盘」的数据 + 串行队列：避免并发/快速的 update 各自基于旧闭包克隆，
  // 互相覆盖（典型症状：删了笔记/发票又自己回来，因为某个慢一拍的保存把旧副本写了回去）。
  const dataRef = useRef<DevData>(data);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  // setup/unlock/lock 走 setData，这里把 ref 同步到最新；update 路径在 persist 里也会即时更新 ref。
  useEffect(() => { dataRef.current = data; }, [data]);

  const persist = useCallback(async (next: DevData) => {
    if (!keyRef.current || !saltRef.current) return;
    next.updatedAt = Date.now();
    const file = await sealWithKey(keyRef.current, saltRef.current, iterRef.current, next);
    await store.saveVaultFile(file);
    dataRef.current = next;   // 让队列里的下一个 update 立刻看到最新数据，不必等 React 重渲染
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

  // 旧库（固定口令加密）→ 引导用户设置真正的主密码后迁移；新库/别的密码 → 正常锁屏；没有库 → 首次设置。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await store.requestPersist();
      const file = await store.loadVaultFile();
      if (cancelled) return;
      if (!file) { setStatus("setup"); return; }
      let legacy = false;
      try { await openVault(LEGACY_PW, file); legacy = true; } catch { legacy = false; }
      if (!cancelled) setStatus(legacy ? "migrate" : "locked");
    })();
    return () => { cancelled = true; };
  }, []);

  // 把旧的「固定口令库」重新用用户自己的主密码加密。旧库先备份，新库写成功后才算数。
  const migrateLegacy = useCallback(async (password: string): Promise<boolean> => {
    const file = await store.loadVaultFile();
    if (!file) return false;
    let d: Partial<DevData>;
    try { ({ data: d } = await openVault<Partial<DevData>>(LEGACY_PW, file)); } catch { return false; }
    await store.saveVaultBackup(file);   // 迁移前留底，万一中途出错还能找回
    const nd = normalize(d);
    const { file: nf, key, salt, iter } = await createVault(password, nd);
    await store.saveVaultFile(nf);
    keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
    dataRef.current = nd;
    setData(nd); setStatus("unlocked");
    return true;
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null; saltRef.current = null; iterRef.current = 0;
    setData(emptyData()); setStatus("locked");
  }, []);

  // 串行执行：每个 update 等上一个落盘后，再从「最新数据」克隆，保证改动叠加而非互相覆盖。
  const update = useCallback((mut: (d: DevData) => void) => {
    const run = queueRef.current.then(async () => {
      const next = clone(dataRef.current);
      mut(next);
      await persist(next);
    });
    queueRef.current = run.catch(() => { /* 单个失败不卡死整条队列 */ });
    return run;
  }, [persist]);

  const updateSettings = useCallback(async (s: Partial<DevSettings>) => {
    await update((d) => { d.settings = { ...d.settings, ...s }; });
  }, [update]);

  // 排进与 update 相同的串行队列：等 in-flight 的旧密钥 persist 落盘后再换钥、重封、落盘，避免旧写入后落盘覆盖新库
  const changeMaster = useCallback((oldPw: string, newPw: string): Promise<boolean> => {
    const run = queueRef.current.then(async () => {
      const file = await store.loadVaultFile();
      if (!file) return false;
      try { await openVault(oldPw, file); } catch { return false; }
      const { file: nf, key, salt, iter } = await createVault(newPw, dataRef.current);
      await store.saveVaultFile(nf);
      keyRef.current = key; saltRef.current = salt; iterRef.current = iter;
      return true;
    });
    queueRef.current = run.catch(() => { /* 失败不卡死队列 */ });
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
    a.download = `devworld-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.vault`;
    document.body.appendChild(a);   // Safari 需要锚点在 DOM 里才会触发下载
    a.click();
    a.remove();
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
      // 25 秒后清空剪贴板（重复复制先清旧定时器，以最后一次为准）
      if (clipTimer.current) clearTimeout(clipTimer.current);
      clipTimer.current = window.setTimeout(() => { navigator.clipboard?.writeText("").catch(() => {}); }, 25000);
    }).catch(() => { setToast("复制失败"); setTimeout(() => setToast(null), 1500); });
  }, []);

  return (
    <C.Provider value={{ status, data, setup, unlock, migrateLegacy, lock, update, changeMaster, updateSettings, exportVault, importVault, copy, toast }}>
      {children}
    </C.Provider>
  );
}
