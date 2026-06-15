@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 君白家专用理财 ...
py run.py 2>nul || python run.py
pause
