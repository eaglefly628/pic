@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 家庭影像 Family Gallery ...
py run.py 2>nul || python run.py
pause
