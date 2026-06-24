@echo off
cd /d "%~dp0"
echo Starting MyStock Lab dev server on http://localhost:5173 ...
npm run dev -- --port 5173
pause
