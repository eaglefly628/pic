import React, { useState } from "react";
import type { View } from "../lib/compute";
import { Btn, card } from "../ui";
import { IconChevron, IconPlus } from "../icons";

type AccVM = View["groups"][number]["accounts"][number];

export default function Accounts({ view, onOpen, onAddAccount }: { view: View; onOpen: (id: string) => void; onAddAccount: () => void }) {
  const t = view.totals;
  const [mode, setMode] = useState<"group" | "flat">("group");

  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <div style={{ flex: 1, ...card, padding: "16px 22px", display: "flex", alignItems: "center", gap: 28 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>净资产</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{t.netWorth}</div>
          </div>
          <div style={{ width: 0.5, height: 34, background: "var(--separator-strong)" }} />
          <div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>总资产</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 3 }}>{t.totalAssets}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>总负债</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--red)", fontVariantNumeric: "tabular-nums", marginTop: 3 }}>{t.totalLiabilities}</div>
          </div>
        </div>
        <Btn onClick={onAddAccount} style={{ height: 36 }}><IconPlus />新增账户</Btn>
      </div>

      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 2, background: "var(--fill-quaternary)", borderRadius: 8, padding: 2 }}>
          <button onClick={() => setMode("group")} style={seg(mode === "group")}>按分类</button>
          <button onClick={() => setMode("flat")} style={seg(mode === "flat")}>全部排序</button>
        </div>
      </div>

      {mode === "group" ? (
        view.groups.map((grp) => (
          <div key={grp.cat} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px 9px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>{grp.title}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: grp.subtotalColor, fontVariantNumeric: "tabular-nums" }}>{grp.subtotal}</div>
            </div>
            <div style={{ ...card, overflow: "hidden" }}>
              {grp.accounts.map((acc) => <AccountRow key={acc.id} acc={acc} onOpen={onOpen} />)}
            </div>
          </div>
        ))
      ) : (
        <div style={{ ...card, overflow: "hidden" }}>
          {view.flatAccounts.map((acc) => <AccountRow key={acc.id} acc={acc} onOpen={onOpen} showCat />)}
        </div>
      )}
    </div>
  );
}

function AccountRow({ acc, onOpen, showCat }: { acc: AccVM; onOpen: (id: string) => void; showCat?: boolean }) {
  return (
    <div onClick={() => onOpen(acc.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: acc.border, cursor: "pointer" }}>
      <span style={{ width: 38, height: 38, borderRadius: 10, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${acc.color} 15%, transparent)`, color: acc.color }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{acc.initial}</span>
      </span>
      <div style={{ minWidth: 0, width: 168 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acc.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acc.sub}</div>
      </div>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--fill-quaternary)", padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{showCat ? acc.catTitle : acc.type}</span>
      <div style={{ flex: 1, minWidth: 24, maxWidth: 90 }}>
        <div style={{ height: 5, borderRadius: 3, background: "var(--track)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: acc.pctWidth, background: acc.color, borderRadius: 3 }} />
        </div>
      </div>
      <div style={{ textAlign: "right", width: 92 }} title={`更新于 ${acc.updated}`}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: acc.stale ? "var(--orange)" : "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{acc.ago}</div>
        <div style={{ fontSize: 10.5, color: acc.stale ? "var(--orange)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{acc.updated}</div>
      </div>
      <div style={{ textAlign: "right", width: 118 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: acc.amountColor, fontVariantNumeric: "tabular-nums" }}>{acc.balance}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{acc.pct} · 占比</div>
      </div>
      <span style={{ flex: "none" }}><IconChevron size={16} /></span>
    </div>
  );
}

function seg(active: boolean): React.CSSProperties {
  return {
    border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 6, whiteSpace: "nowrap",
    background: active ? "var(--bg-card)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
  };
}
