// 「我家里的一切」统一服务器 —— run.py 的 Node 版（逐段等价移植，接口/行为/数据目录完全一致）。
// 为苹果上架准备：App 不再依赖系统 Python，Electron 主进程直接 require 本文件内嵌启动。
// 也可独立运行：node desktop/server.js（等价于以前的 python run.py）。
//
//     /            -> hub/index.html（入口页）
//     /finance/*   -> project-one/dist（家庭理财）
//     /gallery/*   -> project-two/dist（家庭影像）
//     /vault/*     -> project-three/dist（家庭密码）
//     /dev/*       -> project-four/dist（男主的开发世界）
//
// 数据全部保存在本机，不联网、不上传（行情/比分按需本机代取）。
"use strict";
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");
const crypto = require("crypto");
const { URL: NodeURL } = require("url");

const PORT = 5180;
const BACKUP_KEEP = 40; // 磁盘上保留的历史备份份数（轮转）
// 数据结构版本：改动数据形状、且旧版本 App 读不了/会写坏时 +1（与 run.py 保持同一个数字）。
const DATA_VERSION = 1;

// ROOT：payload 目录（开发时 = 仓库根目录；打包后由 main.js 传入 Resources/payload）。
let ROOT = path.join(__dirname, "..");
let HUB = "";
let MOUNTS = {};

function setRoot(dir) {
  ROOT = dir;
  HUB = path.join(ROOT, "hub", "index.html");
  MOUNTS = {
    "/finance": path.join(ROOT, "project-one", "dist"),
    "/gallery": path.join(ROOT, "project-two", "dist"),
    "/vault": path.join(ROOT, "project-three", "dist"),
    "/dev": path.join(ROOT, "project-four", "dist"),
  };
}
setRoot(ROOT);

function appVersion() {
  // 版本号单一真源：根目录 VERSION 文件。
  try {
    const v = fs.readFileSync(path.join(ROOT, "VERSION"), "utf-8").trim();
    return v || "0.0.0";
  } catch (e) {
    return "0.0.0";
  }
}

function dataDir() {
  // 本机稳定数据目录——跨版本升级不变（和 run.py 完全相同的路径，老数据直接读到）。
  // macOS: ~/Library/Application Support/我家里的一切
  // Windows: %APPDATA%/我家里的一切     Linux: ~/.local/share/我家里的一切
  const home = os.homedir();
  let base;
  if (process.platform === "win32") base = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  else if (process.platform === "darwin") base = path.join(home, "Library", "Application Support");
  else base = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
  let d = path.join(base, "我家里的一切");
  try {
    fs.mkdirSync(path.join(d, "backups"), { recursive: true });
    return d;
  } catch (e) {
    d = path.join(ROOT, ".home-data");
    fs.mkdirSync(path.join(d, "backups"), { recursive: true });
    return d;
  }
}

function appChannel(override) {
  // 发布版 / 开发版分开：Electron 用参数明确指定；直接跑时按有没有 .git 自动判断。
  if (override === "dev" || override === "release") return override;
  const env = process.env.HOME_CHANNEL;
  if (env === "dev" || env === "release") return env;
  return fs.existsSync(path.join(ROOT, ".git")) ? "dev" : "release";
}

// 运行期状态（start() 时定稿）
let APP_VERSION = "0.0.0";
let APP_CHANNEL = "dev";
let APP_LABEL = "";
let DATA_DIR = "";

function atomicWrite(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true }); // 目录被删/首次写入也能自愈
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p); // 原子替换，避免写一半导致的半损坏文件
}

// 与 run.py 的 json.dumps(sort_keys=True) 等价的规范化序列化，用于「内容没变」判断。
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

function tsName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function rotateBackups() {
  // 轮转按修改时间（备份/冲突两种前缀混在一起时按名字排会删错顺序）
  let files;
  try {
    files = fs.readdirSync(path.join(DATA_DIR, "backups")).filter((f) => f.endsWith(".home"))
      .map((f) => ({ f, m: fs.statSync(path.join(DATA_DIR, "backups", f)).mtimeMs }))
      .sort((a, b) => a.m - b.m);
  } catch (e) { return; }
  for (const x of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) {
    try { fs.unlinkSync(path.join(DATA_DIR, "backups", x.f)); } catch (e) { /* ignore */ }
  }
}

