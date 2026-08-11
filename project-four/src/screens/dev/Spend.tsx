import { useEffect, useState } from "react";
import type { DevData, SpendLog } from "../../types";
import { card, Btn, inputStyle } from "../../ui";
import { IconPlus, IconTrash } from "../../icons";
import { uid } from "./shared";

type Mut = (fn: (d: DevData) => void) => void;

const todayStr = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const yuan = (n: number) => "¥" + (Math.round((n || 0) * 100) / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const daysUntil = (dateStr?: string) => { if (!dateStr) return null; const t = new Date(dateStr + "T00:00:00"); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.ceil((t.getTime() - now.getTime()) / 86400000); };

// 迁移旧单池格式（title/pot）→ 多资金池，并给无归属的开销补 poolId。
function ensureSpend(d: DevData): SpendLog {
  if (!d.spend) d.spend = { pools: [], items: [] };
  const s = d.spend as SpendLog & { pot?: number; title?: string };
  if (!Array.isArray(s.items)) s.items = [];
  if (!Array.isArray(s.pools)) s.pools = [];
  if (s.pot != null || s.title != null || s.items.some((it) => !it.poolId)) {
    let pid = s.pools[0]?.id;
    if (!pid) { pid = uid("pool"); s.pools.push({ id: pid, name: s.title || "赌球赢的钱", amount: s.pot ?? 0, createdAt: Date.now() }); }
    s.items.forEach((it) => { if (!it.poolId) it.poolId = pid!; });
    delete s.pot; delete s.title;
  }
  return d.spend;
}

export default function Spend({ data, mut }: { data: DevData; mut: Mut }) {
  const raw = data.spend ?? { pools: [], items: [] };
  const pools = raw.pools ?? [];
  const items = raw.items ?? [];

  // 首次进入时迁移旧格式
  useEffect(() => {
    const s = data.spend as (SpendLog & { pot?: number; title?: string }) | undefined;
    if (s && (s.pot != null || s.title != null || (s.items || []).some((it) => !it.poolId))) mut((d) => { ensureSpend(d); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const spentOf = (pid: string) => items.filter((x) => x.poolId === pid).reduce((a, x) => a + (x.amount || 0), 0);
  const totalPot = pools.reduce((a, p) => a + (p.amount || 0), 0);
  const totalSpent = items.reduce((a, x) => a + (x.amount || 0), 0);
  const totalLeft = totalPot - totalSpent;

  const addPool = (name: string, amount: number, targetDate: string) => mut((d) => { ensureSpend(d).pools.push({ id: uid("pool"), name: name.trim() || "意外之财", amount: amount || 0, targetDate: targetDate || undefined, createdAt: Date.now() }); });
  const patchPool = (id: string, patch: Partial<{ name: string; amount: number; targetDate?: string }>) => mut((d) => { const p = ensureSpend(d).pools.find((x) => x.id === id); if (p) Object.assign(p, patch); });
  const delPool = (id: string, name: string) => { if (confirm(`删除资金池「${name}」及它下面的所有开销记录？`)) mut((d) => { const s = ensureSpend(d); s.pools = s.pools.filter((x) => x.id !== id); s.items = s.items.filter((x) => x.poolId !== id); }); };
  const addItem = (poolId: string, amount: number, label: string, date: string) => mut((d) => { ensureSpend(d).items.unshift({ id: uid("sp"), poolId, amount, label: label.trim(), date: date || todayStr(), createdAt: Date.now() }); });
  const delItem = (id: string) => mut((d) => { const s = ensureSpend(d); s.items = s.items.filter((x) => x.id !== id); });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>意外资金池 · 花光计划</div>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4, lineHeight: 1.6 }}>把意外之财（赌球赢的、奖金、回款…）<strong>一池一池花掉</strong>。只记开销、不记收入；给每池定个花完日期，它帮你算该花多快。</div>
      </div>

      {/* 总览 */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 16, display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center" }}>
        <Stat label="全部池子" value={yuan(totalPot)} />
        <Stat label="已花" value={yuan(totalSpent)} color="var(--orange)" />
        <Stat label={totalLeft >= 0 ? "还剩" : "超支"} value={yuan(Math.abs(totalLeft))} color={totalLeft >= 0 ? "var(--green)" : "var(--red)"} big />
        <div style={{ flex: 1 }} />
        <Btn onClick={() => setAdding((v) => !v)} variant={adding ? "ghost" : "primary"}><IconPlus size={14} stroke="currentColor" /> 新资金池</Btn>
      </div>

      {adding && <AddPool onAdd={(n, a, t) => { addPool(n, a, t); setAdding(false); }} onCancel={() => setAdding(false)} />}

      {!pools.length && !adding && (
        <div style={{ ...card, padding: "30px 18px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5 }}>还没有资金池。点右上「新资金池」，把一笔意外之财放进来，定个花完日期 💸</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pools.map((p) => {
          const spent = spentOf(p.id);
          const left = (p.amount || 0) - spent;
          const prog = p.amount > 0 ? Math.min(1, spent / p.amount) : 0;
          const dLeft = daysUntil(p.targetDate);
          const poolItems = items.filter((x) => x.poolId === p.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
          const done = left <= 0;
          const perDay = dLeft != null && dLeft > 0 && left > 0 ? left / dLeft : null;
          return (
            <div key={p.id} style={{ ...card, padding: "14px 16px" }}>
              {/* 头部：名字 + 金额 + 目标日期 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <input defaultValue={p.name} onBlur={(e) => { if (e.target.value.trim() !== p.name) patchPool(p.id, { name: e.target.value.trim() || "意外之财" }); }} style={{ border: "none", background: "transparent", fontSize: 15.5, fontWeight: 700, color: "var(--text-primary)", outline: "none", padding: 0, minWidth: 90, flex: "0 1 auto" }} />
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>池子</span>
                <span style={{ color: "var(--text-tertiary)" }}>¥</span>
                <input type="number" inputMode="decimal" defaultValue={p.amount || ""} onBlur={(e) => { const n = parseFloat(e.target.value) || 0; if (n !== p.amount) patchPool(p.id, { amount: n }); }} style={{ ...inputStyle, width: 96, padding: "4px 8px", fontWeight: 700 }} />
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 6 }}>花完日期</span>
                <input type="date" defaultValue={p.targetDate || ""} onChange={(e) => patchPool(p.id, { targetDate: e.target.value || undefined })} style={{ ...inputStyle, width: 148, padding: "4px 8px" }} />
                <div style={{ flex: 1 }} />
                <button onClick={() => delPool(p.id, p.name)} className="fv-tap" title="删除资金池" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, cursor: "pointer", display: "flex" }}><IconTrash size={15} stroke="currentColor" /></button>
              </div>

              {/* 进度条 */}
              <div style={{ height: 8, borderRadius: 5, background: "var(--fill-q)", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${prog * 100}%`, height: "100%", background: done ? "var(--green)" : left < 0 ? "var(--red)" : "var(--accent)", transition: "width .3s" }} />
              </div>

              {/* 数字 + 规划 */}
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline", fontSize: 12.5 }}>
                <span style={{ color: "var(--text-secondary)" }}>已花 <strong style={{ color: "var(--orange)" }}>{yuan(spent)}</strong></span>
                <span style={{ color: "var(--text-secondary)" }}>{done ? "已花完" : "还剩"} <strong style={{ color: done ? "var(--green)" : left < 0 ? "var(--red)" : "var(--text-primary)" }}>{yuan(Math.abs(left))}</strong></span>
                {/* 花完计划 */}
                {done ? (
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ 这池花光了</span>
                ) : dLeft == null ? (
                  <span style={{ color: "var(--text-tertiary)" }}>没定花完日期</span>
                ) : dLeft < 0 ? (
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>已过期 {-dLeft} 天，还剩 {yuan(left)} 没花完</span>
                ) : dLeft === 0 ? (
                  <span style={{ color: "var(--orange)", fontWeight: 600 }}>今天到期 · 建议今天花完剩余 {yuan(left)}</span>
                ) : (
                  <span style={{ color: "var(--text-secondary)" }}>距目标 <strong>{dLeft}</strong> 天 · 建议日均 <strong style={{ color: "var(--accent)" }}>{yuan(perDay || 0)}</strong>{dLeft >= 7 ? ` · 周均 ${yuan((perDay || 0) * 7)}` : ""}</span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => setOpen(open === p.id ? null : p.id)} className="fv-tap" style={{ border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "2px 4px" }}>{open === p.id ? "收起" : `记一笔 · ${poolItems.length} 笔 ▾`}</button>
              </div>

              {/* 展开：加开销 + 明细 */}
              {open === p.id && <PoolDetail items={poolItems} onAdd={(a, l, dt) => addItem(p.id, a, l, dt)} onDel={delItem} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddPool({ onAdd, onCancel }: { onAdd: (name: string, amount: number, targetDate: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const ok = name.trim() && parseFloat(amount) > 0;
  return (
    <div style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="池子名（如 赌球赢的钱 / 年终奖）" style={{ ...inputStyle, flex: 1, minWidth: 180 }} autoFocus />
      <span style={{ color: "var(--text-tertiary)" }}>¥</span>
      <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="有多少" style={{ ...inputStyle, width: 110 }} />
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>花完日期</span>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
      <Btn onClick={() => ok && onAdd(name, parseFloat(amount), date)} disabled={!ok}>建池</Btn>
      <Btn onClick={onCancel} variant="ghost">取消</Btn>
    </div>
  );
}

function PoolDetail({ items, onAdd, onDel }: { items: { id: string; amount: number; label: string; date: string }[]; onAdd: (amount: number, label: string, date: string) => void; onDel: (id: string) => void }) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayStr());
  const add = () => { const a = parseFloat(amount); if (!a || a <= 0 || !label.trim()) return; onAdd(a, label, date); setAmount(""); setLabel(""); setDate(todayStr()); };
  return (
    <div style={{ marginTop: 12, borderTop: "0.5px solid var(--separator)", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="金额" style={{ ...inputStyle, width: 100 }} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="买了什么" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 148 }} />
        <Btn onClick={add} disabled={!amount || !label.trim()}><IconPlus size={13} stroke="currentColor" /> 加</Btn>
      </div>
      {!items.length ? (
        <div style={{ padding: "10px 4px", color: "var(--text-tertiary)", fontSize: 12.5 }}>这池还没花过。</div>
      ) : items.map((it) => (
        <div key={it.id} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 6px", borderRadius: 8, fontSize: 13 }}>
          <span style={{ width: 48, flex: "none", fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{it.date?.slice(5)}</span>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
          <span style={{ flex: "none", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{yuan(it.amount)}</span>
          <button onClick={() => onDel(it.id)} className="fv-tap" title="删除" style={{ border: "none", background: "transparent", color: "var(--text-tertiary)", padding: 3, borderRadius: 6, cursor: "pointer", display: "flex", flex: "none" }}><IconTrash size={14} stroke="currentColor" /></button>
        </div>
      ))}
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
