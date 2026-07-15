import React, { useState } from "react";
import type { DevData } from "../../types";
import { card, Btn, inputStyle } from "../../ui";
import { IconPlus, IconTrash } from "../../icons";
import { uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

const todayStr = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const yuan = (n: number) => "¥" + (n || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
function ensureSpend(d: DevData) { if (!d.spend) d.spend = { items: [] }; if (!d.spend.items) d.spend.items = []; return d.spend; }

// 临时小记账：只记开销、不记收入——把赌球赢的钱花出去，记用了多少、买了啥。
export default function Spend({ data, mut }: { data: DevData; mut: Mut }) {
  const log = data.spend ?? { items: [] };
  const items = [...(log.items ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const spent = items.reduce((a, x) => a + (x.amount || 0), 0);
  const pot = log.pot;
  const left = pot != null ? pot - spent : undefined;

  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayStr());

  const add = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !label.trim()) return;
    mut((d) => { ensureSpend(d).items.unshift({ id: uid("sp"), amount: amt, label: label.trim(), date: date || todayStr(), createdAt: Date.now() }); });
    setAmount(""); setLabel(""); setDate(todayStr());
  };
  const del = (id: string) => mut((d) => { const s = ensureSpend(d); s.items = s.items.filter((x) => x.id !== id); });
  const clearAll = () => { if (confirm("清空这本小账的全部开销记录？彩金池会保留。")) mut((d) => { ensureSpend(d).items = []; }); };
  const setPot = (v: string) => mut((d) => { const s = ensureSpend(d); const n = parseFloat(v); s.pot = v.trim() === "" || isNaN(n) ? undefined : n; });
  const setTitle = (v: string) => mut((d) => { ensureSpend(d).title = v; });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input value={log.title ?? ""} onChange={(e) => setTitle(e.target.value)} placeholder="赌球花账" style={titleInput} />
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.6 }}>临时小账本，<strong>只记开销、不记收入</strong>——把赌球赢的钱花出去，记一下用了多少、买了啥。</div>
      </div>

      <div style={{ ...card, padding: "16px 18px", marginBottom: 14, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 3 }}>彩金池 · 赢的钱（可留空）</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ color: "var(--text-tertiary)", fontSize: 15 }}>¥</span>
            <input type="number" inputMode="decimal" defaultValue={pot ?? ""} onBlur={(e) => setPot(e.target.value)} placeholder="0" style={numInput} />
          </div>
        </div>
        <Stat label="已花" value={yuan(spent)} color="var(--orange)" />
        {left != null && <Stat label={left >= 0 ? "还剩" : "超支"} value={yuan(Math.abs(left))} color={left >= 0 ? "var(--green)" : "var(--red)"} big />}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{items.length} 笔</div>
      </div>

      <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="金额" style={{ ...inputStyle, width: 110 }} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="买了什么" style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        <Btn onClick={add} disabled={!amount || !label.trim()}><IconPlus size={14} stroke="currentColor" /> 加一笔</Btn>
      </div>

      <div style={{ ...card, padding: "6px 8px" }}>
        {!items.length && <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>还没有开销。上面加一笔，把钱花出去 🎉</div>}
        {items.map((it) => (
          <div key={it.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 9, borderTop: "0.5px solid var(--separator)" }}>
            <span style={{ width: 52, flex: "none", fontSize: 11.5, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{it.date?.slice(5)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
            <span style={{ flex: "none", fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{yuan(it.amount)}</span>
            <button onClick={() => del(it.id)} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", flex: "none", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div style={{ textAlign: "right", marginTop: 10 }}>
          <button onClick={clearAll} className="fv-tap" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer", padding: "4px 6px" }}>清空账本</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: big ? 23 : 18, fontWeight: 700, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

const titleInput: React.CSSProperties = { border: "none", background: "transparent", fontSize: 20, fontWeight: 700, color: "var(--text-primary)", outline: "none", padding: 0, width: "100%", maxWidth: 320 };
const numInput: React.CSSProperties = { border: "none", borderBottom: "1px solid var(--separator)", background: "transparent", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", outline: "none", padding: "1px 0", width: 110, fontVariantNumeric: "tabular-nums" };
