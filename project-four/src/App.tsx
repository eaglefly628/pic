import { useState } from "react";
import { useVault } from "./lib/vault";
import Lock from "./screens/Lock";
import SettingsScreen from "./screens/SettingsScreen";
import Overview from "./screens/dev/Overview";
import Tasks from "./screens/dev/Tasks";
import Notes from "./screens/dev/Notes";
import Snippets from "./screens/dev/Snippets";
import Bookmarks from "./screens/dev/Bookmarks";
import Life from "./screens/dev/Life";
import { IconLock, IconTerminal } from "./icons";

type View = "overview" | "tasks" | "notes" | "snippets" | "links" | "life" | "settings";
const TABS: { v: View; l: string }[] = [
  { v: "overview", l: "概览" }, { v: "tasks", l: "任务" }, { v: "notes", l: "笔记" },
  { v: "snippets", l: "片段" }, { v: "links", l: "书签" }, { v: "life", l: "生活" }, { v: "settings", l: "设置" },
];

export default function App() {
  const { status, toast, lock, data, update } = useVault();
  const [view, setView] = useState<View>("overview");

  if (status === "loading") {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>载入中…</div>;
  }
  if (status !== "unlocked") return <Lock />;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <header style={{ flex: "none", height: 54, display: "flex", alignItems: "center", gap: 6, padding: "0 18px", borderBottom: "0.5px solid var(--separator)", background: "var(--bg-content)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, fontSize: 15, marginRight: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(160deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center" }}><IconTerminal size={16} stroke="#fff" /></span>
          男主的开发世界
        </div>
        {TABS.map((t) => <Tab key={t.v} active={view === t.v} onClick={() => setView(t.v)}>{t.l}</Tab>)}
        <div style={{ flex: 1 }} />
        <button onClick={lock} className="fv-btn" style={lockBtn} title="立即锁定">
          <IconLock size={14} stroke="currentColor" /> 锁定
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: view === "settings" ? 0 : "22px 26px 40px" }}>
          {view === "overview" && <Overview data={data} mut={update} goto={(t) => setView(t)} />}
          {view === "tasks" && <Tasks data={data} mut={update} />}
          {view === "notes" && <Notes data={data} mut={update} />}
          {view === "snippets" && <Snippets data={data} mut={update} />}
          {view === "links" && <Bookmarks data={data} mut={update} />}
          {view === "life" && <Life data={data} mut={update} />}
          {view === "settings" && <SettingsScreen />}
        </div>
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