function writeHistory(prefix, data) {
  fs.mkdirSync(path.join(DATA_DIR, "backups"), { recursive: true }); // 运行中目录被删也能自愈
  atomicWrite(path.join(DATA_DIR, "backups", `我家里的一切-${prefix}-${tsName()}.home`), data);
  rotateBackups();
}

function readMeta() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "meta.json"), "utf-8"));
    return m && typeof m === "object" ? m : null;
  } catch (e) {
    return null;
  }
}

const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

function backupSave(raw) {
  // 收下浏览器端打包好的「整屋备份」（各库数据已在浏览器里加密，服务端只当密文存盘）。
  const bundle = JSON.parse(raw.toString("utf-8"));
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle) || !bundle.__home_backup)
    return { ok: false, error: "不是本系统的备份数据" };
  // 传输层标记（不落盘）：baseSavedAt=客户端上次同步到的磁盘时间戳；force=用户明确要求以这份为准；
  // conflictOnly=只存成历史备份、不动 current（覆盖前给旧状态留底用）。
  const baseSavedAt = typeof bundle.baseSavedAt === "number" ? bundle.baseSavedAt : null;
  const force = Boolean(bundle.force);
  const conflictOnly = Boolean(bundle.conflictOnly);
  delete bundle.baseSavedAt; delete bundle.force; delete bundle.conflictOnly;
  const content = (b) => canonical({ localStorage: b.localStorage ?? null, indexedDB: b.indexedDB ?? null });
  const newContent = content(bundle);
  const newHash = sha256(newContent);
  if (conflictOnly) {
    bundle.dataVersion = DATA_VERSION; bundle.appVersion = APP_VERSION; bundle.appChannel = APP_CHANNEL; bundle.savedAt = Date.now();
    writeHistory("冲突", Buffer.from(JSON.stringify(bundle), "utf-8"));
    return { ok: true, conflictOnly: true, dir: DATA_DIR };
  }
  // 快路径：meta.json 里存了上次写盘内容的哈希，命中即「没变化」，免去整读整比（省掉热路径三倍序列化）。
  const meta = readMeta();
  if (meta && meta.contentHash === newHash && typeof meta.savedAt === "number")
    return { ok: true, savedAt: meta.savedAt, bytes: meta.bytes || 0, dir: DATA_DIR, unchanged: true };
  const oldRaw = backupLatest();
  let old = null;
  if (oldRaw !== null) {
    try {
      old = JSON.parse(oldRaw.toString("utf-8"));
    } catch (e) {
      old = null;
    }
    if (old && typeof old === "object" && !Array.isArray(old)) {
      // 兼容护栏：磁盘上是更高数据版本(更新的 App)写的 → 本(旧)入口拒绝覆盖，避免写坏
      const storedDv = parseInt(old.dataVersion || 0, 10) || 0;
      if (storedDv > DATA_VERSION)
        return { ok: false, error: "reject-downgrade", storedDataVersion: storedDv, myDataVersion: DATA_VERSION,
                 hint: "磁盘上的数据是更新版本的 App 写的，本入口版本偏旧、已拒绝覆盖。请把本入口也更新到最新。" };
      // 内容没变就不更新时间戳——否则多入口会因时间戳变化互相触发无谓的“恢复”。
      if (content(old) === newContent)
        return { ok: true, savedAt: old.savedAt, bytes: oldRaw.length, dir: DATA_DIR, unchanged: true };
      // 过期写护栏：客户端声明了它基于哪个磁盘版本（baseSavedAt），但磁盘已被另一个入口写过
      // （时间戳对不上、内容也不同）→ 不覆盖 current，把这份存成「冲突」历史备份，让客户端先拉新数据。
      if (!force && baseSavedAt !== null && (old.savedAt || 0) !== baseSavedAt) {
        bundle.dataVersion = DATA_VERSION; bundle.appVersion = APP_VERSION; bundle.appChannel = APP_CHANNEL; bundle.savedAt = Date.now();
        writeHistory("冲突", Buffer.from(JSON.stringify(bundle), "utf-8"));
        return { ok: false, error: "stale-write", diskSavedAt: old.savedAt || 0, conflictSaved: true,
                 hint: "磁盘上有另一个入口存的更新数据；这份修改已存入历史备份，请先同步最新数据。" };
      }
    }
  }
  bundle.dataVersion = DATA_VERSION;
  bundle.appVersion = APP_VERSION;
  bundle.appChannel = APP_CHANNEL;
  bundle.savedAt = Date.now();
  const data = Buffer.from(JSON.stringify(bundle), "utf-8");
  fs.mkdirSync(path.join(DATA_DIR, "backups"), { recursive: true });
  atomicWrite(path.join(DATA_DIR, "current.home"), data);
  writeHistory("备份", data);
  try {
    fs.writeFileSync(path.join(DATA_DIR, "meta.json"),
      JSON.stringify({ appVersion: APP_VERSION, savedAt: bundle.savedAt, bytes: data.length, dataVersion: DATA_VERSION, contentHash: newHash }));
  } catch (e) { /* ignore */ }
  return { ok: true, savedAt: bundle.savedAt, bytes: data.length, dir: DATA_DIR };
}

