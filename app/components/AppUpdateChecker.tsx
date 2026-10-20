"use client";

import React, { useEffect, useState, useCallback } from "react";
import { APP_VERSION } from "@/lib/appVersion";

interface UpdateInfo {
    latestVersion: string;
    apkUrl: string;
    releaseNotes: string;
    forceUpdate: boolean;
}

/**
 * AppUpdateChecker
 * Renders nothing on PWA / browser — only activates inside the Android APK.
 * Checks /api/app-version on mount; if server version > installed version,
 * shows a modal prompting the student to download and install the new APK.
 */
export default function AppUpdateChecker() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [dismissed, setDismissed] = useState(false);

    const isNativeApp = useCallback((): boolean => {
        if (typeof window === "undefined") return false;
        return (
            typeof (window as any).Capacitor !== "undefined" &&
            (window as any).Capacitor?.isNativePlatform?.() === true
        );
    }, []);

    const parseVersion = (v: string): number[] =>
        v.replace(/[^0-9.]/g, "").split(".").map(Number);

    const isNewer = (latest: string, current: string): boolean => {
        const a = parseVersion(latest);
        const b = parseVersion(current);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const av = a[i] ?? 0;
            const bv = b[i] ?? 0;
            if (av > bv) return true;
            if (av < bv) return false;
        }
        return false;
    };

    useEffect(() => {
        // Only run inside the native Android APK
        if (!isNativeApp()) return;

        const checkForUpdate = async () => {
            try {
                const res = await fetch(`/api/app-version?_t=${Date.now()}`, {
                    cache: "no-store",
                    headers: { "Cache-Control": "no-cache, no-store" },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!data.success || !data.latestVersion) return;

                if (isNewer(data.latestVersion, APP_VERSION)) {
                    setUpdateInfo({
                        latestVersion: data.latestVersion,
                        apkUrl: data.apkUrl || "",
                        releaseNotes: data.releaseNotes || "Performance improvements.",
                        forceUpdate: data.forceUpdate === true,
                    });
                }
            } catch (err) {
                // Silent fail — update check should never crash the app
                console.warn("App update check failed:", err);
            }
        };

        // Slight delay so dashboard loads first
        const timer = setTimeout(checkForUpdate, 3000);
        return () => clearTimeout(timer);
    }, [isNativeApp]);

    // Not on native app, no update, or dismissed (and not forced)
    if (!updateInfo) return null;
    if (dismissed && !updateInfo.forceUpdate) return null;

    const handleDownload = () => {
        if (updateInfo.apkUrl) {
            window.open(updateInfo.apkUrl, "_blank");
        }
    };

    const handleDismiss = () => {
        if (!updateInfo.forceUpdate) {
            setDismissed(true);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                backgroundColor: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: "0 0 24px 0",
            }}
        >
            <div
                style={{
                    backgroundColor: "#fff",
                    borderRadius: "20px 20px 16px 16px",
                    width: "100%",
                    maxWidth: 440,
                    padding: "24px 20px 20px",
                    boxShadow: "0 -4px 40px rgba(0,0,0,0.25)",
                    fontFamily: "sans-serif",
                }}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                        }}
                    >
                        🚀
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>
                            New Update Available
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            v{APP_VERSION} → v{updateInfo.latestVersion}
                        </div>
                    </div>
                </div>

                {/* Release notes */}
                <div
                    style={{
                        background: "#f8fafc",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 13,
                        color: "#475569",
                        marginBottom: 16,
                        lineHeight: 1.5,
                        border: "1px solid #e2e8f0",
                    }}
                >
                    {updateInfo.releaseNotes}
                </div>

                {/* Force update warning */}
                {updateInfo.forceUpdate && (
                    <div
                        style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 12,
                            color: "#dc2626",
                            marginBottom: 14,
                            fontWeight: 600,
                        }}
                    >
                        ⚠️ This update is required. Please install to continue using the app.
                    </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                    {!updateInfo.forceUpdate && (
                        <button
                            onClick={handleDismiss}
                            style={{
                                flex: 1,
                                padding: "11px 0",
                                borderRadius: 10,
                                border: "1px solid #e2e8f0",
                                background: "#f1f5f9",
                                color: "#64748b",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Later
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        style={{
                            flex: 2,
                            padding: "11px 0",
                            borderRadius: 10,
                            border: "none",
                            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                        }}
                    >
                        ⬇️ Update Now
                    </button>
                </div>

                {/* Help note */}
                <div
                    style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: "#94a3b8",
                        textAlign: "center",
                        lineHeight: 1.4,
                    }}
                >
                    Tap "Update Now" → download the file → open it → tap Install
                </div>
            </div>
        </div>
    );
}
