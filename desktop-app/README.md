# Hosteleaze Desktop Gatepass App

A native Python desktop application for campus gate management — faster than browser, works with USB camera.

## 📁 Structure

```
desktop-app/
├── main.py              ← Entry point (run this)
├── config.py            ← API URL, colors, settings
├── requirements.txt     ← Python dependencies
├── start.bat            ← One-click Windows launcher
├── core/
│   ├── api.py           ← Railway API communication
│   ├── face_engine.py   ← Local face matching + SQLite
│   └── qr_scanner.py   ← OpenCV QR scanning
└── ui/
    ├── login_screen.py  ← Gate login UI
    └── gate_screen.py   ← Main split-screen gate UI
```

## 🚀 Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure API URL
Edit `config.py` and set:
```python
API_BASE_URL = "https://hosteleaze.com"   # your Railway URL
TENANT_SLUG  = "ogi"                       # your tenant slug
```

### 3. Run the app
```bash
python main.py
# OR double-click start.bat
```

## 🏗️ Build .exe for Distribution

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name "HostelEaze-GatePass" --icon assets/icon.ico main.py
```
The `.exe` will be in the `dist/` folder. Upload to Cloudflare R2.

## 🔑 Login

Use the same gate password configured in your web portal under **Manage Gatepass**.

## 📷 USB Camera

Plug in any USB webcam. The app auto-detects it. For face scanning mode, the camera opens automatically and starts scanning.

## 🌐 Offline Mode

If internet drops:
- QR scanning continues (tokens are generated locally)  
- Scan results are queued in local SQLite database
- When internet restores, queued scans are auto-synced to Railway

## ⚡ Why It's Faster Than Browser

| Feature | Browser | Desktop App |
|---|---|---|
| Camera start | 2–4 seconds | < 0.5 seconds |
| Face match | Via JS | Direct Python/NumPy |
| QR decode | Via JS | Native C (pyzbar) |
| Startup | 3–8 seconds | < 1 second |
