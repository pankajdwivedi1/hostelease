"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// GETPASS GATE DESKTOP — Split Screen: QR Code + Outing History
// ============================================================
// This page is designed to run on a desktop/screen at the campus gate.
// Left side: Rotating QR code (changes every 10 seconds)
// Right side: Live outing history and student counts
// ============================================================

// ===================== QR Code Generator (Canvas-based) =====================
// Simple QR code generator using canvas - no external library needed
// Uses a text-to-QR approach with the QR code API

function QRCodeCanvas({ data, size = 400 }: { data: string; size?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !data) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Use QR code image from API
        const img = new Image();
        img.crossOrigin = "anonymous";
        // Use a reliable QR code API
        const encodedData = encodeURIComponent(data);
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&bgcolor=ffffff&color=000000&margin=4&qzone=2`;

        img.onload = () => {
            canvas.width = size;
            canvas.height = size;
            // Draw a white background first
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
        };

        img.onerror = () => {
            // Fallback: Draw a placeholder
            canvas.width = size;
            canvas.height = size;
            ctx.fillStyle = "#0a0a1a";
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = "#00ff88";
            ctx.font = "bold 24px Inter, system-ui";
            ctx.textAlign = "center";
            ctx.fillText("QR Loading...", size / 2, size / 2);
        };
    }, [data, size]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{
                borderRadius: "16px",
                border: "3px solid rgba(0, 255, 136, 0.3)",
            }}
        />
    );
}

// ===================== Types =====================
interface OutingRecord {
    _id: string;
    studentName: string;
    hostelName: string;
    roomNumber: string;
    registrationId?: string;
    checkOutTime: string;
    checkOutISTTime: string;
    checkOutISTDate: string;
    checkInTime?: string;
    checkInISTTime?: string;
    checkInISTDate?: string;
    status: "out" | "in";
    durationMinutes?: number;
    currentDurationMinutes?: number;
    currentDurationText?: string;
    gateName?: string;
}

interface LiveData {
    summary: {
        totalStudents: number;
        studentsIn: number;
        studentsOut: number;
    };
    currentlyOut: OutingRecord[];
    recentActivity: OutingRecord[];
}

// ===================== Main Component =====================
export default function GateDesktopPage() {
    const [qrData, setQrData] = useState<string>("");
    const [qrToken, setQrToken] = useState<string>("");
    const [qrExpiry, setQrExpiry] = useState<Date | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(10);
    const [liveData, setLiveData] = useState<LiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [gateName] = useState("Main Gate");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastScanResult, setLastScanResult] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const router = useRouter();

    // ===================== Logout =====================
    const handleLogout = () => {
        sessionStorage.clear();
        router.push("/login?logout=success");
    };

    // ===================== Fetch new QR token =====================
    const fetchNewQR = useCallback(async () => {
        try {
            const res = await fetch(`/api/getpass/generate-qr?gate=${encodeURIComponent(gateName)}`);
            const data = await res.json();

            if (data.success) {
                setQrData(data.qrData);
                setQrToken(data.token);
                setQrExpiry(new Date(data.expiresAt));
                setTimeLeft(10);
                setError("");
            } else {
                setError("Failed to generate QR code");
            }
        } catch (err) {
            setError("Network error - retrying...");
        }
    }, [gateName]);

    // ===================== Fetch live data =====================
    const fetchLiveData = useCallback(async () => {
        try {
            const res = await fetch("/api/getpass/live");
            const data = await res.json();

            if (data.success) {
                setLiveData(data);
                setLoading(false);
            }
        } catch (err) {
            console.error("Failed to fetch live data:", err);
        }
    }, []);

    // ===================== Timer: Rotate QR every 10 seconds =====================
    useEffect(() => {
        fetchNewQR();
        const qrInterval = setInterval(fetchNewQR, 10000); // Every 10 seconds
        return () => clearInterval(qrInterval);
    }, [fetchNewQR]);

    // ===================== Timer: Refresh live data every 5 seconds =====================
    useEffect(() => {
        fetchLiveData();
        const liveInterval = setInterval(fetchLiveData, 5000); // Every 5 seconds
        return () => clearInterval(liveInterval);
    }, [fetchLiveData]);

    // ===================== Countdown timer =====================
    useEffect(() => {
        const countdownInterval = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 10));
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(countdownInterval);
    }, []);

    // ===================== Fullscreen toggle =====================
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // ===================== Format time =====================
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    // ===================== Duration formatter =====================
    const formatDuration = (minutes: number) => {
        if (!minutes) return "Just now";
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <div style={styles.container}>
            {/* =================== LEFT PANEL: QR CODE =================== */}
            <div style={styles.leftPanel}>
                {/* Header */}
                <div style={styles.qrHeader}>
                    <div style={styles.logoContainer}>
                        <div style={styles.logoIcon}>🎫</div>
                        <div>
                            <h1 style={styles.title}>GETPASS</h1>
                            <p style={styles.subtitle}>Campus Outing System</p>
                        </div>
                    </div>
                    <div style={styles.gateLabel}>
                        <span style={styles.gateBadge}>📍 {gateName}</span>
                    </div>
                </div>

                {/* QR Code */}
                <div style={styles.qrContainer}>
                    <div style={{
                        ...styles.qrWrapper,
                        animation: "qrPulse 4s infinite cubic-bezier(0.4, 0, 0.6, 1)"
                    }}>
                        {qrData ? (
                            <QRCodeCanvas data={qrData} size={550} />
                        ) : (
                            <div style={styles.qrPlaceholder}>
                                <div style={styles.spinner}></div>
                                <p>Generating QR Code...</p>
                            </div>
                        )}
                    </div>

                    {/* Timer Ring */}
                    <div style={styles.timerContainer}>
                        <div
                            style={{
                                ...styles.timerRing,
                                background: `conic-gradient(
                  ${timeLeft <= 3 ? "#ff4444" : "#00ff88"} ${(timeLeft / 10) * 360}deg,
                  rgba(255,255,255,0.1) ${(timeLeft / 10) * 360}deg
                )`,
                            }}
                        >
                            <div style={styles.timerInner}>
                                <span style={{
                                    ...styles.timerText,
                                    color: timeLeft <= 3 ? "#ff4444" : "#00ff88",
                                }}>
                                    {timeLeft}s
                                </span>
                            </div>
                        </div>
                        <p style={styles.timerLabel}>New QR in</p>
                    </div>
                </div>

                {/* Instructions */}
                <div style={styles.instructions}>
                    <div style={styles.instructionStep}>
                        <span style={styles.stepIcon}>📱</span>
                        <span>Open HostelEase App</span>
                    </div>
                    <div style={styles.instructionArrow}>→</div>
                    <div style={styles.instructionStep}>
                        <span style={styles.stepIcon}>📸</span>
                        <span>Tap "Scan GETPASS"</span>
                    </div>
                    <div style={styles.instructionArrow}>→</div>
                    <div style={styles.instructionStep}>
                        <span style={styles.stepIcon}>✅</span>
                        <span>Done!</span>
                    </div>
                </div>

                {/* Current Time */}
                <div style={styles.clockContainer}>
                    <p style={styles.clockTime}>
                        {mounted ? formatTime(currentTime) : "--:--:-- --"}
                    </p>
                    <p style={styles.clockDate}>
                        {mounted ? formatDate(currentTime) : "Loading date..."}
                    </p>
                </div>

                {/* Error display */}
                {error && (
                    <div style={styles.errorBanner}>
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* =================== RIGHT PANEL: LIVE OUTING HISTORY =================== */}
            <div style={styles.rightPanel}>
                {/* Summary Cards */}
                <div style={styles.summaryHeader}>
                    <h2 style={styles.rightTitle}>📊 Live Campus Status</h2>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={handleLogout}
                            style={styles.logoutBtn}
                            title="Logout from GETPASS"
                        >
                            <span style={{ fontSize: "14px" }}>Logout</span>
                            <span style={{ fontSize: "18px" }}>🚪</span>
                        </button>
                        <button onClick={toggleFullscreen} style={styles.fullscreenBtn}>
                            {isFullscreen ? "⊡" : "⊞"}
                        </button>
                    </div>
                </div>

                {liveData && (
                    <div style={styles.summaryCards}>
                        <div style={styles.summaryCard}>
                            <div style={styles.summaryIcon}>👥</div>
                            <div style={styles.summaryValue}>{liveData.summary.totalStudents}</div>
                            <div style={styles.summaryLabel}>Total Students</div>
                        </div>
                        <div style={{ ...styles.summaryCard, ...styles.summaryCardGreen }}>
                            <div style={styles.summaryIcon}>🏠</div>
                            <div style={{ ...styles.summaryValue, color: "#00ff88" }}>
                                {liveData.summary.studentsIn}
                            </div>
                            <div style={styles.summaryLabel}>In Campus</div>
                        </div>
                        <div style={{ ...styles.summaryCard, ...styles.summaryCardRed }}>
                            <div style={styles.summaryIcon}>🚶</div>
                            <div style={{ ...styles.summaryValue, color: "#ff6b6b" }}>
                                {liveData.summary.studentsOut}
                            </div>
                            <div style={styles.summaryLabel}>Outside</div>
                        </div>
                    </div>
                )}

                {/* Last Scan Result Banner */}
                {lastScanResult && (
                    <div
                        style={{
                            ...styles.scanResultBanner,
                            background: lastScanResult.action === "checkout"
                                ? "linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 107, 107, 0.05))"
                                : "linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 255, 136, 0.05))",
                            borderColor: lastScanResult.action === "checkout" ? "#ff6b6b" : "#00ff88",
                        }}
                    >
                        <span style={styles.scanResultIcon}>
                            {lastScanResult.action === "checkout" ? "🚶‍♂️" : "🏠"}
                        </span>
                        <div>
                            <p style={styles.scanResultName}>{lastScanResult.studentName}</p>
                            <p style={styles.scanResultMsg}>{lastScanResult.message}</p>
                        </div>
                    </div>
                )}

                {/* Currently Outside */}
                <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>
                        🔴 Currently Outside ({liveData?.currentlyOut?.length || 0})
                    </h3>
                </div>

                <div style={styles.scrollContainer}>
                    {liveData?.currentlyOut && liveData.currentlyOut.length > 0 ? (
                        <div style={styles.outingList}>
                            {liveData.currentlyOut.map((record) => (
                                <div key={record._id} style={styles.outingCard}>
                                    <div style={styles.outingCardLeft}>
                                        <div style={styles.outingAvatar}>
                                            {record.studentName?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <p style={styles.outingName}>{record.studentName}</p>
                                            <p style={styles.outingDetails}>
                                                {record.hostelName} • Room {record.roomNumber}
                                                {record.registrationId && ` • ${record.registrationId}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={styles.outingCardRight}>
                                        <span style={styles.outingDuration}>
                                            {record.currentDurationText || formatDuration(record.currentDurationMinutes || 0)}
                                        </span>
                                        <span style={styles.outingTime}>
                                            Out at {record.checkOutISTTime}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={styles.emptyState}>
                            <span style={styles.emptyIcon}>✅</span>
                            <p style={styles.emptyText}>All students are in campus</p>
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>📋 Recent Activity</h3>
                </div>

                <div style={styles.scrollContainerSmall}>
                    {liveData?.recentActivity && liveData.recentActivity.length > 0 ? (
                        <div style={styles.activityList}>
                            {liveData.recentActivity.map((record) => (
                                <div key={record._id} style={styles.activityRow}>
                                    <span
                                        style={{
                                            ...styles.activityDot,
                                            background: record.status === "out" ? "#ff6b6b" : "#00ff88",
                                        }}
                                    />
                                    <span style={styles.activityName}>{record.studentName}</span>
                                    <span style={styles.activityAction}>
                                        {record.status === "out" ? "went out" : "returned"}
                                    </span>
                                    <span style={styles.activityTime}>
                                        {record.status === "out" ? record.checkOutISTTime : record.checkInISTTime}
                                    </span>
                                    {record.status === "in" && record.durationMinutes !== undefined && (
                                        <span style={styles.activityDurationBadge}>
                                            {formatDuration(record.durationMinutes)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={styles.emptyState}>
                            <span style={styles.emptyIcon}>📭</span>
                            <p style={styles.emptyText}>No activity yet today</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===================== Styles =====================
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: "flex",
        width: "100vw",
        height: "100vh",
        background: "#0a0a1a",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: "#ffffff",
        overflow: "hidden",
    },

    // ===== LEFT PANEL (QR Code) =====
    leftPanel: {
        flex: "0 0 50%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "30px 40px",
        background: "linear-gradient(180deg, #0a0a1a 0%, #0d1420 50%, #0a0a1a 100%)",
        borderRight: "1px solid rgba(0, 255, 136, 0.1)",
        position: "relative",
    },

    qrHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
    },

    logoContainer: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },

    logoIcon: {
        fontSize: "40px",
        animation: "pulse 2s infinite",
    },

    title: {
        fontSize: "32px",
        fontWeight: "800",
        background: "linear-gradient(135deg, #00ff88, #00cc6a)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        letterSpacing: "3px",
        margin: 0,
    },

    subtitle: {
        fontSize: "13px",
        color: "rgba(255,255,255,0.5)",
        margin: 0,
        letterSpacing: "2px",
        textTransform: "uppercase" as const,
    },

    gateLabel: {
        display: "flex",
        alignItems: "center",
    },

    gateBadge: {
        padding: "8px 16px",
        background: "rgba(0, 255, 136, 0.1)",
        border: "1px solid rgba(0, 255, 136, 0.3)",
        borderRadius: "20px",
        fontSize: "14px",
        color: "#00ff88",
    },

    qrContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        flex: 1,
        justifyContent: "center",
    },

    qrWrapper: {
        padding: "15px",
        background: "#ffffff",
        borderRadius: "28px",
        border: "12px solid #00ff88",
        boxShadow: "0 0 100px rgba(0, 255, 136, 0.25)",
        position: "relative" as const,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    qrPlaceholder: {
        width: "550px",
        height: "550px",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        color: "rgba(255,255,255,0.5)",
        fontSize: "16px",
    },

    spinner: {
        width: "40px",
        height: "40px",
        border: "3px solid rgba(0, 255, 136, 0.2)",
        borderTop: "3px solid #00ff88",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
    },

    timerContainer: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: "8px",
    },

    timerRing: {
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.3s ease",
        boxShadow: "0 0 20px rgba(0, 255, 136, 0.2)",
    },

    timerInner: {
        width: "66px",
        height: "66px",
        borderRadius: "50%",
        background: "#0a0a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    timerText: {
        fontSize: "24px",
        fontWeight: "900",
        fontVariantNumeric: "tabular-nums" as const,
    },

    timerLabel: {
        fontSize: "12px",
        color: "rgba(255,255,255,0.4)",
        margin: 0,
        textTransform: "uppercase" as const,
        letterSpacing: "1px",
    },

    instructions: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px 24px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.06)",
    },

    instructionStep: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "14px",
        color: "rgba(255,255,255,0.7)",
    },

    stepIcon: {
        fontSize: "20px",
    },

    instructionArrow: {
        color: "rgba(0, 255, 136, 0.5)",
        fontSize: "16px",
        fontWeight: "700",
    },

    clockContainer: {
        textAlign: "center" as const,
    },

    clockTime: {
        fontSize: "28px",
        fontWeight: "700",
        color: "rgba(255,255,255,0.9)",
        margin: "0 0 4px 0",
        fontVariantNumeric: "tabular-nums" as const,
    },

    clockDate: {
        fontSize: "14px",
        color: "rgba(255,255,255,0.4)",
        margin: 0,
    },

    errorBanner: {
        position: "absolute" as const,
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "10px 20px",
        background: "rgba(255, 68, 68, 0.2)",
        border: "1px solid rgba(255, 68, 68, 0.4)",
        borderRadius: "8px",
        color: "#ff6b6b",
        fontSize: "13px",
    },

    // ===== RIGHT PANEL (Live Data) =====
    rightPanel: {
        flex: "0 0 50%",
        display: "flex",
        flexDirection: "column",
        padding: "24px 30px",
        background: "linear-gradient(180deg, #0d1117 0%, #0a0e14 100%)",
        overflow: "hidden",
    },

    summaryHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "16px",
    },

    rightTitle: {
        fontSize: "22px",
        fontWeight: "700",
        color: "#ffffff",
        margin: 0,
    },

    fullscreenBtn: {
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
        padding: "6px 12px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
    },

    logoutBtn: {
        background: "rgba(255, 68, 68, 0.1)",
        border: "1px solid rgba(255, 68, 68, 0.3)",
        color: "#ff6b6b",
        padding: "6px 16px",
        borderRadius: "8px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontWeight: "600",
        transition: "all 0.2s ease",
    },

    summaryCards: {
        display: "flex",
        gap: "12px",
        marginBottom: "20px",
    },

    summaryCard: {
        flex: 1,
        padding: "16px",
        background: "rgba(255,255,255,0.04)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)",
        textAlign: "center" as const,
    },

    summaryCardGreen: {
        border: "1px solid rgba(0, 255, 136, 0.2)",
        background: "rgba(0, 255, 136, 0.05)",
    },

    summaryCardRed: {
        border: "1px solid rgba(255, 107, 107, 0.2)",
        background: "rgba(255, 107, 107, 0.05)",
    },

    summaryIcon: {
        fontSize: "24px",
        marginBottom: "4px",
    },

    summaryValue: {
        fontSize: "32px",
        fontWeight: "800",
        color: "#ffffff",
        fontVariantNumeric: "tabular-nums" as const,
    },

    summaryLabel: {
        fontSize: "11px",
        color: "rgba(255,255,255,0.5)",
        textTransform: "uppercase" as const,
        letterSpacing: "1px",
        marginTop: "4px",
    },

    scanResultBanner: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid",
        marginBottom: "16px",
        animation: "fadeIn 0.3s ease",
    },

    scanResultIcon: {
        fontSize: "32px",
    },

    scanResultName: {
        fontSize: "16px",
        fontWeight: "700",
        color: "#fff",
        margin: 0,
    },

    scanResultMsg: {
        fontSize: "13px",
        color: "rgba(255,255,255,0.7)",
        margin: 0,
    },

    sectionHeader: {
        marginBottom: "10px",
    },

    sectionTitle: {
        fontSize: "16px",
        fontWeight: "600",
        color: "rgba(255,255,255,0.9)",
        margin: 0,
    },

    scrollContainer: {
        flex: 1,
        overflowY: "auto" as const,
        marginBottom: "16px",
        minHeight: "0",
    },

    scrollContainerSmall: {
        flex: 1,
        overflowY: "auto" as const,
        minHeight: "0",
    },

    outingList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "8px",
    },

    outingCard: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        background: "rgba(255, 107, 107, 0.06)",
        borderRadius: "12px",
        border: "1px solid rgba(255, 107, 107, 0.15)",
    },

    outingCardLeft: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },

    outingAvatar: {
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        background: "linear-gradient(135deg, #ff6b6b, #ee5a24)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "700",
        fontSize: "18px",
        color: "#fff",
    },

    outingName: {
        fontSize: "15px",
        fontWeight: "600",
        color: "#fff",
        margin: 0,
    },

    outingDetails: {
        fontSize: "12px",
        color: "rgba(255,255,255,0.5)",
        margin: "2px 0 0 0",
    },

    outingCardRight: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "flex-end",
        gap: "4px",
    },

    outingDuration: {
        fontSize: "16px",
        fontWeight: "700",
        color: "#ff6b6b",
        fontVariantNumeric: "tabular-nums" as const,
    },

    outingTime: {
        fontSize: "11px",
        color: "rgba(255,255,255,0.4)",
    },

    emptyState: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        gap: "12px",
    },

    emptyIcon: {
        fontSize: "36px",
    },

    emptyText: {
        fontSize: "14px",
        color: "rgba(255,255,255,0.4)",
        margin: 0,
    },

    activityList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "4px",
    },

    activityRow: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.02)",
        fontSize: "13px",
    },

    activityDot: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        flexShrink: 0,
    },

    activityName: {
        fontWeight: "600",
        color: "rgba(255,255,255,0.9)",
        flex: 1,
    },

    activityAction: {
        color: "rgba(255,255,255,0.4)",
        fontSize: "12px",
    },

    activityTime: {
        color: "rgba(255,255,255,0.5)",
        fontVariantNumeric: "tabular-nums" as const,
        fontSize: "12px",
        minWidth: "70px",
        textAlign: "right" as const,
    },

    activityDurationBadge: {
        padding: "2px 8px",
        background: "rgba(0, 255, 136, 0.1)",
        borderRadius: "4px",
        color: "#00ff88",
        fontSize: "11px",
        fontWeight: "600",
    },
};