function backupLatest() {
  const p = path.join(DATA_DIR, "current.home");
  try {
    return fs.statSync(p).isFile() ? fs.readFileSync(p) : null;
  } catch (e) {
    return null;
  }
}

function backupList() {
  let items = [];
  try {
    items = fs.readdirSync(path.join(DATA_DIR, "backups")).filter((f) => f.endsWith(".home")).map((name) => {
      const st = fs.statSync(path.join(DATA_DIR, "backups", name));
      return { name, bytes: st.size, mtime: Math.floor(st.mtimeMs) };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch (e) { /* ignore */ }
  const cur = path.join(DATA_DIR, "current.home");
  let curM = null;
  try { curM = Math.floor(fs.statSync(cur).mtimeMs); } catch (e) { /* ignore */ }
  return { ok: true, version: APP_VERSION, dir: DATA_DIR, current: curM, backups: items };
}

function resolveStatic(p0) {
  const p = p0.split("?")[0].split("#")[0];
  if (p === "/" || p === "/index.html") return HUB;
  for (const [prefix, base] of Object.entries(MOUNTS)) {
    if (p === prefix || p.startsWith(prefix + "/")) {
      const rel = p.slice(prefix.length).replace(/^\/+/, "") || "index.html";
      let target = path.resolve(base, rel);
      try { if (fs.statSync(target).isDirectory()) target = path.join(target, "index.html"); } catch (e) { /* fallthrough */ }
      // 防目录穿越
      const baseR = path.resolve(base);
      if ((target === baseR || target.startsWith(baseR + path.sep)) && fs.existsSync(target) && fs.statSync(target).isFile())
        return target;
      return null;
    }
  }
  return null;
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".map": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".wasm": "application/wasm",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg",
};

// ─────────────────────────── 行情：金价 / 比特币 / 汇率（本机代取，无需 API key）──────────
async function getJson(url, timeoutMs = 10000) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return await r.json();
}

async function yahooChart(symbol, rng = "3mo") {
  // Yahoo 日线收盘：现价 + 前收 + 历史（统一收在 history[].usd 里，复用前端图表逻辑）。
  const y = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${rng}&interval=1d`);
  const res = y.chart.result[0];
  const meta = res.meta || {};
  const ts = res.timestamp || [];
  const closes = ((res.indicators || {}).quote || [{}])[0].close || [];
  const hist = [];
  for (let i = 0; i < Math.min(ts.length, closes.length); i++)
    if (closes[i] !== null && closes[i] !== undefined) hist.push({ t: ts[i] * 1000, usd: closes[i] });
  return {
    price: meta.regularMarketPrice ?? (hist.length ? hist[hist.length - 1].usd : null),
    prevClose: meta.chartPreviousClose ?? null,
    history: hist,
  };
}

async function usdCny() {
  // 美元兑人民币（两个免费源，谁通用用谁，都不要 key）。
  for (const url of ["https://api.frankfurter.app/latest?from=USD&to=CNY", "https://open.er-api.com/v6/latest/USD"]) {
    try {
      return (await getJson(url)).rates.CNY;
    } catch (e) { /* try next */ }
  }
  return null;
}

async function fetchGold(rng = "3mo") {
  const out = { ok: false };
  try {
    const q = await yahooChart("GC=F", rng); // 金价 + 历史：Yahoo 国际现货金期货 GC=F
    Object.assign(out, { usdPerOz: q.price, prevClose: q.prevClose, history: q.history, src: "yahoo" });
  } catch (e) {
    try { // 降级：只取现价
      const g = await getJson("https://api.gold-api.com/price/XAU");
      Object.assign(out, { usdPerOz: g.price ?? null, prevClose: null, history: [], src: "gold-api" });
    } catch (e2) {
      return { ok: false, error: "金价获取失败（需联网）" };
    }
  }
  out.usdCny = await usdCny();
  out.ok = out.usdPerOz !== null && out.usdPerOz !== undefined;
  out.asOf = Date.now();
  return out;
}

async function fetchBtc(rng = "3mo") {
  const out = { ok: false };
  try {
    const q = await yahooChart("BTC-USD", rng);
    Object.assign(out, { usd: q.price, prevClose: q.prevClose, history: q.history, src: "yahoo" });
  } catch (e) {
    try {
      const c = await getJson("https://api.coinbase.com/v2/prices/BTC-USD/spot");
      Object.assign(out, { usd: parseFloat(c.data.amount), prevClose: null, history: [], src: "coinbase" });
    } catch (e2) {
      return { ok: false, error: "比特币价格获取失败（需联网）" };
    }
  }
  out.usdCny = await usdCny();
  out.ok = out.usd !== null && out.usd !== undefined;
  out.asOf = Date.now();
  return out;
}

const FX_SYMBOLS = ["CNY", "EUR", "JPY", "HKD", "GBP", "KRW", "TWD", "AUD"];
async function fetchFx(rng = "3mo") {
  const out = { ok: false, base: "USD" };
  let rates = {};
  try {
    const j = await getJson(`https://api.frankfurter.app/latest?from=USD&to=${FX_SYMBOLS.join(",")}`);
    rates = j.rates || {};
  } catch (e) {
    try {
      const allr = (await getJson("https://open.er-api.com/v6/latest/USD")).rates || {};
      for (const k of FX_SYMBOLS) if (k in allr) rates[k] = allr[k];
    } catch (e2) {
      return { ok: false, error: "汇率获取失败（需联网）" };
    }
  }
  out.rates = rates;
  out.cny = rates.CNY ?? null;
  const hist = []; // USD/CNY 走势（frankfurter 时间序列，开区间到今天）
  try {
    const days = { "1mo": 32, "3mo": 95, "6mo": 190, "1y": 370 }[rng] || 95;
    const start = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10);
    const r = (await getJson(`https://api.frankfurter.app/${start}..?from=USD&to=CNY`)).rates || {};
    for (const d of Object.keys(r).sort()) {
      const v = r[d].CNY;
      if (v !== null && v !== undefined) hist.push({ t: Date.parse(d + "T00:00:00"), usd: v });
    }
  } catch (e) { /* ignore */ }
  out.history = hist;
  out.ok = Object.keys(rates).length > 0;
  out.asOf = Date.now();
  return out;
}

