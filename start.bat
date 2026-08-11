@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 君百家 · 家庭电子管理系统 ...
where node >nul 2>nul && (node desktop\server.js) || (py run.py 2>nul || python run.py)
pause
