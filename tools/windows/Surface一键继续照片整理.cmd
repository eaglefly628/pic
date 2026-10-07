@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0surface-handoff.ps1"
if errorlevel 1 (
  echo.
  echo The handoff did not finish. Take a photo of the red error and send it to Codex.
  pause
)
