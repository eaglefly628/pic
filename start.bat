@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 君百家 · 家庭电子管理系统 ...
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; print(sys.version)" >nul 2>nul
  if not errorlevel 1 (
    py -3 run.py
    goto :done
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; print(sys.version)" >nul 2>nul
  if not errorlevel 1 (
    python run.py
    goto :done
  )
)
echo Python 3 was not found. Install Python and restart this launcher.
:done
pause
