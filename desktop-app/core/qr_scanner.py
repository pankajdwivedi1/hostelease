"""
HOSTELEAZE Desktop Gatepass App
core/qr_scanner.py — USB camera QR scanning via OpenCV + pyzbar
"""

import cv2
import numpy as np
import threading
import time
from typing import Callable, Optional
try:
    from pyzbar import pyzbar
    PYZBAR_OK = True
except ImportError:
    PYZBAR_OK = False


class CameraScanner:
    """
    Unified camera feed manager for QR + Face scanning.
    Runs camera in a background thread, calls callbacks on each frame.
    """

    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self._cap: Optional[cv2.VideoCapture] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._frame_callbacks: list = []
        self._last_frame = None
        self._lock = threading.Lock()
        self._error: Optional[str] = None

    def add_frame_callback(self, cb: Callable):
        """Register a callback that receives each BGR frame."""
        self._frame_callbacks.append(cb)

    def start(self) -> bool:
        """Open camera and start background capture thread."""
        try:
            self._cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
            if not self._cap.isOpened():
                # Try without backend flag
                self._cap = cv2.VideoCapture(self.camera_index)
            if not self._cap.isOpened():
                self._error = f"Cannot open camera {self.camera_index}. Check USB camera connection."
                return False
            # Set preferred resolution
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self._cap.set(cv2.CAP_PROP_FPS, 30)
            self._running = True
            self._thread = threading.Thread(target=self._capture_loop, daemon=True)
            self._thread.start()
            return True
        except Exception as e:
            self._error = str(e)
            return False

    def stop(self):
        """Stop camera feed."""
        self._running = False
        if self._cap:
            self._cap.release()
            self._cap = None

    def get_last_frame(self):
        with self._lock:
            return self._last_frame.copy() if self._last_frame is not None else None

    def get_error(self) -> Optional[str]:
        return self._error

    def _capture_loop(self):
        while self._running:
            if not self._cap or not self._cap.isOpened():
                time.sleep(0.1)
                continue
            ret, frame = self._cap.read()
            if not ret:
                time.sleep(0.05)
                continue
            with self._lock:
                self._last_frame = frame
            for cb in self._frame_callbacks:
                try:
                    cb(frame)
                except Exception:
                    pass
            time.sleep(0.03)  # ~30fps


def scan_qr_from_frame(frame_bgr: np.ndarray) -> Optional[str]:
    """
    Scan a single OpenCV frame for QR codes.
    Returns the decoded string or None.
    """
    if not PYZBAR_OK:
        return None
    try:
        decoded = pyzbar.decode(frame_bgr)
        for d in decoded:
            if d.type == "QRCODE":
                return d.data.decode("utf-8", errors="ignore")
    except Exception:
        pass
    return None


def list_available_cameras(max_test: int = 5) -> list:
    """Return list of available camera indices."""
    available = []
    for i in range(max_test):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            available.append(i)
            cap.release()
    return available


def frame_to_pil(frame_bgr: np.ndarray):
    """Convert OpenCV BGR frame to PIL Image for display in Tkinter."""
    from PIL import Image
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)
