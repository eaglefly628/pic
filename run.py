#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""总启动器：二选一启动「理财」或「家庭影像」。也可直接进各自子目录运行其 run.py。"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APPS = {
    "1": ("project-one", "理财 · junbai家专用理财软件", "http://127.0.0.1:5180/"),
    "2": ("project-two", "家庭影像 · 照片/视频", "http://127.0.0.1:5181/"),
}


def main() -> int:
    print("请选择要启动的应用：")
    for k, (_, name, url) in APPS.items():
        print(f"  [{k}] {name}   → {url}")
    choice = input("输入 1 或 2 回车：").strip()
    app = APPS.get(choice)
    if not app:
        print("无效选择。")
        return 1
    proj = ROOT / app[0]
    return subprocess.run([sys.executable, "run.py"], cwd=str(proj)).returncode


if __name__ == "__main__":
    raise SystemExit(main())
