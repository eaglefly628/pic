#!/bin/bash
# 「我家里的一切」——双击这个文件即可启动（会打开一个终端小窗 + 浏览器）。
# 数据自动存到本机磁盘，不会丢；关掉终端窗口即退出。
cd "$(dirname "$0")" || exit 1

echo "正在启动「我家里的一切」…（数据自动存到本机、不会丢；关掉本窗口即退出）"

if command -v python3 >/dev/null 2>&1; then
  exec python3 run.py
elif command -v python >/dev/null 2>&1; then
  exec python run.py
else
  echo ""
  echo "✗ 没找到 Python。请先装 Python 3：https://www.python.org/downloads/"
  echo ""
  read -r -p "按回车键退出…" _
  exit 1
fi
