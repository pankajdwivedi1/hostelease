#!/bin/bash
set -e

echo "==================================================="
echo "  Starting Hostelease AI Attendance Microservice"
echo "==================================================="

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "[*] Creating virtual environment..."
    python3 -m venv venv
fi

echo "[*] Activating virtual environment..."
source venv/bin/activate

echo "[*] Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "[*] Starting FastAPI Server with 4 Uvicorn workers on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