// ─────────────────────────── 看球：比分 / 赛程（本机代取，无需 API key）──────────────
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
// 只代理这些公开联赛（白名单，避免被当任意 URL 代理）
const SPORT_LEAGUES = {
  "fifa.world": "soccer/fifa.world", // 世界杯（男足）
  nba: "basketball/nba",
  wnba: "basketball/wnba",
  "eng.1": "soccer/eng.1", // 英超
  "esp.1": "soccer/esp.1", // 西甲
  "ita.1": "soccer/ita.1", // 意甲
  "ger.1": "soccer/ger.1", // 德甲
  "uefa.champions": "soccer/uefa.champions", // 欧冠
};

function espnSide(c) {
  const t = (c || {}).team || {};
  return {
    name: t.displayName ?? null,
    short: t.shortDisplayName || t.abbreviation || t.name || null,
    abbr: t.abbreviation ?? null, logo: t.logo ?? null,
    score: c ? c.score ?? null : null, winner: Boolean(c && c.winner),
  };
}

function espnEvent(ev) {
  const comp = (ev.competitions || [{}])[0] || {};
  const cs = comp.competitors || [];
  const home = cs.find((x) => x.homeAway === "home") || null;
  const away = cs.find((x) => x.homeAway === "away") || null;
  const st = ((ev.status || {}).type) || {};
  let note = "";
  const notes = comp.notes || [];
  if (Array.isArray(notes) && notes.length) note = notes[0].headline || "";
  let odds = null;
  const od = comp.odds || [];
  if (Array.isArray(od) && od.length) odds = od[0].details ?? null; // 庄家盘口，仅供参考
  return {
    id: ev.id ?? null, date: ev.date ?? null,
    name: ev.shortName || ev.name || null,
    state: st.state ?? null, // pre / in / post
    completed: Boolean(st.completed),
    detail: st.shortDetail || st.detail || "",
    note, odds,
    home: home ? espnSide(home) : null,
    away: away ? espnSide(away) : null,
  };
}

