@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies were not found. Running installer...
  call "%~dp0install.bat"
  if errorlevel 1 exit /b 1
)

echo Starting MorseMotion. Close this window or press Ctrl+C to stop.
call npm.cmd run dev -- --open
pause
