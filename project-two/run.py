#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
家庭影像 Family Gallery · 一键启动器
--------------------------------------------------------------------------
直接运行即可使用，无需了解 npm：

    python run.py            # 或 python3 run.py

它会在本机启动一个本地服务并自动打开浏览器。数据全部加密保存在本机，
不联网、不上传。按 Ctrl+C 退出。

工作方式：
  - 已有打包好的 dist/ → 直接提供服务（无需 Node）。
  - 没有 dist/ 但装了 Node → 自动 npm install && npm run build 后再启动。
"""
import functools
import http.server
import shutil
import socketserver
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
PREFERRED_PORT = 5181


def ensure_dist() -> bool:
    if (DIST / "index.html").exists():
        return True
    npm = shutil.which("npm")
    if not npm:
        print("✗ 未找到已构建的 dist/，且本机未检测到 Node/npm。")
        print("  请先安装 Node.js，然后执行：npm install && npm run build")
        return False
    print("首次运行：正在构建前端，请稍候（npm install && npm run build）…")
    try:
        if not (ROOT / "node_modules").exists():
            subprocess.run([npm, "install"], cwd=ROOT, check=True)
        subprocess.run([npm, "run", "build"], cwd=ROOT, check=True)
    except subprocess.CalledProcessError as e:
        print(f"✗ 构建失败：{e}")
        return False
    return (DIST / "index.html").exists()


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # 安静日志
        pass

    def end_headers(self):
        # 本地应用，避免缓存导致更新后看到旧版本
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    if not ensure_dist():
        return 1
    # 固定端口，保证数据始终保存在同一地址（localStorage 按来源隔离，换端口会"看不到"旧数据）
    port = PREFERRED_PORT
    url = f"http://127.0.0.1:{port}/"
    handler = functools.partial(Handler, directory=str(DIST))
    try:
        httpd = Server(("127.0.0.1", port), handler)
    except OSError:
        # 端口被占用：大概率本应用已在运行，直接打开已运行实例（同一地址=同一份数据）
        print(f"检测到 {port} 已被占用，应用可能已在运行，直接打开：{url}")
        print("（如需重启，请先关闭原来的运行窗口，再运行本脚本）")
        webbrowser.open(url)
        return 0
    with httpd:
        print("┌─────────────────────────────────────────────┐")
        print("│  家庭影像 · Family Gallery              │")
        print("├─────────────────────────────────────────────┤")
        print(f"│  已启动：{url:<35}│")
        print("│  数据本地加密保存 · 按 Ctrl+C 退出            │")
        print("└─────────────────────────────────────────────┘")
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已退出。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
