"""
HOSTELEAZE Desktop Gatepass App
ui/gate_screen.py — Exact replica of www.hosteleaze.com Web Gatepass View
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import messagebox
import threading
import time
import json
import hashlib
import hmac
import datetime
import io
import os
import sys
from typing import Optional, Callable, Dict, Any
from PIL import Image, ImageTk, ImageDraw, ImageFont
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    COLORS, LIVE_DASHBOARD_REFRESH_SECONDS,
    GALLERY_SYNC_INTERVAL_MINUTES, QR_HMAC_SECRET
)
from core.api import HostelEazeAPI
from core.face_engine import (
    load_gallery_from_db, save_gallery_to_db, match_face,
    check_skin_tone, check_screen_spoof, queue_offline_scan,
    get_pending_offline_queue, mark_offline_synced
)

try:
    import cv2
    import numpy as np
    CV2_OK = True
except ImportError:
    CV2_OK = False

try:
    from pyzbar import pyzbar
    PYZBAR_OK = True
except ImportError:
    PYZBAR_OK = False

try:
    import qrcode
    QRCODE_OK = True
except ImportError:
    QRCODE_OK = False


# ── Image Caching & Helpers ──────────────────────────────────────────────────

_AVATAR_CACHE: Dict[str, ctk.CTkImage] = {}

def get_ist_now() -> datetime.datetime:
    return datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)


def fmt_duration(minutes: int) -> str:
    if not minutes or minutes <= 0:
        return "Just now"
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    rem_min = minutes % 60
    if hours < 24:
        return f"{hours}h {rem_min}m" if rem_min else f"{hours}h"
    days = hours // 24
    rem_hours = hours % 24
    return f"{days}d {rem_hours}h {rem_min}m"


def fmt_time_ampm(time_str: str) -> str:
    if not time_str:
        return ""
    try:
        if "T" in time_str or "Z" in time_str:
            dt = datetime.datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            dt = dt + datetime.timedelta(hours=5, minutes=30)
            return dt.strftime("%I:%M:%S %p")
        if ":" in time_str:
            parts = time_str.split(":")
            if len(parts) >= 2:
                hr = int(parts[0])
                mn = parts[1][:2]
                ampm = "AM" if hr < 12 else "PM"
                hr12 = hr % 12
                if hr12 == 0:
                    hr12 = 12
                sec = parts[2][:2] if len(parts) > 2 else "00"
                return f"{hr12:02d}:{mn}:{sec} {ampm}"
        return time_str[:11]
    except Exception:
        return time_str[:11]


def make_initials_avatar(name: str, size: int = 32, bg_color: str = "#2563eb") -> ctk.CTkImage:
    img = Image.new("RGB", (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    letter = (name.strip()[0].upper()) if name.strip() else "?"
    try:
        font = ImageFont.truetype("arial.ttf", int(size * 0.55))
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), letter, font=font)
    tx = (size - (bbox[2] - bbox[0])) // 2
    ty = (size - (bbox[3] - bbox[1])) // 2
    draw.text((tx, ty), letter, fill="white", font=font)
    return ctk.CTkImage(img, size=(size, size))


def get_cached_avatar(url: Optional[str], name: str, size: int = 32,
                       callback: Optional[Callable[[ctk.CTkImage], None]] = None) -> ctk.CTkImage:
    cache_key = f"{url}_{size}" if url else f"name_{name}_{size}"
    if cache_key in _AVATAR_CACHE:
        return _AVATAR_CACHE[cache_key]

    fallback = make_initials_avatar(name, size)
    _AVATAR_CACHE[cache_key] = fallback

    if url and callback:
        def _fetch():
            try:
                resp = requests.get(url, timeout=4)
                if resp.status_code == 200:
                    pil_img = Image.open(io.BytesIO(resp.content)).convert("RGB")
                    pil_img = pil_img.resize((size, size), Image.LANCZOS)
                    ctk_img = ctk.CTkImage(pil_img, size=(size, size))
                    _AVATAR_CACHE[cache_key] = ctk_img
                    callback(ctk_img)
            except Exception:
                pass
        threading.Thread(target=_fetch, daemon=True).start()

    return fallback


def make_clean_qr(data: str, size: int = 420) -> Image.Image:
    if not QRCODE_OK:
        img = Image.new("RGB", (size, size), "white")
        d = ImageDraw.Draw(img)
        d.text((size // 4, size // 2), "Install qrcode[pil]", fill="black")
        return img
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((size, size), Image.LANCZOS)


# ── Student Card Row (for Outside & Returns Today) ───────────────────────────

class StudentRow(ctk.CTkFrame):
    """
    Compact, crisp replica of student card in web:
    [Avatar 24x24]  NAME (bold) [GATE-PASS/HOME-LEAVE]       [Duration]
                    YEAR • SEM • HOSTEL • ROOM                [IST Time]
    Uses rock-solid pack layout so labels are NEVER clipped or invisible.
    """

    def __init__(self, master, record: dict, is_outside: bool = True, **kwargs):
        super().__init__(
            master,
            fg_color=COLORS["bg_row"],
            corner_radius=8,
            border_width=1,
            border_color="#1e293b",
            **kwargs
        )
        self._build(record, is_outside)

    def _build(self, r: dict, is_outside: bool):
        name = (r.get("studentName") or r.get("name") or "Unknown Student").upper()
        reg = r.get("registrationId") or r.get("registration_id") or ""
        room = r.get("roomNumber") or r.get("room_number") or ""
        hostel = r.get("hostelName") or r.get("hostel_name") or ""
        year = r.get("year") or "1ST YEAR"
        sem = r.get("semester") or "1ST SEM"
        photo_url = r.get("profilePicture") or r.get("profile_picture") or r.get("photo")

        rtype = str(r.get("type", "outing")).lower()
        is_leave = "leave" in rtype or rtype == "hleave"
        is_overdue = bool(r.get("isOverdue", False))

        dur_mins = r.get("currentDurationMinutes") or r.get("durationMinutes") or 0
        dur_text = r.get("currentDurationText") or fmt_duration(dur_mins)

        time_val = (r.get("checkOutISTTime") or r.get("checkInISTTime") or
                    fmt_time_ampm(r.get("checkOutTime", "") or r.get("checkInTime", "")))

        # ── 1. AVATAR (left, 24x24) ──
        avatar_holder = ctk.CTkFrame(
            self, width=28, height=28,
            fg_color="#0f172a",
            corner_radius=6,
            border_width=1,
            border_color="#38bdf8" if is_leave else "#00ff88"
        )
        avatar_holder.pack(side="left", padx=(6, 6), pady=4)
        avatar_holder.pack_propagate(False)

        avatar_lbl = ctk.CTkLabel(avatar_holder, text="")
        avatar_lbl.place(relx=0.5, rely=0.5, anchor="center")

        def _update_avatar(img: ctk.CTkImage):
            try:
                if avatar_lbl.winfo_exists():
                    avatar_lbl.configure(image=img)
            except Exception:
                pass

        initial_img = get_cached_avatar(photo_url, name, size=24, callback=_update_avatar)
        avatar_lbl.configure(image=initial_img)

        # ── 2. DURATION / TIME (right) ──
        right_box = ctk.CTkFrame(self, fg_color="transparent")
        right_box.pack(side="right", padx=(4, 8), pady=3)

        if is_outside:
            dur_color = "#ef4444" if (is_overdue or dur_mins > 300) else ("#fbbf24" if dur_mins > 60 else "#38bdf8")
        else:
            dur_color = "#00ff88"

        self._dur_lbl = ctk.CTkLabel(
            right_box,
            text=dur_text,
            font=("Segoe UI", 9, "bold"),
            text_color=dur_color,
            anchor="e"
        )
        self._dur_lbl.pack(anchor="e")

        if time_val:
            self._time_lbl = ctk.CTkLabel(
                right_box,
                text=time_val,
                font=("Segoe UI", 7.5),
                text_color=COLORS["text_dark_dim"],
                anchor="e"
            )
            self._time_lbl.pack(anchor="e")

        # ── 3. STUDENT INFO (center, expandable) ──
        center_box = ctk.CTkFrame(self, fg_color="transparent")
        center_box.pack(side="left", fill="both", expand=True, pady=3)

        top_line = ctk.CTkFrame(center_box, fg_color="transparent")
        top_line.pack(fill="x", anchor="w")

        name_lbl = ctk.CTkLabel(
            top_line,
            text=name,
            font=("Segoe UI", 9.5, "bold"),
            text_color=COLORS["text_white"],
            anchor="w"
        )
        name_lbl.pack(side="left")

        # Badge
        if is_leave:
            badge_bg = COLORS["badge_leave_bg"]
            badge_fg = COLORS["badge_leave_fg"]
            badge_text = "🏠 HOME-LEAVE"
        else:
            badge_bg = COLORS["badge_gp_bg"]
            badge_fg = COLORS["badge_gp_fg"]
            badge_text = "🎫 GATE-PASS"

        if is_overdue:
            badge_bg = "#450a0a"
            badge_fg = "#ef4444"
            badge_text = "⚠ OVERDUE"

        badge = ctk.CTkFrame(top_line, fg_color=badge_bg, corner_radius=3)
        badge.pack(side="left", padx=(6, 0))
        ctk.CTkLabel(
            badge,
            text=badge_text,
            font=("Segoe UI", 7, "bold"),
            text_color=badge_fg
        ).pack(padx=4, pady=1)

        # Subtitle
        sub_parts = []
        if year:
            sub_parts.append(str(year).upper())
        if sem:
            sub_parts.append(str(sem).upper())
        if hostel:
            sub_parts.append(str(hostel).upper())
        if room:
            sub_parts.append(f"ROOM {room}")

        sub_str = " • ".join(sub_parts) if sub_parts else (reg or "STUDENT")
        sub_lbl = ctk.CTkLabel(
            center_box,
            text=sub_str,
            font=("Segoe UI", 7.5),
            text_color=COLORS["text_dim"],
            anchor="w"
        )
        sub_lbl.pack(anchor="w", pady=(1, 0))


# ── Main Gate Screen ─────────────────────────────────────────────────────────

class GateScreen(ctk.CTkFrame):
    def __init__(self, master, gate_info: dict, on_logout: Callable):
        super().__init__(master, fg_color=COLORS["bg_dark"], corner_radius=0)
        self._api: HostelEazeAPI = gate_info["api"]
        self._gate_name: str = gate_info.get("gateName", "Main Gate")
        self._gate_id: str = gate_info.get("gateId", "main-gate")
        self._gate_mode: str = gate_info.get("gateMode", "qr")
        self._qr_seconds: int = gate_info.get("qrSeconds", 15)
        self._on_logout = on_logout

        # State
        self._live_data = {
            "summary": {"totalStudents": 0, "studentsIn": 0, "studentsOut": 0, "leaveCount": 0, "gatePassCount": 0},
            "currentlyOut": [],
            "recentActivity": []
        }
        self._qr_data: str = ""
        self._qr_time_left: int = self._qr_seconds
        self._cam_cap = None
        self._cam_running = False
        self._gallery = []
        self._last_scan_time: float = 0
        self._scan_cooldown: float = 3.0
        self._is_fullscreen = False
        self._matching_in_progress = False
        self._current_out_ids = []
        self._current_ret_ids = []
        self._consecutive_match = {"studentId": None, "count": 0}
        self._last_processed_student_id = None
        self._last_processed_time = 0.0
        self._latest_cam_pil = None
        self._cam_render_job = None
        self._smoothed_box = None
        self._face_miss_count = 0
        self._last_match_attempt_time = 0.0
        self._current_sub_status_text = ""

        # Pre-warm face recognition model in background to prevent first-scan lag
        def _prewarm():
            try:
                import face_recognition as fr
                dummy = np.zeros((100, 100, 3), dtype=np.uint8)
                fr.face_encodings(dummy, [(10, 90, 90, 10)])
            except Exception:
                pass
        threading.Thread(target=_prewarm, daemon=True).start()

        self._build_layout()
        self._start_services()

    # ─────────────────────── MAIN LAYOUT ──────────────────────────

    def _build_layout(self):
        self.grid_rowconfigure(0, weight=1)
        # Exact proportion: 42% left, 58% right with uniform lock
        self.grid_columnconfigure(0, weight=42, uniform="main_cols")
        self.grid_columnconfigure(1, weight=58, uniform="main_cols")

        # ── LEFT PANEL (QR / Camera View) ──
        self._left_frame = ctk.CTkFrame(
            self,
            fg_color=COLORS["bg_left"],
            corner_radius=0,
            border_width=0
        )
        self._left_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        self._build_left_section(self._left_frame)

        # ── RIGHT PANEL (Live Campus Status) ──
        self._right_frame = ctk.CTkFrame(
            self,
            fg_color=COLORS["bg_right"],
            corner_radius=0,
            border_width=1,
            border_color="#111827"
        )
        self._right_frame.grid(row=0, column=1, sticky="nsew", padx=0, pady=0)
        self._build_right_section(self._right_frame)

    # ─────────────────────── LEFT SECTION ─────────────────────────

    def _build_left_section(self, parent):
        parent.grid_rowconfigure(2, weight=1)
        parent.grid_columnconfigure(0, weight=1)

        # 1. Top Header Row
        hdr = ctk.CTkFrame(parent, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=20, pady=(16, 6))

        title_lbl = ctk.CTkLabel(
            hdr,
            text="GATEPASS",
            font=("Segoe UI", 24, "bold"),
            text_color=COLORS["accent_green"]
        )
        title_lbl.pack(side="left")

        # Flow breadcrumb pill
        self._flow_pill_frame = ctk.CTkFrame(hdr, fg_color="#0d1f18", corner_radius=12,
                                             border_width=1, border_color="#1a4731")
        self._flow_pill_frame.pack(side="right")
        self._flow_pill_lbl = ctk.CTkLabel(
            self._flow_pill_frame,
            text="📱 Open App  ➔  📷 Scan QR  ➔  ✅ Done",
            font=("Segoe UI", 10, "bold"),
            text_color=COLORS["accent_green"]
        )
        self._flow_pill_lbl.pack(padx=10, pady=4)

        # 2. Gate identity pills
        sub_pill_row = ctk.CTkFrame(parent, fg_color="transparent")
        sub_pill_row.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 10))

        inst_pill = ctk.CTkFrame(sub_pill_row, fg_color="#0c2336", corner_radius=6,
                                 border_width=1, border_color="#0284c7")
        inst_pill.pack(side="left")
        self._inst_pill_lbl = ctk.CTkLabel(
            inst_pill,
            text=f"🏛 {self._gate_name.upper()}",
            font=("Segoe UI", 9, "bold"),
            text_color="#38bdf8"
        )
        self._inst_pill_lbl.pack(padx=8, pady=2)

        self._mode_pill = ctk.CTkFrame(sub_pill_row, fg_color="#1e1b4b", corner_radius=6,
                                       border_width=1, border_color="#6366f1")
        self._mode_pill.pack(side="left", padx=8)
        self._mode_pill_lbl = ctk.CTkLabel(
            self._mode_pill,
            text="QR CODE  CAMPUS OUTING SYSTEM",
            font=("Segoe UI", 8, "bold"),
            text_color="#a5b4fc"
        )
        self._mode_pill_lbl.pack(padx=8, pady=2)

        # 3. Time + Timer Bar
        clock_row = ctk.CTkFrame(parent, fg_color="transparent")
        clock_row.grid(row=2, column=0, sticky="new", padx=20, pady=(0, 12))

        # Timer Box
        self._timer_box = ctk.CTkFrame(clock_row, width=70, height=42,
                                       fg_color="#062419", corner_radius=10,
                                       border_width=2, border_color=COLORS["accent_green"])
        self._timer_box.pack(side="left", padx=(0, 14))
        self._timer_box.pack_propagate(False)
        self._timer_val_lbl = ctk.CTkLabel(
            self._timer_box,
            text=f"{self._qr_seconds}s",
            font=("Segoe UI", 16, "bold"),
            text_color=COLORS["accent_green"]
        )
        self._timer_val_lbl.place(relx=0.5, rely=0.5, anchor="center")

        # Digital Clock
        self._clock_time_lbl = ctk.CTkLabel(
            clock_row,
            text="00:00:00 PM",
            font=("Segoe UI", 22, "bold"),
            text_color=COLORS["text_white"]
        )
        self._clock_time_lbl.pack(side="left", padx=(0, 10))

        sep_lbl = ctk.CTkLabel(
            clock_row,
            text="|",
            font=("Segoe UI", 20),
            text_color=COLORS["text_dark_dim"]
        )
        sep_lbl.pack(side="left", padx=(0, 10))

        self._clock_date_lbl = ctk.CTkLabel(
            clock_row,
            text="01-01-2026",
            font=("Segoe UI", 18, "bold"),
            text_color=COLORS["text_light"]
        )
        self._clock_date_lbl.pack(side="left")

        # 4. CENTER STAGE: QR Code or Camera Frame (Clean, high-visibility, fixed box)
        self._center_stage = ctk.CTkFrame(parent, fg_color="transparent")
        self._center_stage.grid(row=3, column=0, sticky="nsew", padx=20, pady=(0, 14))
        parent.grid_rowconfigure(3, weight=1)
        self._center_stage.grid_rowconfigure(0, weight=1)
        self._center_stage.grid_columnconfigure(0, weight=1)

        # ── A. QR CONTAINER ──
        self._qr_container = ctk.CTkFrame(
            self._center_stage,
            fg_color="#030712",
            corner_radius=28,
            border_width=4,
            border_color=COLORS["accent_green"]
        )
        self._qr_container.grid(row=0, column=0, sticky="", padx=10, pady=10)
        self._qr_img_lbl = ctk.CTkLabel(self._qr_container, text="", corner_radius=20)
        self._qr_img_lbl.pack(padx=16, pady=16)

        # ── B. CAMERA CONTAINER ──
        self._cam_container = ctk.CTkFrame(
            self._center_stage,
            fg_color="#030712",
            corner_radius=28,
            border_width=3,
            border_color="#38bdf8"
        )
        self._cam_container.grid(row=0, column=0, sticky="", padx=10, pady=10)
        self._cam_container.grid_remove()  # hidden initially

        # Top badge in camera frame
        cam_top_bar = ctk.CTkFrame(self._cam_container, fg_color="transparent")
        cam_top_bar.pack(fill="x", padx=14, pady=(10, 4))
        cam_front_pill = ctk.CTkFrame(cam_top_bar, fg_color="#0c2336", corner_radius=6,
                                      border_width=1, border_color="#0284c7")
        cam_front_pill.pack(side="right")
        ctk.CTkLabel(cam_front_pill, text="📷 FRONT CAMERA",
                     font=("Segoe UI", 8, "bold"), text_color="#38bdf8").pack(padx=6, pady=1)

        # Video feed view (Pure Tk Label for 0% flicker and hardware-speed pixmap update)
        self._cam_video_lbl = tk.Label(
            self._cam_container,
            bg="#030712",
            bd=0,
            highlightthickness=0,
            width=440,
            height=360
        )
        self._cam_video_lbl.pack(padx=12, pady=4)

        # Bottom bar in camera frame
        cam_bot_bar = ctk.CTkFrame(self._cam_container, fg_color="transparent")
        cam_bot_bar.pack(fill="x", padx=14, pady=(4, 10))
        self._cam_sub_status = ctk.CTkLabel(
            cam_bot_bar,
            text="● Looking for student face...",
            font=("Segoe UI", 10, "bold"),
            text_color="#38bdf8"
        )
        self._cam_sub_status.pack(side="left")

        cam_bio_pill = ctk.CTkLabel(
            cam_bot_bar,
            text="1:N BIOMETRIC",
            font=("Segoe UI", 8, "bold"),
            text_color=COLORS["text_dim"]
        )
        cam_bio_pill.pack(side="right")

    # ─────────────────────── RIGHT SECTION ────────────────────────

    def _build_right_section(self, parent):
        parent.grid_rowconfigure(2, weight=1)
        parent.grid_columnconfigure(0, weight=1)

        # 1. Header Bar: Title + Action Buttons
        top_bar = ctk.CTkFrame(parent, fg_color="transparent")
        top_bar.grid(row=0, column=0, sticky="ew", padx=18, pady=(16, 8))

        title_box = ctk.CTkFrame(top_bar, fg_color="transparent")
        title_box.pack(side="left")

        ctk.CTkLabel(title_box, text="📊", font=("Segoe UI", 16)).pack(side="left", padx=(0, 6))
        ctk.CTkLabel(
            title_box,
            text="Live Campus Status",
            font=("Segoe UI", 16, "bold"),
            text_color=COLORS["text_white"]
        ).pack(side="left")

        # Action Buttons (right)
        btn_box = ctk.CTkFrame(top_bar, fg_color="transparent")
        btn_box.pack(side="right")

        # Mode switch button
        self._switch_mode_btn = ctk.CTkButton(
            btn_box,
            text="📷 CAMERA MODE" if self._gate_mode == "qr" else "📋 QR MODE",
            font=("Segoe UI", 10, "bold"),
            fg_color="#0c2336",
            hover_color="#075985",
            border_width=1,
            border_color="#0284c7",
            text_color="#38bdf8",
            height=30,
            corner_radius=8,
            command=self._toggle_mode
        )
        self._switch_mode_btn.pack(side="left", padx=4)

        # Fullscreen
        ctk.CTkButton(
            btn_box,
            text="⛶",
            font=("Segoe UI", 12),
            fg_color="#161b2e",
            hover_color="#1e293b",
            border_width=1,
            border_color="#334155",
            text_color=COLORS["text_muted"],
            height=30, width=32,
            corner_radius=8,
            command=self._toggle_fullscreen
        ).pack(side="left", padx=4)

        # Logout
        ctk.CTkButton(
            btn_box,
            text="LOGOUT 🔒",
            font=("Segoe UI", 10, "bold"),
            fg_color="#2b0d10",
            hover_color="#450a0a",
            border_width=1,
            border_color="#7f1d1d",
            text_color="#ff6b6b",
            height=30,
            corner_radius=8,
            command=self._do_logout
        ).pack(side="left", padx=4)

        # 2. 4 Horizontal Summary Cards
        summary_row = ctk.CTkFrame(parent, fg_color="transparent")
        summary_row.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 10))
        for c in range(4):
            summary_row.grid_columnconfigure(c, weight=1, uniform="stat_cards")

        # Card 1: TOTAL
        c1 = ctk.CTkFrame(summary_row, fg_color="#0d1424", corner_radius=12,
                          border_width=1, border_color="#1e293b", height=78)
        c1.grid(row=0, column=0, sticky="ew", padx=4)
        c1.pack_propagate(False)
        ctk.CTkLabel(c1, text="👥", font=("Segoe UI", 14)).pack(pady=(6, 0))
        self._stat_total_lbl = ctk.CTkLabel(c1, text="0", font=("Segoe UI", 18, "bold"),
                                            text_color=COLORS["text_white"])
        self._stat_total_lbl.pack()
        ctk.CTkLabel(c1, text="TOTAL", font=("Segoe UI", 8, "bold"),
                     text_color=COLORS["text_dim"]).pack()

        # Card 2: IN CAMPUS
        c2 = ctk.CTkFrame(summary_row, fg_color="#072017", corner_radius=12,
                          border_width=1, border_color="#1a4731", height=78)
        c2.grid(row=0, column=1, sticky="ew", padx=4)
        c2.pack_propagate(False)
        ctk.CTkLabel(c2, text="🏠", font=("Segoe UI", 14)).pack(pady=(6, 0))
        self._stat_in_lbl = ctk.CTkLabel(c2, text="0", font=("Segoe UI", 18, "bold"),
                                         text_color=COLORS["accent_green"])
        self._stat_in_lbl.pack()
        ctk.CTkLabel(c2, text="IN CAMPUS", font=("Segoe UI", 8, "bold"),
                     text_color=COLORS["text_dim"]).pack()

        # Card 3: OUTSIDE (with sub-rows for Gatepass & Home-Leave)
        c3 = ctk.CTkFrame(summary_row, fg_color="#240c0f", corner_radius=12,
                          border_width=1, border_color="#5c1d1d", height=78)
        c3.grid(row=0, column=2, sticky="ew", padx=4)
        c3.pack_propagate(False)

        c3_top = ctk.CTkFrame(c3, fg_color="transparent")
        c3_top.pack(fill="x", padx=8, pady=(4, 2))
        ctk.CTkLabel(c3_top, text="OUTSIDE", font=("Segoe UI", 9, "bold"),
                     text_color="#ff6b6b").pack(side="left")
        self._stat_out_lbl = ctk.CTkLabel(c3_top, text="0", font=("Segoe UI", 14, "bold"),
                                          text_color="#ff6b6b")
        self._stat_out_lbl.pack(side="right")

        c3_mid = ctk.CTkFrame(c3, fg_color="transparent")
        c3_mid.pack(fill="x", padx=8, pady=0)
        ctk.CTkLabel(c3_mid, text="GATE-PASS", font=("Segoe UI", 7, "bold"),
                     text_color=COLORS["text_dim"]).pack(side="left")
        self._stat_gp_lbl = ctk.CTkLabel(c3_mid, text="0", font=("Segoe UI", 10, "bold"),
                                         text_color=COLORS["text_white"])
        self._stat_gp_lbl.pack(side="right")

        c3_bot = ctk.CTkFrame(c3, fg_color="transparent")
        c3_bot.pack(fill="x", padx=8, pady=0)
        ctk.CTkLabel(c3_bot, text="HOME-LEAVE", font=("Segoe UI", 7, "bold"),
                     text_color=COLORS["text_dim"]).pack(side="left")
        self._stat_hl_lbl = ctk.CTkLabel(c3_bot, text="0", font=("Segoe UI", 10, "bold"),
                                         text_color=COLORS["text_white"])
        self._stat_hl_lbl.pack(side="right")

        # Card 4: HISTORY
        c4 = ctk.CTkFrame(summary_row, fg_color="#141926", corner_radius=12,
                          border_width=1, border_color="#1e293b", height=78)
        c4.grid(row=0, column=3, sticky="ew", padx=4)
        c4.pack_propagate(False)
        ctk.CTkLabel(c4, text="📜", font=("Segoe UI", 14)).pack(pady=(6, 0))
        ctk.CTkLabel(c4, text="GO ➔", font=("Segoe UI", 14, "bold"),
                     text_color="#fbbf24").pack()
        ctk.CTkLabel(c4, text="HISTORY", font=("Segoe UI", 8, "bold"),
                     text_color=COLORS["text_dim"]).pack()

        # 3. Two Side-by-Side Scrollable Columns
        columns_frame = ctk.CTkFrame(parent, fg_color="transparent")
        columns_frame.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 16))
        columns_frame.grid_rowconfigure(1, weight=1)
        columns_frame.grid_columnconfigure(0, weight=1, uniform="list_cols")
        columns_frame.grid_columnconfigure(1, weight=1, uniform="list_cols")

        # ── LEFT SUB-COLUMN: OUTSIDE ──
        out_hdr = ctk.CTkFrame(columns_frame, fg_color="transparent")
        out_hdr.grid(row=0, column=0, sticky="ew", padx=4, pady=(0, 6))
        self._out_hdr_lbl = ctk.CTkLabel(
            out_hdr,
            text="🔴 Outside (0)",
            font=("Segoe UI", 12, "bold"),
            text_color=COLORS["text_white"]
        )
        self._out_hdr_lbl.pack(side="left")

        out_scroll_box = ctk.CTkFrame(columns_frame, fg_color="#070b12", corner_radius=12,
                                      border_width=1, border_color="#1e293b")
        out_scroll_box.grid(row=1, column=0, sticky="nsew", padx=4)
        out_scroll_box.grid_rowconfigure(0, weight=1)
        out_scroll_box.grid_columnconfigure(0, weight=1)

        self._out_scroll = ctk.CTkScrollableFrame(
            out_scroll_box,
            fg_color="transparent",
            scrollbar_button_color="#161b2e",
            scrollbar_button_hover_color="#334155"
        )
        self._out_scroll.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)
        self._out_scroll.grid_columnconfigure(0, weight=1)

        self._out_empty_lbl = ctk.CTkLabel(
            self._out_scroll,
            text="✅  All students are in campus",
            font=("Segoe UI", 11),
            text_color=COLORS["text_dark_dim"]
        )
        self._out_empty_lbl.grid(row=0, column=0, pady=30)

        # ── RIGHT SUB-COLUMN: RETURNS TODAY ──
        ret_hdr = ctk.CTkFrame(columns_frame, fg_color="transparent")
        ret_hdr.grid(row=0, column=1, sticky="ew", padx=4, pady=(0, 6))
        self._ret_hdr_lbl = ctk.CTkLabel(
            ret_hdr,
            text="🟢 Returns Today",
            font=("Segoe UI", 12, "bold"),
            text_color=COLORS["text_white"]
        )
        self._ret_hdr_lbl.pack(side="left")

        ret_scroll_box = ctk.CTkFrame(columns_frame, fg_color="#070b12", corner_radius=12,
                                      border_width=1, border_color="#1e293b")
        ret_scroll_box.grid(row=1, column=1, sticky="nsew", padx=4)
        ret_scroll_box.grid_rowconfigure(0, weight=1)
        ret_scroll_box.grid_columnconfigure(0, weight=1)

        self._ret_scroll = ctk.CTkScrollableFrame(
            ret_scroll_box,
            fg_color="transparent",
            scrollbar_button_color="#161b2e",
            scrollbar_button_hover_color="#334155"
        )
        self._ret_scroll.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)
        self._ret_scroll.grid_columnconfigure(0, weight=1)

        self._ret_empty_lbl = ctk.CTkLabel(
            self._ret_scroll,
            text="No returns recorded today",
            font=("Segoe UI", 11),
            text_color=COLORS["text_dark_dim"]
        )
        self._ret_empty_lbl.grid(row=0, column=0, pady=30)

    # ─────────────────────── SERVICES & TIMERS ────────────────────

    def _start_services(self):
        self._update_clock()
        self._load_face_gallery()
        self._refresh_live_data()

        if self._gate_mode == "qr":
            self._set_qr_view()
        else:
            self._set_camera_view()

    def _update_clock(self):
        now = get_ist_now()
        self._clock_time_lbl.configure(text=now.strftime("%I:%M:%S %p"))
        self._clock_date_lbl.configure(text=now.strftime("%d-%m-%Y"))
        self.after(1000, self._update_clock)

    # ─────────────────────── QR LOGIC ─────────────────────────────

    def _set_qr_view(self):
        self._gate_mode = "qr"
        self._stop_camera()
        self._cam_container.grid_remove()
        self._qr_container.grid()

        self._flow_pill_lbl.configure(text="📱 Open App  ➔  📷 Scan QR  ➔  ✅ Done")
        self._mode_pill_lbl.configure(text="QR CODE  CAMPUS OUTING SYSTEM")
        self._switch_mode_btn.configure(text="📷 CAMERA MODE")
        self._timer_box.pack(side="left", padx=(0, 14))

        self._generate_qr()
        self._start_qr_timer()

    def _generate_qr(self):
        qr_info = self._api.generate_qr_data(self._gate_name, self._qr_seconds)
        self._qr_data = qr_info["qrData"]

        def _worker():
            pil_img = make_clean_qr(self._qr_data, size=400)
            ctk_img = ctk.CTkImage(pil_img, size=(400, 400))
            self.after(0, lambda: self._qr_img_lbl.configure(image=ctk_img))

        threading.Thread(target=_worker, daemon=True).start()

    def _start_qr_timer(self):
        self._qr_time_left = self._qr_seconds
        self._tick_qr()

    def _tick_qr(self):
        if self._gate_mode != "qr":
            return
        self._qr_time_left -= 1
        clr = "#ef4444" if self._qr_time_left <= 3 else COLORS["accent_green"]
        self._timer_val_lbl.configure(text=f"{self._qr_time_left}s", text_color=clr)
        self._timer_box.configure(border_color=clr)

        if self._qr_time_left <= 0:
            self._generate_qr()
            self._qr_time_left = self._qr_seconds

        self.after(1000, self._tick_qr)

    # ─────────────────────── CAMERA LOGIC ─────────────────────────

    def _set_cam_status(self, text: str, color: str = "#38bdf8"):
        """Only updates status label if text actually changes (prevents flicker)."""
        if self._current_sub_status_text != text:
            self._current_sub_status_text = text
            self.after(0, lambda: self._cam_sub_status.configure(text=text, text_color=color))

    def _set_camera_view(self):
        self._gate_mode = "camera"
        self._qr_container.grid_remove()
        self._cam_container.grid()

        self._flow_pill_lbl.configure(text="🧍 Face Camera  ➔  🔍 Match Face  ➔  ✅ Auto Pass")
        self._mode_pill_lbl.configure(text="FACE CAMERA  CAMPUS OUTING SYSTEM")
        self._switch_mode_btn.configure(text="📋 QR MODE")
        self._timer_box.pack_forget()

        if not CV2_OK:
            self._set_cam_status("❌ OpenCV not installed", "#ef4444")
            return

        self._cam_running = True
        self._render_camera_frame()
        threading.Thread(target=self._camera_worker, daemon=True).start()

    def _render_camera_frame(self):
        """Runs smoothly on the UI thread at ~30 FPS with zero flicker."""
        if not self._cam_running or self._gate_mode != "camera":
            return
        pil_img = self._latest_cam_pil
        if pil_img is not None:
            photo = ImageTk.PhotoImage(pil_img)
            self._cam_video_lbl.configure(image=photo)
            self._cam_video_lbl.image = photo
        self._cam_render_job = self.after(33, self._render_camera_frame)

    def _camera_worker(self):
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            self._set_cam_status("❌ No USB camera found", "#ef4444")
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)

        self._cam_cap = cap

        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

        try:
            import face_recognition as fr
            fr_ready = True
        except Exception:
            fr_ready = False

        frame_count = 0

        while self._cam_running:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.03)
                continue

            frame_count += 1
            display = frame.copy()

            # Detect faces every 2 frames to keep CPU low
            if frame_count % 2 == 0:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(90, 90))
                if len(faces) > 0:
                    best_f = max(faces, key=lambda b: b[2] * b[3])
                    fx, fy, fw, fh = best_f
                    self._face_miss_count = 0
                    if self._smoothed_box is None:
                        self._smoothed_box = [float(fx), float(fy), float(fw), float(fh)]
                    else:
                        # Smooth EMA tracking
                        self._smoothed_box[0] = 0.55 * fx + 0.45 * self._smoothed_box[0]
                        self._smoothed_box[1] = 0.55 * fy + 0.45 * self._smoothed_box[1]
                        self._smoothed_box[2] = 0.55 * fw + 0.45 * self._smoothed_box[2]
                        self._smoothed_box[3] = 0.55 * fh + 0.45 * self._smoothed_box[3]
                else:
                    self._face_miss_count += 1
                    if self._face_miss_count > 5:
                        self._smoothed_box = None
                        if not self._matching_in_progress:
                            self._set_cam_status("● Looking for student face...", "#38bdf8")

            # Draw sleek cyber corner brackets
            if self._smoothed_box is not None:
                bx, by, bw, bh = [int(v) for v in self._smoothed_box]
                bx = max(2, min(638, bx))
                by = max(2, min(478, by))
                bw = max(10, min(638 - bx, bw))
                bh = max(10, min(478 - by, bh))

                clen = min(24, bw // 4, bh // 4)
                color = (0, 255, 136)  # Neon Emerald (#00ff88)
                t = 2

                # Top-Left
                cv2.line(display, (bx, by), (bx + clen, by), color, t)
                cv2.line(display, (bx, by), (bx, by + clen), color, t)
                # Top-Right
                cv2.line(display, (bx + bw, by), (bx + bw - clen, by), color, t)
                cv2.line(display, (bx + bw, by), (bx + bw - clen, by), color, t)
                # Bottom-Left
                cv2.line(display, (bx, by + bh), (bx + clen, by + bh), color, t)
                cv2.line(display, (bx, by + bh), (bx, by + bh - clen), color, t)
                # Bottom-Right
                cv2.line(display, (bx + bw, by + bh), (bx + bw - clen, by + bh), color, t)
                cv2.line(display, (bx + bw, by + bh), (bx + bw - clen, by + bh), color, t)

            # Resize to fit camera frame inside left container nicely (440x360)
            disp_resized = cv2.resize(display, (440, 360), interpolation=cv2.INTER_LINEAR)
            rgb = cv2.cvtColor(disp_resized, cv2.COLOR_BGR2RGB)
            self._latest_cam_pil = Image.fromarray(rgb)

            # Throttled async face matching (CPU stays cool, max 2.5 attempts/sec)
            now = time.time()
            if (self._smoothed_box is not None and
                    not self._matching_in_progress and
                    (now - self._last_match_attempt_time) > 0.4 and
                    (now - self._last_scan_time) > self._scan_cooldown and
                    fr_ready and self._gallery):

                self._last_match_attempt_time = now
                self._matching_in_progress = True
                frame_snapshot = frame.copy()
                face_coords = [int(v) for v in self._smoothed_box]
                threading.Thread(
                    target=self._async_face_match,
                    args=(frame_snapshot, face_coords),
                    daemon=True
                ).start()

            time.sleep(0.02)

        cap.release()

    def _async_face_match(self, frame_img, face_box):
        try:
            import face_recognition as fr
            fx, fy, fw, fh = face_box
            H, W, _ = frame_img.shape

            pad_w = int(fw * 0.15)
            pad_h = int(fh * 0.15)
            top = max(0, fy - pad_h)
            bottom = min(H, fy + fh + pad_h)
            left = max(0, fx - pad_w)
            right = min(W, fx + fw + pad_w)
            locs = [(top, right, bottom, left)]

            full_rgb = np.ascontiguousarray(cv2.cvtColor(frame_img, cv2.COLOR_BGR2RGB))
            encs = fr.face_encodings(full_rgb, locs, num_jitters=1)

            if encs and self._gallery:
                query = encs[0].tolist()
                matched = match_face(query, self._gallery)

                if matched:
                    candidate_id = matched.get("id") or matched.get("registration_id") or matched.get("name")

                    # Check if consecutive frame matches the same candidate
                    if self._consecutive_match.get("studentId") == candidate_id:
                        self._consecutive_match["count"] += 1
                    else:
                        self._consecutive_match = {"studentId": candidate_id, "count": 1}

                    current_count = self._consecutive_match["count"]
                    name = matched.get("name", "Student")
                    score = matched.get("_matchPercent", 86)

                    # Require 3 consecutive frames of positive consensus
                    if current_count < 3:
                        self._set_cam_status(f"● Identifying {name} ({current_count}/3)...", "#38bdf8")
                    else:
                        # 3 consecutive frames confirmed!
                        now_ms = time.time()
                        if (self._last_processed_student_id != candidate_id or
                                (now_ms - self._last_processed_time) > 10.0):
                            self._last_processed_student_id = candidate_id
                            self._last_processed_time = now_ms
                            self._consecutive_match = {"studentId": None, "count": 0}
                            self._last_scan_time = now_ms
                            self.after(0, lambda s=matched: self._on_face_match_success(s))
                else:
                    self._consecutive_match = {"studentId": None, "count": 0}
                    self._set_cam_status("● Looking for student face...", "#38bdf8")
            else:
                self._consecutive_match = {"studentId": None, "count": 0}
                self._set_cam_status("● Looking for student face...", "#38bdf8")
        except Exception as ex:
            print("Async face match error:", ex)
        finally:
            self._matching_in_progress = False

    def _stop_camera(self):
        self._cam_running = False
        if getattr(self, "_cam_render_job", None):
            try:
                self.after_cancel(self._cam_render_job)
            except Exception:
                pass
            self._cam_render_job = None
        if self._cam_cap:
            try:
                self._cam_cap.release()
            except Exception:
                pass
            self._cam_cap = None
        self._smoothed_box = None
        self._face_miss_count = 0

    def _on_face_match_success(self, student: dict):
        reg = student.get("registration_id") or student.get("registrationId", "")
        name = student.get("name", "")
        pct = student.get("_matchPercent", 90)

        self._cam_sub_status.configure(
            text=f"✅ {name} ({pct}%)",
            text_color=COLORS["accent_green"]
        )

        def _sub():
            res = self._api.process_scan(reg, student.get("email", ""))
            self.after(0, lambda: self._handle_scan_done(res, student))

        threading.Thread(target=_sub, daemon=True).start()

    def _handle_scan_done(self, res: dict, hint: dict):
        if res.get("success"):
            act = res.get("action", "out")
            sname = res.get("studentName") or hint.get("name", "")
            action_text = "Checked IN" if act == "checkin" else "Checked OUT"
            self._cam_sub_status.configure(
                text=f"✅ {sname} — {action_text}",
                text_color=COLORS["accent_green"]
            )
            self._play_beep()
            self._refresh_live_data()
        elif res.get("offline"):
            self._cam_sub_status.configure(
                text="⚠ Offline: Scan saved locally",
                text_color="#fbbf24"
            )

    # ─────────────────────── DASHBOARD SYNC ───────────────────────

    def _refresh_live_data(self):
        def _fetch():
            data = self._api.fetch_live_data(minimal=False)
            self.after(0, lambda: self._apply_live_data(data))

        threading.Thread(target=_fetch, daemon=True).start()
        self.after(LIVE_DASHBOARD_REFRESH_SECONDS * 1000, self._refresh_live_data)

    def _apply_live_data(self, data: dict):
        if not data.get("success"):
            return

        self._live_data = data
        summary = data.get("summary", {})
        outside_list = data.get("currentlyOut", [])
        returns_list = data.get("recentActivity", [])

        # 1. Update 4 Cards
        tot = summary.get("totalStudents", 0)
        s_in = summary.get("studentsIn", 0)
        s_out = summary.get("studentsOut", len(outside_list))
        s_gp = summary.get("gatePassCount", 0)
        s_hl = summary.get("leaveCount", 0)

        self._stat_total_lbl.configure(text=str(tot))
        self._stat_in_lbl.configure(text=str(s_in))
        self._stat_out_lbl.configure(text=str(s_out))
        self._stat_gp_lbl.configure(text=str(s_gp))
        self._stat_hl_lbl.configure(text=str(s_hl))

        # 2. Update Column Headers
        self._out_hdr_lbl.configure(text=f"🔴 Outside ({len(outside_list)})")
        self._ret_hdr_lbl.configure(text=f"🟢 Returns Today ({len(returns_list)})")

        # 3. Populate Outside List ONLY if data changed (Prevents blinking/fluctuating)
        out_ids = [str(r.get("studentId") or r.get("_id") or r.get("registrationId") or r.get("studentName")) for r in outside_list]
        if out_ids != self._current_out_ids:
            self._current_out_ids = out_ids
            for w in self._out_scroll.winfo_children():
                w.destroy()

            if outside_list:
                for rec in outside_list:
                    row = StudentRow(self._out_scroll, rec, is_outside=True)
                    row.pack(fill="x", pady=1, padx=2)
            else:
                empty = ctk.CTkLabel(
                    self._out_scroll,
                    text="✅  All students are in campus",
                    font=("Segoe UI", 11),
                    text_color=COLORS["text_dark_dim"]
                )
                empty.pack(pady=40)

        # 4. Populate Returns Today List ONLY if data changed (Prevents blinking/fluctuating)
        ret_ids = [str(r.get("studentId") or r.get("_id") or r.get("registrationId") or r.get("studentName")) for r in returns_list]
        if ret_ids != self._current_ret_ids:
            self._current_ret_ids = ret_ids
            for w in self._ret_scroll.winfo_children():
                w.destroy()

            if returns_list:
                for rec in returns_list:
                    row = StudentRow(self._ret_scroll, rec, is_outside=False)
                    row.pack(fill="x", pady=1, padx=2)
            else:
                empty = ctk.CTkLabel(
                    self._ret_scroll,
                    text="No returns recorded today",
                    font=("Segoe UI", 11),
                    text_color=COLORS["text_dark_dim"]
                )
                empty.pack(pady=40)

    # ─────────────────────── TOGGLES & ACTIONS ────────────────────

    def _toggle_mode(self):
        if self._gate_mode == "qr":
            self._set_camera_view()
        else:
            self._set_qr_view()

    def _toggle_fullscreen(self):
        self._is_fullscreen = not self._is_fullscreen
        self.winfo_toplevel().attributes("-fullscreen", self._is_fullscreen)

    def _do_logout(self):
        self.cleanup()
        self._on_logout()

    def _load_face_gallery(self):
        local = load_gallery_from_db()
        if local:
            self._gallery = local

        def _sync():
            res = self._api.fetch_face_gallery()
            if res.get("success"):
                students = res.get("students", [])
                if students:
                    save_gallery_to_db(students)
                    self._gallery = students

        threading.Thread(target=_sync, daemon=True).start()
        self.after(GALLERY_SYNC_INTERVAL_MINUTES * 60 * 1000, self._load_face_gallery)

    def _play_beep(self):
        try:
            import winsound
            winsound.Beep(900, 100)
            winsound.Beep(1200, 150)
        except Exception:
            pass

    def cleanup(self):
        self._stop_camera()
