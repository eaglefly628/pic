@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 junbai家专用理财软件 ...
py run.py 2>nul || python run.py
pause
