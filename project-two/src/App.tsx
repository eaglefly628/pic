import React, { useState } from "react";
import type { MediaItem } from "./types";
import { useTheme } from "./lib/theme";
import { useLibrary } from "./lib/library";
import { IconSummary, IconPhoto, IconPin, IconAlbum, IconUpload, IconGear, IconSearch, IconImage, IconWand } from "./icons";
import Summary from "./screens/Summary";
import Gallery from "./screens/Gallery";
import Places from "./screens/Places";
import Albums from "./screens/Albums";
import ImportScreen from "./screens/ImportScreen";
import Settings from "./screens/Settings";
import Cleanup from "./screens/Cleanup";
import { Lightbox } from "./components/Lightbox";

type Screen = "summary" | "gallery" | "places" | "albums" | "cleanup" | "import" | "settings";
const glass: React.CSSProperties = { backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" };
const groupLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", padding: "14px 10px 4px", letterSpacing: "0.02em" };

function navStyle(active: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 500, padding: "7px 10px", borderRadius: 8, marginBottom: 1, background: active ? "var(--accent)" : "transparent", color: active ? "#fff" : "var(--text-secondary)" };
}

const TITLES: Record<Screen, string> = { summary: "总览", gallery: "图库", places: "地点", albums: "相册", cleanup: "整理", import: "导入", settings: "设置" };

export default function App() {
  const { theme, toggle } = useTheme();
  const { items, albums } = useLibrary();
  const [screen, setScreen] = useState<Screen>("summary");
  const [lb, setLb] = useState<{ list: MediaItem[]; index: number } | null>(null);
  const open = (list: MediaItem[], index: number) => setLb({ list, index });

  return (
    <div className="fv-root" data-theme={theme} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wallpaper)", padding: 24 }}>
      <div style={{ position: "relative", width: 1320, height: "88vh", maxWidth: "100%", borderRadius: 13, overflow: "hidden", boxShadow: "var(--win-shadow)", display: "flex", background: "var(--bg-content)", border: "0.5px solid var(--separator-strong)" }}>
        {/* 侧栏 */}
        <aside style={{ width: 224, flex: "none", background: "var(--bg-sidebar)", ...glass, borderRight: "0.5px solid var(--separator)", display: "flex", flexDirection: "column" }}>
          <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 20px" }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />)}
          </div>
          <div style={{ padding: "4px 16px 14px", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(160deg,var(--accent),#5E5CE6)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconImage size={18} /></div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>家庭影像</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>本地 · 不联网</div>
            </div>
          </div>
          <nav className="fv-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
            <div style={{ ...groupLabel, padding: "8px 10px 4px" }}>浏览</div>
            <Nav active={screen === "summary"} onClick={() => setScreen("summary")} icon={<IconSummary />} label="总览" />
            <Nav active={screen === "gallery"} onClick={() => setScreen("gallery")} icon={<IconPhoto />} label="图库" badge={String(items.filter((m) => !m.private).length)} />
            <Nav active={screen === "places"} onClick={() => setScreen("places")} icon={<IconPin />} label="地点" />
            <Nav active={screen === "albums"} onClick={() => setScreen("albums")} icon={<IconAlbum />} label="相册" badge={String(albums.length)} />
            <div style={groupLabel}>工具</div>
            <Nav active={screen === "cleanup"} onClick={() => setScreen("cleanup")} icon={<IconWand />} label="整理（去重/清理）" />
            <div style={groupLabel}>其他</div>
            <Nav active={screen === "import"} onClick={() => setScreen("import")} icon={<IconUpload />} label="导入" />
            <Nav active={screen === "settings"} onClick={() => setScreen("settings")} icon={<IconGear />} label="设置" />
          </nav>
        </aside>

        {/* 主区 */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg-content)" }}>
          <div style={{ height: 52, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: "var(--bg-toolbar)", ...glass, borderBottom: "0.5px solid var(--separator)", zIndex: 5 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{TITLES[screen]}</div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: 180, height: 30, padding: "0 10px", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)" }}>
              <IconSearch /><span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>搜索（即将支持）</span>
            </div>
            <button onClick={toggle} title="切换外观" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "var(--fill-quaternary)", border: "0.5px solid var(--separator)", cursor: "pointer", color: "var(--text-secondary)" }}>{theme === "light" ? "🌙" : "☀️"}</button>
            <button onClick={() => setScreen("import")} style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 8, background: "var(--accent)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12.5, fontWeight: 500 }}><IconUpload size={14} stroke="#fff" />导入</button>
          </div>

          <div className="fv-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {screen === "summary" && <Summary goImport={() => setScreen("import")} />}
            {screen === "gallery" && <Gallery onOpen={open} goImport={() => setScreen("import")} />}
            {screen === "places" && <Places onOpen={open} />}
            {screen === "albums" && <Albums onOpen={open} />}
            {screen === "cleanup" && <Cleanup />}
            {screen === "import" && <ImportScreen goGallery={() => setScreen("gallery")} />}
            {screen === "settings" && <Settings />}
          </div>
        </main>

        {lb && <Lightbox items={lb.list} index={lb.index} setIndex={(i) => setLb((l) => (l ? { ...l, index: i } : l))} onClose={() => setLb(null)} />}
      </div>
    </div>
  );
}

function Nav({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string }) {
  return (
    <button onClick={onClick} style={navStyle(active)}>
      {icon}<span>{label}</span>
      {badge != null && <span style={{ marginLeft: "auto", fontSize: 11, color: active ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{badge}</span>}
    </button>
  );
}
