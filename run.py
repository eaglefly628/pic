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
import csv
import http.server
import io
import json
import mimetypes
import os
import re
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
PORT = int(os.environ.get("HOME_PORT") or 5180)
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
    取不到系统目录时退回项目内 .home-data。
    HOME_DATA_DIR 环境变量可以强制指定目录（测试脚本用，避免碰到真实数据）。"""
    forced = os.environ.get("HOME_DATA_DIR")
    if forced:
        d = Path(forced)
        (d / "backups").mkdir(parents=True, exist_ok=True)
        return d
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


def app_channel() -> str:
    """发布版 / 开发版分开：
    - 打成 .app 安装后（Resources/payload，没有 .git）→ release「发布版」
    - 在仓库里直接跑（python run.py / npm start，有 .git）→ dev「开发版」
    Electron 会用 HOME_CHANNEL 明确指定；直接跑时按有没有 .git 自动判断。"""
    env = os.environ.get("HOME_CHANNEL")
    if env in ("dev", "release"):
        return env
    return "dev" if (ROOT / ".git").exists() else "release"


APP_VERSION = app_version()
APP_CHANNEL = app_channel()
APP_LABEL = APP_VERSION + ("-dev" if APP_CHANNEL == "dev" else "")   # 开发版带 -dev 后缀，一眼区分
# 数据结构版本：改动数据形状（加/改字段）时 +1。配套的兼容规矩：
#   ① 存盘时打上这个版本号；
#   ② 新版写的数据，老版能「只读打开」查看（不认识的新字段忽略、不删）；
#   ③ 老版保存时，服务端拒绝用较低版本覆盖磁盘上更高版本的数据（护栏，见 backup_save）。
# 这样开发版 / 安装版即使一时新旧不一，也只会「后者只读、不互相写坏」。
DATA_VERSION = 3
DATA_DIR = data_dir()


def _atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)   # 目录被删/首次写入也能自愈
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    try:
        os.chmod(tmp, 0o600)   # 只有本人可读：文件里除了加密金库，还有其它子应用的明文数据
    except Exception:
        pass
    os.replace(tmp, path)   # 原子替换，避免写一半导致的半损坏文件


# 服务器是多线程的（ThreadingTCPServer），而 45 秒定时、页面隐藏、pagehide 的 sendBeacon
# 可能贴得很近。_atomic_write 用的是固定的 .tmp 文件名，两个请求同时进来会互相踩，
# os.replace 可能把写了一半的搬过去。整个「读旧值 → 比对 → 写新值」串行化。
_BACKUP_LOCK = threading.Lock()


def backup_save(raw: bytes) -> dict:
    """收下浏览器端打包好的「整屋备份」（各库数据已在浏览器里加密，服务端只当密文存盘）。
    写 current.home（最新），并在 backups/ 里留一份带时间戳的历史，轮转保留最近 BACKUP_KEEP 份。"""
    with _BACKUP_LOCK:
        return _backup_save_locked(raw)


def _backup_save_locked(raw: bytes) -> dict:
    bundle = json.loads(raw)
    if not isinstance(bundle, dict) or not bundle.get("__home_backup"):
        return {"ok": False, "error": "不是本系统的备份数据"}
    def _content(b):
        return json.dumps({"localStorage": b.get("localStorage"), "indexedDB": b.get("indexedDB")}, sort_keys=True, ensure_ascii=False)
    new_content = _content(bundle)
    old_raw = backup_latest()
    if old_raw is not None:
        try:
            old = json.loads(old_raw)
        except Exception:
            old = None
        if isinstance(old, dict):
            # 兼容护栏：磁盘上是更高数据版本(更新的 App)写的 → 本(旧)入口拒绝覆盖，避免写坏
            stored_dv = int(old.get("dataVersion") or 0)
            if stored_dv > DATA_VERSION:
                return {"ok": False, "error": "reject-downgrade", "storedDataVersion": stored_dv, "myDataVersion": DATA_VERSION,
                        "hint": "磁盘上的数据是更新版本的 App 写的，本入口版本偏旧、已拒绝覆盖。请把本入口也更新到最新。"}
            # 内容没变就不更新时间戳——否则多入口会因时间戳变化互相触发无谓的“恢复”。
            if _content(old) == new_content:
                return {"ok": True, "savedAt": old.get("savedAt"), "bytes": len(old_raw), "dir": str(DATA_DIR), "unchanged": True}
            # 乐观并发：客户端带上「我上次同步到的 savedAt」。磁盘上的比它新，说明另一个入口
            # （比如安装版和 VSCode 同时开着）在我之后写过——直接覆盖会把对方的改动抹掉。
            # 拒绝，让前端先把新的拉回来。老客户端不带这个字段则跳过检查（向后兼容）。
            base = bundle.get("baseSavedAt")
            disk_at = int(old.get("savedAt") or 0)
            if isinstance(base, (int, float)) and disk_at > int(base):
                return {"ok": False, "error": "stale", "diskSavedAt": disk_at, "baseSavedAt": int(base),
                        "hint": "磁盘上的数据比你这个窗口上次同步到的更新（另一个入口写过），本次未覆盖。刷新页面会拉取最新数据。"}
    bundle.pop("baseSavedAt", None)   # 只用于校验，不落盘
    bundle["dataVersion"] = DATA_VERSION
    bundle["appVersion"] = APP_VERSION
    bundle["appChannel"] = APP_CHANNEL
    bundle["savedAt"] = int(time.time() * 1000)
    data = json.dumps(bundle, ensure_ascii=False).encode("utf-8")
    (DATA_DIR / "backups").mkdir(parents=True, exist_ok=True)   # 运行中目录被删也能自愈
    _atomic_write(DATA_DIR / "current.home", data)
    _atomic_write(_fresh_backup_path("我家里的一切-备份-"), data)
    _prune_backups()
    try:
        (DATA_DIR / "meta.json").write_text(
            json.dumps({"appVersion": APP_VERSION, "savedAt": bundle["savedAt"], "bytes": len(data)}, ensure_ascii=False),
            encoding="utf-8")
    except Exception:
        pass
    return {"ok": True, "savedAt": bundle["savedAt"], "bytes": len(data), "dir": str(DATA_DIR)}


_TS_RE = re.compile(r"(\d{8})-(\d{6})")


def _fresh_backup_path(prefix: str) -> Path:
    """backups/<prefix><时间戳>.home；同一秒内连写两次（页面隐藏 + pagehide 贴得很近）不再互相覆盖，
    第二份加 -2、-3 后缀。"""
    ts = time.strftime("%Y%m%d-%H%M%S")
    d = DATA_DIR / "backups"
    p = d / f"{prefix}{ts}.home"
    i = 2
    while p.exists():
        p = d / f"{prefix}{ts}-{i}.home"
        i += 1
    return p


def _stamp_of(f: Path):
    """从文件名里取出 YYYYMMDD-HHMMSS；取不到就用 mtime。"""
    m = _TS_RE.search(f.name)
    if m:
        return m.group(1) + "-" + m.group(2)
    return time.strftime("%Y%m%d-%H%M%S", time.localtime(f.stat().st_mtime))


def _order_of(f: Path):
    """排序键。文件名只精确到秒，同一秒里写的两份（比如恢复前的安全副本和紧跟着的自动备份）
    光看名字分不出先后，再用 mtime 做次级键，顺序才是确定的。"""
    try:
        return (_stamp_of(f), f.stat().st_mtime)
    except Exception:
        return (_stamp_of(f), 0.0)


def _prune_backups():
    """分层保留，而不是只留最近 40 次。
    原来的问题：编辑得勤的时候 40 次只够半小时，一次错误状态能把所有好的历史全部滚掉。
    现在：最近 BACKUP_KEEP 次全留；再往前每天留当天最后一份、留 30 天；再往前每周留一份、留 12 周。
    手动的安全副本（keep- 开头，恢复前自动存的）单独计数，留最近 10 份，不参与上面的轮转。"""
    d = DATA_DIR / "backups"
    auto = sorted([f for f in d.glob("*.home") if not f.name.startswith("keep-")], key=_order_of)
    keep = set(auto[-BACKUP_KEEP:])
    # 按天 / 按周分桶，各桶取最后一份
    by_day, by_week = {}, {}
    for f in auto:
        st = _stamp_of(f)
        day = st[:8]
        try:
            t = time.strptime(day, "%Y%m%d")
            week = time.strftime("%G-%V", t)
        except Exception:
            week = day[:6]
        by_day[day] = f          # 同一天后面的覆盖前面的 → 留当天最后一份
        by_week[week] = f
    now = time.time()
    for day, f in by_day.items():
        try:
            age = (now - time.mktime(time.strptime(day, "%Y%m%d"))) / 86400
        except Exception:
            age = 0
        if age <= 30:
            keep.add(f)
    weeks = sorted(by_week.keys())[-12:]
    for w in weeks:
        keep.add(by_week[w])
    for f in auto:
        if f not in keep:
            try:
                f.unlink()
            except Exception:
                pass
    manual = sorted([f for f in d.glob("keep-*.home")], key=_order_of)
    for f in manual[:-10]:
        try:
            f.unlink()
        except Exception:
            pass


def backup_keep(raw: bytes) -> dict:
    """无条件把一份 bundle 存成安全副本（不动 current.home、不做过期检查）。
    用在「从备份恢复」之前：先把当前本机状态存下来，恢复错了还能回来。"""
    try:
        bundle = json.loads(raw)
    except Exception:
        return {"ok": False, "error": "不是合法的备份数据（JSON 解析失败）"}
    if not isinstance(bundle, dict) or not bundle.get("__home_backup"):
        return {"ok": False, "error": "不是本系统的备份数据"}
    bundle.pop("baseSavedAt", None)
    bundle["savedAt"] = int(time.time() * 1000)
    bundle["dataVersion"] = DATA_VERSION
    data = json.dumps(bundle, ensure_ascii=False).encode("utf-8")
    with _BACKUP_LOCK:
        p = _fresh_backup_path("keep-恢复前-")
        _atomic_write(p, data)
        _prune_backups()
    return {"ok": True, "name": p.name, "bytes": len(data)}


def backup_get(name: str):
    """按文件名取一份历史备份。只认 backups/ 里的 .home 文件名，防穿越。"""
    if not name or "/" in name or "\\" in name or name in (".", "..") or not name.endswith(".home"):
        return None
    base = (DATA_DIR / "backups").resolve()
    target = (base / name).resolve()
    if target.parent != base or not target.is_file():
        return None
    return target.read_bytes()


def backup_latest():
    p = DATA_DIR / "current.home"
    return p.read_bytes() if p.is_file() else None


def _tighten_perms():
    """启动时把旧版本留下的 644 备份文件收紧成 600（新写的文件在 _atomic_write 里已经是 600）。
    只在多用户系统上有意义；Windows 上 chmod 基本无效，失败静默。"""
    try:
        files = [DATA_DIR / "current.home"] + list((DATA_DIR / "backups").glob("*.home"))
        for f in files:
            if f.is_file() and (f.stat().st_mode & 0o077):
                os.chmod(f, 0o600)
    except Exception:
        pass


def backup_list() -> dict:
    # 按时间倒序（最新在前），自动备份和 keep- 安全副本按真实时间穿插，而不是按文件名分成两堆
    files = sorted((DATA_DIR / "backups").glob("*.home"), key=_order_of, reverse=True)
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

# ── 美债收益率 ──────────────────────────────────────────────
# 主源是美国财政部官方的「每日收益率曲线」CSV：整条曲线（1 月 ~ 30 年）都有，
# 不要 key、不要注册，就是个静态文件。降级用 Yahoo 的几个收益率指数。
UST_HISTORY_KEYS = ["3M", "2Y", "5Y", "10Y", "30Y"]   # 走势图只回这几档，省流量
_UST_HDR = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(mo|month|yr|year)s?\s*$", re.I)


def _ust_tenor(header):
    """把 CSV 表头（"1 Mo" / "1.5 Month" / "10 Yr"）变成 ("10Y", 120.0)。认不出来返回 None。"""
    m = _UST_HDR.match(header or "")
    if not m:
        return None
    n = float(m.group(1))
    months = n if m.group(2).lower().startswith("mo") else n * 12
    key = ("%g" % months) + "M" if months < 12 else ("%g" % (months / 12)) + "Y"
    return key, months


def _ust_year(year):
    """取某一年的每日收益率曲线。返回 (按日期升序的行, {档位: 月数})。
    行的形状：{"date": "2026-09-10", "t": 毫秒, "y": {"10Y": 4.12, ...}}"""
    url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
           "daily-treasury-rates.csv/%d/all?type=daily_treasury_yield_curve"
           "&field_tdr_date_year=%d&page&_format=csv" % (year, year))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/csv, */*"})
    with urllib.request.urlopen(req, timeout=25) as r:
        text = r.read().decode("utf-8-sig", "replace")
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 2:
        return [], {}
    # 表头里哪几列是档位（列的顺序/有无各年不同，所以按名字认，不按位置）
    cols, months_of = [], {}
    for i, h in enumerate(rows[0]):
        t = _ust_tenor(h)
        if t:
            cols.append((i, t[0]))
            months_of[t[0]] = t[1]
    out = []
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        try:
            mo, da, yr = row[0].strip().split("/")
            yr, mo, da = int(yr), int(mo), int(da)
            ms = int(time.mktime((yr, mo, da, 12, 0, 0, 0, 0, -1)) * 1000)   # 正午，避开时区把日期推偏
        except Exception:
            continue
        y = {}
        for i, key in cols:
            if i < len(row) and row[i].strip():
                try:
                    y[key] = float(row[i].strip())
                except Exception:
                    pass
        if y:
            out.append({"date": "%04d-%02d-%02d" % (yr, mo, da), "t": ms, "y": y})
    out.sort(key=lambda x: x["date"])
    return out, months_of


def _ust_yahoo():
    """降级：Yahoo 的收益率指数，只够拼出一条很粗的曲线，没有完整历史。"""
    out = {}
    for sym, key in (("%5EIRX", "3M"), ("%5EFVX", "5Y"), ("%5ETNX", "10Y"), ("%5ETYX", "30Y")):
        try:
            v = _yahoo_chart(sym, "5d")["price"]
            if v is None:
                continue
            # Yahoo 这几个指数历史上按「收益率 ×10」报（42.5 = 4.25%），后来改成直接报。
            # 收益率不可能到 25%，据此两种口径都能兜住。
            out[key] = v / 10.0 if v > 25 else v
        except Exception:
            continue
    return out


def fetch_ust(rng="3mo"):
    """美债收益率：最新一整条曲线 + 上一交易日（算日涨跌）+ 常用几档的历史走势。"""
    days = {"1mo": 32, "3mo": 95, "6mo": 190, "1y": 370}.get(rng, 95)
    cutoff = time.time() - days * 86400
    rows, months_of, err = [], {}, None
    try:
        year = time.gmtime().tm_year
        rows, months_of = _ust_year(year)
        # 当年文件不够长（尤其年初），再补上一年
        if not rows or rows[0]["t"] / 1000.0 > cutoff:
            try:
                prev_rows, prev_months = _ust_year(year - 1)
                rows = prev_rows + rows
                for k, v in prev_months.items():
                    months_of.setdefault(k, v)
            except Exception:
                pass
    except Exception as e:
        err = str(e)

    if not rows:
        curve = _ust_yahoo()
        if not curve:
            return {"ok": False, "error": "美债收益率获取失败（需联网）" + (" · " + err if err else "")}
        tenors = [{"key": k, "months": {"3M": 3, "5Y": 60, "10Y": 120, "30Y": 360}[k]} for k in curve]
        tenors.sort(key=lambda x: x["months"])
        return {"ok": True, "src": "yahoo", "asOf": int(time.time() * 1000), "partial": True,
                "tenors": tenors, "latest": {"date": None, "y": curve}, "prev": None,
                "history": {}, "curves": [],
                "note": "只取到当前收益率，没有历史走势（财政部数据源暂时取不到）"}

    kept = [r for r in rows if r["t"] / 1000.0 >= cutoff]
    if len(kept) < 2:
        kept = rows[-60:]
    latest = rows[-1]
    prev = rows[-2] if len(rows) >= 2 else None
    tenors = sorted(({"key": k, "months": m} for k, m in months_of.items()), key=lambda x: x["months"])
    history = {}
    for k in UST_HISTORY_KEYS:
        pts = [{"t": r["t"], "usd": r["y"][k]} for r in kept if k in r["y"]]
        if len(pts) >= 2:
            history[k] = pts

    # 曲线对比：现在 / 约一个月前 / 所选区间最早那期（去重，按日期新→旧）
    def nearest(target_ms):
        return min(rows, key=lambda r: abs(r["t"] - target_ms)) if rows else None
    picks, seen = [], set()
    for r in (latest, nearest(latest["t"] - 30 * 86400000), kept[0]):
        if r and r["date"] not in seen:
            seen.add(r["date"])
            picks.append({"date": r["date"], "t": r["t"], "y": r["y"]})
    picks.sort(key=lambda x: x["date"], reverse=True)

    return {"ok": True, "src": "treasury", "asOf": int(time.time() * 1000),
            "tenors": tenors, "latest": {"date": latest["date"], "t": latest["t"], "y": latest["y"]},
            "prev": ({"date": prev["date"], "y": prev["y"]} if prev else None),
            "history": history, "curves": picks, "points": len(kept)}


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
    # 从 stderr 里挑出具体是哪些文件夹被拒绝的（macOS du: "du: /x/y: Operation not permitted"），
    # 给前端一个能直接点名道姓的列表，而不是一句含糊的"有权限问题"。这一步要在"items 是否为空"
    # 判断之前做——因为「这一层整个都读不到」（比如直接点进桌面/文稿）时 items 会是空的，
    # 以前会在下面提前 return 一个干巴巴的错误字符串，白白扔掉这里本能给出的具体文件夹名单。
    denied_paths = []
    for line in stderr.splitlines():
        m = re.match(r"^du:\s*(?:cannot read directory\s*)?'?([^:']+)'?\s*:?\s*(Operation not permitted|Permission denied)", line.strip())
        if m:
            p = m.group(1).strip().rstrip(":")
            if not p:
                continue
            label = "这一层本身" if p == rp else (os.path.basename(p) or p)
            if label not in denied_paths:
                denied_paths.append(label)
    if not items and stderr.strip():
        if denied_paths:
            # 整层都读不到，但至少能点名道姓——照样走"成功但受限"的返回形状，
            # 让前端画那条可操作的权限横幅，而不是丢一句用户没法照做的错误文案。
            return {"ok": True, "path": rp, "parent": os.path.dirname(rp), "home": HOME,
                    "items": [], "total": 0, "scanned": 0, "disk": _disk_df(),
                    "partial": partial, "denied": True, "deniedPaths": denied_paths[:8]}
        return {"ok": False, "error": "读取受限（可能需要在 系统设置→隐私→完全磁盘访问 授权），且没能定位到具体是哪个文件夹"}
    items.sort(key=lambda x: -x["bytes"])
    return {"ok": True, "path": rp, "parent": os.path.dirname(rp), "home": HOME,
            "items": items, "total": total or sum(i["bytes"] for i in items),
            "scanned": sum(i["bytes"] for i in items), "disk": _disk_df(),
            "partial": partial, "denied": bool(stderr.strip()), "deniedPaths": denied_paths[:8]}

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
        if bare in ("/api/btc", "/api/fx", "/api/ust"):
            from urllib.parse import urlparse, parse_qs
            rng = (parse_qs(urlparse(self.path).query).get("range") or ["3mo"])[0]
            if rng not in ("1mo", "3mo", "6mo", "1y"):
                rng = "3mo"
            fn = {"/api/btc": fetch_btc, "/api/fx": fetch_fx, "/api/ust": fetch_ust}[bare]
            try:
                body = fn(rng)
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
            return self._send_json({"ok": True, "version": APP_VERSION, "channel": APP_CHANNEL,
                                    "label": APP_LABEL, "dataVersion": DATA_VERSION, "dir": str(DATA_DIR)})
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
        if bare == "/api/backup/get":
            from urllib.parse import urlparse, parse_qs, unquote
            q = parse_qs(urlparse(self.path).query)
            name = unquote((q.get("name") or [""])[0])
            data = backup_get(name)
            if data is None:
                self.send_error(404); return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
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
        if bare == "/api/backup/keep":
            origin = self.headers.get("Origin", "")
            if origin and origin not in ("http://localhost:%d" % PORT, "http://127.0.0.1:%d" % PORT):
                self.send_error(403); return
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                raw = self.rfile.read(ln) if ln else b""
                res = backup_keep(raw)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            return self._send_json(res)
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
        _tighten_perms()
        _tag = f"v{APP_LABEL}  ·  {'开发版' if APP_CHANNEL == 'dev' else '发布版'}"
        print("┌──────────────────────────────────────────────┐")
        print(f"│  我家里的一切  {_tag:<28}│")
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
