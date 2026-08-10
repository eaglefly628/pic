import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVault } from "./vault/VaultContext";
import { useTheme } from "./lib/theme";
import { buildView, type RangeKey } from "./lib/compute";
import { useBreakpoint } from "./lib/breakpoint";
import type { VaultData } from "./vault/types";
import { addAccount, addSnapshot, deleteAccount, deleteSnapshotEntry, updateAccount } from "./vault/ops";
import {
  IconShield, IconDashboard, IconCard, IconLock, IconUser, IconImport, IconGear, IconChevron, IconSearch, IconKey,
  IconPercent, IconWallet, IconChartUp, IconMarkets,
} from "./icons";
import Unlock from "./screens/Unlock";
import Dashboard from "./screens/Dashboard";
import Accounts, { type AccMode } from "./screens/Accounts";
import Detail from "./screens/Detail";
import Passwords from "./screens/Passwords";
import Info from "./screens/Info";
import ImportData from "./screens/ImportData";
import Settings from "./screens/Settings";
import Interest from "./screens/Interest";
import Income from "./screens/Income";
import Budget from "./screens/Budget";
import Markets from "./screens/Markets";
import Secret from "./screens/Secret";
import { AccountEditor, SnapshotEditor } from "./screens/editors";

type Screen =
  | "dashboard" | "accounts" | "detail" | "passwords" | "info" | "import"
  | "settings" | "interest" | "income" | "budget" | "markets"
  | "more";   // 仅手机：装下 Tab Bar 放不下的入口

const glass: React.CSSProperties = {
  backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
};
const groupLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", padding: "14px 10px 4px", letterSpacing: "0.02em" };

function navStyle(active: boolean, collapsed: boolean): React.CSSProperties {
  return {
    position: "relative", zIndex: 1,
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    justifyContent: collapsed ? "center" : "flex-start",
    textAlign: "left", border: "none",
    cursor: "pointer", fontSize: 13.5, fontWeight: 500,
    padding: collapsed ? "9px 0" : "7px 10px", borderRadius: 8, marginBottom: 1,
    background: "transparent", color: active ? "#fff" : "var(--text-secondary)",
  };
}

export default function App() {
  const { status, data } = useVault();
  const { theme } = useTheme();

  if (status === "loading") {
    return <div className="fv-root" data-theme={theme} style={{ minHeight: "100vh", background: "var(--wallpaper)" }} />;
  }
  if (status !== "unlocked" || !data) {
    return <div className="fv-root" data-theme={theme}><Unlock /></div>;
  }
  return <div className="fv-root" data-theme={theme}><Shell data={data} /></div>;
}

