import React, { useRef, useState } from "react";
import type { View } from "../lib/compute";
import type { RangeKey } from "../lib/compute";
import { Btn, TextField, card, Segmented } from "../ui";
import { useVault } from "../vault/VaultContext";
import { fmt } from "../lib/format";
import { useCountUp, rise, reduceMotion } from "../lib/anim";

function greetingWord() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}
// 问候语旁的时段标记。与 icons.tsx 同规格：24×24、细线、currentColor、圆头圆角接。
function GreetingMark({ size = 19 }: { size?: number }) {
  const h = new Date().getHours();
  const base = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  if (h < 6) return (                                    // 夜深了：月牙
    <svg {...base}><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.6 8.6 0 1 0 10.2 10.2Z" /></svg>
  );
  if (h < 11) return (                                   // 早上好：日出
    <svg {...base}><path d="M12 4v2.4M5.6 7.6l1.7 1.7M18.4 7.6l-1.7 1.7M3 16h3M18 16h3" /><path d="M8 16a4 4 0 0 1 8 0" /><path d="M2.5 20h19" /></svg>
  );
  if (h < 14) return (                                   // 中午好：太阳
    <svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></svg>
  );
  if (h < 18) return (                                   // 下午好：多云
    <svg {...base}><circle cx="8.5" cy="8.5" r="3" /><path d="M8.5 2.8v1.4M4.2 4.2l1 1M2.8 8.5h1.4M12.8 4.2l-1 1" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7 4.6 4.6 0 0 0-8.8 1.2A3 3 0 0 0 9 19Z" /></svg>
  );
  return (                                               // 晚上好：日落
    <svg {...base}><path d="M12 3.5v2.4M5.6 8.6l1.7 1.7M18.4 8.6l-1.7 1.7M3 17h3M18 17h3" /><path d="M8 17a4 4 0 0 1 8 0" /><path d="M2.5 21h19" /><path d="m9.4 4.6 2.6 2.6 2.6-2.6" /></svg>
  );
}
export default function Dashboard({ view, onOpen, range, setRange }: { view: View; onOpen: (id: string) => void; range: RangeKey; setRange: (r: RangeKey) => void }) {
  const { update } = useVault();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  const t = view.totals;
  const netAnim = useCountUp(t.netRaw);
  const saveNote = () => {
    if (!editKey) return;
    const text = draft.trim();
    update((d) => { if (!d.dataset.monthNotes) d.dataset.monthNotes = {}; if (text) d.dataset.monthNotes[editKey] = text; else delete d.dataset.monthNotes[editKey]; });
    setEditKey(null);
  };
  return (
    <div style={{ padding: "28px 32px 40px" }}>
      <div className="fv-rise" style={{ ...rise(0), display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}><span style={{ display: "inline-flex", color: "var(--accent)" }}><GreetingMark /></span>{greetingWord()}，{view.meta.userName}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 3 }}>{today} · {view.meta.vaultName}{view.meta.real ? "" : " · 示例数据"}</div>
        </div>
      </div>

      <div className="fv-rise" style={{ ...rise(70), display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 18 }}>
        <MetricCard label="总资产" value={t.assetsRaw} chip="资产合计" chipNote={`${view.meta.accountCount} 个账户`} chipColor="var(--green)" />
        <MetricCard label="总负债" value={t.liabRaw} chip="含信用卡/贷款" chipNote="负债合计" chipColor="var(--red)" />
        <div className="fv-sweep" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(155deg, var(--accent), #b08a5e)", borderRadius: 14, padding: "20px 22px", boxShadow: "0 10px 26px -8px var(--accent-soft)", color: "#fff" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 85% at 88% 0%, rgba(255,255,255,0.30), transparent 58%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", fontWeight: 500 }}>净资产</div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 9, fontVariantNumeric: "tabular-nums" }}>{fmt(netAnim)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.22)", padding: "2px 7px", borderRadius: 6 }}>{t.netDelta}</span>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)" }}>较上期</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fv-rise" style={{ ...rise(140), display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 18 }}>
        <div style={{ ...card, padding: "20px 22px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>净资产趋势</div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{view.trend.caption}</div>
            </div>
            <Segmented value={range} onChange={(r) => setRange(r as RangeKey)} style={{ width: 212 }}
              options={[{ value: "3m", label: "近3月" }, { value: "1y", label: "近1年" }, { value: "all", label: "全部" }]} />
          </div>
          <TrendChart view={view} />
        </div>

        <DonutCard donut={view.donut} />
      </div>

      {view.monthlyChanges.length > 0 && (
        <div className="fv-rise" style={{ ...card, ...rise(210), padding: "18px 22px", marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
            每月变化量<span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>近 12 期净资产变化</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minHeight: 134 }}>
            {view.monthlyChanges.map((c, i) => {
              const editing = editKey === c.key;
              return (
                <div key={c.key} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                  {c.note ? (
                    <button onClick={() => { setEditKey(c.key); setDraft(c.note); }} title={c.note}
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: 9.5, lineHeight: 1.25, color: editing ? "var(--accent)" : "var(--text-secondary)", maxWidth: "100%", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textAlign: "center", wordBreak: "break-all" }}>{c.note}</span>
                      <span style={{ fontSize: 9, lineHeight: 1, color: editing ? "var(--accent)" : "var(--text-tertiary)" }}>▾</span>
                    </button>
                  ) : (
                    <button onClick={() => { setEditKey(c.key); setDraft(""); }} title="标主要原因"
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: 11, lineHeight: 1, color: editing ? "var(--accent)" : "var(--text-tertiary)", opacity: editing ? 1 : 0.35 }}>＋</button>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 600, color: c.up ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }}>{c.text}</div>
                  <div className="fv-grow" style={{ animationDelay: `${i * 40}ms`, width: "58%", maxWidth: 30, height: Math.max(4, c.ratio * 56), borderRadius: 4, background: editing ? "var(--accent)" : (c.up ? "var(--green)" : "var(--red)") }} />
                  <div style={{ fontSize: 10, color: editing ? "var(--accent)" : "var(--text-tertiary)", fontWeight: editing ? 600 : 400, whiteSpace: "nowrap" }}>{c.label}</div>
                </div>
              );
            })}
          </div>
          {editKey && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--separator)" }}>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>「{view.monthlyChanges.find((c) => c.key === editKey)?.label ?? ""}」主要原因</span>
              <TextField value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="手动输入，如：发年终奖 / 股市回调 / 买房首付"
                onKeyDown={(e) => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") setEditKey(null); }} style={{ flex: 1 }} />
              <Btn onClick={saveNote}>保存</Btn>
              <Btn variant="ghost" onClick={() => setEditKey(null)}>取消</Btn>
            </div>
          )}
        </div>
      )}

      <div className="fv-rise" style={{ ...card, ...rise(280), overflow: "hidden" }}>
        <div style={{ padding: "16px 22px 12px", fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>最近更新</div>
        {view.recent.length === 0 && <div style={{ padding: "0 22px 18px", fontSize: 12.5, color: "var(--text-tertiary)" }}>暂无变动记录</div>}
        {view.recent.map((r) => (
          <div key={r.id} onClick={() => onOpen(r.id)} className="fv-row" style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 22px", borderTop: "0.5px solid var(--separator)", cursor: "pointer" }}>
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
      <svg viewBox="0 0 600 220" preserveAspectRatio="none" style={{ width: "100%", height: 208, display: "block", overflow: "visible" }}>
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
        <path key={"a" + view.trend.area} className="fv-fade-in" d={view.trend.area} fill="url(#fvArea)" />
        <path key={"l" + view.trend.line} className="fv-draw-line" pathLength={1} d={view.trend.line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {hp && <line x1={hp.x} x2={hp.x} y1={16} y2={190} stroke="var(--separator-strong)" strokeWidth="1" strokeDasharray="3 3" />}
        <circle className="fv-pulse" cx={view.trend.lastX} cy={view.trend.lastY} r="4" fill="var(--accent)" />
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

function DonutCard({ donut }: { donut: View["donut"] }) {
  const [hi, setHi] = useState<number | null>(null);
  return (
    <div style={{ ...card, padding: "20px 22px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>资产构成</div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", width: 118, height: 118, flex: "none" }}>
          <svg viewBox="0 0 120 120" className="fv-donut-in" style={{ width: 118, height: 118, transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="46" fill="none" stroke="var(--track)" strokeWidth="15" />
            {donut.map((seg, i) => (
              <circle
                key={i} cx="60" cy="60" r="46" fill="none" stroke={seg.color}
                strokeWidth={hi === i ? 21 : hi == null ? 15 : 13}
                strokeDasharray={seg.dash} strokeDashoffset={seg.offset} strokeLinecap="butt"
                onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
                style={{ transition: "stroke-width .2s cubic-bezier(.2,.7,.3,1), opacity .2s ease", opacity: hi == null || hi === i ? 1 : 0.4, cursor: "pointer" }}
              />
            ))}
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            {hi != null ? (
              <div key={hi} style={{ textAlign: "center", animation: reduceMotion ? undefined : "fvRise .2s ease" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{donut[hi].pct}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", maxWidth: 84, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{donut[hi].name}</div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>占比</div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {donut.map((seg, i) => (
            <div
              key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "5px 7px", borderRadius: 7, cursor: "pointer", transition: "background-color .15s ease, opacity .15s ease", background: hi === i ? "var(--hover)" : "transparent", opacity: hi == null || hi === i ? 1 : 0.5 }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: seg.color, flex: "none", transform: hi === i ? "scale(1.35)" : "scale(1)", transition: "transform .15s ease" }} />
              <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seg.name}</span>
              <span style={{ marginLeft: "auto", color: "var(--text-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{seg.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, chip, chipNote, chipColor }: { label: string; value: number; chip: string; chipNote: string; chipColor: string }) {
  const n = useCountUp(value);
  return (
    <div style={{ ...card, padding: "20px 22px" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginTop: 9, fontVariantNumeric: "tabular-nums" }}>{fmt(n)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color: chipColor, background: `color-mix(in srgb, ${chipColor} 13%, transparent)`, padding: "2px 7px", borderRadius: 6 }}>{chip}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{chipNote}</span>
      </div>
    </div>
  );
}
