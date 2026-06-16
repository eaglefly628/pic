import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVault } from "../vault/VaultContext";
import { buildView, type RangeKey } from "../lib/compute";
import { addAccount, addSnapshot, deleteAccount, updateAccount } from "../vault/ops";
import { hasSecret, createSecret, unlockSecret, saveSecret, changeSecretPassword, clearSecret } from "../vault/secretStore";
import { passwordStrength, type UnlockedKeys } from "../lib/crypto";
import type { Dataset } from "../data/types";
import Dashboard from "./Dashboard";
import Accounts from "./Accounts";
import Detail from "./Detail";
import { InterestView } from "./Interest";
import { AccountEditor, SnapshotEditor } from "./editors";
import { Btn, Field, Modal, TextField } from "../ui";
import { IconKey, IconChevron, IconArrowRight } from "../icons";

type Sub = "dashboard" | "accounts" | "detail" | "interest";
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export default function Secret({ onExit }: { onExit: () => void }) {
  const { data } = useVault();
  const userName = data?.dataset.userName ?? "我";

  const [status, setStatus] = useState<"loading" | "onboard" | "locked" | "unlocked">("loading");
  const [ds, setDs] = useState<Dataset | null>(null);
  const keysRef = useRef<UnlockedKeys | null>(null);

  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const [sub, setSub] = useState<Sub>("dashboard");
  const [selectedId, setSelectedId] = useState("");
  const [range, setRange] = useState<RangeKey>("1y");
  const [accEditor, setAccEditor] = useState<{ open: boolean; editing: boolean }>({ open: false, editing: false });
  const [snapEditor, setSnapEditor] = useState(false);
  const [cpwOpen, setCpwOpen] = useState(false);
  const [cnpw, setCnpw] = useState(""); const [cnpw2, setCnpw2] = useState(""); const [cmsg, setCmsg] = useState("");

  useEffect(() => { setStatus(hasSecret() ? "locked" : "onboard"); }, []);

  const doChangePw = async () => {
    setCmsg("");
    if (cnpw.length < 4) return setCmsg("新密码至少 4 位");
    if (cnpw !== cnpw2) return setCmsg("两次输入不一致");
    if (!keysRef.current) return;
    keysRef.current = await changeSecretPassword(keysRef.current, cnpw);
    setCpwOpen(false); setCnpw(""); setCnpw2(""); setCmsg("");
  };
  const resetSecret = () => {
    if (confirm("忘记密码？将清空「独立管理」的全部数据并重新设置（不可恢复）。是否继续？")) {
      clearSecret(); setPw(""); setErr(""); setStatus("onboard");
    }
  };

  const onboard = status === "onboard";
  const submitPw = async () => {
    setErr("");
    if (onboard) {
      if (pw.length < 4) return setErr("密码至少 4 位");
      if (pw !== pw2) return setErr("两次输入不一致");
      setBusy(true);
      const r = await createSecret(pw, userName);
      keysRef.current = r.keys; setDs(r.data); setSelectedId(r.data.accounts[0]?.id ?? ""); setBusy(false); setStatus("unlocked");
    } else {
      setBusy(true);
      const r = await unlockSecret(pw);
      setBusy(false);
      if (!r) { setErr("密码错误"); setPw(""); return; }
      keysRef.current = r.keys; setDs(r.data); setSelectedId(r.data.accounts[0]?.id ?? ""); setStatus("unlocked");
    }
  };

  const view = useMemo(() => (ds ? buildView(ds, { range, selectedId }) : null), [ds, range, selectedId]);
  const currentAcc = ds?.accounts.find((a) => a.id === view?.detail.id);
  const mutate = (fn: (d: Dataset) => void) => {
    if (!ds || !keysRef.current) return;
    const next = clone(ds); fn(next); setDs(next); void saveSecret(keysRef.current, next);
  };
  const open = (id: string) => { setSelectedId(id); setSub("detail"); };
  const strength = passwordStrength(pw);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "var(--bg-content)", animation: "fvRise .2s ease" }}>
      <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: "var(--bg-toolbar)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--separator)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(160deg,#8E8E93,#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconKey size={13} stroke="#fff" /></span>
          独立管理
        </span>
        {status === "unlocked" && view && (
          sub === "detail" ? (
            <button onClick={() => setSub("accounts")} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13, fontWeight: 500, padding: "5px 7px" }}>
              <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={16} stroke="var(--accent)" /></span>{view.detail.name}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 2, background: "var(--fill-quaternary)", borderRadius: 8, padding: 2, marginLeft: 6 }}>
              <button onClick={() => setSub("dashboard")} style={seg(sub === "dashboard")}>仪表盘</button>
              <button onClick={() => setSub("accounts")} style={seg(sub === "accounts")}>账户</button>
              <button onClick={() => setSub("interest")} style={seg(sub === "interest")}>利息</button>
            </div>
          )
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>独立密码 · 独立加密</span>
        {status === "unlocked" && <Btn variant="ghost" onClick={() => setCpwOpen(true)} style={{ height: 30 }}>改密码</Btn>}
        <Btn variant="ghost" onClick={onExit} style={{ height: 30 }}>退出</Btn>
      </div>

      {status === "unlocked" && view && ds ? (
        <>
          <div className="fv-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {sub === "dashboard" && <Dashboard view={view} onOpen={open} range={range} setRange={setRange} />}
            {sub === "accounts" && <Accounts view={view} onOpen={open} onAddAccount={() => setAccEditor({ open: true, editing: false })} />}
            {sub === "interest" && <InterestView dataset={ds} onSetRate={(id, dec) => mutate((d) => { const a = d.accounts.find((x) => x.id === id); if (a) a.rate = dec; })} />}
            {sub === "detail" && (
              <Detail
                view={view}
                onAddSnapshot={() => setSnapEditor(true)}
                onEditAccount={() => setAccEditor({ open: true, editing: true })}
                onDeleteAccount={() => { if (currentAcc && confirm(`删除「${currentAcc.name}」及其全部快照？`)) { mutate((d) => deleteAccount(d, currentAcc.id)); setSub("accounts"); } }}
              />
            )}
          </div>
          <AccountEditor
            open={accEditor.open}
            initial={accEditor.editing ? currentAcc : undefined}
            onClose={() => setAccEditor({ open: false, editing: false })}
            onSubmit={(meta, balance) => {
              if (accEditor.editing && currentAcc) mutate((d) => updateAccount(d, currentAcc.id, meta));
              else mutate((d) => addAccount(d, meta, balance));
            }}
          />
          <SnapshotEditor open={snapEditor} accountName={currentAcc?.name ?? ""} onClose={() => setSnapEditor(false)}
            onSubmit={(date, amount) => { if (currentAcc) mutate((d) => addSnapshot(d, currentAcc.id, date, amount)); }} />
          <Modal open={cpwOpen} title="修改独立管理密码" onClose={() => setCpwOpen(false)} width={400}
            footer={<><Btn variant="ghost" onClick={() => setCpwOpen(false)}>取消</Btn><Btn onClick={doChangePw}>保存</Btn></>}>
            <Field label="新密码"><TextField type="password" value={cnpw} onChange={(e) => setCnpw(e.target.value)} autoFocus /></Field>
            <Field label="确认新密码"><TextField type="password" value={cnpw2} onChange={(e) => setCnpw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doChangePw(); }} /></Field>
            {cmsg && <div style={{ fontSize: 12, color: "var(--red)" }}>{cmsg}</div>}
          </Modal>
        </>
      ) : status === "loading" ? null : (
        // 私房钱独立密码：创建 / 解锁
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: 300 }}>
            <div style={{ width: 56, height: 56, borderRadius: 15, background: "linear-gradient(160deg,#8E8E93,#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconKey size={26} stroke="#fff" /></div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{onboard ? "设置独立管理密码" : "独立管理已锁定"}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{onboard ? "与主密码不同，独立加密保存" : "输入独立管理密码"}</div>
            </div>
            <TextField type="password" autoFocus value={pw} placeholder={onboard ? "设置独立管理密码" : "独立管理密码"} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !onboard) submitPw(); }} />
            {onboard && (
              <>
                <TextField type="password" value={pw2} placeholder="再次输入" onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitPw(); }} />
                {pw && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--track)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(strength.score / 4) * 100}%`, background: strength.score >= 3 ? "var(--green)" : strength.score >= 2 ? "var(--orange)" : "var(--red)" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{strength.label}</span>
                  </div>
                )}
              </>
            )}
            {err && <div style={{ fontSize: 12, color: "var(--red)" }}>{err}</div>}
            <Btn onClick={submitPw} disabled={busy} style={{ height: 40, width: "100%" }}>{busy ? "处理中…" : onboard ? "创建并进入" : "解锁"}{!busy && <IconArrowRight size={15} stroke="#fff" />}</Btn>
            {!onboard && <button onClick={resetSecret} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>忘记密码？重置独立管理（清空后重设）</button>}
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.6 }}>⚠️ 独立管理密码同样无法找回；与主密码相互独立。</div>
          </div>
        </div>
      )}
    </div>
  );
}

function seg(active: boolean): React.CSSProperties {
  return {
    border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "5px 13px", borderRadius: 6, whiteSpace: "nowrap",
    background: active ? "var(--bg-card)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
  };
}
