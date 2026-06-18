// 财经行情数据层。浏览器直连的关键是 CORS：
//  - 汇率 frankfurter.app（免 key，日级，CORS 友好）
//  - 加密 CoinGecko（免 key，实时，CORS 友好）
//  - 指数/个股/大宗商品/美债 Twelve Data（需免费 key，CORS 友好，实时~15分钟延迟）
// 行情为公开数据，不含任何本地隐私；仅在打开「财经」页时联网拉取。
import type { MarketCategory, MarketSource, WatchItem } from "../vault/types";

export interface Quote {
  status: "ok" | "needkey" | "error";
  price?: number;
  change?: number;
  changePct?: number;
  currency?: string;
  asOf?: string;
}

export const CATEGORY_LABEL: Record<MarketCategory, string> = {
  index: "指数", forex: "外汇", commodity: "大宗商品", bond: "债券 / 美债", stock: "自选股票", crypto: "加密货币",
};
export const CATEGORY_ORDER: MarketCategory[] = ["index", "forex", "commodity", "bond", "stock", "crypto"];

let _uid = 0;
const uid = () => "w" + Date.now().toString(36) + (_uid++).toString(36);

/** 根据品类推断默认数据源 */
export function sourceForCategory(cat: MarketCategory): MarketSource {
  if (cat === "forex") return "frankfurter";
  if (cat === "crypto") return "coingecko";
  return "twelvedata";
}

export function defaultWatch(): WatchItem[] {
  const mk = (symbol: string, name: string, category: MarketCategory): WatchItem =>
    ({ id: uid(), symbol, name, category, source: sourceForCategory(category) });
  return [
    mk("SPY", "标普500 (SPY)", "index"),
    mk("QQQ", "纳指100 (QQQ)", "index"),
    mk("DIA", "道琼斯 (DIA)", "index"),
    mk("USD/CNY", "美元 / 人民币", "forex"),
    mk("USD/JPY", "美元 / 日元", "forex"),
    mk("EUR/USD", "欧元 / 美元", "forex"),
    mk("USD/HKD", "美元 / 港元", "forex"),
    mk("XAU/USD", "黄金 (盎司/美元)", "commodity"),
    mk("XAG/USD", "白银 (盎司/美元)", "commodity"),
    mk("TLT", "美债20年+ (TLT)", "bond"),
    mk("bitcoin", "比特币 BTC", "crypto"),
    mk("ethereum", "以太坊 ETH", "crypto"),
  ];
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

async function fetchCrypto(items: WatchItem[], out: Map<string, Quote>) {
  const ids = [...new Set(items.map((i) => i.symbol))];
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd&include_24hr_change=true`;
    const r = await fetch(url);
    const j = await r.json();
    for (const it of items) {
      const d = j[it.symbol];
      if (d && d.usd != null) out.set(it.id, { status: "ok", price: num(d.usd), changePct: num(d.usd_24h_change), currency: "USD" });
      else out.set(it.id, { status: "error" });
    }
  } catch { for (const it of items) out.set(it.id, { status: "error" }); }
}

async function fetchForex(items: WatchItem[], out: Map<string, Quote>) {
  // frankfurter 按 base 分组：base→[symbol...]
  const byBase = new Map<string, WatchItem[]>();
  for (const it of items) {
    const [from] = it.symbol.split("/");
    (byBase.get(from) ?? byBase.set(from, []).get(from)!).push(it);
  }
  await Promise.all([...byBase.entries()].map(async ([from, group]) => {
    const tos = [...new Set(group.map((g) => g.symbol.split("/")[1]).filter(Boolean))];
    try {
      const r = await fetch(`https://api.frankfurter.app/latest?base=${from}&symbols=${tos.join(",")}`);
      const j = await r.json();
      for (const it of group) {
        const to = it.symbol.split("/")[1];
        const v = j?.rates?.[to];
        if (v != null) out.set(it.id, { status: "ok", price: num(v), currency: to, asOf: j.date });
        else out.set(it.id, { status: "error" });
      }
    } catch { for (const it of group) out.set(it.id, { status: "error" }); }
  }));
}

async function fetchTwelve(items: WatchItem[], apiKey: string | undefined, out: Map<string, Quote>) {
  if (!apiKey) { for (const it of items) out.set(it.id, { status: "needkey" }); return; }
  const symbols = [...new Set(items.map((i) => i.symbol))];
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(","))}&apikey=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    const j = await r.json();
    // 单个符号时返回对象本身，多个时按 symbol 为键
    const pick = (sym: string) => (symbols.length === 1 ? j : j?.[sym]);
    for (const it of items) {
      const d = pick(it.symbol);
      const price = d ? num(d.close ?? d.price) : undefined;
      if (d && price != null && !d.code) {
        out.set(it.id, { status: "ok", price, change: num(d.change), changePct: num(d.percent_change), currency: d.currency, asOf: d.datetime });
      } else {
        out.set(it.id, { status: "error" });
      }
    }
  } catch { for (const it of items) out.set(it.id, { status: "error" }); }
}

/** 拉取整张自选清单的最新行情 */
export async function loadQuotes(watch: WatchItem[], apiKey?: string): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  const crypto = watch.filter((w) => w.source === "coingecko");
  const forex = watch.filter((w) => w.source === "frankfurter");
  const td = watch.filter((w) => w.source === "twelvedata");
  await Promise.all([
    crypto.length ? fetchCrypto(crypto, out) : null,
    forex.length ? fetchForex(forex, out) : null,
    td.length ? fetchTwelve(td, apiKey, out) : null,
  ]);
  return out;
}

export function fmtPrice(q: Quote): string {
  if (q.price == null) return "—";
  const p = q.price;
  const digits = p >= 1000 ? 2 : p >= 1 ? 4 : 6;
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}
