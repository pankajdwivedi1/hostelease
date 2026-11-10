@echo off
title Hosteleaze Gatepass — Desktop App
cd /d "%~dp0"
echo Starting Hosteleaze Gatepass Desktop...
python main.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: App failed to start. Make sure Python and dependencies are installed.
    echo Run: pip install -r requirements.txt
    pause
)
