import { useMemo, useState } from "react";
import { useVault } from "../lib/vault";
import type { ItemType, VaultItem } from "../types";
import { TYPE_LABEL } from "../types";
import ItemModal from "./ItemModal";
import { EmptyState } from "../ui";
import { IconKey, IconCard, IconNote, IconInfo, IconStar, IconSearch, IconPlus, IconLock } from "../icons";

const TYPE_ICON: Record<ItemType, (p: { size?: number; stroke?: string }) => React.ReactNode> = {
  login: IconKey, card: IconCard, note: IconNote, info: IconInfo,
};
const TYPES: ItemType[] = ["login", "card", "note", "info"];

function subtitle(it: VaultItem): string {
  if (it.type === "login") return it.username || it.url || "—";
  if (it.type === "card") return it.cardNumber ? "•••• " + it.cardNumber.replace(/\s/g, "").slice(-4) : (it.cardholder || "—");
  if (it.type === "note") return (it.notes || "").split("\n")[0] || "—";
  return it.fields?.[0] ? `${it.fields[0].label}：${it.fields[0].secret ? "••••" : it.fields[0].value}` : "—";
}

export default function VaultScreen() {
  const { items } = useVault();
  const [filter, setFilter] = useState<"all" | "fav" | ItemType>("all");
  const [q, setQ] = useState("");
  const [viewItem, setViewItem] = useState<VaultItem | null>(null);
  const [creating, setCreating] = useState<ItemType | null>(null);
  const [menu, setMenu] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, fav: items.filter((i) => i.favorite).length };
    for (const t of TYPES) c[t] = items.filter((i) => i.type === t).length;
    return c;
  }, [items]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((i) => (filter === "all" ? true : filter === "fav" ? i.favorite : i.type === filter))
      .filter((i) => !query || [i.title, i.username, i.url, i.notes, i.cardholder, ...(i.fields?.map((f) => f.label + f.value) ?? [])].some((s) => s?.toLowerCase().includes(query)))
      .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || b.updatedAt - a.updatedAt);
  }, [items, filter, q]);

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* 侧栏 */}
      <div style={{ width: 196, flex: "none", borderRight: "0.5px solid var(--separator)", padding: "16px 10px", overflow: "auto" }}>
        <SideItem label="全部" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} icon={<IconLock size={15} />} />
        <SideItem label="收藏" count={counts.fav} active={filter === "fav"} onClick={() => setFilter("fav")} icon={<IconStar size={15} />} />
        <div style={{ height: 10 }} />
        {TYPES.map((t) => {
          const Ic = TYPE_ICON[t];
          return <SideItem key={t} label={TYPE_LABEL[t]} count={counts[t]} active={filter === t} onClick={() => setFilter(t)} icon={<Ic size={15} />} />;
        })}
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><IconSearch /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题、账号、网址…" style={{ width: "100%", padding: "8px 12px 8px 30px", fontSize: 13.5, borderRadius: 9, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" }} />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenu((v) => !v)} onBlur={() => setTimeout(() => setMenu(false), 150)} className="fv-btn" style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, padding: "8px 14px", borderRadius: 9 }}>
              <IconPlus size={16} stroke="#fff" /> 新建
            </button>
            {menu && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "var(--bg-elevated)", border: "0.5px solid var(--separator)", borderRadius: 11, boxShadow: "var(--shadow)", padding: 6, zIndex: 20, width: 150 }}>
                {TYPES.map((t) => {
                  const Ic = TYPE_ICON[t];
                  return (
                    <button key={t} onMouseDown={() => { setCreating(t); setMenu(false); }} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13.5, padding: "8px 10px", borderRadius: 8 }}>
                      <Ic size={15} stroke="var(--text-secondary)" /> {TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "10px 14px 30px", animation: "fvFade .25s ease" }}>
          {list.length === 0 ? (
            <EmptyState icon={<IconLock size={26} stroke="var(--text-tertiary)" />} title={items.length === 0 ? "保险库是空的" : "没有匹配项"} text={items.length === 0 ? "点右上角「新建」添加第一条密码、银行卡或家庭信息。" : undefined} />
          ) : (
            list.map((it) => {
              const Ic = TYPE_ICON[it.type];
              return (
                <button key={it.id} onClick={() => setViewItem(it)} className="fv-row" style={rowStyle}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--fill-q)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic size={17} stroke="var(--accent)" /></span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title || "（无标题）"}</span>
                      {it.favorite && <IconStar size={13} stroke="var(--orange)" />}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle(it)}</span>
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", flex: "none" }}>{TYPE_LABEL[it.type]}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {viewItem && <ItemModal item={viewItem} onClose={() => setViewItem(null)} />}
      {creating && <ItemModal newType={creating} onClose={() => setCreating(null)} />}
    </div>
  );
}

function SideItem({ label, count, active, onClick, icon }: { label: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className={"fv-nav" + (active ? " active" : "")} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none", background: active ? "var(--fill)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontSize: 13.5, fontWeight: 500, padding: "8px 10px", borderRadius: 9, marginBottom: 2 }}>
      <span style={{ display: "flex", color: active ? "var(--accent)" : "var(--text-tertiary)" }}>{icon}</span>
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{count}</span>
    </button>
  );
}

const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", border: "none", background: "transparent", padding: "10px 12px", borderRadius: 11, marginBottom: 2 };
