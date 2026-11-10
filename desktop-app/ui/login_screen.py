"""
HOSTELEAZE Desktop Gatepass App
ui/login_screen.py — Login UI matching website dark theme
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import messagebox
import threading
from typing import Callable
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import COLORS, APP_TITLE
from core.api import HostelEazeAPI


class LoginScreen(ctk.CTkFrame):
    """
    Login screen — replicates the web portal gate login.
    Password entry + gate selection dropdown.
    """

    def __init__(self, master, on_login_success: Callable):
        super().__init__(master, fg_color=COLORS["bg_dark"], corner_radius=0)
        self._api = HostelEazeAPI()
        self._on_success = on_login_success
        self._gates = []
        self._selected_gate_id = "getpass"
        self._loading = False

        self._build_ui()
        self._load_gates()

    def _build_ui(self):
        # Centered container
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        center = ctk.CTkFrame(self, fg_color=COLORS["bg_card"],
                               corner_radius=20, border_width=1,
                               border_color=COLORS["border_white"])
        center.grid(row=0, column=0, padx=40, pady=40, sticky="")
        center.grid_columnconfigure(0, weight=1)

        # ── Logo / Brand ──
        logo_frame = ctk.CTkFrame(center, fg_color="transparent")
        logo_frame.grid(row=0, column=0, pady=(40, 10), padx=60)

        emoji_lbl = ctk.CTkLabel(logo_frame, text="🏫", font=("Segoe UI", 48))
        emoji_lbl.pack()

        brand_lbl = ctk.CTkLabel(
            logo_frame,
            text="HOSTELEAZE",
            font=("Segoe UI", 22, "bold"),
            text_color=COLORS["accent_green"]
        )
        brand_lbl.pack()

        sub_lbl = ctk.CTkLabel(
            logo_frame,
            text="Campus Gatepass — Desktop",
            font=("Segoe UI", 12),
            text_color=COLORS["text_muted"]
        )
        sub_lbl.pack()

        # ── Divider ──
        div = ctk.CTkFrame(center, height=1, fg_color=COLORS["border_white"])
        div.grid(row=1, column=0, sticky="ew", padx=40, pady=(20, 0))

        # ── Form ──
        form = ctk.CTkFrame(center, fg_color="transparent")
        form.grid(row=2, column=0, padx=60, pady=20, sticky="ew")
        form.grid_columnconfigure(0, weight=1)

        # Gate selector label
        gate_lbl = ctk.CTkLabel(form, text="SELECT GATE",
                                 font=("Segoe UI", 10, "bold"),
                                 text_color=COLORS["text_dim"])
        gate_lbl.grid(row=0, column=0, sticky="w", pady=(0, 4))

        self._gate_var = ctk.StringVar(value="Loading gates...")
        self._gate_dropdown = ctk.CTkOptionMenu(
            form,
            variable=self._gate_var,
            values=["Loading..."],
            fg_color=COLORS["bg_panel"],
            button_color=COLORS["accent_blue"],
            button_hover_color="#2563eb",
            dropdown_fg_color=COLORS["bg_panel"],
            dropdown_hover_color=COLORS["bg_dark"],
            text_color=COLORS["text_white"],
            font=("Segoe UI", 13),
            height=42,
            corner_radius=10,
            command=self._on_gate_selected
        )
        self._gate_dropdown.grid(row=1, column=0, sticky="ew", pady=(0, 16))

        # Password label
        pass_lbl = ctk.CTkLabel(form, text="GATE PASSWORD",
                                  font=("Segoe UI", 10, "bold"),
                                  text_color=COLORS["text_dim"])
        pass_lbl.grid(row=2, column=0, sticky="w", pady=(0, 4))

        self._password_entry = ctk.CTkEntry(
            form,
            placeholder_text="Enter gate access password",
            show="●",
            font=("Segoe UI", 14),
            fg_color=COLORS["bg_panel"],
            border_color=COLORS["border_white"],
            border_width=1,
            text_color=COLORS["text_white"],
            placeholder_text_color=COLORS["text_dim"],
            height=48,
            corner_radius=10,
        )
        self._password_entry.grid(row=3, column=0, sticky="ew", pady=(0, 6))
        self._password_entry.bind("<Return>", lambda e: self._do_login())

        # Show/hide password
        show_frame = ctk.CTkFrame(form, fg_color="transparent")
        show_frame.grid(row=4, column=0, sticky="e", pady=(0, 16))
        self._show_pass_var = tk.BooleanVar(value=False)
        show_cb = ctk.CTkCheckBox(
            show_frame, text="Show password",
            variable=self._show_pass_var,
            command=self._toggle_show_pass,
            font=("Segoe UI", 11),
            text_color=COLORS["text_muted"],
            fg_color=COLORS["accent_blue"],
            hover_color="#2563eb",
            border_color=COLORS["border_white"],
            checkmark_color="white",
        )
        show_cb.pack()

        # Error label
        self._error_lbl = ctk.CTkLabel(
            form, text="", font=("Segoe UI", 12),
            text_color=COLORS["accent_red"], wraplength=320
        )
        self._error_lbl.grid(row=5, column=0, pady=(0, 8))

        # Login button
        self._login_btn = ctk.CTkButton(
            form,
            text="🔐  LOGIN TO GATE",
            font=("Segoe UI", 14, "bold"),
            fg_color=COLORS["accent_green"],
            hover_color="#00cc6a",
            text_color="#000000",
            height=52,
            corner_radius=12,
            command=self._do_login
        )
        self._login_btn.grid(row=6, column=0, sticky="ew", pady=(0, 8))

        # Status indicator
        self._status_lbl = ctk.CTkLabel(
            center,
            text="🔴  Checking server connection...",
            font=("Segoe UI", 10),
            text_color=COLORS["text_dim"]
        )
        self._status_lbl.grid(row=3, column=0, pady=(0, 24))

        # Version
        ver_lbl = ctk.CTkLabel(
            center,
            text="v1.0.0  •  hosteleaze.com",
            font=("Segoe UI", 9),
            text_color=COLORS["text_dim"]
        )
        ver_lbl.grid(row=4, column=0, pady=(0, 24))

    def _load_gates(self):
        """Fetch available gates from server in background."""
        def _fetch():
            gates = self._api.get_available_gates()
            try:
                if self.winfo_exists():
                    self.after(0, lambda: self._populate_gates(gates))
            except Exception:
                pass
        threading.Thread(target=_fetch, daemon=True).start()

    def _populate_gates(self, gates: list):
        if gates:
            self._gates = gates
            gate_names = [g.get("name", "Main Gate") for g in gates]
            self._gate_dropdown.configure(values=gate_names)
            self._gate_var.set(gate_names[0])
            self._selected_gate_id = f"getpass_{gates[0].get('id', 'main-gate')}"
            self._status_lbl.configure(text="🟢  Connected to server", text_color=COLORS["accent_green"])
        else:
            # Offline fallback
            self._gate_dropdown.configure(values=["Main Gate"])
            self._gate_var.set("Main Gate")
            self._selected_gate_id = "getpass"
            self._status_lbl.configure(text="🟡  Offline mode — using default gate", text_color=COLORS["accent_amber"])

    def _on_gate_selected(self, gate_name: str):
        for g in self._gates:
            if g.get("name") == gate_name:
                self._selected_gate_id = f"getpass_{g.get('id', 'main-gate')}"
                return
        self._selected_gate_id = "getpass"

    def _toggle_show_pass(self):
        self._password_entry.configure(show="" if self._show_pass_var.get() else "●")

    def _do_login(self):
        if self._loading:
            return
        password = self._password_entry.get().strip()
        if not password:
            self._error_lbl.configure(text="⚠ Please enter the gate password")
            return

        self._loading = True
        self._error_lbl.configure(text="")
        self._login_btn.configure(text="Connecting...", state="disabled")
        self._status_lbl.configure(text="🔄  Authenticating...", text_color=COLORS["text_muted"])

        def _attempt():
            result = self._api.login_gate(password, self._selected_gate_id)
            self.after(0, lambda: self._handle_login_result(result))

        threading.Thread(target=_attempt, daemon=True).start()

    def _handle_login_result(self, result: dict):
        self._loading = False
        self._login_btn.configure(text="🔐  LOGIN TO GATE", state="normal")

        if result.get("success"):
            gate_info = {
                "gateName":  result.get("gateName", "Main Gate"),
                "gateId":    result.get("gateId", "main-gate"),
                "gateMode":  result.get("gateMode", "qr"),
                "qrSeconds": 15,
                "api":       self._api,
            }
            self._on_success(gate_info)
        else:
            err = result.get("error", "Login failed")
            self._error_lbl.configure(text=f"❌ {err}")
            self._status_lbl.configure(text="🔴  Login failed", text_color=COLORS["accent_red"])
            self._password_entry.focus()
