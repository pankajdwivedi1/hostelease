"""
HOSTELEAZE 100% Native Desktop Gatepass App
main.py — Pure Python / OpenCV / CustomTkinter Native Windows Desktop Application
DirectShow USB camera hardware access, CPU-native face matching & QR scanning, 0% browser, 0% WebGL dependency.
Guaranteed compatibility across Windows 7, 8, 10, and 11.
"""

import os
import sys

# ── Windows 7 & Legacy CPU Compatibility ──
# 1. Force OpenBLAS to use SSE2 (prevents AVX/AVX2 illegal instruction crashes on Intel Core 2 Duo)
os.environ["OPENBLAS_CORETYPE"] = "SSE2"
os.environ["PYTHONLEGACYWINDOWSSTDIO"] = "1"

# 2. Deactivate shcore.dll automatic DPI awareness (shcore.dll does NOT exist on Windows 7)
try:
    import customtkinter as ctk
    ctk.deactivate_automatic_dpi_awareness()
except Exception:
    pass

import threading
import time

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)

from config import COLORS, APP_TITLE


def run_native_gui_app():
    """
    Launches 100% Native Pure Desktop GUI.
    Zero Browser, Zero WebView2, Zero WebGL.
    Works natively on Windows 7, 8, 10, 11 with direct USB camera access.
    """
    import customtkinter as ctk
    from ui.login_screen import LoginScreen
    from ui.gate_screen import GateScreen

    class HostelEazeNativeApp(ctk.CTk):
        def __init__(self):
            super().__init__()
            ctk.set_appearance_mode("dark")
            ctk.set_default_color_theme("blue")

            self.title(APP_TITLE)
            self.geometry("1366x850")
            self.minsize(1024, 680)
            self.configure(fg_color=COLORS["bg_dark"])

            # Set icon
            icon_path = os.path.join(base_dir, "assets", "icon.ico")
            if not os.path.exists(icon_path):
                uvw_src = os.path.join(os.path.dirname(base_dir), "public", "uvw_logo.jpg")
                if os.path.exists(uvw_src):
                    try:
                        from PIL import Image
                        os.makedirs(os.path.dirname(icon_path), exist_ok=True)
                        img = Image.open(uvw_src).convert("RGBA")
                        icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
                        img.save(icon_path, format="ICO", sizes=icon_sizes)
                    except Exception:
                        icon_path = None
                else:
                    icon_path = None

            if icon_path and os.path.exists(icon_path):
                try:
                    self.iconbitmap(icon_path)
                except Exception:
                    pass

            self._current_screen = None
            self.protocol("WM_DELETE_WINDOW", self._on_close)

            # Start with Login Screen
            self.show_login()

        def show_login(self):
            if self._current_screen is not None:
                if hasattr(self._current_screen, "cleanup"):
                    try:
                        self._current_screen.cleanup()
                    except Exception:
                        pass
                self._current_screen.destroy()

            self._current_screen = LoginScreen(self, on_login_success=self.show_gate)
            self._current_screen.pack(fill="both", expand=True)

        def show_gate(self, gate_info: dict):
            if self._current_screen is not None:
                if hasattr(self._current_screen, "cleanup"):
                    try:
                        self._current_screen.cleanup()
                    except Exception:
                        pass
                self._current_screen.destroy()

            self._current_screen = GateScreen(self, gate_info=gate_info, on_logout=self.show_login)
            self._current_screen.pack(fill="both", expand=True)

        def _on_close(self):
            if self._current_screen and hasattr(self._current_screen, "cleanup"):
                try:
                    self._current_screen.cleanup()
                except Exception:
                    pass
            self.destroy()
            sys.exit(0)

    app = HostelEazeNativeApp()
    app.mainloop()


def run_webview_app():
    """
    Fallback webview runner when explicitly requested with --web flag.
    """
    import webview

    GATEPASS_PROD_URL = "https://www.hosteleaze.com/getpass"
    GATEPASS_LOCAL_URL = "http://localhost:3000/getpass"

    target_url = GATEPASS_PROD_URL
    try:
        import requests
        r = requests.get(GATEPASS_LOCAL_URL, timeout=0.6)
        if r.status_code == 200:
            target_url = GATEPASS_LOCAL_URL
    except Exception:
        pass

    storage_path = os.path.join(
        os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
        "HostelEaze",
        "WebView2Data"
    )
    os.makedirs(storage_path, exist_ok=True)

    icon_path = os.path.join(base_dir, "assets", "icon.ico")

    window = webview.create_window(
        title=APP_TITLE,
        url=target_url,
        width=1366,
        height=850,
        min_size=(1024, 680),
        frameless=False,
        easy_drag=False
    )

    webview.start(
        storage_path=storage_path,
        private_mode=False,
        gui="edgechromium",
        icon=icon_path if os.path.exists(icon_path) else None
    )


if __name__ == "__main__":
    try:
        if "--web" in sys.argv:
            run_webview_app()
        else:
            run_native_gui_app()
    except Exception as ex:
        err_msg = str(ex)
        import traceback
        tb_msg = traceback.format_exc()
        try:
            log_path = os.path.join(os.environ.get("TEMP", os.path.expanduser("~")), "hosteleaze_error.log")
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(tb_msg)
        except Exception:
            pass
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(
                0,
                f"Could not start HostelEaze Desktop:\n\n{err_msg}\n\nSee log in %TEMP%\\hosteleaze_error.log",
                "HostelEaze Error",
                0x10
            )
        except Exception:
            try:
                import tkinter as tk
                from tkinter import messagebox
                root = tk.Tk()
                root.withdraw()
                messagebox.showerror(
                    "HostelEaze Error",
                    f"Could not start HostelEaze Desktop:\n\n{err_msg}"
                )
                root.destroy()
            except Exception:
                pass
