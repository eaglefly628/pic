import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { VaultData } from "./types";
import { createVault, rewrapVault, sealVault, unlockVault, type UnlockedKeys, type VaultBlob } from "../lib/crypto";
import { hasVault, loadBlob, saveBlob } from "../lib/storage";
import { initialVaultData } from "../data/defaultData";

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
  const keysRef = useRef<UnlockedKeys | null>(null);
  const blobRef = useRef<VaultBlob | null>(null);
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    setStatus(hasVault() ? "locked" : "onboard");
  }, []);

  const create = useCallback(async (pw: string) => {
    const initial = initialVaultData();
    const { blob, keys } = await createVault(pw, initial);
    saveBlob(blob);
    blobRef.current = blob;
    keysRef.current = keys;
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
      setData(d);
      lastActivity.current = Date.now();
      setStatus("unlocked");
      return true;
    } catch {
      return false; // 密码错误
    }
  }, []);

  const lock = useCallback(() => {
    keysRef.current = null;
    setData(null);
    setStatus("locked");
  }, []);

  const reload = useCallback(() => {
    setStatus(hasVault() ? "locked" : "onboard");
    keysRef.current = null;
    setData(null);
  }, []);

  const update = useCallback(async (mut: (d: VaultData) => void) => {
    if (!keysRef.current || !data) return;
    const next = clone(data);
    mut(next);
    setData(next);
    const blob = await sealVault(keysRef.current, next);
    saveBlob(blob);
    blobRef.current = blob;
  }, [data]);

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
