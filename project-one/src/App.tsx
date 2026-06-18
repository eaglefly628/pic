import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVault } from "./vault/VaultContext";
import { useTheme } from "./lib/theme";
import { buildView, type RangeKey } from "./lib/compute";
import type { VaultData } from "./vault/types";
import { addAccount, addSnapshot, deleteAccount, updateAccount } from "./vault/ops";
import {
  IconShield, IconDashboard, IconCard, IconLock, IconUser, IconImport, IconGear, IconChevron, IconSearch, IconKey,
  IconPercent, IconWallet, IconChartUp, IconMarkets,
} from "./icons";
import Unlock from "./screens/Unlock";
import Dashboard from "./screens/Dashboard";
import Accounts from "./screens/Accounts";
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

type Screen = "dashboard" | "accounts" | "detail" | "passwords" | "info" | "import" | "settings" | "interest" | "income" | "budget" | "markets";

const glass: React.CSSProperties = {
  backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
};
const groupLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", padding: "14px 10px 4px", letterSpacing: "0.02em" };

function navStyle(active: boolean): React.CSSProperties {
  return {
    position: "relative", zIndex: 1,
    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none",
    cursor: "pointer", fontSize: 13.5, fontWeight: 500, padding: "7px 10px", borderRadius: 8, marginBottom: 1,
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
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedId, setSelectedId] = useState<string>(data.dataset.accounts[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("1y");
  const navRef = useRef<HTMLElement>(null);
  const [navInd, setNavInd] = useState<{ top: number; height: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector('[data-active="1"]') as HTMLElement | null;
    if (el) setNavInd({ top: el.offsetTop, height: el.offsetHeight, left: el.offsetLeft, width: el.offsetWidth });
  }, [screen]);

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
    info: "个人信息", import: "导入 / 导出", settings: "设置", interest: "利息预测", income: "收入情况", budget: "预算与预测", markets: "财经行情",
  };
  const pageTitle = TITLES[screen];

  return (
    <div className="fv-wallpaper" style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ position: "relative", width: 1200, height: 800, maxWidth: "100%", borderRadius: 13, overflow: "hidden", boxShadow: "var(--win-shadow)", display: "flex", background: "var(--bg-content)", border: "0.5px solid var(--separator-strong)" }}>
        {/* SIDEBAR */}
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

          <nav ref={navRef} className="fv-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 12px", position: "relative" }}>
            {navInd && <div aria-hidden className="fv-navhi" style={{ position: "absolute", top: navInd.top, left: navInd.left, width: navInd.width, height: navInd.height, background: "var(--accent)", borderRadius: 8, boxShadow: "0 2px 8px var(--accent-soft)", zIndex: 0 }} />}
            <div style={{ ...groupLabel, padding: "8px 10px 4px" }}>概览</div>
            <NavBtn active={screen === "dashboard"} onClick={() => setScreen("dashboard")} icon={<IconDashboard />} label="仪表盘" />
            <NavBtn active={screen === "markets"} onClick={() => setScreen("markets")} icon={<IconMarkets />} label="财经行情" />
            <div style={groupLabel}>资金</div>
            <NavBtn active={screen === "accounts" || screen === "detail"} onClick={() => setScreen("accounts")} icon={<IconCard />} label="资金账户" badge={String(view.meta.accountCount)} />
            <NavBtn active={screen === "interest"} onClick={() => setScreen("interest")} icon={<IconPercent />} label="利息预测" />
            <NavBtn active={screen === "import"} onClick={() => setScreen("import")} icon={<IconImport />} label="导入 / 导出" />
            <div style={groupLabel}>收支</div>
            <NavBtn active={screen === "income"} onClick={() => setScreen("income")} icon={<IconWallet />} label="收入情况" />
            <NavBtn active={screen === "budget"} onClick={() => setScreen("budget")} icon={<IconChartUp />} label="预算与预测" />
            <div style={groupLabel}>安全</div>
            <NavBtn active={screen === "passwords"} onClick={() => setScreen("passwords")} icon={<IconKey />} label="密码保险箱" badge={String(data.passwords.length)} />
            <NavBtn active={screen === "info"} onClick={() => setScreen("info")} icon={<IconUser />} label="个人信息" />
            <div style={groupLabel}>其他</div>
            <NavBtn active={screen === "settings"} onClick={() => setScreen("settings")} icon={<IconGear />} label="设置" />
          </nav>

          <div style={{ padding: "10px 12px 12px", borderTop: "0.5px solid var(--separator)" }}>
            <button onClick={() => setScreen("info")} className={"fv-nav" + (screen === "info" ? " active" : "")} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none", cursor: "pointer", padding: "6px 9px", borderRadius: 9, background: screen === "info" ? "var(--accent-soft)" : "transparent" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#0A84FF,#5E5CE6)", color: "#fff", fontSize: 12, fontWeight: 700 }}>{userInitial}</span>
              <div style={{ lineHeight: 1.25, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{view.meta.userName}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>户主 · 管理员</div>
              </div>
              <span style={{ marginLeft: "auto", flex: "none" }}><IconChevron /></span>
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg-content)" }}>
          <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: "var(--bg-toolbar)", ...glass, borderBottom: "0.5px solid var(--separator)", zIndex: 5 }}>
            {screen === "detail" && (
              <button onClick={() => setScreen("accounts")} className="fv-tap" style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13.5, fontWeight: 500, padding: "5px 7px", marginLeft: -7, borderRadius: 7 }}>
                <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><IconChevron size={17} stroke="var(--accent)" /></span>账户
              </button>
            )}
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{pageTitle}</div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: 188, height: 30, padding: "0 10px", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)" }}>
              <IconSearch />
              <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>搜索全部</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)", border: "0.5px solid var(--separator-strong)", borderRadius: 4, padding: "1px 4px" }}>⌘K</span>
            </div>
            <button onClick={toggle} title="切换外观" className="fv-icnbtn" style={{ width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--text-secondary)" }}>
              <span>{theme === "light" ? "🌙" : "☀️"}</span>
            </button>
            <button onClick={lock} className="fv-btn" style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 8, background: "var(--accent)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12.5, fontWeight: 500 }}>
              <IconLock size={14} stroke="currentColor" />锁定
            </button>
          </div>

          <div className="fv-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {screen === "dashboard" && <Dashboard view={view} onOpen={open} range={range} setRange={setRange} />}
            {screen === "accounts" && <Accounts view={view} onOpen={open} onAddAccount={() => setAccEditor({ open: true, editing: false })} />}
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
          </div>
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
        <span onClick={onSecretTap} title="" style={{ position: "absolute", bottom: 4, right: 10, fontSize: 10.5, color: "var(--text-tertiary)", opacity: 0.6, userSelect: "none", zIndex: 30, padding: "4px 6px" }}>v0.1.0</span>
        {secretOpen && <Secret onExit={() => setSecretOpen(false)} />}
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string }) {
  return (
    <button onClick={onClick} data-active={active ? "1" : undefined} className={"fv-nav" + (active ? " active" : "")} style={navStyle(active)}>
      {icon}<span>{label}</span>
      {badge != null && <span style={{ marginLeft: "auto", fontSize: 11, color: active ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{badge}</span>}
    </button>
  );
}
