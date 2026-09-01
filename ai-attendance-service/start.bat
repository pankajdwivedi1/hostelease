@echo off
echo ===================================================
echo   Starting Hostelease AI Attendance Microservice
echo ===================================================

cd /d "%~dp0"

IF NOT EXIST "venv" (
    echo [*] Creating virtual environment...
    python -m venv venv
)

echo [*] Activating virtual environment...
call venv\Scripts\activate.bat

echo [*] Installing dependencies...
pip install -r requirements.txt

echo [*] Starting FastAPI Server on port 8000...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
