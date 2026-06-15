import React, { useRef, useState } from "react";
import type { View } from "../lib/compute";
import type { RangeKey } from "../lib/compute";
import { card } from "../ui";
import { fmt } from "../lib/format";

function greetingWord() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
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

export default function Dashboard({ view, onOpen, range, setRange }: { view: View; onOpen: (id: string) => void; range: RangeKey; setRange: (r: RangeKey) => void }) {
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
        <MetricCard label="总资产" value={t.totalAssets} chip="资产合计" chipNote={`${view.meta.accountCount} 个账户`} chipColor="var(--green)" />
        <MetricCard label="总负债" value={t.totalLiabilities} chip="含信用卡/贷款" chipNote="负债合计" chipColor="var(--red)" />
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
          <TrendChart view={view} />
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

      {view.monthlyChanges.length > 0 && (
        <div style={{ ...card, padding: "18px 22px", marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
            每月变化量<span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>近 12 期净资产变化</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 104 }}>
            {view.monthlyChanges.map((c, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: c.up ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }}>{c.text}</div>
                <div style={{ width: "58%", maxWidth: 30, height: Math.max(4, c.ratio * 56), borderRadius: 4, background: c.up ? "var(--green)" : "var(--red)" }} />
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>最近更新</div>
        {view.recent.length === 0 && <div style={{ padding: "0 22px 18px", fontSize: 12.5, color: "var(--text-tertiary)" }}>暂无变动记录</div>}
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

function TrendChart({ view }: { view: View }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const pts = view.trend.points;

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || pts.length === 0) return;
    const rect = el.getBoundingClientRect();
    const xView = ((e.clientX - rect.left) * 600) / rect.width;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - xView); if (d < bd) { bd = d; best = i; } });
    const p = pts[best];
    setHover({ i: best, px: (p.x * rect.width) / 600, py: (p.y * rect.height) / 220 });
  };

  const hp = hover ? pts[hover.i] : null;
  const tipLeft = hover ? Math.min(Math.max(hover.px, 52), (ref.current?.clientWidth ?? 600) - 52) : 0;
  const tipTop = hover ? (hover.py > 56 ? hover.py - 50 : hover.py + 14) : 0;

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
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
        {hp && <line x1={hp.x} x2={hp.x} y1={16} y2={190} stroke="var(--separator-strong)" strokeWidth="1" strokeDasharray="3 3" />}
        <circle cx={view.trend.lastX} cy={view.trend.lastY} r="4.5" fill="var(--accent)" stroke="var(--bg-card)" strokeWidth="2.5" />
        {hp && <circle cx={hp.x} cy={hp.y} r="5" fill="var(--accent)" stroke="var(--bg-card)" strokeWidth="2.5" />}
        {view.trend.xLabels.map((x, i) => (
          <text key={i} x={x.x} y="216" textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{x.label}</text>
        ))}
      </svg>
      {hp && (
        <div style={{ position: "absolute", left: tipLeft, top: tipTop, transform: "translateX(-50%)", pointerEvents: "none", background: "var(--bg-card)", border: "0.5px solid var(--separator-strong)", boxShadow: "var(--card-shadow)", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap", zIndex: 2 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{hp.date}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(hp.value)}</div>
        </div>
      )}
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
