import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { VaultData } from "./types";
import { createVault, needsKdfUpgrade, rewrapVault, sealVault, unlockVault, upgradeKdf, type UnlockedKeys, type VaultBlob } from "../lib/crypto";
import { hasVault, loadBlob, saveBlob } from "../lib/storage";
import { initialVaultData } from "../data/defaultData";
import { requestHomePassword } from "../lib/homeBridge";
import { migrateStatisticalMonths } from "../lib/statMonth";
import { pruneOrphanBalances } from "./ops";
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
  const keysRef = useRef<UnlockedKeys | null>(null);
  const blobRef = useRef<VaultBlob | null>(null);
  const dataRef = useRef<VaultData | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
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
      let activeBlob = blob;
      let activeKeys = keys;
      // 老金库（KDF 迭代次数低于当前标准）：趁手里有主密码，静默升级后落盘。
      // 只是用更强的 KDF 重新包裹同一个 DEK，数据密文不动；失败也不影响本次解锁。
      if (needsKdfUpgrade(blob)) {
        try {
          const up = await upgradeKdf(keys, blob, pw);
          saveBlob(up.blob);
          activeBlob = up.blob;
          activeKeys = up.keys;
        } catch { /* 升级失败就下次再说，不能因此打不开金库 */ }
      }
      // 自愈：早期版本删账户时没清历史快照，混用不同版本后文件里会留下指向
      // 已删账户的残留。清掉并落盘，只在真的清到东西时才写一次。
      const pruned = pruneOrphanBalances(d.dataset);
      // 旧快照第一次升级时写入明确的统计月份；迁移标记落盘后，以后解锁 O(1) 跳过全量扫描。
      const statMonthMigration = migrateStatisticalMonths(d.dataset);
      if (pruned > 0 || statMonthMigration.changed) {
        const sealed = await sealVault(activeKeys, d);
        saveBlob(sealed);
        activeBlob = sealed;
      }
      blobRef.current = activeBlob;
      keysRef.current = activeKeys;
      dataRef.current = d;
      setData(d);
      lastActivity.current = Date.now();
      setStatus("unlocked");
      return true;
    } catch {
      return false; // 密码错误
    }
  }, []);

  // 初始化：大厅已解锁则通过一次性同源消息拿内存主密码；否则回落到本应用自己的锁屏。
  // 主密码不再写 sessionStorage，刷新或关闭大厅后就消失。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const housePw = await requestHomePassword();
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
    blobRef.current = null;
    dataRef.current = null;
    pwSession.set(null); // 同时锁上密码保险箱的二次验证会话
    setData(null);
    setStatus("locked");
  }, []);

  const reload = useCallback(() => {
    setStatus(hasVault() ? "locked" : "onboard");
    keysRef.current = null;
    blobRef.current = null;
    dataRef.current = null;
    pwSession.set(null);
    setData(null);
  }, []);

  // 所有写入串行，并始终从最近一次已落盘的数据继续修改；快速连续操作不会互相覆盖。
  const update = useCallback((mut: (d: VaultData) => void) => {
    const run = queueRef.current.then(async () => {
      const keys = keysRef.current;
      const current = dataRef.current;
      if (!keys || !current) return;
      const next = clone(current);
      mut(next);
      const blob = await sealVault(keys, next);
      saveBlob(blob);
      blobRef.current = blob;
      dataRef.current = next;
      setData(next);
    });
    queueRef.current = run.catch(() => { /* 单次失败不能堵死后续保存 */ });
    return run;
  }, []);

  const changePassword = useCallback((newPw: string) => {
    const run = queueRef.current.then(async () => {
      if (!keysRef.current || !blobRef.current) return;
      const { blob, keys } = await rewrapVault(keysRef.current, blobRef.current, newPw);
      saveBlob(blob);
      blobRef.current = blob;
      keysRef.current = keys;
    });
    queueRef.current = run.catch(() => { /* 同上 */ });
    return run;
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
