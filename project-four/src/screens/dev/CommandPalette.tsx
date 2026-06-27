import { useEffect, useMemo, useRef, useState } from "react";
import type { DevData } from "../../types";
import { card } from "../../ui";
import { IconSearch } from "../../icons";
import { INVOICE_EMOJI } from "../../lib/invoices";

interface Hit { icon: string; type: string; title: string; sub: string; view: string; url?: string; }

export default function CommandPalette({ data, onClose, onGo }: { data: DevData; onClose: () => void; onGo: (view: string) => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const hits = useMemo<Hit[]>(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return [];
    const has = (...xs: (string | undefined)[]) => xs.join(" ").toLowerCase().includes(ql);
    const out: Hit[] = [];
    const cap = (arr: Hit[], n = 5) => arr.slice(0, n);
    out.push(...cap(data.tasks.filter((t) => has(t.title, t.tags?.join(" "))).map((t) => ({ icon: "📋", type: "任务", title: t.title, sub: t.due ? "到期 " + t.due : "任务", view: "tasks" }))));
    out.push(...cap(data.notes.filter((n) => has(n.title, n.body, n.tags?.join(" "))).map((n) => ({ icon: "📝", type: "笔记", title: n.title || "未命名笔记", sub: (n.category || "笔记"), view: "notes" }))));
    out.push(...cap(data.snippets.filter((s) => has(s.title, s.code, s.lang, s.tags?.join(" "))).map((s) => ({ icon: "⟨⟩", type: "片段", title: s.title, sub: s.lang || "片段", view: "snippets" }))));
    out.push(...cap(data.links.filter((l) => has(l.title, l.url, l.category)).map((l) => ({ icon: "🔖", type: "书签", title: l.title, sub: l.url, view: "links", url: l.url }))));
    out.push(...cap(data.lifeItems.filter((it) => has(it.title, it.tags?.join(" "), ...Object.values(it.values).map((v) => Array.isArray(v) ? v.join(" ") : String(v ?? "")))).map((it) => { const c = data.collections.find((x) => x.id === it.collectionId); return { icon: c?.emoji || "📦", type: c?.name || "生活", title: it.title, sub: c?.name || "生活", view: "life" }; })));
    out.push(...cap(data.secrets.filter((s) => has(s.title, s.tags?.join(" "), s.entries.map((e) => e.label).join(" "))).map((s) => ({ icon: "🔑", type: "密钥", title: s.title, sub: "密钥库", view: "secrets" }))));
    out.push(...cap((data.accounts ?? []).filter((a) => has(a.name, a.category, a.login, a.note)).map((a) => ({ icon: a.domain === "work" ? "💳" : "🧾", type: a.domain === "work" ? "账户" : "储值卡", title: a.name, sub: (a.category || "") + (a.balance != null ? `　余额 ${a.currency}${a.balance}` : ""), view: "accounts" }))));
    out.push(...cap((data.invoices ?? []).filter((v) => has(v.category, v.note)).map((v) => ({ icon: INVOICE_EMOJI[v.category ?? ""] ?? "🧾", type: "发票", title: v.note || v.category || "发票", sub: `${v.date}　${v.category || "未归类"}`, view: "company" }))));
    return out.slice(0, 24);
  }, [q, data]);

  useEffect(() => { setActive(0); }, [q]);

  const choose = (h: Hit | undefined) => {
    if (!h) return;
    if (h.url) window.open(h.url, "_blank", "noreferrer");
    else onGo(h.view);
    onClose();
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", background: "rgba(0,0,0,0.34)", backdropFilter: "blur(2px)", animation: "fvFade .12s ease" }}>
      <div style={{ ...card, width: 600, maxWidth: "92%", overflow: "hidden", animation: "fvPop .16s ease" }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(hits[active]); }
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: hits.length ? "0.5px solid var(--separator)" : "none" }}>
          <IconSearch size={17} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索任务 / 笔记 / 片段 / 书签 / 生活 / 账户 / 发票 / 密钥…" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, color: "var(--text-primary)" }} />
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", border: "0.5px solid var(--separator)", borderRadius: 5, padding: "1px 5px" }}>Esc</span>
        </div>
        {hits.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
            {hits.map((h, i) => (
              <button key={i} onMouseEnter={() => setActive(i)} onClick={() => choose(h)}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: "none", cursor: "pointer", padding: "9px 12px", borderRadius: 9, background: i === active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent" }}>
                <span style={{ fontSize: 16, width: 22, textAlign: "center", flex: "none" }}>{h.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.sub}</div>
                </span>
                <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", background: "var(--fill-q)", border: "0.5px solid var(--separator)", padding: "1px 7px", borderRadius: 5, flex: "none" }}>{h.type}</span>
              </button>
            ))}
          </div>
        )}
        {q.trim() && hits.length === 0 && <div style={{ padding: "26px 18px", textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>没有匹配的结果</div>}
      </div>
    </div>
  );
}
