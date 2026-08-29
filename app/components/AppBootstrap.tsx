"use client";

import { useEffect, useState } from "react";
import { installToastSystem, showToast } from "@/lib/toast";
import { Capacitor } from "@capacitor/core";

/**
 * ============================================================
 * AppBootstrap — Native Experience Component
 * ============================================================
 * 1. Patches window.alert() with premium toasts
 * 2. Shows a professional "Onboarding" permission screen
 *    only on the very first visit (to handle browser gesture rules)
 * ============================================================
 */

const PERMISSIONS_ASKED_KEY = "hosteleaze_v2_perms_ok";

export default function AppBootstrap() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // 0. Suppress unhandled errors from third-party browser extensions (e.g. MetaMask, crypto wallets)
    if (typeof window !== "undefined") {
      const suppressExtensionErrors = (e: any) => {
        const msg = e?.message || e?.reason?.message || (typeof e?.reason === 'string' ? e.reason : '') || '';
        if (
          msg.includes("MetaMask") ||
          msg.includes("inpage.js") ||
          msg.includes("chrome-extension://") ||
          msg.includes("moz-extension://") ||
          msg.includes("safari-extension://") ||
          msg.includes("ethereum")
        ) {
          if (e?.preventDefault) e.preventDefault();
          if (e?.stopImmediatePropagation) e.stopImmediatePropagation();
          return true;
        }
      };

      window.addEventListener("error", suppressExtensionErrors, true);
      window.addEventListener("unhandledrejection", suppressExtensionErrors, true);
    }

    // 1. Install toast system immediately (overrides window.alert)
    installToastSystem();

    // 2. Check if we've already handled permissions for this user
    if (typeof window !== "undefined") {
      const alreadyAsked = localStorage.getItem(PERMISSIONS_ASKED_KEY) || document.cookie.includes(PERMISSIONS_ASKED_KEY);
      const userType = localStorage.getItem("userType");

      // Only show overlay for logged-in students who haven't been asked yet
      if (!alreadyAsked && userType === "student") {
        // Delay slightly for better visual entrance
        setTimeout(() => setShowOverlay(true), 1200);
      }
    }

    // 3. Set up deep link listener for native app (OAuth Loopback)
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appUrlOpen", async (event: { url: string }) => {
          console.log("App opened via deep link:", event.url);
          try {
            const parsedUrl = new URL(event.url);
            const hash = parsedUrl.hash.substring(1);
            const params = new URLSearchParams(hash || parsedUrl.search);
            
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            
            if (accessToken && refreshToken) {
              console.log("Found OAuth tokens via deep link, redirecting...");
              // Firebase handles auth — just redirect to home
              showToast("Logged in successfully!", "success");
              window.location.replace("/");
            }
          } catch (err) {
            console.error("Error parsing deep link URL:", err);
          }
        });
      });
    }
  }, []);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const handleGrantPermissions = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    setPermissionError(null);

    // ─── 🔔 1. Request PUSH NOTIFICATIONS ───────────────
    let notifGranted = true;
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        const notifStatus = await Notification.requestPermission();
        if (notifStatus !== "granted") {
          notifGranted = false;
        } else {
          // Register Web Push subscription
          const cachedStudent = localStorage.getItem("cachedStudentData");
          if (cachedStudent) {
            try {
              const parsed = JSON.parse(cachedStudent);
              const sid = parsed._id || parsed.id;
              if (sid) {
                const { registerPushNotifications } = await import("@/lib/pushRegister");
                registerPushNotifications(sid, "student").catch(() => {});
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn("Notification request error:", err);
    }

    if (!notifGranted) {
      setIsRequesting(false);
      setPermissionError("Notification permission is required to receive Dean broadcasts, curfew notices, and leave approvals. Please tap the 🔒 or ℹ️ icon next to the address bar, allow notifications, and try again.");
      return;
    }

    // ─── 📍 2. Request LOCATION ─────────────────────────
    try {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          () => resolve(), // Continue regardless of error
          { timeout: 5000 }
        );
      });
    } catch {}

    // ─── 📷 🎤 3. Request CAMERA & MICROPHONE ────────────
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(t => t.stop()); // Close immediately
    } catch (err) {
      console.warn("Camera/Microphone permission error during bootstrap:", err);
    }

    // 🏁 4. Finish
    localStorage.setItem(PERMISSIONS_ASKED_KEY, "1");
    document.cookie = `${PERMISSIONS_ASKED_KEY}=1; max-age=31536000; path=/`;
    showToast("Permissions configured successfully!", "success");
    
    // Smooth exit
    setTimeout(() => {
      setShowOverlay(false);
    }, 400);
  };

  if (!showOverlay) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 bg-[#0a0a1f] animate-in fade-in duration-500"
      style={{ fontFamily: "var(--font-lora), serif" }}
    >
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] p-7 flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-700">
        
        {/* Animated App Icon Shell */}
        <div className="w-16 h-16 bg-blue-600 rounded-2xl mb-4 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)] animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0112 3a9.991 9.991 0 017.93 4M12 11a9.994 9.994 0 00-6.212 5.1a10.042 10.042 0 003.458 2.035m3.107.037A10.05 10.05 0 0018 12.5V12" />
            </svg>
        </div>

        <h1 className="text-xl font-bold text-white mb-1.5 tracking-tight">Required Permissions</h1>
        <p className="text-blue-100/60 text-xs mb-5 leading-relaxed">
          Hosteleaze requires push notifications, biometric camera, and campus location access to operate.
        </p>

        {permissionError && (
          <div className="w-full mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-left">
            <p className="text-[11px] text-red-200 font-semibold leading-tight">
              ⚠️ {permissionError}
            </p>
          </div>
        )}

        {/* Feature List */}
        <div className="w-full space-y-3 mb-6">
            <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-lg shrink-0">🔔</div>
                <div>
                    <h3 className="text-white text-[10px] font-bold uppercase tracking-widest opacity-50">Push Notifications</h3>
                    <p className="text-white/80 text-[11px] font-medium leading-tight">Dean broadcasts, gatepass approvals, and curfew alerts.</p>
                </div>
            </div>
            <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-lg shrink-0">📍</div>
                <div>
                    <h3 className="text-white text-[10px] font-bold uppercase tracking-widest opacity-50">Location</h3>
                    <p className="text-white/80 text-[11px] font-medium leading-tight">Verifies you are currently on campus when checking in.</p>
                </div>
            </div>
            <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-lg shrink-0">📷</div>
                <div>
                    <h3 className="text-white text-[10px] font-bold uppercase tracking-widest opacity-50">Camera & Biometrics</h3>
                    <p className="text-white/80 text-[11px] font-medium leading-tight">Facial recognition for attendance and scanning gatepass QR codes.</p>
                </div>
            </div>
        </div>

        <button
          onClick={handleGrantPermissions}
          disabled={isRequesting}
          className={`w-full py-3.5 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs hover:bg-blue-500 shadow-xl shadow-blue-900/40 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {isRequesting ? (
            <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Processing...
            </>
          ) : (
            permissionError ? "Retry & Grant Notifications" : "Grant All Permissions"
          )}
        </button>

        <p className="mt-3 text-[10px] text-white/30 font-medium">
          Note: Your device will display system permission popups next.
        </p>
      </div>
    </div>
  );
}
