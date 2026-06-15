import React, { useMemo, useState } from "react";
import { useVault } from "../vault/VaultContext";
import { buildView, type RangeKey } from "../lib/compute";
import { addAccount, addSnapshot, deleteAccount, updateAccount, emptyDataset } from "../vault/ops";
import type { VaultData } from "../vault/types";
import Dashboard from "./Dashboard";
import Accounts from "./Accounts";
import Detail from "./Detail";
import { InterestView } from "./Interest";
import { AccountEditor, SnapshotEditor } from "./editors";
import { Btn } from "../ui";
import { IconKey, IconChevron } from "../icons";

type Sub = "dashboard" | "accounts" | "detail" | "interest";

export default function Secret({ onExit }: { onExit: () => void }) {
  const { data, update } = useVault();
  const userName = data?.dataset.userName ?? "我";
  const secret = data?.secret ?? emptyDataset("私房钱", userName);

  const [sub, setSub] = useState<Sub>("dashboard");
  const [selectedId, setSelectedId] = useState<string>(secret.accounts[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("1y");
  const [accEditor, setAccEditor] = useState<{ open: boolean; editing: boolean }>({ open: false, editing: false });
  const [snapEditor, setSnapEditor] = useState(false);

  const view = useMemo(() => buildView(secret, { range, selectedId }), [secret, range, selectedId]);
  const currentAcc = secret.accounts.find((a) => a.id === view.detail.id);

  const ensureSecret = (d: VaultData) => { if (!d.secret) d.secret = emptyDataset("私房钱", d.dataset.userName); return d.secret; };
  const open = (id: string) => { setSelectedId(id); setSub("detail"); };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "var(--bg-content)", animation: "fvRise .2s ease" }}>
      <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: "var(--bg-toolbar)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--separator)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(160deg,#8E8E93,#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconKey size={13} stroke="#fff" /></span>
          私房钱
        </span>
        {sub === "detail" ? (
          <button onClick={() => setSub("accounts")} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13, fontWeight: 500, padding: "5px 7px" }}>
            <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={16} stroke="var(--accent)" /></span>{view.detail.name}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 2, background: "var(--fill-quaternary)", borderRadius: 8, padding: 2, marginLeft: 6 }}>
            <button onClick={() => setSub("dashboard")} style={seg(sub === "dashboard")}>仪表盘</button>
            <button onClick={() => setSub("accounts")} style={seg(sub === "accounts")}>账户</button>
            <button onClick={() => setSub("interest")} style={seg(sub === "interest")}>利息</button>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>独立加密 · 自动保存</span>
        <Btn variant="ghost" onClick={onExit} style={{ height: 30 }}>退出</Btn>
      </div>

      <div className="fv-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {sub === "dashboard" && <Dashboard view={view} onOpen={open} range={range} setRange={setRange} />}
        {sub === "accounts" && <Accounts view={view} onOpen={open} onAddAccount={() => setAccEditor({ open: true, editing: false })} />}
        {sub === "interest" && <InterestView dataset={secret} onSetRate={(id, dec) => update((d) => { const a = ensureSecret(d).accounts.find((x) => x.id === id); if (a) a.rate = dec; })} />}
        {sub === "detail" && (
          <Detail
            view={view}
            onAddSnapshot={() => setSnapEditor(true)}
            onEditAccount={() => setAccEditor({ open: true, editing: true })}
            onDeleteAccount={() => {
              if (currentAcc && confirm(`删除「${currentAcc.name}」及其全部快照？`)) {
                update((d) => deleteAccount(ensureSecret(d), currentAcc.id));
                setSub("accounts");
              }
            }}
          />
        )}
      </div>

      <AccountEditor
        open={accEditor.open}
        initial={accEditor.editing ? currentAcc : undefined}
        onClose={() => setAccEditor({ open: false, editing: false })}
        onSubmit={(meta, balance) => {
          if (accEditor.editing && currentAcc) update((d) => updateAccount(ensureSecret(d), currentAcc.id, meta));
          else update((d) => addAccount(ensureSecret(d), meta, balance));
        }}
      />
      <SnapshotEditor
        open={snapEditor}
        accountName={currentAcc?.name ?? ""}
        onClose={() => setSnapEditor(false)}
        onSubmit={(date, amount) => { if (currentAcc) update((d) => addSnapshot(ensureSecret(d), currentAcc.id, date, amount)); }}
      />
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
