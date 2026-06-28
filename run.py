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
import threading
import time
import urllib.request
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


def fetch_gold(rng="3mo"):
    """黄金价格 + 走势（无需 API key，本机代取，避免浏览器跨域）。"""
    out = {"ok": False}
    try:  # 金价 + 历史：Yahoo 国际现货金期货 GC=F
        y = _get_json("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=%s&interval=1d" % rng)
        res = y["chart"]["result"][0]
        meta = res.get("meta", {})
        ts = res.get("timestamp") or []
        closes = (res.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
        hist = [{"t": ts[i] * 1000, "usd": closes[i]} for i in range(min(len(ts), len(closes))) if closes[i] is not None]
        out.update({"usdPerOz": meta.get("regularMarketPrice") or (hist[-1]["usd"] if hist else None),
                    "prevClose": meta.get("chartPreviousClose"), "history": hist, "src": "yahoo"})
    except Exception:
        try:  # 降级：只取现价
            g = _get_json("https://api.gold-api.com/price/XAU")
            out.update({"usdPerOz": g.get("price"), "prevClose": None, "history": [], "src": "gold-api"})
        except Exception:
            return {"ok": False, "error": "金价获取失败（需联网）"}
    out["usdCny"] = None  # 美元兑人民币（两个免费源，谁通用谁）
    for url in ("https://api.frankfurter.app/latest?from=USD&to=CNY", "https://open.er-api.com/v6/latest/USD"):
        try:
            out["usdCny"] = _get_json(url)["rates"]["CNY"]
            break
        except Exception:
            continue
    out["ok"] = out.get("usdPerOz") is not None
    out["asOf"] = int(time.time() * 1000)
    return out


# ─────────────────────────── 磁盘扫描 / 清理（本机） ───────────────────────────
HOME = os.path.expanduser("~")
def _exp(p): return os.path.expanduser(p)

def _du_bytes(path):
    try:
        out = subprocess.run(["du", "-sk", path], capture_output=True, text=True, timeout=300)
        return int(out.stdout.split("\t")[0].split()[0]) * 1024
    except Exception:
        return 0

def disk_scan():
    """home 下一层各项，按占用从大到小。"""
    items = []
    try:
        out = subprocess.run(["du", "-k", "-d", "1", HOME], capture_output=True, text=True, timeout=900)
        for line in out.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) != 2:
                continue
            kb, path = parts
            if path == HOME:
                continue
            try:
                b = int(kb) * 1024
            except ValueError:
                continue
            items.append({"path": path, "label": os.path.basename(path) or path, "bytes": b})
    except Exception as e:
        return {"ok": False, "error": "扫描失败：" + str(e)}
    items.sort(key=lambda x: -x["bytes"])
    return {"ok": True, "home": HOME, "items": items[:20], "asOf": int(time.time() * 1000)}

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
        if bare == "/api/disk/scan":
            return self._send_json(disk_scan())
        if bare == "/api/disk/targets":
            return self._send_json(disk_targets())
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
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
    except OSError:
        print(f"检测到 {PORT} 已被占用，直接打开：{url}")
        webbrowser.open(url)
        return 0
    with httpd:
        print("┌──────────────────────────────────────────────┐")
        print("│  我家里的一切                                   │")
        print(f"│  已启动：{url:<36}│")
        print("│  顶部菜单进入：理财 / 影像 / 密码 / 开发       │")
        print("│  数据本地保存 · 按 Ctrl+C 退出                 │")
        print("└──────────────────────────────────────────────┘")
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已退出。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
