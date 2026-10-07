@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0surface-handoff.ps1"
if errorlevel 1 (
  echo.
  echo 执行没有完成。请保留本窗口，把上方红色错误拍照发给 Codex。
  pause
)