async function fetchSports(league, dates) {
  const p = SPORT_LEAGUES[league];
  if (!p) return { ok: false, error: `未知联赛：${league}` };
  let url = `${ESPN_BASE}/${p}/scoreboard`;
  if (dates) url += `?dates=${dates}`;
  let raw;
  try {
    raw = await getJson(url, 15000);
  } catch (e) {
    return { ok: false, error: `拉取失败（需联网）：${e}` };
  }
  const events = (raw.events || []).map(espnEvent);
  let lname = "";
  try { lname = ((raw.leagues || [{}])[0] || {}).name || ""; } catch (e) { /* ignore */ }
  return { ok: true, league, leagueName: lname, events, asOf: Date.now() };
}

// ─────────────────────────── 磁盘扫描 / 清理（本机；macOS/Linux） ───────────────────
const HOME = os.homedir();
const exp = (p) => (p.startsWith("~") ? path.join(HOME, p.slice(1)) : p);

function run(cmd, args, timeoutMs) {
  // execFile 的 Promise 包装：超时被杀时仍返回已拿到的部分 stdout（对齐 run.py 的 TimeoutExpired 处理）。
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || "", stderr: stderr || "", timedOut: Boolean(err && err.killed) });
    });
  });
}

async function duBytes(p) {
  try {
    const r = await run("du", ["-sk", p], 300000);
    const kb = parseInt(r.stdout.split("\t")[0].trim(), 10);
    return Number.isFinite(kb) ? kb * 1024 : 0;
  } catch (e) {
    return 0;
  }
}

async function diskDf() {
  // 整机根卷的 总量 / 已用 / 可用（df -k /，macOS 与 Linux 列位相同）。
  try {
    const r = await run("df", ["-k", "/"], 15000);
    const f = r.stdout.trim().split("\n")[1].split(/\s+/);
    return { total: parseInt(f[1], 10) * 1024, used: parseInt(f[2], 10) * 1024, free: parseInt(f[3], 10) * 1024 };
  } catch (e) {
    return null;
  }
}

async function diskScan() {
  // 默认入口：用户目录(home)下一层。复用 diskLs 以保证与逐层下钻完全一致。
  const r = await diskLs(HOME);
  if (r && r.ok) r.asOf = Date.now();
  return r;
}

