# HOSTELEAZE PROJECT RULES & ARCHITECTURE MEMORY

## 1. EXCLUSIVE INFRASTRUCTURE STACK (NO EXCEPTIONS)
- **ONLY Railway & Cloudflare**:
  - The project operates EXCLUSIVELY on **Railway** (for application/backend runtime and internal PostgreSQL database) and **Cloudflare** (for CDN/DNS and Cloudflare R2 storage).
  - **NEVER** test, reference, or fallback to Supabase, Vercel, or MongoDB. They are obsolete and strictly forbidden.
- **Railway Server for Code Running**: 
  - All backend and production application code runs on **Railway**.
  - Always maintain production readiness for Railway container deployment.

## 2. MEDIA & FILE STORAGE
- **Cloudflare R2 for Videos & Photos**:
  - All photos, student profile pictures, and parental consent videos MUST be stored on and served from **Cloudflare R2**.
  - Do NOT store binary media files locally or commit them to the Git repository.

## 3. STUDENT IDENTIFICATION & AUTHENTICATION
- **Zero Reliance on Firebase UID for Business Logic**:
  - Firebase is strictly used by students for login/authentication session management ONLY.
  - **NEVER** use Firebase UID for student lookups, biometric face matching, attendance records, or gatepass processing.
  - **ALWAYS** match and identify students using **Student Registration ID** (e.g., `BOYS-0001`, `GANGOTRI-0090`) and **Student Email ID** (or internal database `_id`).

## 4. BIOMETRICS & FRAUD-PROOF ATTENDANCE (BANK-GRADE PAD)
- **Neural Anti-Spoofing & Multi-Factor PAD**:
  - In-process **MiniFASNetV2 ONNX Runtime** neural model detects live physical human skin vs. synthetic screens / printed paper.
  - Enforce presentation attack detection:
    1. Specular glass glare reflection hotspot detection (rejects phone / tablet screens).
    2. High-frequency Moiré lattice grid detection (rejects LCD / OLED displays).
    3. Device casing / phone border detection (rejects secondary phones held up).
    4. Biometric matching with a calibrated Euclidean threshold (minimum 75% match against registered face descriptor).
- **Passive Liveness Only**:
  - Maintain passive liveness (holding steady for 1 second).
  - **NEVER use active gesture challenges (eye-blinking, head-turning, smiling)**; they are vulnerable to video replays and rejected by users.

## 5. LOCAL DEVELOPMENT SERVER
- **Auto-Restart Local Server**:
  - Keep the local development server active for local testing.
  - If the local server closes or terminates, restart it immediately (`npm run dev`).

## 6. PRESERVATION OF SETTINGS & CODE INTEGRITY
- **Strict Settings Preservation**:
  - NEVER modify, alter, or remove any settings, form fields, configurations, rules, or features in HOSTELEAZE unless the user explicitly and specifically instructs you to modify that particular setting.
- **Preserve All Data & Payload Fields**:
  - Always ensure all student profile fields (e.g., motherNumber, fatherNumber, fatherName, motherName, permanentAddress, homeState, etc.) remain 100% mapped and saved end-to-end.
