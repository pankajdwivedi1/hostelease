"""
HOSTELEAZE Desktop Gatepass App
core/api.py — All Railway API communication
"""

import requests
import hmac
import hashlib
import time
import json
import threading
from typing import Optional, Dict, Any
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import API_BASE_URL, TENANT_SLUG, QR_HMAC_SECRET


class HostelEazeAPI:
    """Handles all HTTP communication with the Railway backend."""

    def __init__(self):
        self.base_url = API_BASE_URL.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "x-tenant-slug": TENANT_SLUG,
            "User-Agent": "HostelEaze-Desktop/1.0",
        })
        self._auth_cookie: Optional[str] = None
        self._gate_name: str = "Main Gate"
        self._gate_id: str = "main-gate"
        self._gate_mode: str = "qr"
        self._qr_seconds: int = 15

    # ─────────────────────────── AUTH ───────────────────────────

    def login_gate(self, password: str, gate_id: str = "getpass") -> Dict[str, Any]:
        """Login as gate guard. Returns gate info on success."""
        try:
            resp = self.session.post(
                f"{self.base_url}/api/warden/auth",
                json={"password": password, "hostelId": gate_id},
                timeout=15
            )
            data = resp.json()
            if resp.status_code == 200 and data.get("success"):
                # Store auth cookie
                cookie_header = resp.headers.get("Set-Cookie", "")
                if cookie_header:
                    self._auth_cookie = cookie_header
                    self.session.headers.update({"Cookie": cookie_header})
                # Persist gate settings
                self._gate_name = data.get("gateName", "Main Gate")
                self._gate_id   = data.get("gateId", "main-gate")
                self._gate_mode = data.get("gateMode", "qr")
                return {"success": True, **data}
            return {"success": False, "error": data.get("error", "Login failed")}
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "Cannot connect to server. Check internet connection."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_available_gates(self) -> list:
        """Fetch list of configured gates from admin settings."""
        try:
            resp = self.session.get(f"{self.base_url}/api/admin/settings", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                gates = data.get("gatepassGates", [])
                return gates
        except Exception:
            pass
        return []

    # ──────────────────────── QR GENERATION ─────────────────────

    def generate_qr_data(self, gate_name: Optional[str] = None, qr_seconds: int = 15) -> Dict[str, Any]:
        """Generate HMAC-signed QR data locally (zero network calls)."""
        gate = gate_name or self._gate_name
        timestamp = int(time.time() * 1000)  # ms
        secret = QR_HMAC_SECRET
        message = f"{gate}:{timestamp}"
        signature = hmac.new(
            secret.encode(), message.encode(), hashlib.sha256
        ).hexdigest()
        signed_token = f"{timestamp}.{signature}"

        qr_payload = json.dumps({
            "t": signed_token,
            "g": gate,
            "s": qr_seconds,
            "ts": timestamp,
            "app": "hosteleaze-getpass",
        }, separators=(",", ":"))

        expires_at = timestamp + (qr_seconds + 10) * 1000  # ms

        return {
            "qrData": qr_payload,
            "token": signed_token,
            "expiresAt": expires_at,
            "gateName": gate,
        }

    # ──────────────────────── FACE GALLERY ──────────────────────

    def fetch_face_gallery(self) -> Dict[str, Any]:
        """Download all student face descriptors from server."""
        try:
            resp = self.session.get(
                f"{self.base_url}/api/students/identifier-gallery",
                timeout=60
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return {"success": True, "students": data.get("students", []), "count": data.get("count", 0)}
            return {"success": False, "error": "Failed to fetch gallery"}
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "No internet — using cached gallery"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ───────────────────────── SCAN ─────────────────────────────

    def process_scan(self, registration_id: str, email: str = "",
                     qr_data: Optional[str] = None) -> Dict[str, Any]:
        """
        Submit a scan (QR or face match) to the server.
        For QR: pass qr_data.
        For Face: pass a fresh QR generated locally + registrationId.
        """
        try:
            # For face scan: generate a fresh internal QR token
            if qr_data is None:
                local_qr = self.generate_qr_data()
                qr_data = local_qr["qrData"]

            payload = {
                "qrData": qr_data,
                "registrationId": registration_id,
                "email": email,
            }
            resp = self.session.post(
                f"{self.base_url}/api/getpass/scan",
                json=payload,
                timeout=15
            )
            data = resp.json()
            if resp.status_code == 200 and data.get("success"):
                return {"success": True, **data}
            return {"success": False, "error": data.get("error", "Scan failed"), "status": resp.status_code}
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "OFFLINE", "offline": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ─────────────────────── LIVE DASHBOARD ─────────────────────

    def fetch_live_data(self, minimal: bool = False) -> Dict[str, Any]:
        """Fetch live gate dashboard data."""
        try:
            resp = self.session.get(
                f"{self.base_url}/api/getpass/live",
                params={"minimal": "true" if minimal else "false"},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return {"success": True, **data}
            return {"success": False}
        except Exception:
            return {"success": False}

    # ───────────────────── MANUAL TOGGLE ────────────────────────

    def manual_toggle(self, registration_id: str) -> Dict[str, Any]:
        """Manually check in/out a student by registration ID."""
        try:
            resp = self.session.post(
                f"{self.base_url}/api/getpass/manual-toggle",
                json={"registrationId": registration_id},
                timeout=15
            )
            data = resp.json()
            return data
        except Exception as e:
            return {"success": False, "error": str(e)}
