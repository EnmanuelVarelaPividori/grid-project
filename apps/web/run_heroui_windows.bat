@echo off
setlocal
cd /d "%~dp0..\.."
call pnpm --filter @gridshare/web build || exit /b 1
where py >nul 2>nul
if not errorlevel 1 (py apps/web/app.py --open & exit /b %errorlevel%)
python apps/web/app.py --open
