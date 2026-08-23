import { useMemo, useState } from "react";
import { useIsPhone } from "../lib/breakpoint";
import { useVault } from "../lib/vault";
import type { ItemType, VaultItem } from "../types";
import { TYPE_LABEL } from "../types";
import ItemModal from "./ItemModal";
import { EmptyState } from "../ui";
import { IconKey, IconCard, IconNote, IconInfo, IconStar, IconSearch, IconPlus, IconLock } from "../icons";

const FILTER_LABEL: Record<string, string> = { all: "全部", fav: "收藏" };

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
  const phone = useIsPhone();
  // 手机上分类栏默认收成图标条；点箭头拉出来，选完一个分类自动收回去
  const [railOpen, setRailOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, fav: items.filter((i) => i.favorite).length };
    for (const t of TYPES) c[t] = items.filter((i) => i.type === t).length;
    return c;
  }, [items]);

  // 选一个分类：手机上顺手把拉出来的分类栏收回去
  const pick = (f: "all" | "fav" | ItemType) => { setFilter(f); if (phone) setRailOpen(false); };

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((i) => (filter === "all" ? true : filter === "fav" ? i.favorite : i.type === filter))
      .filter((i) => !query || [i.title, i.username, i.url, i.notes, i.cardholder, ...(i.fields?.map((f) => f.label + f.value) ?? [])].some((s) => s?.toLowerCase().includes(query)))
      .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || b.updatedAt - a.updatedAt);
  }, [items, filter, q]);

  return (
    <div style={{ display: "flex", height: "100%", position: "relative", overflow: "hidden" }}>
      {/* 侧栏：桌面常驻 196px；手机收成 46px 图标条，展开时浮在列表上方（不挤压列表） */}
      {phone && railOpen && (
        <div onClick={() => setRailOpen(false)}
          style={{ position: "absolute", inset: 0, zIndex: 18, background: "rgba(0,0,0,0.28)" }} />
      )}
      <div style={{
        width: phone ? (railOpen ? 150 : 38) : 196,
        flex: "none", borderRight: "0.5px solid var(--separator)",
        padding: phone ? (railOpen ? "8px 8px" : "6px 3px") : "16px 10px",
        overflow: "auto", background: "var(--bg-content)",
        position: phone && railOpen ? "absolute" : "relative",
        insetBlock: phone && railOpen ? 0 : undefined,
        left: phone && railOpen ? 0 : undefined,
        zIndex: phone && railOpen ? 19 : undefined,
        boxShadow: phone && railOpen ? "var(--shadow)" : undefined,
        transition: "width .22s cubic-bezier(.2,.7,.3,1)",
      }}>
        {phone && (
          <button onClick={() => setRailOpen((v) => !v)} className="fv-nav fv-tap"
            title={railOpen ? "收起分类" : "展开分类"} aria-label={railOpen ? "收起分类" : "展开分类"}
            style={{
              display: "flex", alignItems: "center", justifyContent: railOpen ? "flex-end" : "center",
              width: "100%", minHeight: 30, marginBottom: 2, border: "none", borderRadius: 7,
              background: "transparent", color: "var(--text-tertiary)", cursor: "pointer",
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: railOpen ? "rotate(180deg)" : "none", transition: "transform .22s" }}>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        )}
        <SideItem label="全部" count={counts.all} active={filter === "all"} onClick={() => pick("all")} icon={<IconLock size={15} />} compact={phone} iconOnly={phone && !railOpen} />
        <SideItem label="收藏" count={counts.fav} active={filter === "fav"} onClick={() => pick("fav")} icon={<IconStar size={15} />} compact={phone} iconOnly={phone && !railOpen} />
        <div style={{ height: phone ? 6 : 10 }} />
        {TYPES.map((t) => {
          const Ic = TYPE_ICON[t];
          return <SideItem key={t} label={TYPE_LABEL[t]} count={counts[t]} active={filter === t} onClick={() => pick(t)} icon={<Ic size={15} />} compact={phone} iconOnly={phone && !railOpen} />;
        })}
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: phone ? 7 : 10, padding: phone ? "10px 12px" : "14px 20px", borderBottom: "0.5px solid var(--separator)" }}>
          {phone && (
            <span style={{ flex: "none", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {FILTER_LABEL[filter] ?? TYPE_LABEL[filter as ItemType]}
              <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}> {counts[filter]}</span>
            </span>
          )}
          <div style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: phone ? undefined : 360 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><IconSearch /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题、账号、网址…" style={{ width: "100%", padding: "8px 12px 8px 30px", fontSize: 13.5, borderRadius: 9, border: "0.5px solid var(--separator)", background: "var(--fill-q)", color: "var(--text-primary)" }} />
          </div>
          {!phone && <div style={{ flex: 1 }} />}
          <div style={{ position: "relative", flex: "none" }}>
            <button onClick={() => setMenu((v) => !v)} onBlur={() => setTimeout(() => setMenu(false), 150)} className="fv-btn" style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, padding: phone ? "8px 10px" : "8px 14px", borderRadius: 9 }}>
              <IconPlus size={16} stroke="#fff" />{phone ? "" : " 新建"}
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

        <div style={{ flex: 1, overflow: "auto", padding: phone ? "8px 10px 24px" : "10px 14px 30px", animation: "fvFade .25s ease" }}>
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

function SideItem({ label, count, active, onClick, icon, compact, iconOnly }: {
  label: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode;
  compact?: boolean; iconOnly?: boolean;
}) {
  return (
    <button onClick={onClick} className={"fv-nav" + (active ? " active" : "")}
      title={iconOnly ? `${label} · ${count}` : undefined}
      style={{
        display: "flex", alignItems: "center", gap: iconOnly ? 0 : 8,
        justifyContent: iconOnly ? "center" : "flex-start",
        width: "100%", border: "none", background: active ? "var(--fill)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontSize: compact ? 12.5 : 13.5, fontWeight: 500,
        padding: iconOnly ? "11px 0" : compact ? "7px 8px" : "8px 10px",
        borderRadius: 9, marginBottom: 2, position: "relative",
      }}>
      <span style={{ display: "flex", flex: "none", color: active ? "var(--accent)" : "var(--text-tertiary)" }}>{icon}</span>
      {/* 标签不再 flex:1 撑开——原来「标签靠左、数字靠右」中间留一大段空当，
          没有信息量。现在紧挨着排，条数用一个小圆圈贴在右下角表示。 */}
      {!iconOnly && <span style={{ textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{label}</span>}
      {count > 0 && (
        <span style={{
          position: iconOnly ? "absolute" : "static",
          bottom: iconOnly ? 2 : undefined,
          right: iconOnly ? 0 : undefined,
          marginLeft: iconOnly ? 0 : 5,
          flex: "none",
          // content-box + padding + border 会让实际尺寸涨到 26px 把图标盖住，必须 border-box
          boxSizing: "border-box",
          minWidth: iconOnly ? 14 : 16, height: iconOnly ? 14 : 16,
          padding: iconOnly ? "0 2px" : "0 4px", borderRadius: 8,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: iconOnly ? 9 : 10, fontWeight: 600, lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          background: active ? "var(--accent)" : "var(--fill)",
          color: active ? "#fff" : "var(--text-tertiary)",
          border: iconOnly ? "1.5px solid var(--bg-content)" : "none",
        }}>{count > 99 ? "99+" : count}</span>
      )}
    </button>
  );
}

const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", border: "none", background: "transparent", padding: "10px 12px", borderRadius: 11, marginBottom: 2 };
