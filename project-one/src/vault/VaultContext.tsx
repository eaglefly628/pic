import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { VaultData } from "./types";
import { createVault, needsKdfUpgrade, rewrapVault, sealVault, unlockVault, upgradeKdf, type UnlockedKeys, type VaultBlob } from "../lib/crypto";
import { hasVault, loadBlob, saveBlob } from "../lib/storage";
import { initialVaultData } from "../data/defaultData";
import { pwSession } from "./pwStore";

type Status = "loading" | "onboard" | "locked" | "unlocked";

interface VaultCtx {
  status: Status;
  data: VaultData | null;
  create: (pw: string) => Promise<void>;
  unlock: (pw: string) => Promise<boolean>;
  lock: () => void;
  reload: () => void;
  update: (mut: (d: VaultData) => void) => Promise<void>;
  changePassword: (newPw: string) => Promise<void>;
  bumpActivity: () => void;
}

const Ctx = createContext<VaultCtx | null>(null);
export function useVault(): VaultCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVault must be used within VaultProvider");
  return v;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<VaultData | null>(null);
  const dataRef = useRef<VaultData | null>(null); // 与 data 同步：update 基于最新值，避免闭包旧值互相覆盖
  const keysRef = useRef<UnlockedKeys | null>(null);
  const blobRef = useRef<VaultBlob | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve()); // 串行写队列：前一次落盘完成才写下一次
  const lastActivity = useRef<number>(Date.now());

  const create = useCallback(async (pw: string) => {
    const initial = initialVaultData();
    const { blob, keys } = await createVault(pw, initial);
    saveBlob(blob);
    blobRef.current = blob;
    keysRef.current = keys;
    dataRef.current = initial;
    setData(initial);
    lastActivity.current = Date.now();
    setStatus("unlocked");
  }, []);

  const unlock = useCallback(async (pw: string): Promise<boolean> => {
    const blob = loadBlob();
    if (!blob) {
      setStatus("onboard");
      return false;
    }
    try {
      const { data: d, keys } = await unlockVault<VaultData>(pw, blob);
      blobRef.current = blob;
      keysRef.current = keys;
      // 老金库（KDF 迭代次数低于当前标准）：趁手里有主密码，静默升级后落盘。
      // 只是用更强的 KDF 重新包裹同一个 DEK，数据密文不动；失败也不影响本次解锁。
      if (needsKdfUpgrade(blob)) {
        try {
          const up = await upgradeKdf(keys, blob, pw);
          saveBlob(up.blob);
          blobRef.current = up.blob;
          keysRef.current = up.keys;
        } catch { /* 升级失败就下次再说，不能因此打不开金库 */ }
      }
      dataRef.current = d;
      setData(d);
      lastActivity.current = Date.now();
      setStatus("unlocked");
      return true;
    } catch {
      return false; // 密码错误
    }
  }, []);

  // 初始化：大厅（hub）已解锁则拿大厅主密码自动开锁 / 首次初始化；否则回落到本应用自己的锁屏
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const housePw = sessionStorage.getItem("home.key");
      if (housePw) {
        if (hasVault()) {
          const ok = await unlock(housePw);
          if (ok || cancelled) return;          // 与大厅密码一致 → 直接进；不一致 → 回落到自己的锁
        } else {
          await create(housePw);
          return;
        }
      }
      if (!cancelled) setStatus(hasVault() ? "locked" : "onboard");
    })();
    return () => { cancelled = true; };
  }, [create, unlock]);

  const lock = useCallback(() => {
    keysRef.current = null;
    pwSession.set(null); // 同时锁上密码保险箱的二次验证会话
    dataRef.current = null;
    setData(null);
    setStatus("locked");
  }, []);

  const reload = useCallback(() => {
    setStatus(hasVault() ? "locked" : "onboard");
    keysRef.current = null;
    pwSession.set(null);
    dataRef.current = null;
    setData(null);
  }, []);

  const update = useCallback(async (mut: (d: VaultData) => void) => {
    const keys = keysRef.current;
    if (!keys || !dataRef.current) return;
    const next = clone(dataRef.current); // 基于最新数据克隆，避免并发 update 相互覆盖
    mut(next);
    dataRef.current = next;
    setData(next);
    // 排进串行队列：前一次写完才写下一次；返回本次持久化完成的 Promise（失败会 reject）
    const p = writeQueue.current.then(async () => {
      const blob = await sealVault(keys, next);
      saveBlob(blob);
      blobRef.current = blob;
    });
    writeQueue.current = p.catch(() => {}); // 单次失败不阻塞后续写入
    return p;
  }, []);

  const changePassword = useCallback(async (newPw: string) => {
    if (!keysRef.current || !blobRef.current) return;
    const { blob, keys } = await rewrapVault(keysRef.current, blobRef.current, newPw);
    saveBlob(blob);
    blobRef.current = blob;
    keysRef.current = keys;
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  // 自动锁定 + 活动监听
  useEffect(() => {
    if (status !== "unlocked") return;
    const onAct = () => (lastActivity.current = Date.now());
    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onAct, { passive: true }));
    const timer = window.setInterval(() => {
      const min = data?.settings.autoLockMin ?? 0;
      if (min > 0 && Date.now() - lastActivity.current > min * 60_000) lock();
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onAct));
      window.clearInterval(timer);
    };
  }, [status, data?.settings.autoLockMin, lock]);

  return (
    <Ctx.Provider value={{ status, data, create, unlock, lock, reload, update, changePassword, bumpActivity }}>
      {children}
    </Ctx.Provider>
  );
}
