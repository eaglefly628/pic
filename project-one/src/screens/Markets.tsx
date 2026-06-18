import { useCallback, useEffect, useMemo, useState } from "react";
import { useVault } from "../vault/VaultContext";
import type { MarketCategory, MarketConfig, WatchItem } from "../vault/types";
import { loadQuotes, defaultWatch, sourceForCategory, fmtPrice, CATEGORY_LABEL, CATEGORY_ORDER, type Quote } from "../lib/markets";
import { rise } from "../lib/anim";
import { Btn, TextField, Select, card } from "../ui";
import { IconRefresh, IconPlus, IconTrash, IconKey } from "../icons";

const DEFAULT_CFG = (): MarketConfig => ({ refreshSec: 60, watch: defaultWatch(), apiKey: "" });

export default function Markets() {
  const { data, update } = useVault();
  const cfg = data?.markets;
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  // 首次进入：写入默认自选清单
  useEffect(() => { if (data && !data.markets) update((d) => { d.markets = DEFAULT_CFG(); }); }, [data, update]);
  useEffect(() => { setKeyInput(cfg?.apiKey ?? ""); }, [cfg?.apiKey]);

  const mut = useCallback((fn: (m: MarketConfig) => void) => {
    update((d) => { if (!d.markets) d.markets = DEFAULT_CFG(); fn(d.markets); });
  }, [update]);

  const watchKey = cfg?.watch.map((w) => w.id + w.symbol).join("|") ?? "";
  const load = useCallback(async () => {
    if (!cfg || cfg.watch.length === 0) { setQuotes(new Map()); return; }
    setLoading(true);
    try { setQuotes(await loadQuotes(cfg.watch, cfg.apiKey)); setUpdated(Date.now()); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey, cfg?.apiKey]);

  useEffect(() => {
    load();
    const sec = cfg?.refreshSec || 60;
    const t = setInterval(load, sec * 1000);
    return () => clearInterval(t);
  }, [load, cfg?.refreshSec]);

  const grouped = useMemo(() => {
    const g = new Map<MarketCategory, WatchItem[]>();
    for (const w of cfg?.watch ?? []) (g.get(w.category) ?? g.set(w.category, []).get(w.category)!).push(w);
    return CATEGORY_ORDER.filter((c) => g.has(c)).map((c) => [c, g.get(c)!] as const);
  }, [cfg?.watch]);

  const hasKey = !!cfg?.apiKey;
  const needKeyCount = (cfg?.watch ?? []).filter((w) => w.source === "twelvedata").length;

  return (
    <div style={{ padding: "24px 32px 40px" }}>
      {/* 顶部：刷新 / 更新时间 / key */}
      <div className="fv-rise" style={{ ...rise(0), display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
          延迟行情 · 仅供参考{updated ? ` · 更新于 ${new Date(updated).toLocaleTimeString("zh-CN")}` : ""}
        </div>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" className="fv-spin-hover" onClick={load} disabled={loading}><IconRefresh size={14} />{loading ? "刷新中…" : "刷新"}</Btn>
        <Btn variant={hasKey ? "ghost" : "soft"} onClick={() => setShowKey((v) => !v)}><IconKey size={14} stroke="currentColor" />{hasKey ? "API Key 已设置" : "设置 API Key"}</Btn>
      </div>

      {/* API key 面板 */}
      {showKey && (
        <div className="fv-rise" style={{ ...card, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Twelve Data 免费 API Key</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 12 }}>
            指数 / 个股 / 大宗商品 / 美债需要它（汇率与加密货币无需 key）。到 <span style={{ color: "var(--accent)" }}>twelvedata.com</span> 免费注册即可获得（免费额度家用足够）。Key 加密保存在本地金库。
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <TextField value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="粘贴你的 API Key" style={{ fontFamily: "ui-monospace, monospace" }} />
            <Btn onClick={() => { mut((m) => { m.apiKey = keyInput.trim(); }); setShowKey(false); }} style={{ whiteSpace: "nowrap" }}>保存</Btn>
            {hasKey && <Btn variant="ghost" onClick={() => { mut((m) => { m.apiKey = ""; }); setKeyInput(""); }}>清除</Btn>}
          </div>
        </div>
      )}

      {!hasKey && needKeyCount > 0 && (
        <div style={{ fontSize: 12, color: "var(--orange)", marginBottom: 14 }}>
          有 {needKeyCount} 项（指数/商品/美债/个股）需要 API Key 才能显示。汇率与加密货币已可直接查看。
        </div>
      )}

      {/* 行情分组表 */}
      {grouped.map(([cat, items], gi) => (
        <div key={cat} className="fv-rise" style={{ ...rise(60 + gi * 60), ...card, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 18px 10px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {CATEGORY_LABEL[cat]}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>{items.length}</span>
          </div>
          {items.map((w) => <Row key={w.id} item={w} q={quotes.get(w.id)} onRemove={() => mut((m) => { m.watch = m.watch.filter((x) => x.id !== w.id); })} />)}
        </div>
      ))}

      <AddRow onAdd={(it) => mut((m) => { m.watch.push(it); })} />

      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", lineHeight: 1.7, marginTop: 16 }}>
        说明：汇率来自 frankfurter（央行参考价，日级）、加密来自 CoinGecko（实时）、其余来自 Twelve Data（实时~15 分钟延迟）。<br />
        中国国债收益率 / 央行逆回购(OMO) 暂无免费且浏览器可直连的接口，建议手动记录，或日后接入你自己的小代理。
      </div>
    </div>
  );
}

function Row({ item, q, onRemove }: { item: WatchItem; q?: Quote; onRemove: () => void }) {
  const up = (q?.changePct ?? 0) > 0, down = (q?.changePct ?? 0) < 0;
  const color = up ? "var(--green)" : down ? "var(--red)" : "var(--text-secondary)";
  return (
    <div className="fv-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderTop: "0.5px solid var(--separator)", fontSize: 13 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "ui-monospace, monospace" }}>{item.symbol}</div>
      </div>
      {q?.status === "needkey" ? (
        <div style={{ fontSize: 12, color: "var(--orange)" }}>需 API Key</div>
      ) : q?.status === "error" ? (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>取数失败</div>
      ) : (
        <>
          <div style={{ width: 130, textAlign: "right", fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {q ? fmtPrice(q) : "…"}{q?.currency ? <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginLeft: 4 }}>{q.currency}</span> : null}
          </div>
          <div style={{ width: 96, textAlign: "right", fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>
            {q?.changePct != null ? `${up ? "+" : ""}${q.changePct.toFixed(2)}%` : "—"}
          </div>
        </>
      )}
      <button className="fv-icnbtn" onClick={onRemove} title="移除" style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><IconTrash size={14} stroke="currentColor" /></button>
    </div>
  );
}

const CATS: { value: MarketCategory; label: string }[] = [
  { value: "index", label: "指数" }, { value: "stock", label: "股票" }, { value: "forex", label: "外汇" },
  { value: "commodity", label: "大宗商品" }, { value: "bond", label: "债券" }, { value: "crypto", label: "加密货币" },
];

function AddRow({ onAdd }: { onAdd: (it: WatchItem) => void }) {
  const [cat, setCat] = useState<MarketCategory>("stock");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const hint = cat === "forex" ? "如 USD/CNY、EUR/USD" : cat === "crypto" ? "CoinGecko id，如 bitcoin、solana" : "Twelve Data 代码，如 AAPL、00700.HK、XAU/USD";
  const add = () => {
    const s = symbol.trim();
    if (!s) return;
    onAdd({ id: "w" + Date.now().toString(36), symbol: s, name: name.trim() || s, category: cat, source: sourceForCategory(cat) });
    setSymbol(""); setName("");
  };
  return (
    <div className="fv-rise" style={{ ...rise(40), ...card, padding: "14px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>添加自选</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ width: 120 }}><Select value={cat} options={CATS} onChange={(e) => setCat(e.target.value as MarketCategory)} /></div>
        <div style={{ flex: 1, minWidth: 150 }}><TextField value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={hint} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /></div>
        <div style={{ flex: 1, minWidth: 120 }}><TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="显示名（可选）" onKeyDown={(e) => { if (e.key === "Enter") add(); }} /></div>
        <Btn onClick={add}><IconPlus size={15} />添加</Btn>
      </div>
    </div>
  );
}
