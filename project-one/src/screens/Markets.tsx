import { useCallback, useEffect, useMemo, useState } from "react";
import { rise } from "../lib/anim";
import { Btn, card, Segmented } from "../ui";
import { IconRefresh } from "../icons";

type Pt = { t: number; usd: number };
type Gold = { ok: boolean; usdPerOz?: number; prevClose?: number | null; history?: Pt[]; usdCny?: number | null; asOf?: number; src?: string; error?: string };
type Range = "1mo" | "3mo" | "6mo" | "1y";

const RANGES = [{ value: "1mo", label: "近1月" }, { value: "3mo", label: "近3月" }, { value: "6mo", label: "近6月" }, { value: "1y", label: "近1年" }];
const OZ_G = 31.1035;
const fmt = (n: number | null | undefined, d = 2) => (n == null || isNaN(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

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
  const [range, setRange] = useState<Range>("3mo");
  const [unit, setUnit] = useState<"usd" | "cny">("usd");
  const [g, setG] = useState<Gold | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try { const res = await fetch("/api/gold?range=" + r, { cache: "no-store" }); setG(await res.json()); }
    catch (e) { setG({ ok: false, error: "取数失败（需联网）" }); }
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
  const chart = useMemo(() => spark(series.map((s) => s.v), 640, 180), [series]);

  return (
    <div style={{ padding: "24px 32px 40px", maxWidth: 820 }}>
      <div className="fv-rise" style={{ ...rise(0), display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>黄金行情 · 国际现货 · 仅供参考{g?.asOf ? ` · 更新于 ${new Date(g.asOf).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}</div>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={() => load(range)} disabled={loading}><IconRefresh size={14} />{loading ? "刷新中…" : "刷新"}</Btn>
      </div>

      {g && !g.ok ? (
        <div className="fv-rise" style={{ ...rise(40), ...card, padding: "40px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13.5, lineHeight: 1.8 }}>
          {g.error || "暂时取不到金价"}。<br />这一页需要联网读取公开行情；确认网络后点右上「刷新」。
        </div>
      ) : (
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
            {series.length > 1 ? (
              <>
                <svg viewBox="0 0 640 180" style={{ width: "100%", height: 180, display: "block" }}>
                  <defs><linearGradient id="goldgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E0A050" stopOpacity="0.28" /><stop offset="1" stopColor="#E0A050" stopOpacity="0" /></linearGradient></defs>
                  <path d={chart.area} fill="url(#goldgrad)" />
                  <path d={chart.line} fill="none" stroke="#E0A050" strokeWidth="2" />
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}><span>{fmtDate(series[0].t)}</span><span>{fmtDate(series[series.length - 1].t)}</span></div>
              </>
            ) : <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", padding: "40px 0", textAlign: "center" }}>{loading ? "加载中…" : "暂无走势数据"}</div>}
          </div>
        </>
      )}

      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 16 }}>
        数据：国际现货金（Yahoo Finance · GC=F）+ 美元兑人民币（frankfurter），<strong>都不需要 API Key</strong>，由本机 run.py 代取（避免浏览器跨域）。<br />
        「黄金/人民币」按国际金价折算（1 盎司 = 31.1035 克），与境内上海金(Au99.99)实盘略有差异，仅供参考。本页需要联网。
      </div>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}<span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 4 }}>{sub}</span></div>
    </div>
  );
}
