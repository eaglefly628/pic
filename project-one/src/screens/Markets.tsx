import { useCallback, useEffect, useMemo, useState } from "react";
import { rise } from "../lib/anim";
import { Btn, card, Segmented } from "../ui";
import { IconRefresh } from "../icons";

type Pt = { t: number; usd: number };  // 历史点，值统一放 .usd（金价/币价/汇率通用）
type Range = "1mo" | "3mo" | "6mo" | "1y";
type Gold = { ok: boolean; usdPerOz?: number; prevClose?: number | null; history?: Pt[]; usdCny?: number | null; asOf?: number; src?: string; error?: string };
type Btc = { ok: boolean; usd?: number; prevClose?: number | null; history?: Pt[]; usdCny?: number | null; asOf?: number; error?: string };
type Fx = { ok: boolean; base?: string; rates?: Record<string, number>; cny?: number | null; history?: Pt[]; asOf?: number; error?: string };
type Tab = "gold" | "btc" | "fx";

const RANGES = [{ value: "1mo", label: "近1月" }, { value: "3mo", label: "近3月" }, { value: "6mo", label: "近6月" }, { value: "1y", label: "近1年" }];
const OZ_G = 31.1035;
const fmt = (n: number | null | undefined, d = 2) => (n == null || isNaN(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const updatedAt = (asOf?: number) => (asOf ? ` · 更新于 ${new Date(asOf).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "");

function spark(vals: number[], w: number, h: number) {
  const pad = 6;
  if (vals.length < 2) return { line: "", area: "" };
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const x = (i: number) => pad + (i / (vals.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / rng) * (h - 2 * pad);
  let line = "";
  vals.forEach((v, i) => { line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; });
  const area = line + `L${x(vals.length - 1).toFixed(1)} ${(h - pad).toFixed(1)} L${x(0).toFixed(1)} ${(h - pad).toFixed(1)} Z`;
  return { line: line.trim(), area };
}

export default function Markets() {
  const [tab, setTab] = useState<Tab>("gold");
  return (
    <div style={{ padding: "24px 32px 40px", maxWidth: 820 }}>
      <div className="fv-rise" style={{ ...rise(0), marginBottom: 16 }}>
        <Segmented value={tab} onChange={(v) => setTab(v as Tab)} style={{ width: 300 }}
          options={[{ value: "gold", label: "黄金" }, { value: "btc", label: "比特币" }, { value: "fx", label: "美元汇率" }]} />
      </div>
      {tab === "gold" && <GoldView />}
      {tab === "btc" && <BtcView />}
      {tab === "fx" && <FxView />}
    </div>
  );
}

// ── 通用图表 ────────────────────────────────────────────────
function TrendChart({ series, color, gradId, loading }: { series: { t: number; v: number }[]; color: string; gradId: string; loading: boolean }) {
  const chart = useMemo(() => spark(series.map((s) => s.v), 640, 180), [series]);
  if (series.length <= 1) return <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "40px 0", textAlign: "center" }}>{loading ? "加载中…" : "暂无走势数据"}</div>;
  return (
    <>
      <svg viewBox="0 0 640 180" style={{ width: "100%", height: 180, display: "block" }}>
        <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
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
