import { useCallback, useEffect, useMemo, useState } from "react";
import { rise } from "../lib/anim";
import { Btn, card, Segmented } from "../ui";
import { IconRefresh } from "../icons";
import { useBreakpoint } from "../lib/breakpoint";

type Pt = { t: number; usd: number };  // 历史点，值统一放 .usd（金价/币价/汇率通用）
type Range = "1mo" | "3mo" | "6mo" | "1y";
type Gold = { ok: boolean; usdPerOz?: number; prevClose?: number | null; history?: Pt[]; usdCny?: number | null; asOf?: number; src?: string; error?: string };
type Btc = { ok: boolean; usd?: number; prevClose?: number | null; history?: Pt[]; usdCny?: number | null; asOf?: number; error?: string };
type Fx = { ok: boolean; base?: string; rates?: Record<string, number>; cny?: number | null; history?: Pt[]; asOf?: number; error?: string };
type UstCurve = { date: string; t: number; y: Record<string, number> };
type Ust = {
  ok: boolean; src?: string; asOf?: number; partial?: boolean; note?: string; error?: string;
  tenors?: { key: string; months: number }[];
  latest?: { date: string | null; t?: number; y: Record<string, number> };
  prev?: { date: string; y: Record<string, number> } | null;
  history?: Record<string, Pt[]>;
  curves?: UstCurve[];
};
type Tab = "gold" | "btc" | "fx" | "ust";

