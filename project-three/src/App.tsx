import { useState } from "react";
import { useVault } from "./lib/vault";
import Lock from "./screens/Lock";
import VaultScreen from "./screens/VaultScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { IconLock } from "./icons";

export default function App() {
  const { status, toast, lock } = useVault();
  const [view, setView] = useState<"vault" | "settings">("vault");

  if (status === "loading") {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>载入中…</div>;
  }
  if (status !== "unlocked") return <Lock />;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <header style={{ flex: "none", height: 54, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderBottom: "0.5px solid var(--separator)", background: "var(--bg-content)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, fontSize: 15, marginRight: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(160deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center" }}><IconLock size={15} stroke="#fff" /></span>
          家庭密码
        </div>
        <Tab active={view === "vault"} onClick={() => setView("vault")}>保险库</Tab>
        <Tab active={view === "settings"} onClick={() => setView("settings")}>设置</Tab>
        <div style={{ flex: 1 }} />
        <button onClick={lock} className="fv-btn" style={lockBtn} title="立即锁定">
          <IconLock size={14} stroke="currentColor" /> 锁定
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {view === "vault" ? <VaultScreen /> : <SettingsScreen />}
      </main>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--text-primary)", color: "var(--bg-content)", padding: "10px 18px", borderRadius: 11, fontSize: 13, fontWeight: 500, boxShadow: "var(--shadow)", zIndex: 100, animation: "fvFade .2s ease" }}>{toast}</div>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={"fv-nav fv-tap" + (active ? " active" : "")} style={{ border: "none", background: active ? "var(--fill)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontSize: 13.5, fontWeight: 500, padding: "7px 14px", borderRadius: 9 }}>{children}</button>
  );
}

const lockBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, border: "0.5px solid var(--separator)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 9 };
