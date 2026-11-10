"""
HOSTELEAZE Desktop Gatepass App
core/face_engine.py — Local face matching engine (no server needed)
"""

import numpy as np
import sqlite3
import json
import os
import sys
import threading
from typing import Optional, List, Dict, Any, Tuple
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import FACE_MATCH_THRESHOLD, OFFLINE_DB_PATH


DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), OFFLINE_DB_PATH)


# ─────────────────────────── DATABASE ───────────────────────────

def init_db():
    """Initialize local SQLite database for face gallery + offline queue."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS face_gallery (
            id TEXT PRIMARY KEY,
            name TEXT,
            registration_id TEXT,
            erp_id TEXT,
            hostel_name TEXT,
            room_number TEXT,
            profile_picture TEXT,
            student_status TEXT,
            outing_type TEXT,
            father_number TEXT,
            mother_number TEXT,
            college_name TEXT,
            branch TEXT,
            year TEXT,
            semester TEXT,
            face_descriptor TEXT,
            updated_at INTEGER
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS offline_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_id TEXT,
            email TEXT,
            qr_data TEXT,
            timestamp INTEGER,
            synced INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()


def save_gallery_to_db(students: List[Dict]):
    """Save downloaded face gallery to SQLite."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    now = int(__import__("time").time())
    for s in students:
        descriptor = s.get("faceDescriptor")
        descriptor_json = json.dumps(descriptor) if descriptor else None
        c.execute("""
            INSERT OR REPLACE INTO face_gallery
            (id, name, registration_id, erp_id, hostel_name, room_number,
             profile_picture, student_status, outing_type, father_number,
             mother_number, college_name, branch, year, semester,
             face_descriptor, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            str(s.get("id", "")),
            s.get("name", ""),
            s.get("registrationId", ""),
            s.get("erpId", ""),
            s.get("hostelName", ""),
            s.get("roomNumber", ""),
            s.get("profilePicture", ""),
            s.get("studentStatus", "in"),
            s.get("outingType", "outing"),
            s.get("fatherNumber", ""),
            s.get("motherNumber", ""),
            s.get("collegeName", ""),
            s.get("branch", ""),
            s.get("year", ""),
            s.get("semester", ""),
            descriptor_json,
            now,
        ))
    conn.commit()
    conn.close()


def load_gallery_from_db() -> List[Dict]:
    """Load face gallery from local SQLite."""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT * FROM face_gallery")
        rows = c.fetchall()
        conn.close()
        cols = ["id","name","registration_id","erp_id","hostel_name","room_number",
                "profile_picture","student_status","outing_type","father_number",
                "mother_number","college_name","branch","year","semester",
                "face_descriptor","updated_at"]
        students = []
        for row in rows:
            d = dict(zip(cols, row))
            fd = d.get("face_descriptor")
            d["faceDescriptor"] = json.loads(fd) if fd else None
            students.append(d)
        return students
    except Exception:
        return []


def queue_offline_scan(registration_id: str, email: str, qr_data: str):
    """Queue a scan for later sync when internet restores."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO offline_queue (registration_id, email, qr_data, timestamp)
        VALUES (?,?,?,?)
    """, (registration_id, email, qr_data, int(__import__("time").time() * 1000)))
    conn.commit()
    conn.close()


def get_pending_offline_queue() -> List[Dict]:
    """Return unsynced offline scans."""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id, registration_id, email, qr_data FROM offline_queue WHERE synced=0")
        rows = c.fetchall()
        conn.close()
        return [{"db_id": r[0], "registration_id": r[1], "email": r[2], "qr_data": r[3]} for r in rows]
    except Exception:
        return []


def mark_offline_synced(db_id: int):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE offline_queue SET synced=1 WHERE id=?", (db_id,))
    conn.commit()
    conn.close()


# ────────────────────────── FACE MATCHING ────────────────────────

def calculate_match_score(distance: float) -> int:
    """Exact replica of calculateScore(distance) from lib/faceMatching.ts."""
    if distance <= 0.35:
        score = 100 - (distance * 28.57)
    elif distance <= 0.48:
        score = 90 - ((distance - 0.35) * 115.38)
    elif distance <= 0.58:
        score = 75 - ((distance - 0.48) * 250)
    else:
        score = max(0, 50 - ((distance - 0.58) * 200))
    return int(round(max(0, min(100, score))))


def euclidean_distance(a: List[float], b: List[float]) -> float:
    arr_a = np.array(a, dtype=np.float32)
    arr_b = np.array(b, dtype=np.float32)
    return float(np.sqrt(np.sum((arr_a - arr_b) ** 2)))


def match_face(query_descriptor: List[float], gallery: List[Dict]) -> Optional[Dict]:
    """
    1:N face match against local gallery.
    Requires:
    1. Calibrated distance <= 0.38 (Score >= 86%)
    2. Runner-up distance margin >= 0.015 (Disambiguation)
    """
    if not query_descriptor or not gallery:
        return None

    best_dist = 999.0
    second_best_dist = 999.0
    best_student = None

    for student in gallery:
        fd = student.get("faceDescriptor")
        if not fd or not isinstance(fd, list) or len(fd) != 128:
            continue
        try:
            dist = euclidean_distance(query_descriptor, fd)
            if dist < best_dist:
                second_best_dist = best_dist
                best_dist = dist
                best_student = student
            elif dist < second_best_dist:
                second_best_dist = dist
        except Exception:
            continue

    if best_student:
        score = calculate_match_score(best_dist)
        margin = second_best_dist - best_dist

        # Strict checks matching GateCameraScanner.tsx (score >= 86% and margin >= 0.015)
        if best_dist <= FACE_MATCH_THRESHOLD and margin >= 0.015:
            return {
                **best_student,
                "_matchDistance": best_dist,
                "_matchPercent": score,
                "_secondDistance": second_best_dist,
                "_margin": margin
            }

    return None


# ─────────────────────────── LIVENESS CHECK ──────────────────────

def check_skin_tone(frame_bgr: np.ndarray, box) -> Tuple[bool, float]:
    """
    Basic real skin tone check using YCbCr color space.
    Returns (is_real_skin, skin_ratio).
    """
    try:
        x, y, w, h = box
        x, y = max(0, x), max(0, y)
        roi = frame_bgr[y:y+h, x:x+w]
        if roi.size == 0:
            return False, 0.0

        # Sample center 60%
        cx = int(w * 0.2)
        cy = int(h * 0.2)
        cw = int(w * 0.6)
        ch = int(h * 0.6)
        center = roi[cy:cy+ch, cx:cx+cw]
        if center.size == 0:
            return False, 0.0

        # Convert BGR → YCbCr
        import cv2
        ycbcr = cv2.cvtColor(center, cv2.COLOR_BGR2YCrCb)
        Y, Cr, Cb = ycbcr[:,:,0], ycbcr[:,:,1], ycbcr[:,:,2]

        # Skin pixel mask (empirical YCbCr bounds)
        skin_mask = (
            (Y > 50) &
            (Cr >= 133) & (Cr <= 173) &
            (Cb >= 77)  & (Cb <= 127)
        )
        skin_ratio = float(skin_mask.sum()) / max(1, skin_mask.size)
        return skin_ratio >= 0.26, skin_ratio
    except Exception:
        return False, 0.0


def check_screen_spoof(frame_bgr: np.ndarray, box) -> Tuple[bool, str]:
    """
    Detect screen / photo spoofing via glare and Moiré.
    Returns (is_spoof, reason).
    """
    try:
        import cv2
        x, y, w, h = box
        x, y = max(0, x), max(0, y)
        roi = frame_bgr[y:y+h, x:x+w]
        if roi.size == 0:
            return False, ""

        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        total = gray.size

        # 1. Specular glare (blown-out whites)
        glare_pixels = int(np.sum(gray >= 252))
        if glare_pixels / max(1, total) > 0.12:
            return True, "Glass Screen Glare Detected"

        # 2. Moiré pattern (high-frequency grid from LCD/OLED)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        high_freq = int(np.sum(np.abs(laplacian) > 85))
        if high_freq / max(1, total) > 0.12:
            return True, "Digital Screen Pattern Detected"

        return False, ""
    except Exception:
        return False, ""
