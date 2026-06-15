import React, { useMemo, useState } from "react";
import type { Dataset } from "./data/types";
import { buildView, type RangeKey } from "./lib/compute";
import {
  IconDashboard, IconCard, IconLock, IconUser, IconImport, IconGear,
  IconChevron, IconSearch, IconPlus, IconBack, IconClock, IconEdit,
  IconArrowRight, IconShield,
} from "./icons";

type Screen = "dashboard" | "accounts" | "detail" | "profile";

const card: React.CSSProperties = {
  background: "var(--bg-card)", borderRadius: 14, boxShadow: "var(--card-shadow)",
};
const glass: React.CSSProperties = {
  backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
};

function navStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
    border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 500, padding: "7px 10px",
    borderRadius: 8, marginBottom: 1,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)",
  };
}
function segStyle(active: boolean): React.CSSProperties {
  return {
    border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "4px 11px",
    borderRadius: 6, whiteSpace: "nowrap", transition: "all .15s",
    background: active ? "var(--bg-card)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
  };
}
const groupLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", padding: "14px 10px 4px", letterSpacing: "0.02em",
};

function greetingWord() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const MEMBER_COLORS = ["#0A84FF", "#FF2D55", "#FF9500", "#30D158", "#BF5AF2", "#64D2FF"];

