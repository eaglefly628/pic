import React, { useEffect, useMemo, useRef, useState } from "react";
import type { VaultData } from "../vault/types";
import { IconSearch, IconCard, IconWallet, IconChartUp, IconKey, IconUser } from "../icons";
import { useBreakpoint } from "../lib/breakpoint";
import { fmt } from "../lib/format";

/** 搜索命中后要跳去哪 */
export type SearchTarget =
  | { kind: "account"; id: string }
  | { kind: "income" }
  | { kind: "expense" }
  | { kind: "password" }
  | { kind: "info" };

interface Hit {
  key: string;
  group: "账户" | "收入" | "开销" | "密码" | "信息";
  icon: React.ReactNode;
  title: string;
  sub: string;
  target: SearchTarget;
  score: number;
}

/** 简单的包含匹配打分：标题命中比副字段命中分高，前缀命中再高一点。 */
function scoreOf(q: string, title: string, subs: (string | undefined)[]): number {
  const t = title.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  if (subs.some((s) => (s ?? "").toLowerCase().includes(q))) return 1;
  return 0;
}

function collect(data: VaultData, q: string): Hit[] {
  const out: Hit[] = [];
  const ds = data.dataset;
  const latest = (id: string) => {
    for (let i = ds.snapshots.length - 1; i >= 0; i--) { const v = ds.snapshots[i].balances[id]; if (v != null) return v; }
    return 0;
  };
  for (const a of ds.accounts) {
    const s = scoreOf(q, a.name, [a.institution, a.owner, a.type]);
    if (s) out.push({ key: "a:" + a.id, group: "账户", icon: <IconCard size={15} />, title: a.name, sub: `${a.type} · ${a.institution ?? "—"} · ${fmt(latest(a.id))}`, target: { kind: "account", id: a.id }, score: s });
  }
  for (const it of data.incomes ?? []) {
    const s = scoreOf(q, it.name, [it.category, it.note]);
    if (s) out.push({ key: "i:" + it.id, group: "收入", icon: <IconWallet size={15} />, title: it.name, sub: `${fmt(it.amount)} / ${it.period === "month" ? "月" : "年"}${it.category ? " · " + it.category : ""}`, target: { kind: "income" }, score: s });
  }
  for (const it of data.expenses ?? []) {
    const s = scoreOf(q, it.name, [it.category, it.note]);
    if (s) out.push({ key: "e:" + it.id, group: "开销", icon: <IconChartUp size={15} />, title: it.name, sub: `${fmt(it.amount)} / ${it.period === "month" ? "月" : it.period === "year" ? "年" : "一次"}${it.category ? " · " + it.category : ""}`, target: { kind: "expense" }, score: s });
  }
  // 密码：只搜标题 / 用户名 / 网址，绝不把密码本身放进搜索或显示
  for (const it of data.passwords) {
    const s = scoreOf(q, it.title, [it.username, it.url, it.category]);
    if (s) out.push({ key: "p:" + it.id, group: "密码", icon: <IconKey size={15} />, title: it.title, sub: [it.username, it.url].filter(Boolean).join(" · ") || "—", target: { kind: "password" }, score: s });
  }
  for (const it of data.infos) {
    const s = scoreOf(q, it.title, [it.type, it.owner]);
    if (s) out.push({ key: "n:" + it.id, group: "信息", icon: <IconUser size={15} />, title: it.title, sub: `${it.type}${it.owner ? " · " + it.owner : ""}`, target: { kind: "info" }, score: s });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 30);
}

export default function Search({ data, open, onClose, onGo }: {
  data: VaultData; open: boolean; onClose: () => void; onGo: (t: SearchTarget) => void;
}) {
  const phone = useBreakpoint() === "phone";
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setQ(""); setCur(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const query = q.trim().toLowerCase();
  const hits = useMemo(() => (query ? collect(data, query) : []), [data, query]);
  useEffect(() => { setCur(0); }, [query]);

  // 让当前项始终在可视区里
  useEffect(() => {
    const el = listRef.current?.children[cur] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  if (!open) return null;

  const go = (h: Hit) => { onGo(h.target); onClose(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setCur((c) => Math.min(hits.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter" && hits[cur]) { e.preventDefault(); go(hits[cur]); }
  };

  const groupColor: Record<Hit["group"], string> = { 账户: "var(--accent)", 收入: "var(--green)", 开销: "var(--red)", 密码: "var(--orange)", 信息: "var(--text-secondary)" };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "absolute", inset: 0, zIndex: 90, display: "flex", alignItems: phone ? "flex-end" : "flex-start", justifyContent: "center", paddingTop: phone ? 0 : 72, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(2px)", animation: "fvFade .15s ease" }}>
      <div style={{
        width: phone ? "100%" : 560, maxWidth: phone ? "100%" : "92%", maxHeight: phone ? "80%" : "70%",
        background: "var(--bg-card)", borderRadius: phone ? "18px 18px 0 0" : 14, boxShadow: "var(--win-shadow)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: phone ? "fvSheetUp .24s cubic-bezier(.2,.7,.3,1)" : "fvRise .18s ease",
        paddingBottom: phone ? "env(safe-area-inset-bottom, 0px)" : undefined,
      }}>
        {phone && <div aria-hidden style={{ width: 38, height: 4, borderRadius: 2, background: "var(--separator-strong)", margin: "8px auto 0" }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: phone ? "10px 16px 12px" : "14px 18px", borderBottom: "0.5px solid var(--separator)" }}>
          <IconSearch size={16} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="搜账户、收入、开销、密码、信息…"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: phone ? 16 : 14.5, color: "var(--text-primary)" }} />
          {!phone && <kbd style={{ fontSize: 11, color: "var(--text-tertiary)", border: "0.5px solid var(--separator-strong)", borderRadius: 4, padding: "1px 5px" }}>Esc</kbd>}
        </div>

        <div ref={listRef} className="fv-scroll" style={{ overflowY: "auto", padding: 6, minHeight: phone ? 160 : 120 }}>
          {!query && (
            <div style={{ padding: "28px 18px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, lineHeight: 1.7 }}>
              输入关键词，在账户、收入、开销、密码、个人信息里一起找。<br />
              <span style={{ fontSize: 11.5 }}>密码条目只按标题 / 用户名 / 网址匹配，不会搜到密码本身。</span>
            </div>
          )}
          {query && hits.length === 0 && (
            <div style={{ padding: "28px 18px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>没有匹配「{q.trim()}」的内容</div>
          )}
          {hits.map((h, i) => (
            <button key={h.key} onMouseEnter={() => setCur(i)} onClick={() => go(h)}
              style={{
                display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
                padding: phone ? "11px 12px" : "9px 12px", border: "none", cursor: "pointer", borderRadius: 9,
                background: i === cur ? "var(--accent-soft)" : "transparent", color: "var(--text-primary)",
              }}>
              <span style={{ display: "inline-flex", color: i === cur ? "var(--accent)" : "var(--text-tertiary)", flex: "none" }}>{h.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.title}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.sub}</span>
              </span>
              <span style={{ flex: "none", fontSize: 10.5, fontWeight: 600, color: groupColor[h.group], background: `color-mix(in srgb, ${groupColor[h.group]} 12%, transparent)`, padding: "2px 7px", borderRadius: 6 }}>{h.group}</span>
            </button>
          ))}
        </div>

        {!phone && (
          <div style={{ padding: "8px 18px", borderTop: "0.5px solid var(--separator)", fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 14 }}>
            <span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span>
          </div>
        )}
      </div>
    </div>
  );
}
