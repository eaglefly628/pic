#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
我家里的一切 — 统一入口
--------------------------------------------------------------------------
一个端口、一个入口；顶部菜单进入「家庭理财 / 家庭影像 / 家庭密码 / 开发世界」等应用。
各应用仍是独立项目（project-one … project-four），此入口按路径加载它们的 dist：

    /            -> hub/index.html（入口页）
    /finance/*   -> project-one/dist（家庭理财）
    /gallery/*   -> project-two/dist（家庭影像）
    /vault/*     -> project-three/dist（家庭密码）
    /dev/*       -> project-four/dist（男主的开发世界）

直接运行：  python run.py     （或双击 start.bat）
数据全部保存在本机，不联网、不上传。按 Ctrl+C 退出。
"""
import http.server
import json
import mimetypes
import os
import shutil
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HUB = ROOT / "hub" / "index.html"
MOUNTS = {
    "/finance": (ROOT / "project-one" / "dist"),
    "/gallery": (ROOT / "project-two" / "dist"),
    "/vault": (ROOT / "project-three" / "dist"),
    "/dev": (ROOT / "project-four" / "dist"),
}
PORT = 5180
BACKUP_KEEP = 40   # 磁盘上保留的历史备份份数（轮转）


def app_version() -> str:
    """版本号单一真源：根目录 VERSION 文件。改版本只改这一处，各处读取它。"""
    try:
        v = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        return v or "0.0.0"
    except Exception:
        return "0.0.0"


def data_dir() -> Path:
    """本机稳定数据目录——跨版本升级不变（这样新版本能读到旧版本的数据，兼容往前）。
    macOS: ~/Library/Application Support/我家里的一切
    Windows: %APPDATA%/我家里的一切     Linux: ~/.local/share/我家里的一切
    取不到系统目录时退回项目内 .home-data。"""
    home = Path.home()
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA") or (home / "AppData" / "Roaming"))
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or (home / ".local" / "share"))
    d = base / "我家里的一切"
    try:
        (d / "backups").mkdir(parents=True, exist_ok=True)
        return d
    except Exception:
        d = ROOT / ".home-data"
        (d / "backups").mkdir(parents=True, exist_ok=True)
        return d


APP_VERSION = app_version()
DATA_DIR = data_dir()


def _atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)   # 目录被删/首次写入也能自愈
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)   # 原子替换，避免写一半导致的半损坏文件


def backup_save(raw: bytes) -> dict:
    """收下浏览器端打包好的「整屋备份」（各库数据已在浏览器里加密，服务端只当密文存盘）。
    写 current.home（最新），并在 backups/ 里留一份带时间戳的历史，轮转保留最近 BACKUP_KEEP 份。"""
    bundle = json.loads(raw)
    if not isinstance(bundle, dict) or not bundle.get("__home_backup"):
        return {"ok": False, "error": "不是本系统的备份数据"}
    bundle["appVersion"] = APP_VERSION
    bundle["savedAt"] = int(time.time() * 1000)
    data = json.dumps(bundle, ensure_ascii=False).encode("utf-8")
    (DATA_DIR / "backups").mkdir(parents=True, exist_ok=True)   # 运行中目录被删也能自愈
    _atomic_write(DATA_DIR / "current.home", data)
    ts = time.strftime("%Y%m%d-%H%M%S")
    _atomic_write(DATA_DIR / "backups" / f"我家里的一切-备份-{ts}.home", data)
    files = sorted((DATA_DIR / "backups").glob("*.home"))
    for f in files[:-BACKUP_KEEP]:      # 只留最近的若干份
        try:
            f.unlink()
        except Exception:
            pass
    try:
        (DATA_DIR / "meta.json").write_text(
            json.dumps({"appVersion": APP_VERSION, "savedAt": bundle["savedAt"], "bytes": len(data)}, ensure_ascii=False),
            encoding="utf-8")
    except Exception:
        pass
    return {"ok": True, "savedAt": bundle["savedAt"], "bytes": len(data), "dir": str(DATA_DIR)}


def backup_latest():
    p = DATA_DIR / "current.home"
    return p.read_bytes() if p.is_file() else None


def backup_list() -> dict:
    files = sorted((DATA_DIR / "backups").glob("*.home"), key=lambda f: f.name, reverse=True)
    items = [{"name": f.name, "bytes": f.stat().st_size, "mtime": int(f.stat().st_mtime * 1000)} for f in files]
    cur = DATA_DIR / "current.home"
    return {"ok": True, "version": APP_VERSION, "dir": str(DATA_DIR),
            "current": (int(cur.stat().st_mtime * 1000) if cur.is_file() else None), "backups": items}


def resolve(path: str):
    p = path.split("?")[0].split("#")[0]
    if p in ("/", "/index.html"):
        return HUB
    for prefix, base in MOUNTS.items():
        if p == prefix or p.startswith(prefix + "/"):
            rel = p[len(prefix):].lstrip("/") or "index.html"
            target = (base / rel).resolve()
            if target.is_dir():
                target = target / "index.html"
            # 防目录穿越
            if str(target).startswith(str(base.resolve())) and target.is_file():
                return target
            return None
    return None


def _get_json(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def _yahoo_chart(symbol, rng="3mo"):
    """Yahoo 日线收盘：现价 + 前收 + 历史（统一收在 history[].usd 里，复用前端图表逻辑）。"""
    y = _get_json("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=1d" % (symbol, rng))
    res = y["chart"]["result"][0]
    meta = res.get("meta", {})
    ts = res.get("timestamp") or []
    closes = (res.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    hist = [{"t": ts[i] * 1000, "usd": closes[i]} for i in range(min(len(ts), len(closes))) if closes[i] is not None]
    return {"price": meta.get("regularMarketPrice") or (hist[-1]["usd"] if hist else None),
            "prevClose": meta.get("chartPreviousClose"), "history": hist}

def _usd_cny():
    """美元兑人民币（两个免费源，谁通用用谁，都不要 key）。"""
    for url in ("https://api.frankfurter.app/latest?from=USD&to=CNY", "https://open.er-api.com/v6/latest/USD"):
        try:
            return _get_json(url)["rates"]["CNY"]
        except Exception:
            continue
    return None

def fetch_gold(rng="3mo"):
    """黄金价格 + 走势（无需 API key，本机代取，避免浏览器跨域）。"""
    out = {"ok": False}
    try:  # 金价 + 历史：Yahoo 国际现货金期货 GC=F
        q = _yahoo_chart("GC=F", rng)
        out.update({"usdPerOz": q["price"], "prevClose": q["prevClose"], "history": q["history"], "src": "yahoo"})
    except Exception:
        try:  # 降级：只取现价
            g = _get_json("https://api.gold-api.com/price/XAU")
            out.update({"usdPerOz": g.get("price"), "prevClose": None, "history": [], "src": "gold-api"})
        except Exception:
            return {"ok": False, "error": "金价获取失败（需联网）"}
    out["usdCny"] = _usd_cny()
    out["ok"] = out.get("usdPerOz") is not None
    out["asOf"] = int(time.time() * 1000)
    return out

def fetch_btc(rng="3mo"):
    """比特币 BTC/USD 价格 + 走势（Yahoo BTC-USD，降级 Coinbase 现价），无需 API key。"""
    out = {"ok": False}
    try:
        q = _yahoo_chart("BTC-USD", rng)
        out.update({"usd": q["price"], "prevClose": q["prevClose"], "history": q["history"], "src": "yahoo"})
    except Exception:
        try:
            c = _get_json("https://api.coinbase.com/v2/prices/BTC-USD/spot")
            out.update({"usd": float(c["data"]["amount"]), "prevClose": None, "history": [], "src": "coinbase"})
        except Exception:
            return {"ok": False, "error": "比特币价格获取失败（需联网）"}
    out["usdCny"] = _usd_cny()
    out["ok"] = out.get("usd") is not None
    out["asOf"] = int(time.time() * 1000)
    return out

FX_SYMBOLS = ["CNY", "EUR", "JPY", "HKD", "GBP", "KRW", "TWD", "AUD"]
def fetch_fx(rng="3mo"):
    """美元汇率：USD 兑一篮子货币（现价）+ USD/CNY 走势。frankfurter / er-api，无需 key。"""
    out = {"ok": False, "base": "USD"}
    rates = {}
    try:
        j = _get_json("https://api.frankfurter.app/latest?from=USD&to=%s" % ",".join(FX_SYMBOLS))
        rates = j.get("rates", {})
    except Exception:
        try:
            allr = _get_json("https://open.er-api.com/v6/latest/USD").get("rates", {})
            rates = {k: allr[k] for k in FX_SYMBOLS if k in allr}
        except Exception:
            return {"ok": False, "error": "汇率获取失败（需联网）"}
    out["rates"] = rates
    out["cny"] = rates.get("CNY")
    hist = []  # USD/CNY 走势（frankfurter 时间序列，开区间到今天）
    try:
        days = {"1mo": 32, "3mo": 95, "6mo": 190, "1y": 370}.get(rng, 95)
        start = time.strftime("%Y-%m-%d", time.gmtime(time.time() - days * 86400))
        r = _get_json("https://api.frankfurter.app/%s..?from=USD&to=CNY" % start).get("rates", {})
        for d in sorted(r.keys()):
            v = r[d].get("CNY")
            if v is not None:
                hist.append({"t": int(time.mktime(time.strptime(d, "%Y-%m-%d"))) * 1000, "usd": v})
    except Exception:
        pass
    out["history"] = hist
    out["ok"] = bool(rates)
    out["asOf"] = int(time.time() * 1000)
    return out


# ─────────────────────────── 看球：比分 / 赛程（本机代取，无需 API key）──────────────
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"
# 只代理这些公开联赛（白名单，避免被当任意 URL 代理）
SPORT_LEAGUES = {
    "fifa.world": "soccer/fifa.world",          # 世界杯（男足）
    "nba": "basketball/nba",                     # NBA
    "wnba": "basketball/wnba",
    "eng.1": "soccer/eng.1",                     # 英超
    "esp.1": "soccer/esp.1",                     # 西甲
    "ita.1": "soccer/ita.1",                     # 意甲
    "ger.1": "soccer/ger.1",                     # 德甲
    "uefa.champions": "soccer/uefa.champions",   # 欧冠
}

def _espn_side(c):
    t = (c or {}).get("team", {}) or {}
    return {"name": t.get("displayName"), "short": t.get("shortDisplayName") or t.get("abbreviation") or t.get("name"),
            "abbr": t.get("abbreviation"), "logo": t.get("logo"),
            "score": c.get("score"), "winner": bool(c.get("winner"))}

def _espn_event(ev):
    comp = (ev.get("competitions") or [{}])[0]
    cs = comp.get("competitors") or []
    home = next((x for x in cs if x.get("homeAway") == "home"), None)
    away = next((x for x in cs if x.get("homeAway") == "away"), None)
    st = (ev.get("status") or {}).get("type", {}) or {}
    note = ""
    notes = comp.get("notes") or []
    if isinstance(notes, list) and notes:
        note = notes[0].get("headline") or ""
    odds = None
    od = comp.get("odds") or []
    if isinstance(od, list) and od:
        odds = od[0].get("details")  # 庄家盘口，仅供参考
    return {
        "id": ev.get("id"), "date": ev.get("date"),
        "name": ev.get("shortName") or ev.get("name"),
        "state": st.get("state"),                 # pre / in / post
        "completed": bool(st.get("completed")),
        "detail": st.get("shortDetail") or st.get("detail") or "",
        "note": note, "odds": odds,
        "home": _espn_side(home) if home else None,
        "away": _espn_side(away) if away else None,
    }

def fetch_sports(league, dates=None):
    path = SPORT_LEAGUES.get(league)
    if not path:
        return {"ok": False, "error": "未知联赛：%s" % league}
    url = "%s/%s/scoreboard" % (ESPN_BASE, path)
    if dates:
        url += "?dates=%s" % dates
    try:
        raw = _get_json(url, timeout=15)
    except Exception as e:
        return {"ok": False, "error": "拉取失败（需联网）：%s" % e}
    events = [_espn_event(ev) for ev in (raw.get("events") or [])]
    try:
        lname = (raw.get("leagues") or [{}])[0].get("name") or ""
    except Exception:
        lname = ""
    return {"ok": True, "league": league, "leagueName": lname, "events": events, "asOf": int(time.time() * 1000)}


# ─────────────────────────── 磁盘扫描 / 清理（本机） ───────────────────────────
HOME = os.path.expanduser("~")
def _exp(p): return os.path.expanduser(p)

def _du_bytes(path):
    try:
        out = subprocess.run(["du", "-sk", path], capture_output=True, text=True, timeout=300)
        return int(out.stdout.split("\t")[0].split()[0]) * 1024
    except Exception:
        return 0

def _disk_df():
    """整机根卷的 总量 / 已用 / 可用（df -k /，macOS 与 Linux 列位相同）。"""
    try:
        out = subprocess.run(["df", "-k", "/"], capture_output=True, text=True, timeout=15)
        f = out.stdout.strip().splitlines()[1].split()
        return {"total": int(f[1]) * 1024, "used": int(f[2]) * 1024, "free": int(f[3]) * 1024}
    except Exception:
        return None

def disk_scan():
    """默认入口：用户目录(home)下一层。复用 disk_ls 以保证与逐层下钻完全一致
    （含 home 里散落的文件、total 取 du 自身行的真实总量），避免「总量对不上」。"""
    r = disk_ls(HOME)
    if isinstance(r, dict) and r.get("ok"):
        r["asOf"] = int(time.time() * 1000)
    return r

def disk_ls(path):
    """列出某文件夹下一层（文件+子目录）及各自占用，用于逐层下钻。只读、限用户目录内。"""
    rp = os.path.realpath(_exp(path)) if path else "/"
    if not os.path.isdir(rp):
        return {"ok": False, "error": "不是文件夹或不存在"}
    partial = False
    try:
        out = subprocess.run(["du", "-k", "-a", "-d", "1", rp], capture_output=True, text=True, timeout=1800)
        stdout, stderr = out.stdout, out.stderr
    except subprocess.TimeoutExpired as e:  # 整机/超大目录可能超时——尽量用已拿到的部分结果
        stdout = (e.stdout.decode("utf-8", "replace") if isinstance(e.stdout, bytes) else e.stdout) or ""
        stderr = (e.stderr.decode("utf-8", "replace") if isinstance(e.stderr, bytes) else e.stderr) or ""
        partial = True
    except Exception as e:
        return {"ok": False, "error": str(e)}
    items, total = [], 0
    for line in stdout.splitlines():
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        kb, full = parts
        try:
            b = int(kb) * 1024
        except ValueError:
            continue
        if full == rp:
            total = b
            continue
        if os.path.dirname(full) != rp:
            continue
        items.append({"path": full, "label": os.path.basename(full), "bytes": b, "isDir": os.path.isdir(full) and not os.path.islink(full)})
    if not items and stderr.strip():
        return {"ok": False, "error": "读取受限（可能需要在 系统设置→隐私→完全磁盘访问 授权）"}
    items.sort(key=lambda x: -x["bytes"])
    return {"ok": True, "path": rp, "parent": os.path.dirname(rp), "home": HOME,
            "items": items, "total": total or sum(i["bytes"] for i in items),
            "scanned": sum(i["bytes"] for i in items), "disk": _disk_df(),
            "partial": partial, "denied": bool(stderr.strip())}

CLEAN_TARGETS = [
    {"id": "user-caches", "label": "用户缓存（各 App）", "desc": "~/Library/Caches，会自动重建", "paths": ["~/Library/Caches"], "contents": True},
    {"id": "user-logs", "label": "用户日志", "desc": "~/Library/Logs", "paths": ["~/Library/Logs"], "contents": True},
    {"id": "xcode-derived", "label": "Xcode DerivedData", "desc": "编译中间产物，可重建", "paths": ["~/Library/Developer/Xcode/DerivedData"], "contents": True},
    {"id": "xcode-dev", "label": "Xcode 调试缓存", "desc": "iOS DeviceSupport / 模拟器缓存", "paths": ["~/Library/Developer/Xcode/iOS DeviceSupport", "~/Library/Developer/CoreSimulator/Caches"], "contents": True},
    {"id": "npm", "label": "npm 缓存", "desc": "~/.npm/_cacache", "paths": ["~/.npm/_cacache"], "contents": True},
    {"id": "pip", "label": "pip 缓存", "desc": "~/Library/Caches/pip", "paths": ["~/Library/Caches/pip"], "contents": True},
    {"id": "brew", "label": "Homebrew 缓存", "desc": "~/Library/Caches/Homebrew", "paths": ["~/Library/Caches/Homebrew"], "contents": True},
    {"id": "trash", "label": "清空废纸篓", "desc": "永久清空 ~/.Trash（不可恢复）", "paths": ["~/.Trash"], "contents": True, "permanentOnly": True},
]

def disk_targets():
    out = []
    for t in CLEAN_TARGETS:
        size, exists = 0, False
        for p in t["paths"]:
            ep = _exp(p)
            if os.path.exists(ep):
                exists = True
                size += _du_bytes(ep)
        out.append({"id": t["id"], "label": t["label"], "desc": t.get("desc", ""), "bytes": size, "exists": exists, "permanentOnly": t.get("permanentOnly", False)})
    return {"ok": True, "targets": out}

_BLOCK = {os.path.realpath(p) for p in ["/", HOME, "/System", "/Library", "/Users", "/Applications", "/usr", "/bin", "/sbin", "/etc", "/private", "/var", "/opt",
         os.path.join(HOME, "Documents"), os.path.join(HOME, "Desktop"), os.path.join(HOME, "Downloads"), os.path.join(HOME, "Pictures"), os.path.join(HOME, "Movies"), os.path.join(HOME, "Music"), os.path.join(HOME, "Library")]}

def _safe_custom(path):
    rp = os.path.realpath(_exp(path))
    if rp in _BLOCK or not os.path.exists(rp):
        return None
    if not rp.startswith(HOME + os.sep):
        return None  # 只允许清理 home 下
    if len(rp.rstrip(os.sep).split(os.sep)) < 4:
        return None  # 太靠近根，拒绝
    return rp

def _to_trash(item):
    trash = _exp("~/.Trash")
    os.makedirs(trash, exist_ok=True)
    base = os.path.basename(item.rstrip(os.sep)) or "item"
    dest = os.path.join(trash, base)
    n = 1
    while os.path.exists(dest):
        dest = os.path.join(trash, "%s %d" % (base, n)); n += 1
    shutil.move(item, dest)

def _rm(item):
    if os.path.isdir(item) and not os.path.islink(item):
        shutil.rmtree(item)
    else:
        os.remove(item)

def disk_clean(spec):
    mode = "delete" if spec.get("mode") == "delete" else "trash"
    tid = spec.get("id")
    if tid:
        t = next((x for x in CLEAN_TARGETS if x["id"] == tid), None)
        if not t:
            return {"ok": False, "error": "未知清理项"}
        paths = [_exp(p) for p in t["paths"]]
        contents = t.get("contents", True)
        if t.get("permanentOnly"):
            mode = "delete"  # 废纸篓只能永久清
    elif spec.get("path"):
        rp = _safe_custom(spec["path"])
        if not rp:
            return {"ok": False, "error": "该路径不允许清理（关键目录 / 不在用户目录下 / 不存在）"}
        paths, contents = [rp], bool(spec.get("contents", False))
    else:
        return {"ok": False, "error": "缺少清理目标"}
    freed, count, errs = 0, 0, []
    for base in paths:
        if not os.path.exists(base):
            continue
        try:
            items = [os.path.join(base, c) for c in os.listdir(base)] if contents else [base]
        except Exception as e:
            errs.append(str(e)); continue
        for it in items:
            try:
                sz = _du_bytes(it)
                _rm(it) if (mode == "delete") else _to_trash(it)
                freed += sz; count += 1
            except Exception as e:
                errs.append(str(e))
    return {"ok": True, "freed": freed, "count": count, "mode": mode, "errors": errs[:5]}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        # 子应用根路径未带斜杠时重定向，确保相对资源解析正确
        bare = self.path.split("?")[0]
        if bare in ("/finance", "/gallery", "/vault", "/dev"):
            self.send_response(301)
            self.send_header("Location", bare + "/")
            self.end_headers()
            return
        if bare == "/api/gold":
            from urllib.parse import urlparse, parse_qs
            rng = (parse_qs(urlparse(self.path).query).get("range") or ["3mo"])[0]
            if rng not in ("1mo", "3mo", "6mo", "1y"):
                rng = "3mo"
            try:
                body = json.dumps(fetch_gold(rng)).encode("utf-8")
            except Exception as e:
                body = json.dumps({"ok": False, "error": str(e)}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if bare in ("/api/btc", "/api/fx"):
            from urllib.parse import urlparse, parse_qs
            rng = (parse_qs(urlparse(self.path).query).get("range") or ["3mo"])[0]
            if rng not in ("1mo", "3mo", "6mo", "1y"):
                rng = "3mo"
            try:
                body = fetch_btc(rng) if bare == "/api/btc" else fetch_fx(rng)
            except Exception as e:
                body = {"ok": False, "error": str(e)}
            return self._send_json(body)
        if bare == "/api/sports":
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            league = (q.get("league") or ["fifa.world"])[0]
            raw_dates = (q.get("dates") or [""])[0]
            dates = "".join(ch for ch in raw_dates if ch.isdigit() or ch == "-") or None
            try:
                body = fetch_sports(league, dates)
            except Exception as e:
                body = {"ok": False, "error": str(e)}
            return self._send_json(body)
        if bare == "/api/version":
            return self._send_json({"ok": True, "version": APP_VERSION, "dir": str(DATA_DIR)})
        if bare == "/api/backup/latest":
            data = backup_latest()
            if not data:
                self.send_response(204)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        if bare == "/api/backup/list":
            return self._send_json(backup_list())
        if bare == "/api/disk/scan":
            return self._send_json(disk_scan())
        if bare == "/api/disk/targets":
            return self._send_json(disk_targets())
        if bare == "/api/disk/ls":
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self._send_json(disk_ls((q.get("path") or [""])[0]))
        target = resolve(self.path)
        if not target:
            self.send_error(404)
            return
        data = Path(target).read_bytes()
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        bare = self.path.split("?")[0]
        if bare == "/api/backup/save":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                raw = self.rfile.read(ln) if ln else b""
                res = backup_save(raw)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        if bare == "/api/disk/clean":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                spec = json.loads(self.rfile.read(ln) or b"{}")
                res = disk_clean(spec)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
        self.send_error(404)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    if not HUB.is_file():
        print("✗ 缺少 hub/index.html")
        return 1
    url = f"http://localhost:{PORT}/"   # 用 localhost：WebAuthn / Touch ID 不接受 IP 地址
    no_browser = bool(os.environ.get("HOME_NO_BROWSER"))   # 被 Mac App(Electron) 拉起时=1，不再另开系统浏览器
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
    except OSError:
        print(f"检测到 {PORT} 已被占用，直接打开：{url}")
        if not no_browser:
            webbrowser.open(url)
        return 0
    with httpd:
        print("┌──────────────────────────────────────────────┐")
        print(f"│  我家里的一切  v{APP_VERSION:<31}│")
        print(f"│  已启动：{url:<36}│")
        print("│  顶部菜单进入：理财 / 影像 / 密码 / 开发       │")
        print("│  数据本地保存 · 按 Ctrl+C 退出                 │")
        print("└──────────────────────────────────────────────┘")
        print(f"  自动备份目录：{DATA_DIR}")
        if not no_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已退出。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