export default function App({ dataset }: { dataset: Dataset }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedId, setSelectedId] = useState<string>(dataset.accounts[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("1y");
  const [locked, setLocked] = useState(false);

  const view = useMemo(() => buildView(dataset, { range, selectedId }), [dataset, range, selectedId]);
  const userInitial = (view.meta.userName.slice(0, 1) || "U").toUpperCase();

  const members = useMemo(() => {
    const owners = Array.from(new Set(dataset.accounts.map((a) => a.owner).filter((o): o is string => !!o && o !== "—")));
    const list = owners.map((o, i) => ({
      name: o === "本人" ? `${view.meta.userName}（本人）` : o,
      role: o === "本人" ? "户主 · 管理员" : o === "配偶" ? "配偶" : o === "全家" ? "共有" : "成员",
      initial: o.slice(0, 1),
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
      access: o === "本人" ? "完全控制" : o === "全家" ? "共有" : "可编辑",
    }));
    return list.length ? list : [{ name: view.meta.userName, role: "户主 · 管理员", initial: userInitial, color: "#0A84FF", access: "完全控制" }];
  }, [dataset.accounts, view.meta.userName, userInitial]);

  const pageTitle =
    screen === "dashboard" ? "仪表盘" : screen === "accounts" ? "资金账户" : screen === "profile" ? "个人信息" : view.detail.name;

  const open = (id: string) => { setSelectedId(id); setScreen("detail"); };

  return (
    <div
      className="fv-root"
      data-theme={theme}
      style={{
        minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--wallpaper)", padding: 32,
      }}
    >
      <div
        style={{
          position: "relative", width: 1200, height: 780, maxWidth: "100%", borderRadius: 13,
          overflow: "hidden", boxShadow: "var(--win-shadow)", display: "flex",
          background: "var(--bg-content)", border: "0.5px solid var(--separator-strong)",
        }}
      >
        {/* ============ SIDEBAR ============ */}
        <aside style={{ width: 236, flex: "none", background: "var(--bg-sidebar)", ...glass, borderRight: "0.5px solid var(--separator)", display: "flex", flexDirection: "column" }}>
          <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 20px" }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.12)" }} />
            ))}
          </div>

          <div style={{ padding: "4px 16px 16px", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(160deg,var(--accent),#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px var(--accent-soft)" }}>
              <IconShield size={18} />
            </div>
            <div style={{ lineHeight: 1.2, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{view.meta.vaultName}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>本地加密 · 已解锁</div>
            </div>
          </div>

          <nav className="fv-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
            <div style={{ ...groupLabel, padding: "8px 10px 4px" }}>概览</div>
            <button onClick={() => setScreen("dashboard")} style={navStyle(screen === "dashboard")}>
              <IconDashboard /><span>仪表盘</span>
            </button>

            <div style={groupLabel}>资金</div>
            <button onClick={() => setScreen("accounts")} style={navStyle(screen === "accounts" || screen === "detail")}>
              <IconCard /><span>资金账户</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: screen === "accounts" || screen === "detail" ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{view.meta.accountCount}</span>
            </button>

            <div style={groupLabel}>安全</div>
            <button onClick={() => {}} style={{ ...navStyle(false), cursor: "default", opacity: 0.55 }}>
              <IconLock /><span>密码保险箱</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-tertiary)" }}>即将上线</span>
            </button>
            <button onClick={() => setScreen("profile")} style={navStyle(screen === "profile")}>
              <IconUser /><span>个人信息</span>
            </button>

            <div style={groupLabel}>其他</div>
            <button onClick={() => {}} style={{ ...navStyle(false), cursor: "default", opacity: 0.55 }}>
              <IconImport /><span>导入数据</span>
            </button>
            <button onClick={() => {}} style={{ ...navStyle(false), cursor: "default", opacity: 0.55 }}>
              <IconGear /><span>设置</span>
            </button>
          </nav>

          <div style={{ padding: "10px 12px 12px", borderTop: "0.5px solid var(--separator)", display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 9, background: "var(--fill-quaternary)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", flex: "none", boxShadow: "0 0 0 3px color-mix(in srgb, var(--green) 22%, transparent)" }} />
              <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary)" }}>已备份</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>3 天前 · 移动硬盘</div>
              </div>
            </div>
            <button onClick={() => setScreen("profile")} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none", cursor: "pointer", padding: "6px 9px", borderRadius: 9, background: screen === "profile" ? "var(--accent-soft)" : "transparent" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#0A84FF,#5E5CE6)", color: "#fff", fontSize: 12, fontWeight: 700 }}>{userInitial}</span>
              <div style={{ lineHeight: 1.25, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{view.meta.userName}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>户主 · 管理员</div>
              </div>
              <span style={{ marginLeft: "auto", flex: "none" }}><IconChevron /></span>
            </button>
          </div>
        </aside>

        {/* ============ MAIN ============ */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg-content)" }}>
          <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: "var(--bg-toolbar)", ...glass, borderBottom: "0.5px solid var(--separator)", zIndex: 5 }}>
            {screen === "detail" && (
              <button onClick={() => setScreen("accounts")} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13.5, fontWeight: 500, padding: "5px 7px", marginLeft: -7, borderRadius: 7 }}>
                <IconBack />账户
              </button>
            )}
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{pageTitle}</div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: 188, height: 30, padding: "0 10px", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)" }}>
              <IconSearch />
              <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>搜索全部</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)", border: "0.5px solid var(--separator-strong)", borderRadius: 4, padding: "1px 4px" }}>⌘K</span>
            </div>
            <button onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))} title="切换外观" style={{ width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--text-secondary)" }}>
              <span>{theme === "light" ? "🌙" : "☀️"}</span>
            </button>
            <button onClick={() => setLocked(true)} style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 8, background: "var(--accent)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12.5, fontWeight: 500 }}>
              <IconLock size={14} stroke="currentColor" />锁定
            </button>
          </div>

          <div className="fv-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {screen === "dashboard" && <Dashboard view={view} onOpen={open} range={range} setRange={setRange} />}
            {screen === "accounts" && <Accounts view={view} onOpen={open} />}
            {screen === "detail" && <Detail view={view} />}
            {screen === "profile" && <Profile view={view} members={members} userInitial={userInitial} />}
          </div>
        </main>

        {/* ============ LOCK OVERLAY ============ */}
        {locked && (
          <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--wallpaper)", animation: "fvRise 0.3s ease" }}>
            <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", background: "color-mix(in srgb, var(--bg-content) 55%, transparent)" }} />
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: 17, background: "linear-gradient(160deg,var(--accent),#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px var(--accent-soft)" }}>
                <IconLock size={30} stroke="#fff" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{view.meta.vaultName}已锁定</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>输入主密码以解锁全部内容</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 11, background: "var(--bg-card)", boxShadow: "var(--card-shadow)", width: 260 }}>
                <IconLock size={16} />
                <div style={{ display: "flex", gap: 7 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-secondary)" }} />
                  ))}
                </div>
                <button onClick={() => setLocked(false)} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 7, background: "var(--accent)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconArrowRight />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-tertiary)" }}>
                <IconClock />闲置 5 分钟后自动锁定 · 数据已从内存清除
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type View = ReturnType<typeof buildView>;