function Shell({ data }: { data: VaultData }) {
  const { update, lock } = useVault();
  const { theme, toggle } = useTheme();
  const bp = useBreakpoint();
  const isPhone = bp === "phone";
  const isTablet = bp === "tablet";

  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedId, setSelectedId] = useState<string>(data.dataset.accounts[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("1y");
  const [accMode, setAccMode] = useState<AccMode>("group"); // 提到这一层，进详情页再退出不会丢排序方式
  const [railOpen, setRailOpen] = useState(false);          // 平板：侧栏是否展开
  const collapsed = isTablet && !railOpen;

  const navRef = useRef<HTMLElement>(null);
  const [navInd, setNavInd] = useState<{ top: number; height: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector('[data-active="1"]') as HTMLElement | null;
    if (el) setNavInd({ top: el.offsetTop, height: el.offsetHeight, left: el.offsetLeft, width: el.offsetWidth });
    else setNavInd(null);
  }, [screen, collapsed, bp]);

  const [accEditor, setAccEditor] = useState<{ open: boolean; editing: boolean }>({ open: false, editing: false });
  const [snapEditor, setSnapEditor] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const clicksRef = useRef(0);
  const lastClickRef = useRef(0);
  const onSecretTap = () => {
    const now = Date.now();
    clicksRef.current = now - lastClickRef.current < 1500 ? clicksRef.current + 1 : 1;
    lastClickRef.current = now;
    if (clicksRef.current >= 5) { clicksRef.current = 0; setSecretOpen(true); }
  };

  const view = useMemo(() => buildView(data.dataset, { range, selectedId }), [data.dataset, range, selectedId]);
  const userInitial = (view.meta.userName.slice(0, 1) || "U").toUpperCase();
  const currentAcc = data.dataset.accounts.find((a) => a.id === view.detail.id);

  const open = (id: string) => { setSelectedId(id); setScreen("detail"); };

  const TITLES: Record<Screen, string> = {
    dashboard: "仪表盘", accounts: "资金账户", detail: view.detail.name, passwords: "密码保险箱",
    info: "个人信息", import: "导入 / 导出", settings: "设置", interest: "利息预测",
    income: "收入情况", budget: "预算与预测", markets: "财经行情", more: "更多",
  };
  const pageTitle = TITLES[screen];

  // 手机上二级页要能退回一级页
  const backTarget: Partial<Record<Screen, Screen>> = {
    detail: "accounts", budget: "income",
    interest: "more", markets: "more", import: "more", info: "more", settings: "more",
  };
  const back = isPhone ? backTarget[screen] : (screen === "detail" ? "accounts" : undefined);

  const sidebarW = collapsed ? 68 : 236;

  const content = (
    <>
      {screen === "dashboard" && <Dashboard view={view} onOpen={open} range={range} setRange={setRange} />}
      {screen === "accounts" && <Accounts view={view} mode={accMode} onModeChange={setAccMode} onOpen={open} onAddAccount={() => setAccEditor({ open: true, editing: false })} />}
      {screen === "detail" && (
        <Detail
          view={view}
          onAddSnapshot={() => setSnapEditor(true)}
          onEditAccount={() => setAccEditor({ open: true, editing: true })}
          onDeleteAccount={() => {
            if (currentAcc && confirm(`删除账户「${currentAcc.name}」及其全部快照？`)) {
              update((d) => deleteAccount(d.dataset, currentAcc.id));
              setScreen("accounts");
            }
          }}
          onDeleteSnapshot={(date) => { if (currentAcc) update((d) => deleteSnapshotEntry(d.dataset, currentAcc.id, date)); }}
        />
      )}
      {screen === "passwords" && <Passwords />}
      {screen === "info" && <Info />}
      {screen === "import" && <ImportData />}
      {screen === "settings" && <Settings />}
      {screen === "interest" && <Interest />}
      {screen === "income" && <Income />}
      {screen === "budget" && <Budget />}
      {screen === "markets" && <Markets />}
      {screen === "more" && <More onGo={(s) => setScreen(s)} onLock={lock} accounts={view.meta.accountCount} pwCount={data.passwords.length} />}
    </>
  );

  // 窗口容器：桌面是浮在壁纸上的固定尺寸「窗口」，平板/手机直接铺满视口
  const frame: React.CSSProperties = bp === "desktop"
    ? { position: "relative", width: 1200, height: 800, maxWidth: "100%", borderRadius: 13, overflow: "hidden", boxShadow: "var(--win-shadow)", display: "flex", background: "var(--bg-content)", border: "0.5px solid var(--separator-strong)" }
    : { position: "relative", width: "100%", height: "100%", borderRadius: 0, overflow: "hidden", display: "flex", background: "var(--bg-content)", border: "none" };

  return (
    <div className={bp === "desktop" ? "fv-wallpaper" : undefined}
      style={{
        minHeight: "100vh", width: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: bp === "desktop" ? 32 : 0,
        height: bp === "desktop" ? undefined : "100vh",
        background: bp === "desktop" ? undefined : "var(--bg-content)",
      }}>
      <div style={frame}>
        {/* 侧栏：手机不要，改用底部 Tab Bar */}
        {!isPhone && (
          <aside style={{ width: sidebarW, flex: "none", background: "var(--bg-sidebar)", ...glass, borderRight: "0.5px solid var(--separator)", display: "flex", flexDirection: "column", transition: "width .28s cubic-bezier(.2,.7,.3,1)" }}>
            {bp === "desktop" && (
              <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 20px" }}>
                {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                  <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.12)" }} />
                ))}
              </div>
            )}
            <div style={{ padding: collapsed ? "12px 0 14px" : "4px 16px 16px", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 11 }}>
              {/* 平板：品牌盾牌兼作折叠开关 */}
              <button
                onClick={() => isTablet && setRailOpen((v) => !v)}
                title={isTablet ? (railOpen ? "收起侧栏" : "展开侧栏") : undefined}
                className={isTablet ? "fv-press" : undefined}
                style={{
                  width: 34, height: 34, flex: "none", borderRadius: 9, border: "none", padding: 0,
                  background: "linear-gradient(160deg,var(--accent),#b08a5e)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 6px var(--accent-soft)", cursor: isTablet ? "pointer" : "default",
                }}>
                <IconShield size={18} />
              </button>
              {!collapsed && (
                <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{view.meta.vaultName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>本地加密 · 已解锁</div>
                </div>
              )}
            </div>

            <nav ref={navRef} className="fv-scroll" style={{ flex: 1, overflowY: "auto", padding: collapsed ? "4px 10px" : "4px 12px", position: "relative" }}>
              {navInd && <div aria-hidden className="fv-navhi" style={{ position: "absolute", top: navInd.top, left: navInd.left, width: navInd.width, height: navInd.height, background: "var(--accent)", borderRadius: 8, boxShadow: "0 2px 8px var(--accent-soft)", zIndex: 0 }} />}
              {!collapsed && <div style={{ ...groupLabel, padding: "8px 10px 4px" }}>概览</div>}
              <NavBtn c={collapsed} active={screen === "dashboard"} onClick={() => setScreen("dashboard")} icon={<IconDashboard />} label="仪表盘" />
              <NavBtn c={collapsed} active={screen === "markets"} onClick={() => setScreen("markets")} icon={<IconMarkets />} label="财经行情" />
              {!collapsed && <div style={groupLabel}>资金</div>}
              <NavBtn c={collapsed} active={screen === "accounts" || screen === "detail"} onClick={() => setScreen("accounts")} icon={<IconCard />} label="资金账户" badge={String(view.meta.accountCount)} />
              <NavBtn c={collapsed} active={screen === "interest"} onClick={() => setScreen("interest")} icon={<IconPercent />} label="利息预测" />
              <NavBtn c={collapsed} active={screen === "import"} onClick={() => setScreen("import")} icon={<IconImport />} label="导入 / 导出" />
              {!collapsed && <div style={groupLabel}>收支</div>}
              <NavBtn c={collapsed} active={screen === "income"} onClick={() => setScreen("income")} icon={<IconWallet />} label="收入情况" />
              <NavBtn c={collapsed} active={screen === "budget"} onClick={() => setScreen("budget")} icon={<IconChartUp />} label="预算与预测" />
              {!collapsed && <div style={groupLabel}>安全</div>}
              <NavBtn c={collapsed} active={screen === "passwords"} onClick={() => setScreen("passwords")} icon={<IconKey />} label="密码保险箱" badge={String(data.passwords.length)} />
              <NavBtn c={collapsed} active={screen === "info"} onClick={() => setScreen("info")} icon={<IconUser />} label="个人信息" />
              {!collapsed && <div style={groupLabel}>其他</div>}
              <NavBtn c={collapsed} active={screen === "settings"} onClick={() => setScreen("settings")} icon={<IconGear />} label="设置" />
            </nav>

            <div style={{ padding: collapsed ? "10px 10px 12px" : "10px 12px 12px", borderTop: "0.5px solid var(--separator)" }}>
              <button onClick={() => setScreen("info")} className={"fv-nav" + (screen === "info" ? " active" : "")}
                title={collapsed ? view.meta.userName : undefined}
                style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 9, width: "100%", border: "none", cursor: "pointer", padding: collapsed ? "6px 0" : "6px 9px", borderRadius: 9, background: screen === "info" ? "var(--accent-soft)" : "transparent" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,var(--accent),#b08a5e)", color: "#fff", fontSize: 12, fontWeight: 700 }}>{userInitial}</span>
                {!collapsed && (
                  <>
                    <div style={{ lineHeight: 1.25, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{view.meta.userName}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>户主 · 管理员</div>
                    </div>
                    <span style={{ marginLeft: "auto", flex: "none" }}><IconChevron /></span>
                  </>
                )}
              </button>
            </div>
          </aside>
        )}

        {/* MAIN */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg-content)" }}>
          <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: isPhone ? 8 : 12, padding: isPhone ? "0 12px" : "0 18px", background: "var(--bg-toolbar)", ...glass, borderBottom: "0.5px solid var(--separator)", zIndex: 5 }}>
            {back && (
              <button onClick={() => setScreen(back)} className="fv-tap" style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13.5, fontWeight: 500, padding: "5px 7px", marginLeft: -7, borderRadius: 7, minHeight: isPhone ? 44 : undefined }}>
                <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={17} stroke="var(--accent)" /></span>
                {TITLES[back]}
              </button>
            )}
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageTitle}</div>
            <div style={{ flex: 1 }} />
            {/* 搜索框在手机上占不下，收掉 */}
            {!isPhone && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, width: isTablet ? 130 : 188, height: 30, padding: "0 10px", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)" }}>
                <IconSearch />
                <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>搜索全部</span>
                {!isTablet && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)", border: "0.5px solid var(--separator-strong)", borderRadius: 4, padding: "1px 4px" }}>⌘K</span>}
              </div>
            )}
            <button onClick={toggle} title="切换外观" className="fv-icnbtn" style={{ width: isPhone ? 36 : 30, height: isPhone ? 36 : 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--text-secondary)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
                {theme === "light"
                  ? <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.6 8.6 0 1 0 10.2 10.2Z" />
                  : <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></>}
              </svg>
            </button>
            {/* 手机把「锁定」收进「更多」，顶栏留给标题 */}
            {!isPhone && (
              <button onClick={lock} className="fv-btn" style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 8, background: "var(--accent)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12.5, fontWeight: 500 }}>
                <IconLock size={14} stroke="currentColor" />锁定
              </button>
            )}
          </div>

          <div className="fv-scroll fv-page" key={screen} style={{ flex: 1, overflowY: "auto" }}>
            {content}
          </div>

          {isPhone && <TabBar screen={screen} onGo={setScreen} />}
        </main>

        {/* 编辑器 */}
        <AccountEditor
          open={accEditor.open}
          initial={accEditor.editing ? currentAcc : undefined}
          onClose={() => setAccEditor({ open: false, editing: false })}
          onSubmit={(meta, balance) => {
            if (accEditor.editing && currentAcc) update((d) => updateAccount(d.dataset, currentAcc.id, meta));
            else update((d) => addAccount(d.dataset, meta, balance));
          }}
        />
        <SnapshotEditor
          open={snapEditor}
          accountName={currentAcc?.name ?? ""}
          onClose={() => setSnapEditor(false)}
          onSubmit={(date, amount) => { if (currentAcc) update((d) => addSnapshot(d.dataset, currentAcc.id, date, amount)); }}
        />

        {/* 隐藏入口：右下角无反馈小字，连点 5 下进入「私房钱」 */}
        <span onClick={onSecretTap} title="" style={{ position: "absolute", bottom: isPhone ? 88 : 4, right: 10, fontSize: 10.5, color: "var(--text-tertiary)", opacity: 0.6, userSelect: "none", zIndex: 30, padding: "4px 6px" }}>v0.1.0</span>
        {secretOpen && <Secret onExit={() => setSecretOpen(false)} />}
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, badge, c }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string; c: boolean;
}) {
  return (
    <button onClick={onClick} data-active={active ? "1" : undefined} title={c ? label : undefined}
      className={"fv-nav" + (active ? " active" : "")} style={navStyle(active, c)}>
      {icon}
      {!c && <span>{label}</span>}
      {!c && badge != null && <span style={{ marginLeft: "auto", fontSize: 11, color: active ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{badge}</span>}
    </button>
  );
}

/* ── 手机底部 Tab Bar ──────────────────────────────────────────
   5 个标签，高 83px（含安全区）。10 个侧栏入口收成：4 个常用 + 「更多」。 */
const TABS: { key: Screen; label: string; icon: React.ReactNode; owns: Screen[] }[] = [
  { key: "dashboard", label: "仪表盘", icon: <IconDashboard size={21} />, owns: ["dashboard"] },
  { key: "accounts", label: "账户", icon: <IconCard size={21} />, owns: ["accounts", "detail"] },
  { key: "income", label: "收支", icon: <IconWallet size={21} />, owns: ["income", "budget"] },
  { key: "passwords", label: "保险箱", icon: <IconKey size={21} />, owns: ["passwords"] },
  { key: "more", label: "更多", icon: <IconGear size={21} />, owns: ["more", "interest", "markets", "import", "info", "settings"] },
];

function TabBar({ screen, onGo }: { screen: Screen; onGo: (s: Screen) => void }) {
  return (
    <nav style={{
      flex: "none", height: 83, paddingBottom: "env(safe-area-inset-bottom, 0px)",
      display: "flex", alignItems: "flex-start",
      background: "var(--bg-toolbar)", ...glass,
      borderTop: "0.5px solid var(--separator)", zIndex: 6,
    }}>
      {TABS.map((t) => {
        const on = t.owns.includes(screen);
        return (
          <button key={t.key} onClick={() => onGo(t.key)} className="fv-press"
            style={{
              flex: 1, minHeight: 56, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              padding: "9px 0 0", border: "none", background: "transparent", cursor: "pointer",
              color: on ? "var(--accent)" : "var(--text-tertiary)",
            }}>
            {t.icon}
            <span style={{ fontSize: 10, fontWeight: on ? 600 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── 手机「更多」页：Tab Bar 放不下的入口都在这 ── */
function More({ onGo, onLock, accounts, pwCount }: {
  onGo: (s: Screen) => void; onLock: () => void; accounts: number; pwCount: number;
}) {
  const rows: { key: Screen; label: string; icon: React.ReactNode; note?: string }[] = [
    { key: "interest", label: "利息预测", icon: <IconPercent /> },
    { key: "budget", label: "预算与预测", icon: <IconChartUp /> },
    { key: "markets", label: "财经行情", icon: <IconMarkets /> },
    { key: "import", label: "导入 / 导出", icon: <IconImport /> },
    { key: "info", label: "个人信息", icon: <IconUser /> },
    { key: "settings", label: "设置", icon: <IconGear /> },
  ];
  return (
    <div style={{ padding: "16px 14px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ flex: "none", background: "var(--bg-card)", borderRadius: 16, boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
        {rows.map((r, i) => (
          <button key={r.key} onClick={() => onGo(r.key)} className="fv-row"
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 48,
              padding: "0 16px", border: "none", cursor: "pointer", background: "transparent",
              borderTop: i ? "0.5px solid var(--separator)" : "none",
              color: "var(--text-primary)", fontSize: 14, textAlign: "left",
            }}>
            <span style={{ color: "var(--text-secondary)", display: "inline-flex" }}>{r.icon}</span>
            <span>{r.label}</span>
            <span style={{ marginLeft: "auto", display: "inline-flex" }}><IconChevron /></span>
          </button>
        ))}
      </div>

      <div style={{ flex: "none", fontSize: 11.5, color: "var(--text-tertiary)", padding: "0 4px", fontVariantNumeric: "tabular-nums" }}>
        {accounts} 个账户 · {pwCount} 条密码
      </div>

      <button onClick={onLock} className="fv-btn"
        style={{ flex: "none", minHeight: 48, borderRadius: 14, border: "none", cursor: "pointer", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <IconLock size={16} stroke="currentColor" />立即锁定
      </button>
    </div>
  );
}