async function diskLs(p0) {
  // 列出某文件夹下一层（文件+子目录）及各自占用，用于逐层下钻。只读。
  let rp;
  try {
    rp = fs.realpathSync(exp(p0 || "/"));
  } catch (e) {
    return { ok: false, error: "不是文件夹或不存在" };
  }
  let st;
  try { st = fs.statSync(rp); } catch (e) { return { ok: false, error: "不是文件夹或不存在" }; }
  if (!st.isDirectory()) return { ok: false, error: "不是文件夹或不存在" };
  const r = await run("du", ["-k", "-a", "-d", "1", rp], 1800000);
  if (r.err && !r.timedOut && !r.stdout) return { ok: false, error: String(r.err.message || r.err) };
  const partial = r.timedOut;
  const items = [];
  let total = 0;
  for (const line of r.stdout.split("\n")) {
    const parts = line.split("\t");
    if (parts.length !== 2) continue;
    const kb = parseInt(parts[0], 10);
    const full = parts[1];
    if (!Number.isFinite(kb)) continue;
    const b = kb * 1024;
    if (full === rp) { total = b; continue; }
    if (path.dirname(full) !== rp) continue;
    let isDir = false;
    try { isDir = fs.lstatSync(full).isDirectory(); } catch (e) { /* ignore */ }
    items.push({ path: full, label: path.basename(full), bytes: b, isDir });
  }
  if (!items.length && r.stderr.trim())
    return { ok: false, error: "读取受限（可能需要在 系统设置→隐私→完全磁盘访问 授权）" };
  items.sort((a, b) => b.bytes - a.bytes);
  const scanned = items.reduce((s, i) => s + i.bytes, 0);
  return { ok: true, path: rp, parent: path.dirname(rp), home: HOME,
           items, total: total || scanned, scanned, disk: await diskDf(),
           partial, denied: Boolean(r.stderr.trim()) };
}

const CLEAN_TARGETS = [
  { id: "user-caches", label: "用户缓存（各 App）", desc: "~/Library/Caches，会自动重建", paths: ["~/Library/Caches"], contents: true },
  { id: "user-logs", label: "用户日志", desc: "~/Library/Logs", paths: ["~/Library/Logs"], contents: true },
  { id: "xcode-derived", label: "Xcode DerivedData", desc: "编译中间产物，可重建", paths: ["~/Library/Developer/Xcode/DerivedData"], contents: true },
  { id: "xcode-dev", label: "Xcode 调试缓存", desc: "iOS DeviceSupport / 模拟器缓存", paths: ["~/Library/Developer/Xcode/iOS DeviceSupport", "~/Library/Developer/CoreSimulator/Caches"], contents: true },
  { id: "npm", label: "npm 缓存", desc: "~/.npm/_cacache", paths: ["~/.npm/_cacache"], contents: true },
  { id: "pip", label: "pip 缓存", desc: "~/Library/Caches/pip", paths: ["~/Library/Caches/pip"], contents: true },
  { id: "brew", label: "Homebrew 缓存", desc: "~/Library/Caches/Homebrew", paths: ["~/Library/Caches/Homebrew"], contents: true },
  { id: "trash", label: "清空废纸篓", desc: "永久清空 ~/.Trash（不可恢复）", paths: ["~/.Trash"], contents: true, permanentOnly: true },
];

async function diskTargets() {
  const out = [];
  for (const t of CLEAN_TARGETS) {
    let size = 0, exists = false;
    for (const p of t.paths) {
      const ep = exp(p);
      if (fs.existsSync(ep)) { exists = true; size += await duBytes(ep); }
    }
    out.push({ id: t.id, label: t.label, desc: t.desc || "", bytes: size, exists, permanentOnly: Boolean(t.permanentOnly) });
  }
  return { ok: true, targets: out };
}

const BLOCK = new Set(["/", HOME, "/System", "/Library", "/Users", "/Applications", "/usr", "/bin", "/sbin", "/etc", "/private", "/var", "/opt",
  path.join(HOME, "Documents"), path.join(HOME, "Desktop"), path.join(HOME, "Downloads"), path.join(HOME, "Pictures"),
  path.join(HOME, "Movies"), path.join(HOME, "Music"), path.join(HOME, "Library")].map((p) => {
  try { return fs.realpathSync(p); } catch (e) { return p; }
}));

function safeCustom(p0) {
  let rp;
  try {
    rp = fs.realpathSync(exp(p0));
  } catch (e) {
    return null;
  }
  if (BLOCK.has(rp) || !fs.existsSync(rp)) return null;
  if (!rp.startsWith(HOME + path.sep)) return null; // 只允许清理 home 下
  if (rp.replace(new RegExp(path.sep + "+$"), "").split(path.sep).length < 4) return null; // 太靠近根，拒绝
  return rp;
}

