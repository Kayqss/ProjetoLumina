@echo off
setlocal enabledelayedexpansion

REM Move to the directory of this script
cd /d "%~dp0"

echo Starting Lumina backend and frontend...

REM Start backend (server) in a new window
start "Lumina Backend" cmd /k cd /d "%~dp0server" ^&^& npm start

REM Small delay to let backend begin listening
timeout /t 2 /nobreak >nul

REM Start frontend (Vite) in a new window
start "Lumina Frontend" cmd /k cd /d "%~dp0" ^&^& npm run dev

REM Open default browser to the Vite dev server
timeout /t 3 /nobreak >nul
start "" http://localhost:5173/

echo Launch commands issued. You can close this window.
exit /b 0
