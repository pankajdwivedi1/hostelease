# ============================================================
# HOSTELEAZE DESKTOP GATEPASS APP — CONFIG
# ============================================================

# --- Railway API Base URL (your production server) ---
API_BASE_URL = "https://hosteleaze.com"

# --- Tenant Slug (must match your .env.local NEXT_PUBLIC_TENANT_SLUG) ---
TENANT_SLUG = "ogi"

# --- QR HMAC Secret (must match server: hosteleaze_secure_gate_key_2026) ---
QR_HMAC_SECRET = "hosteleaze_secure_gate_key_2026"

# --- Face Matching Threshold (Strict Bank-Grade: distance <= 0.38 / score >= 86%) ---
FACE_MATCH_THRESHOLD = 0.38

# --- Gallery sync interval in minutes ---
GALLERY_SYNC_INTERVAL_MINUTES = 30

# --- Live dashboard refresh in seconds ---
LIVE_DASHBOARD_REFRESH_SECONDS = 10

# --- Offline queue DB path ---
OFFLINE_DB_PATH = "hosteleaze_offline.db"

# --- UI Colors (Exact match to www.hosteleaze.com web dark theme) ---
COLORS = {
    "bg_dark":        "#06090e",
    "bg_left":        "#070b12",
    "bg_right":       "#0d121d",
    "bg_card":        "#111827",
    "bg_card_dim":    "#0b101a",
    "bg_panel":       "#10131a",
    "bg_header":      "#0d1117",
    "bg_row":         "#161b2e",
    "border_subtle":  "#1e293b",
    "border_white":   "#1e293b",
    "border_green":   "#00ff88",
    "border_blue":    "#1e2d4a",
    "border_cyan":    "#0284c7",
    "border_amber":   "#d97706",
    "border_red":     "#ef4444",
    "accent_green":   "#00ff88",
    "accent_cyan":    "#38bdf8",
    "accent_blue":    "#3b82f6",
    "accent_amber":   "#fbbf24",
    "accent_red":     "#ff6b6b",
    "text_white":     "#ffffff",
    "text_light":     "#e2e8f0",
    "text_muted":     "#94a3b8",
    "text_dim":       "#64748b",
    "text_dark_dim":  "#475569",
    "badge_leave_bg": "#451a03",
    "badge_leave_fg": "#fbbf24",
    "badge_gp_bg":    "#0c2538",
    "badge_gp_fg":    "#38bdf8",
    "card_tot_bg":    "#0d1424",
    "card_in_bg":     "#072017",
    "card_out_bg":    "#240c0f",
    "card_hist_bg":   "#141926",
    "success_bg":     "#052e16",
    "error_bg":       "#1a0505",
}

# --- App Window ---
APP_TITLE    = "Hosteleaze — Campus Gatepass"
APP_WIDTH    = 1380
APP_HEIGHT   = 840
APP_MIN_W    = 1180
APP_MIN_H    = 700