const RANGES = [{ value: "1mo", label: "近1月" }, { value: "3mo", label: "近3月" }, { value: "6mo", label: "近6月" }, { value: "1y", label: "近1年" }];
const OZ_G = 31.1035;
const fmt = (n: number | null | undefined, d = 2) => (n == null || isNaN(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const updatedAt = (asOf?: number) => (asOf ? ` · 更新于 ${new Date(asOf).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "");

/** left 给纵轴刻度留出的左边距（不传就跟原来一样两边各留 6）。 */
function spark(vals: number[], w: number, h: number, left = 6) {
  const pad = 6;
  if (vals.length < 2) return { line: "", area: "" };
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const x = (i: number) => left + (i / (vals.length - 1)) * (w - left - pad);
  const y = (v: number) => pad + (1 - (v - min) / rng) * (h - 2 * pad);
  let line = "";
  vals.forEach((v, i) => { line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; });
  const area = line + `L${x(vals.length - 1).toFixed(1)} ${(h - pad).toFixed(1)} L${x(0).toFixed(1)} ${(h - pad).toFixed(1)} Z`;
  return { line: line.trim(), area };
}

export default function Markets() {
  const [tab, setTab] = useState<Tab>("gold");
  const phone = useBreakpoint() === "phone";
  return (
    <div style={{ padding: phone ? "16px 14px 40px" : "24px 32px 40px", maxWidth: 820 }}>
      <div className="fv-rise" style={{ ...rise(0), marginBottom: 16 }}>
        <Segmented value={tab} onChange={(v) => setTab(v as Tab)} style={{ width: phone ? "100%" : 384 }}
          options={[{ value: "gold", label: "黄金" }, { value: "btc", label: "比特币" }, { value: "fx", label: "美元汇率" }, { value: "ust", label: "美债" }]} />
      </div>
      {tab === "gold" && <GoldView />}
      {tab === "btc" && <BtcView />}
      {tab === "fx" && <FxView />}
      {tab === "ust" && <UstView />}
    </div>
  );
}

// ── 通用图表 ────────────────────────────────────────────────
function TrendChart({ series, color, gradId, loading, fmtV }: {
  series: { t: number; v: number }[]; color: string; gradId: string; loading: boolean;
  /** 给了就在图上标出纵轴的最高/最低（收益率这类「数值本身要看清」的场景用）。不给则跟原来一样。 */
  fmtV?: (v: number) => string;
}) {
  const chart = useMemo(() => spark(series.map((s) => s.v), 640, 180, fmtV ? 50 : 6), [series, !!fmtV]);
  const hi = useMemo(() => (series.length ? Math.max(...series.map((s) => s.v)) : 0), [series]);
  const lo = useMemo(() => (series.length ? Math.min(...series.map((s) => s.v)) : 0), [series]);
  if (series.length <= 1) return <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "40px 0", textAlign: "center" }}>{loading ? "加载中…" : "暂无走势数据"}</div>;
  return (
    <>
      <svg viewBox="0 0 640 180" style={{ width: "100%", height: 180, display: "block", overflow: "visible" }}>
        <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {/* 收益率这类要看清数值的，左边留一条刻度槽，标出区间最高/最低 */}
        {fmtV && [{ v: hi, y: 6 }, { v: lo, y: 174 }].map((m) => (
          <g key={m.y}>
            <line x1="50" x2="640" y1={m.y} y2={m.y} stroke="var(--separator)" strokeWidth="1" />
            <text x="44" y={m.y + 3.5} textAnchor="end" fontSize="11" fill="var(--text-tertiary)">{fmtV(m.v)}</text>
          </g>
        ))}
        <path d={chart.area} fill={`url(#${gradId})`} />
        <path d={chart.line} fill="none" stroke={color} strokeWidth="2" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}><span>{fmtDate(series[0].t)}</span><span>{fmtDate(series[series.length - 1].t)}</span></div>
    </>
  );
}
function ErrCard({ msg }: { msg?: string }) {
  return (
    <div className="fv-rise" style={{ ...rise(40), ...card, padding: "40px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5, lineHeight: 1.8 }}>
      {msg || "暂时取不到行情"}。<br />这一页需要联网读取公开行情；确认网络后点右上「刷新」。
    </div>
  );
}
function Bar({ caption, onRefresh, loading }: { caption: string; onRefresh: () => void; loading: boolean }) {
  return (
    <div className="fv-rise" style={{ ...rise(0), display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>{caption}</div>
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onRefresh} disabled={loading}><IconRefresh size={14} />{loading ? "刷新中…" : "刷新"}</Btn>
    </div>
  );
}

// ── 黄金 ────────────────────────────────────────────────────
function GoldView() {
  const [range, setRange] = useState<Range>("3mo");
  const [unit, setUnit] = useState<"usd" | "cny">("usd");
  const [g, setG] = useState<Gold | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try { const res = await fetch("/api/gold?range=" + r, { cache: "no-store" }); setG(await res.json()); }
    catch { setG({ ok: false, error: "取数失败（需联网）" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(range); }, [load, range]);

  const usd = g?.usdPerOz ?? null;
  const cnyOz = usd != null && g?.usdCny != null ? usd * g.usdCny : null;
  const cnyG = cnyOz != null ? cnyOz / OZ_G : null;
  const prev = g?.prevClose ?? null;
  const chg = usd != null && prev ? usd - prev : null;
  const chgPct = usd != null && prev ? ((usd - prev) / prev) * 100 : null;
  const up = (chg ?? 0) > 0, down = (chg ?? 0) < 0;
  const col = up ? "var(--green)" : down ? "var(--red)" : "var(--text-secondary)";
  const series = useMemo(() => (g?.history ?? []).map((p) => ({ t: p.t, v: unit === "cny" && g?.usdCny != null ? (p.usd * g.usdCny) / OZ_G : p.usd })), [g, unit]);

  return (
    <>
      <Bar caption={"黄金行情 · 国际现货 · 仅供参考" + updatedAt(g?.asOf)} onRefresh={() => load(range)} loading={loading} />
      {g && !g.ok ? <ErrCard msg={g.error} /> : (
        <>
          <div className="fv-rise" style={{ ...rise(50), ...card, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>黄金 / 美元</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>${fmt(usd)}<span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 400 }}> /盎司</span></span>
              {chgPct != null && <span style={{ fontSize: 14, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums" }}>{up ? "▲" : down ? "▼" : ""} {fmt(Math.abs(chg ?? 0))} ({up ? "+" : ""}{fmt(chgPct)}%)</span>}
            </div>
            <div style={{ display: "flex", gap: 30, marginTop: 16, flexWrap: "wrap" }}>
              <Stat k="黄金 / 人民币" v={`¥${fmt(cnyG)}`} sub="每克" />
              <Stat k="黄金 / 人民币" v={`¥${fmt(cnyOz, 0)}`} sub="每盎司" />
              <Stat k="美元兑人民币" v={fmt(g?.usdCny, 4)} sub="USD/CNY" />
            </div>
          </div>
          <div className="fv-rise" style={{ ...rise(110), ...card, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>走势</div>
              <div style={{ flex: 1 }} />
              <Segmented value={unit} onChange={(v) => setUnit(v as "usd" | "cny")} style={{ width: 170 }} options={[{ value: "usd", label: "美元/盎司" }, { value: "cny", label: "人民币/克" }]} />
              <Segmented value={range} onChange={(v) => setRange(v as Range)} style={{ width: 248 }} options={RANGES} />
            </div>
            <TrendChart series={series} color="#E0A050" gradId="goldgrad" loading={loading} />
          </div>
        </>
      )}
      <Note>数据：国际现货金（Yahoo Finance · GC=F）+ 美元兑人民币（frankfurter），<strong>都不需要 API Key</strong>，由本机 run.py 代取。<br />「黄金/人民币」按国际金价折算（1 盎司 = 31.1035 克），与境内上海金(Au99.99)实盘略有差异，仅供参考。</Note>
    </>
  );
}

// ── 比特币 ──────────────────────────────────────────────────
function BtcView() {
  const [range, setRange] = useState<Range>("3mo");
  const [unit, setUnit] = useState<"usd" | "cny">("usd");
  const [b, setB] = useState<Btc | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try { const res = await fetch("/api/btc?range=" + r, { cache: "no-store" }); setB(await res.json()); }
    catch { setB({ ok: false, error: "取数失败（需联网）" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(range); }, [load, range]);

  const usd = b?.usd ?? null;
  const cny = usd != null && b?.usdCny != null ? usd * b.usdCny : null;
  const prev = b?.prevClose ?? null;
  const chg = usd != null && prev ? usd - prev : null;
  const chgPct = usd != null && prev ? ((usd - prev) / prev) * 100 : null;
  const up = (chg ?? 0) > 0, down = (chg ?? 0) < 0;
  const col = up ? "var(--green)" : down ? "var(--red)" : "var(--text-secondary)";
  const series = useMemo(() => (b?.history ?? []).map((p) => ({ t: p.t, v: unit === "cny" && b?.usdCny != null ? p.usd * b.usdCny : p.usd })), [b, unit]);

  return (
    <>
      <Bar caption={"比特币 · BTC/USD · 仅供参考" + updatedAt(b?.asOf)} onRefresh={() => load(range)} loading={loading} />
      {b && !b.ok ? <ErrCard msg={b.error} /> : (
        <>
          <div className="fv-rise" style={{ ...rise(50), ...card, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>比特币 / 美元</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>${fmt(usd, 0)}</span>
              {chgPct != null && <span style={{ fontSize: 14, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums" }}>{up ? "▲" : down ? "▼" : ""} {fmt(Math.abs(chg ?? 0), 0)} ({up ? "+" : ""}{fmt(chgPct)}%)</span>}
            </div>
            <div style={{ display: "flex", gap: 30, marginTop: 16, flexWrap: "wrap" }}>
              <Stat k="比特币 / 人民币" v={`¥${fmt(cny, 0)}`} sub="每枚" />
              <Stat k="美元兑人民币" v={fmt(b?.usdCny, 4)} sub="USD/CNY" />
            </div>
          </div>
          <div className="fv-rise" style={{ ...rise(110), ...card, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>走势</div>
              <div style={{ flex: 1 }} />
              <Segmented value={unit} onChange={(v) => setUnit(v as "usd" | "cny")} style={{ width: 150 }} options={[{ value: "usd", label: "美元" }, { value: "cny", label: "人民币" }]} />
              <Segmented value={range} onChange={(v) => setRange(v as Range)} style={{ width: 248 }} options={RANGES} />
            </div>
            <TrendChart series={series} color="#F7931A" gradId="btcgrad" loading={loading} />
          </div>
        </>
      )}
      <Note>数据：比特币 BTC/USD（Yahoo Finance · BTC-USD，降级 Coinbase）+ 美元兑人民币（frankfurter），<strong>都不需要 API Key</strong>，由本机 run.py 代取。加密资产波动剧烈，仅供参考。</Note>
    </>
  );
}

// ── 美元汇率 ────────────────────────────────────────────────
const FX_NAMES: Record<string, string> = { CNY: "人民币", EUR: "欧元", JPY: "日元", HKD: "港币", GBP: "英镑", KRW: "韩元", TWD: "新台币", AUD: "澳元" };
const FX_ORDER = ["CNY", "EUR", "JPY", "HKD", "GBP", "AUD", "TWD", "KRW"];
const fmtRate = (v: number) => fmt(v, v >= 100 ? 1 : v >= 10 ? 3 : 4);

function FxView() {
  const [range, setRange] = useState<Range>("3mo");
  const [fx, setFx] = useState<Fx | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try { const res = await fetch("/api/fx?range=" + r, { cache: "no-store" }); setFx(await res.json()); }
    catch { setFx({ ok: false, error: "取数失败（需联网）" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(range); }, [load, range]);

  const cny = fx?.cny ?? fx?.rates?.CNY ?? null;
  const hist = fx?.history ?? [];
  const prev = hist.length >= 2 ? hist[hist.length - 2].usd : null;
  const chg = cny != null && prev ? cny - prev : null;
  const chgPct = cny != null && prev ? ((cny - prev) / prev) * 100 : null;
  const up = (chg ?? 0) > 0, down = (chg ?? 0) < 0;
  const col = up ? "var(--green)" : down ? "var(--red)" : "var(--text-secondary)";
  const rates = fx?.rates ?? {};
  const others = FX_ORDER.filter((k) => k !== "CNY" && rates[k] != null);
  const series = useMemo(() => hist.map((p) => ({ t: p.t, v: p.usd })), [hist]);

  return (
    <>
      <Bar caption={"美元汇率 · 1 美元可兑换 · 仅供参考" + updatedAt(fx?.asOf)} onRefresh={() => load(range)} loading={loading} />
      {fx && !fx.ok ? <ErrCard msg={fx.error} /> : (
        <>
          <div className="fv-rise" style={{ ...rise(50), ...card, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>美元 / 人民币</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>¥{fmt(cny, 4)}</span>
              {chgPct != null && <span style={{ fontSize: 14, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums" }}>{up ? "▲" : down ? "▼" : ""} {fmt(Math.abs(chg ?? 0), 4)} ({up ? "+" : ""}{fmt(chgPct)}%)</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "14px 24px", marginTop: 18 }}>
              {others.map((k) => <Stat key={k} k={`美元 / ${FX_NAMES[k] || k}`} v={fmtRate(rates[k])} sub={`USD/${k}`} />)}
            </div>
          </div>
          <div className="fv-rise" style={{ ...rise(110), ...card, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>美元 / 人民币 走势</div>
              <div style={{ flex: 1 }} />
              <Segmented value={range} onChange={(v) => setRange(v as Range)} style={{ width: 248 }} options={RANGES} />
            </div>
            <TrendChart series={series} color="var(--accent)" gradId="fxgrad" loading={loading} />
          </div>
        </>
      )}
      <Note>数据：欧洲央行参考汇率（frankfurter，降级 er-api），<strong>不需要 API Key</strong>，由本机 run.py 代取。为银行间中间价，和你换汇时的牌价略有差异，仅供参考。</Note>
    </>
  );
}

// ── 美债收益率 ──────────────────────────────────────────────
/** "10Y" → "10年"、"3M" → "3月" */
const tenorLabel = (k: string) => k.replace(/^([\d.]+)M$/, "$1月").replace(/^([\d.]+)Y$/, "$1年");
const pct = (v: number | null | undefined, d = 2) => (v == null || isNaN(v) ? "—" : v.toFixed(d) + "%");
/** 收益率的涨跌习惯用「基点」说：1bp = 0.01% */
const bp = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "bp";
// 走势图里可选的几档；末尾那项是 10年 减 2年 的利差（长短端倒挂与否看它）
const UST_LINES = [{ value: "10Y", label: "10年" }, { value: "2Y", label: "2年" }, { value: "5Y", label: "5年" }, { value: "30Y", label: "30年" }, { value: "3M", label: "3月" }, { value: "SPREAD", label: "10年–2年" }];
// 曲线图上标哪些档位（全标的话手机上字会挤成一团）
const CURVE_LABELS_WIDE = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
const CURVE_LABELS_PHONE = ["3M", "1Y", "2Y", "5Y", "10Y", "30Y"];

/** 收益率曲线：横轴是期限（等距排开），纵轴是收益率；几条线靠虚实区分，不单靠颜色。 */
function CurveChart({ curves, tenors, phone }: { curves: UstCurve[]; tenors: { key: string; months: number }[]; phone: boolean }) {
  const keys = tenors.map((t) => t.key).filter((k) => curves.some((c) => c.y[k] != null));
  const geom = useMemo(() => {
    const vals = curves.flatMap((c) => keys.map((k) => c.y[k]).filter((v): v is number => v != null));
    if (!vals.length || keys.length < 2) return null;
    const W = 640, H = 210, L = 44, R = 10, T = 14, B = 34;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const pad = (mx - mn) * 0.18 || 0.2;
    const lo = mn - pad, hi = mx + pad;
    const x = (i: number) => L + (i / (keys.length - 1)) * (W - L - R);
    const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const lines = curves.map((c) => {
      let d = "", started = false;
      keys.forEach((k, i) => { const v = c.y[k]; if (v == null) return; d += (started ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; started = true; });
      return { date: c.date, d: d.trim(), dots: keys.map((k, i) => ({ k, v: c.y[k], x: x(i), y: c.y[k] != null ? y(c.y[k]) : 0 })).filter((p) => p.v != null) };
    });
    const ticks = [0, 0.5, 1].map((f) => { const v = hi - f * (hi - lo); return { v, y: y(v) }; });
    return { W, H, L, R, x, y, lines, ticks };
  }, [curves, keys.join(",")]);

  if (!geom) return <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "40px 0", textAlign: "center" }}>暂无曲线数据</div>;
  const labelSet = phone ? CURVE_LABELS_PHONE : CURVE_LABELS_WIDE;
  // 最新那条实线，往前的依次虚线、点线——靠线型区分而不是只靠颜色，色觉障碍也分得出
  const dash: (string | undefined)[] = [undefined, "5 4", "2 3"];
  return (
    <>
      <svg viewBox={`0 0 ${geom.W} ${geom.H}`} style={{ width: "100%", height: phone ? 168 : 210, display: "block", overflow: "visible" }}>
        {geom.ticks.map((t, i) => (
          <g key={i}>
            <line x1={geom.L} x2={geom.W - geom.R} y1={t.y} y2={t.y} stroke="var(--separator)" strokeWidth="1" />
            <text x={geom.L - 6} y={t.y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-tertiary)">{t.v.toFixed(2)}</text>
          </g>
        ))}
        {geom.lines.map((ln, i) => (
          <g key={ln.date}>
            <path d={ln.d} fill="none" strokeDasharray={dash[i % dash.length]}
              stroke={i === 0 ? "var(--accent)" : "var(--text-tertiary)"} strokeWidth={i === 0 ? 2.4 : 1.6}
              strokeLinecap="round" strokeLinejoin="round" opacity={i === 0 ? 1 : 0.75} />
            {i === 0 && ln.dots.map((p) => <circle key={p.k} cx={p.x} cy={p.y} r="2.8" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="1.8" />)}
          </g>
        ))}
        {keys.map((k, i) => labelSet.includes(k) && (
          <text key={k} x={geom.x(i)} y={geom.H - 12} textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)">{tenorLabel(k)}</text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 11.5, color: "var(--text-tertiary)" }}>
        {geom.lines.map((ln, i) => (
          <span key={ln.date} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="22" height="8" style={{ flex: "none" }}><line x1="0" y1="4" x2="22" y2="4" strokeDasharray={dash[i % dash.length]} stroke={i === 0 ? "var(--accent)" : "var(--text-tertiary)"} strokeWidth={i === 0 ? 2.4 : 1.6} /></svg>
            {ln.date}{i === 0 ? "（最新）" : ""}
          </span>
        ))}
      </div>
    </>
  );
}

function UstView() {
  const phone = useBreakpoint() === "phone";
  const [range, setRange] = useState<Range>("6mo");
  const [line, setLine] = useState("10Y");
  const [u, setU] = useState<Ust | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try { const res = await fetch("/api/ust?range=" + r, { cache: "no-store" }); setU(await res.json()); }
    catch { setU({ ok: false, error: "取数失败（需联网）" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(range); }, [load, range]);

  const y = u?.latest?.y ?? {};
  const yPrev = u?.prev?.y ?? {};
  const ten = y["10Y"] ?? null;
  const chg = ten != null && yPrev["10Y"] != null ? ten - yPrev["10Y"] : null;
  const up = (chg ?? 0) > 0, down = (chg ?? 0) < 0;
  const col = up ? "var(--red)" : down ? "var(--green)" : "var(--text-secondary)";   // 收益率涨=债价跌，用红
  const spread = y["10Y"] != null && y["2Y"] != null ? y["10Y"] - y["2Y"] : null;
  const inverted = spread != null && spread < 0;

  // 走势：选了利差就用 10年 减 2年 按日期对齐算，否则直接取那一档
  const series = useMemo(() => {
    const h = u?.history ?? {};
    if (line !== "SPREAD") return (h[line] ?? []).map((p) => ({ t: p.t, v: p.usd }));
    const two = new Map((h["2Y"] ?? []).map((p) => [p.t, p.usd]));
    return (h["10Y"] ?? []).filter((p) => two.has(p.t)).map((p) => ({ t: p.t, v: p.usd - (two.get(p.t) as number) }));
  }, [u, line]);
  const avail = UST_LINES.filter((o) => (o.value === "SPREAD" ? (u?.history?.["10Y"] && u?.history?.["2Y"]) : u?.history?.[o.value]));
  const lineLabel = UST_LINES.find((o) => o.value === line)?.label ?? line;

  return (
    <>
      <Bar caption={"美债收益率 · 美国国债即期收益率 · 仅供参考" + updatedAt(u?.asOf)} onRefresh={() => load(range)} loading={loading} />
      {u && !u.ok ? <ErrCard msg={u.error} /> : (
        <>
          <div className="fv-rise" style={{ ...rise(50), ...card, padding: phone ? "16px 16px" : "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>10 年期</span>
              <span style={{ fontSize: phone ? 26 : 30, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{pct(ten)}</span>
              {chg != null && <span style={{ fontSize: 14, fontWeight: 600, color: col, fontVariantNumeric: "tabular-nums" }}>{up ? "▲" : down ? "▼" : ""} {bp(chg)}</span>}
              {u?.latest?.date && <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{u.latest.date}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${phone ? 96 : 120}px, 1fr))`, gap: "14px 20px", marginTop: 18 }}>
              {["3M", "2Y", "5Y", "10Y", "30Y"].map((k) => y[k] != null && <Stat key={k} k={tenorLabel(k) + "期"} v={pct(y[k])} sub={k} />)}
              {spread != null && <Stat k="10年 − 2年 利差" v={(spread >= 0 ? "+" : "−") + Math.abs(spread * 100).toFixed(0) + "bp"} sub={inverted ? "倒挂" : "正常"} />}
            </div>
            {inverted && (
              <div style={{ marginTop: 14, fontSize: 12, color: "var(--orange)", lineHeight: 1.7, background: "var(--fill-quaternary)", borderRadius: 9, padding: "9px 12px" }}>
                长短端倒挂：10 年期收益率低于 2 年期。历史上出现过几次后跟着经济放缓，但它不预测时间点，也不是买卖建议。
              </div>
            )}
            {u?.partial && u?.note && <div style={{ marginTop: 12, fontSize: 12, color: "var(--orange)" }}>{u.note}</div>}
          </div>

          <div className="fv-rise" style={{ ...rise(110), ...card, padding: phone ? "16px 14px" : "18px 22px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{lineLabel}走势</div>
              <div style={{ flex: 1 }} />
              <Segmented value={range} onChange={(v) => setRange(v as Range)} style={{ width: phone ? "100%" : 248 }} options={RANGES} />
            </div>
            {avail.length > 1 && (
              <div className="fv-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
                {avail.map((o) => (
                  <button key={o.value} type="button" className="fv-tap" onClick={() => setLine(o.value)}
                    style={{
                      flex: "none", padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
                      border: line === o.value ? "1px solid var(--accent)" : "0.5px solid var(--separator-strong)",
                      background: line === o.value ? "var(--accent-soft)" : "transparent",
                      color: line === o.value ? "var(--accent)" : "var(--text-secondary)", fontWeight: line === o.value ? 600 : 500,
                    }}>{o.label}</button>
                ))}
              </div>
            )}
            <TrendChart series={series} color={line === "SPREAD" ? "var(--orange)" : "var(--accent)"} gradId="ustgrad" loading={loading} fmtV={(v) => v.toFixed(2) + "%"} />
            {line === "SPREAD" && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 8, lineHeight: 1.7 }}>低于 0 就是倒挂（10 年期比 2 年期还低）。</div>}
          </div>

          {(u?.curves?.length ?? 0) > 0 && (
            <div className="fv-rise" style={{ ...rise(170), ...card, padding: phone ? "16px 14px" : "18px 22px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>收益率曲线</div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 14, lineHeight: 1.7 }}>
                各期限的收益率连起来，就是这条曲线；拿现在和之前比，能看出是整条抬升/下移，还是长短端在分化。
              </div>
              <CurveChart curves={u!.curves!} tenors={u!.tenors ?? []} phone={phone} />
            </div>
          )}
        </>
      )}
      <Note>
        数据：美国财政部每日收益率曲线（home.treasury.gov 官方 CSV，取不到时降级 Yahoo 收益率指数），<strong>都不需要 API Key</strong>，由本机 run.py 代取。
        <br />收益率按年化百分比计，1bp = 0.01%。为二级市场即期收益率，和你实际买入的价格、票息、税费无关，仅供参考，不构成投资建议。
      </Note>
    </>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 16 }}>{children} 本页需要联网。</div>;
}
function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}<span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 4 }}>{sub}</span></div>
    </div>
  );
}
