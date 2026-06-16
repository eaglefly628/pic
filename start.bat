@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   请选择要启动的应用
echo   [1] 理财          http://127.0.0.1:5180
echo   [2] 家庭影像      http://127.0.0.1:5181
echo ============================================
set /p c=输入 1 或 2 然后回车：
if "%c%"=="1" ( cd project-one & ( py run.py 2>nul || python run.py ) )
if "%c%"=="2" ( cd project-two & ( py run.py 2>nul || python run.py ) )
pause