function Dashboard({ view, onOpen, range, setRange }: { view: View; onOpen: (id: string) => void; range: RangeKey; setRange: (r: RangeKey) => void }) {
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  const t = view.totals;
  return (
    <div style={{ padding: "28px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{greetingWord()}，{view.meta.userName}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 3 }}>{today} · {view.meta.vaultName}{view.meta.real ? "" : " · 示例数据"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 18 }}>
        <MetricCard label="总资产" value={t.totalAssets} chip="↑ 2.1%" chipNote="较上月" chipColor="var(--green)" />
        <MetricCard label="总负债" value={t.totalLiabilities} chip="↓ 0.8%" chipNote="还款中" chipColor="var(--green)" />
        <div style={{ background: "linear-gradient(155deg, var(--accent), #5E5CE6)", borderRadius: 14, padding: "20px 22px", boxShadow: "0 6px 18px var(--accent-soft)", color: "#fff" }}>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", fontWeight: 500 }}>净资产</div>
          <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 9, fontVariantNumeric: "tabular-nums" }}>{t.netWorth}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.22)", padding: "2px 7px", borderRadius: 6 }}>{t.netDelta}</span>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)" }}>较上期</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 18 }}>
        <div style={{ ...card, padding: "20px 22px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>净资产趋势</div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{view.trend.caption}</div>
            </div>
            <div style={{ display: "flex", gap: 2, background: "var(--fill-quaternary)", borderRadius: 8, padding: 2 }}>
              <button onClick={() => setRange("3m")} style={segStyle(range === "3m")}>近3月</button>
              <button onClick={() => setRange("1y")} style={segStyle(range === "1y")}>近1年</button>
              <button onClick={() => setRange("all")} style={segStyle(range === "all")}>全部</button>
            </div>
          </div>
          <svg viewBox="0 0 600 220" style={{ width: "100%", height: 208, display: "block", overflow: "visible" }}>
            <defs>
              <linearGradient id="fvArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {view.trend.grid.map((g, i) => (
              <g key={i}>
                <line x1="44" x2="600" y1={g.y} y2={g.y} stroke="var(--separator)" strokeWidth="1" />
                <text x="38" y={g.ty} textAnchor="end" fontSize="10.5" fill="var(--text-tertiary)">{g.label}</text>
              </g>
            ))}
            <path d={view.trend.area} fill="url(#fvArea)" />
            <path d={view.trend.line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={view.trend.lastX} cy={view.trend.lastY} r="4.5" fill="var(--accent)" stroke="var(--bg-card)" strokeWidth="2.5" />
            {view.trend.xLabels.map((x, i) => (
              <text key={i} x={x.x} y="216" textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{x.label}</text>
            ))}
          </svg>
        </div>

        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>资产构成</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg viewBox="0 0 120 120" style={{ width: 118, height: 118, flex: "none", transform: "rotate(-90deg)" }}>
              <circle cx="60" cy="60" r="46" fill="none" stroke="var(--track)" strokeWidth="15" />
              {view.donut.map((seg, i) => (
                <circle key={i} cx="60" cy="60" r="46" fill="none" stroke={seg.color} strokeWidth="15" strokeDasharray={seg.dash} strokeDashoffset={seg.offset} strokeLinecap="butt" />
              ))}
            </svg>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {view.donut.map((seg, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flex: "none" }} />
                  <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seg.name}</span>
                  <span style={{ marginLeft: "auto", color: "var(--text-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{seg.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>最近更新</div>
        {view.recent.map((r) => (
          <div key={r.id} onClick={() => onOpen(r.id)} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 22px", borderTop: "0.5px solid var(--separator)", cursor: "pointer" }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${r.color} 16%, transparent)` }}>
              <span style={{ width: 12, height: 12, borderRadius: 4, background: r.color }} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{r.detail}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{r.amount}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: r.changeColor, fontVariantNumeric: "tabular-nums" }}>{r.change}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, chip, chipNote, chipColor }: { label: string; value: string; chip: string; chipNote: string; chipColor: string }) {
  return (
    <div style={{ ...card, padding: "20px 22px" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginTop: 9, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color: chipColor, background: `color-mix(in srgb, ${chipColor} 13%, transparent)`, padding: "2px 7px", borderRadius: 6 }}>{chip}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{chipNote}</span>
      </div>
    </div>
  );
}

function Accounts({ view, onOpen }: { view: View; onOpen: (id: string) => void }) {
  const t = view.totals;
  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
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
        <button style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: 9, background: "var(--accent)", border: "none", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 500, boxShadow: "0 2px 6px var(--accent-soft)" }}>
          <IconPlus />新增账户
        </button>
      </div>

      {view.groups.map((grp) => (
        <div key={grp.cat} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px 9px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>{grp.title}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: grp.subtotalColor, fontVariantNumeric: "tabular-nums" }}>{grp.subtotal}</div>
          </div>
          <div style={{ ...card, overflow: "hidden" }}>
            {grp.accounts.map((acc) => (
              <div key={acc.id} onClick={() => onOpen(acc.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: acc.border, cursor: "pointer" }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${acc.color} 15%, transparent)`, color: acc.color }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{acc.initial}</span>
                </span>
                <div style={{ minWidth: 0, width: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acc.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acc.sub}</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--fill-quaternary)", padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{acc.type}</span>
                <div style={{ flex: 1, minWidth: 40, maxWidth: 160 }}>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--track)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: acc.pctWidth, background: acc.color, borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", width: 130 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: acc.amountColor, fontVariantNumeric: "tabular-nums" }}>{acc.balance}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{acc.pct} · 占比</div>
                </div>
                <span style={{ flex: "none" }}><IconChevron size={16} /></span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Detail({ view }: { view: View }) {
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
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>当前余额</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", marginTop: 2 }}>{d.balance}</div>
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

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 22px 13px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>余额快照</div>
          <button style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", borderRadius: 8, background: "var(--accent-soft)", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12.5, fontWeight: 600 }}>
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

const PROFILE_FIELDS = [
  { label: "姓名", value: "待录入", tag: "明文" },
  { label: "手机号码", value: "待录入", tag: "脱敏" },
  { label: "身份证号", value: "待录入", tag: "加密" },
  { label: "邮箱", value: "待录入", tag: "明文" },
  { label: "生日", value: "待录入", tag: "明文" },
];
const SECURITY_ROWS = [
  { name: "主密码", detail: "上次修改 32 天前", status: "强", color: "var(--green)", bg: "color-mix(in srgb, var(--green) 13%, transparent)" },
  { name: "生物识别", detail: "Touch ID / Windows Hello", status: "待启用", color: "var(--text-secondary)", bg: "var(--fill-quaternary)" },
  { name: "自动锁定", detail: "闲置 5 分钟后", status: "5 分钟", color: "var(--text-secondary)", bg: "var(--fill-quaternary)" },
];

function Profile({ view, members, userInitial }: { view: View; members: { name: string; role: string; initial: string; color: string; access: string }[]; userInitial: string }) {
  return (
    <div style={{ padding: "24px 32px 40px", animation: "fvFade 0.3s ease" }}>
      <div style={{ ...card, borderRadius: 16, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ height: 88, background: "linear-gradient(120deg, var(--accent), #5E5CE6 70%, #AF52DE)" }} />
        <div style={{ padding: "0 26px 22px", display: "flex", alignItems: "flex-end", gap: 18, marginTop: -34 }}>
          <span style={{ width: 78, height: 78, borderRadius: 22, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#0A84FF,#5E5CE6)", color: "#fff", fontSize: 30, fontWeight: 700, border: "4px solid var(--bg-card)", boxShadow: "0 6px 16px rgba(0,0,0,0.18)" }}>{userInitial}</span>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)" }}>{view.meta.userName}</h1>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", padding: "3px 9px", borderRadius: 6 }}>户主 · 管理员</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 4 }}>{view.meta.vaultName}</div>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 15px", borderRadius: 9, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--text-primary)", fontSize: 12.5, fontWeight: 500 }}>
            <IconEdit />编辑资料
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "15px 22px 12px" }}>
            <IconLock size={15} stroke="var(--text-secondary)" width={1.8} />
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>实名信息</div>
            <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--orange)", background: "color-mix(in srgb, var(--orange) 14%, transparent)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>机密 · 已加密</span>
          </div>
          {PROFILE_FIELDS.map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", padding: "11px 22px", borderTop: "0.5px solid var(--separator)", fontSize: 13 }}>
              <span style={{ width: 96, flex: "none", color: "var(--text-tertiary)" }}>{f.label}</span>
              <span style={{ flex: 1, color: "var(--text-primary)", fontWeight: 500 }}>{f.value}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", border: "0.5px solid var(--separator-strong)", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap" }}>{f.tag}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", padding: "15px 22px 12px" }}>登录与安全</div>
            {SECURITY_ROWS.map((r) => (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderTop: "0.5px solid var(--separator)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{r.detail}</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: r.color, background: r.bg, padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{r.status}</span>
              </div>
            ))}
          </div>

          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", padding: "15px 22px 12px" }}>家庭成员</div>
            {members.map((m) => (
              <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 22px", borderTop: "0.5px solid var(--separator)" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color, fontSize: 12, fontWeight: 700 }}>{m.initial}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.role}</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-secondary)", background: "var(--fill-quaternary)", padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{m.access}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