function toTrash(item) {
  const trash = exp("~/.Trash");
  fs.mkdirSync(trash, { recursive: true });
  const base = path.basename(item.replace(new RegExp(path.sep + "+$"), "")) || "item";
  let dest = path.join(trash, base);
  let n = 1;
  while (fs.existsSync(dest)) { dest = path.join(trash, `${base} ${n}`); n += 1; }
  try {
    fs.renameSync(item, dest);
  } catch (e) {
    if (e.code === "EXDEV") { fs.cpSync(item, dest, { recursive: true }); fs.rmSync(item, { recursive: true, force: true }); }
    else throw e;
  }
}

function rmItem(item) {
  const st = fs.lstatSync(item);
  if (st.isDirectory() && !st.isSymbolicLink()) fs.rmSync(item, { recursive: true });
  else fs.unlinkSync(item);
}

async function diskClean(spec) {
  let mode = spec.mode === "delete" ? "delete" : "trash";
  const tid = spec.id;
  let paths, contents;
  if (tid) {
    const t = CLEAN_TARGETS.find((x) => x.id === tid);
    if (!t) return { ok: false, error: "未知清理项" };
    paths = t.paths.map(exp);
    contents = t.contents !== false;
    if (t.permanentOnly) mode = "delete"; // 废纸篓只能永久清
  } else if (spec.path) {
    const rp = safeCustom(spec.path);
    if (!rp) return { ok: false, error: "该路径不允许清理（关键目录 / 不在用户目录下 / 不存在）" };
    paths = [rp];
    contents = Boolean(spec.contents);
  } else {
    return { ok: false, error: "缺少清理目标" };
  }
  let freed = 0, count = 0;
  const errs = [];
  for (const base of paths) {
    if (!fs.existsSync(base)) continue;
    let items;
    try {
      items = contents ? fs.readdirSync(base).map((c) => path.join(base, c)) : [base];
    } catch (e) {
      errs.push(String(e.message || e));
      continue;
    }
    for (const it of items) {
      try {
        const sz = await duBytes(it);
        if (mode === "delete") rmItem(it); else toTrash(it);
        freed += sz; count += 1;
      } catch (e) {
        errs.push(String(e.message || e));
      }
    }
  }
  return { ok: true, freed, count, mode, errors: errs.slice(0, 5) };
}

