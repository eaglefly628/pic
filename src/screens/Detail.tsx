import React from "react";
import type { View } from "../lib/compute";
import { card } from "../ui";
import { IconPlus, IconEdit, IconTrash } from "../icons";

export default function Detail({ view, onAddSnapshot, onEditAccount, onDeleteAccount }: {
  view: View; onAddSnapshot: () => void; onEditAccount: () => void; onDeleteAccount: () => void;
}) {
  const d = view.detail;
  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22 }}>
        <span style={{ width: 54, height: 54, borderRadius: 13, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${d.color} 15%, transparent)`, color: d.color }}>
          <span style={{ fontSize: 19, fontWeight: 700 }}>{d.initial}</span>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h1 style={{ fontSize: 21, fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</h1>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--fill-quaternary)", padding: "3px 9px", borderRadius: 6 }}>{d.type}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4 }}>{d.sub}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onEditAccount} title="编辑账户" style={iconBtn}><IconEdit size={15} stroke="var(--text-secondary)" /></button>
          <button onClick={onDeleteAccount} title="删除账户" style={iconBtn}><IconTrash size={15} stroke="var(--red)" /></button>
          <div style={{ textAlign: "right", marginLeft: 8 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>当前余额</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", marginTop: 2 }}>{d.balance}</div>
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: "20px 24px 14px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>余额历史</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: "var(--text-tertiary)" }}>近 6 次快照</span>
            <span style={{ fontWeight: 600, color: d.trendColor, fontVariantNumeric: "tabular-nums" }}>{d.trendLabel}</span>
          </div>
        </div>
        <svg viewBox="0 0 600 200" style={{ width: "100%", height: 194, display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="fvArea2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {d.grid.map((g, i) => (
            <g key={i}>
              <line x1="52" x2="600" y1={g.y} y2={g.y} stroke="var(--separator)" strokeWidth="1" />
              <text x="46" y={g.ty} textAnchor="end" fontSize="10.5" fill="var(--text-tertiary)">{g.label}</text>
            </g>
          ))}
          <path d={d.area} fill="url(#fvArea2)" />
          <path d={d.line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {d.dots.map((dot, i) => (
            <g key={i}>
              <circle cx={dot.x} cy={dot.y} r="3.2" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="2" />
              <text x={dot.x} y="194" textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{dot.label}</text>
            </g>
          ))}
        </svg>
      </div>

      {d.changes.length > 0 && (
        <div style={{ ...card, padding: "18px 22px", marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>每月变化量</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 96 }}>
            {d.changes.map((c, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.up ? "var(--green)" : "var(--red)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{c.text}</div>
                <div style={{ width: "60%", maxWidth: 38, height: Math.max(4, c.ratio * 56), borderRadius: 5, background: c.up ? "var(--green)" : "var(--red)" }} />
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 22px 13px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>余额快照</div>
          <button onClick={onAddSnapshot} style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", borderRadius: 8, background: "var(--accent-soft)", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12.5, fontWeight: 600 }}>
            <IconPlus size={15} stroke="currentColor" width={2.3} />新增快照
          </button>
        </div>
        <div style={{ display: "flex", padding: "7px 22px", fontSize: 11, color: "var(--text-tertiary)", borderTop: "0.5px solid var(--separator)", background: "var(--bg-card-2)" }}>
          <span style={{ width: 120 }}>日期</span>
          <span style={{ flex: 1, textAlign: "right" }}>余额</span>
          <span style={{ width: 130, textAlign: "right" }}>较上次</span>
          <span style={{ width: 80, textAlign: "right" }}>来源</span>
        </div>
        {d.snapshots.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 22px", borderTop: "0.5px solid var(--separator)", fontSize: 13 }}>
            <span style={{ width: 120, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{s.date}</span>
            <span style={{ flex: 1, textAlign: "right", fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{s.amount}</span>
            <span style={{ width: 130, textAlign: "right", fontWeight: 600, color: s.changeColor, fontVariantNumeric: "tabular-nums" }}>{s.change}</span>
            <span style={{ width: 80, textAlign: "right" }}>
              <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", border: "0.5px solid var(--separator-strong)", borderRadius: 5, padding: "1px 6px" }}>{s.source}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)", cursor: "pointer",
};