// ─────────────────────────── HTTP 服务 ───────────────────────────
function sendJson(res, obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf-8");
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": body.length, "Cache-Control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 512 * 1024 * 1024) { reject(new Error("请求体过大")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function originOk(req) {
  const origin = req.headers.origin || "";
  return !origin || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`;
}

const RANGES = new Set(["1mo", "3mo", "6mo", "1y"]);

async function handle(req, res) {
  const u = new NodeURL(req.url, `http://localhost:${PORT}`);
  const bare = u.pathname;
  if (req.method === "GET") {
    // 子应用根路径未带斜杠时重定向，确保相对资源解析正确
    if (["/finance", "/gallery", "/vault", "/dev"].includes(bare)) {
      res.writeHead(301, { Location: bare + "/" });
      res.end();
      return;
    }
    if (bare === "/api/gold" || bare === "/api/btc" || bare === "/api/fx") {
      let rng = u.searchParams.get("range") || "3mo";
      if (!RANGES.has(rng)) rng = "3mo";
      let body;
      try {
        body = bare === "/api/gold" ? await fetchGold(rng) : bare === "/api/btc" ? await fetchBtc(rng) : await fetchFx(rng);
      } catch (e) {
        body = { ok: false, error: String(e.message || e) };
      }
      return sendJson(res, body);
    }
    if (bare === "/api/sports") {
      const league = u.searchParams.get("league") || "fifa.world";
      const rawDates = u.searchParams.get("dates") || "";
      const dates = rawDates.replace(/[^0-9-]/g, "") || null;
      let body;
      try {
        body = await fetchSports(league, dates);
      } catch (e) {
        body = { ok: false, error: String(e.message || e) };
      }
      return sendJson(res, body);
    }
    if (bare === "/api/version")
      return sendJson(res, { ok: true, version: APP_VERSION, channel: APP_CHANNEL, label: APP_LABEL, dataVersion: DATA_VERSION, dir: DATA_DIR });
    if (bare === "/api/backup/latest") {
      const data = backupLatest();
      if (!data) { res.writeHead(204); res.end(); return; }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": data.length, "Cache-Control": "no-store" });
      res.end(data);
      return;
    }
    if (bare === "/api/backup/list") return sendJson(res, backupList());
    if (bare === "/api/disk/scan") return sendJson(res, await diskScan());
    if (bare === "/api/disk/targets") return sendJson(res, await diskTargets());
    if (bare === "/api/disk/ls") return sendJson(res, await diskLs(u.searchParams.get("path") || ""));
    const target = resolveStatic(bare);
    if (!target) { res.writeHead(404); res.end("404"); return; }
    const data = fs.readFileSync(target);
    const ctype = MIME[path.extname(target).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": ctype, "Content-Length": data.length, "Cache-Control": "no-store" });
    res.end(data);
    return;
  }
  if (req.method === "POST") {
    if (bare === "/api/backup/save") {
      if (!originOk(req)) { res.writeHead(403); res.end(); return; }
      let out;
      try {
        out = backupSave(await readBody(req));
      } catch (e) {
        out = { ok: false, error: String(e.message || e) };
      }
      return sendJson(res, out);
    }
    if (bare === "/api/disk/clean") {
      if (!originOk(req)) { res.writeHead(403); res.end(); return; }
      let out;
      try {
        const spec = JSON.parse((await readBody(req)).toString("utf-8") || "{}");
        out = await diskClean(spec);
      } catch (e) {
        out = { ok: false, error: String(e.message || e) };
      }
      return sendJson(res, out);
    }
  }
  res.writeHead(404);
  res.end("404");
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref();
  } catch (e) { /* ignore */ }
}

/**
 * 启动服务。opts:
 *  - root: payload 目录（默认仓库根）
 *  - channel: "dev" | "release"（默认按 HOME_CHANNEL / .git 判断）
 *  - noBrowser: true 则不自动开系统浏览器（Electron 拉起时用）
 * 返回 Promise<"started" | "already-running">；端口被占用但对方不是本系统服务时 reject。
 */
function start(opts = {}) {
  if (opts.root) setRoot(opts.root);
  APP_VERSION = appVersion();
  APP_CHANNEL = appChannel(opts.channel);
  APP_LABEL = APP_VERSION + (APP_CHANNEL === "dev" ? "-dev" : ""); // 开发版带 -dev 后缀，一眼区分
  DATA_DIR = dataDir();
  const url = `http://localhost:${PORT}/`; // 用 localhost：WebAuthn / Touch ID 不接受 IP 地址
  const noBrowser = opts.noBrowser || Boolean(process.env.HOME_NO_BROWSER);
  if (!fs.existsSync(HUB)) return Promise.reject(new Error("缺少 hub/index.html"));
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handle(req, res).catch((e) => {
        try { res.writeHead(500); res.end(String(e.message || e)); } catch (e2) { /* ignore */ }
      });
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        // 已有本系统服务在跑（比如你手动开着）→ 直接用它
        console.log(`检测到 ${PORT} 已被占用，直接打开：${url}`);
        if (!noBrowser) openBrowser(url);
        resolve("already-running");
      } else reject(err);
    });
    server.listen(PORT, "127.0.0.1", () => {
      const tag = `v${APP_LABEL}  ·  ${APP_CHANNEL === "dev" ? "开发版" : "发布版"}`;
      console.log("┌──────────────────────────────────────────────┐");
      console.log(`│  我家里的一切  ${tag}`);
      console.log(`│  已启动：${url}`);
      console.log("│  顶部菜单进入：理财 / 影像 / 密码 / 开发       │");
      console.log("│  数据本地保存 · 按 Ctrl+C 退出                 │");
      console.log("└──────────────────────────────────────────────┘");
      console.log(`  自动备份目录：${DATA_DIR}`);
      if (!noBrowser) setTimeout(() => openBrowser(url), 600);
      resolve("started");
    });
  });
}

module.exports = { start, PORT };

if (require.main === module) {
  start().catch((e) => {
    console.error(`✗ ${e.message || e}`);
    process.exit(1);
  });
}
