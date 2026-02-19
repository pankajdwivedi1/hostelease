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

function QRCodeCanvas({ data, size = 550 }: { data: string; size?: number }) {
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
            className="w-full h-full object-contain rounded-2xl border-[3px] border-[#00ff884d] shadow-[0_0_20px_rgba(0,255,136,0.1)]"
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
        <div className="flex flex-col md:flex-row w-screen min-h-screen md:h-screen bg-[#0a0a1a] font-sans text-white overflow-y-auto md:overflow-hidden">
            {/* =================== LEFT PANEL: QR CODE =================== */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-between p-6 md:p-10 bg-gradient-to-b from-[#0a0a1a] via-[#0d1420] to-[#0a0a1a] border-b md:border-b-0 md:border-r border-[#00ff881a] relative shrink-0 transition-all duration-300">
                {/* Header */}
                <div className="flex justify-between items-center w-full mb-6 md:mb-0">
                    <div className="flex items-center gap-4">
                        <div className="text-4xl animate-pulse">🎫</div>
                        <div>
                            <h1 className="text-3xl font-extrabold bg-gradient-to-br from-[#00ff88] to-[#00cc6a] bg-clip-text text-transparent tracking-widest m-0">
                                GETPASS
                            </h1>
                            <p className="text-[13px] text-[rgba(255,255,255,0.5)] tracking-widest uppercase m-0">
                                Campus Outing System
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <span className="px-4 py-2 bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.3)] rounded-full text-sm text-[#00ff88]">
                            📍 {gateName}
                        </span>
                    </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-5 flex-1 justify-center w-full py-2 md:py-0">
                    <div className="p-4 bg-white rounded-[28px] border-[12px] border-[#00ff88] shadow-[0_0_100px_rgba(0,255,136,0.25)] relative flex items-center justify-center w-full max-w-[85vw] sm:max-w-[450px] md:max-w-[550px] aspect-square">
                        {qrData ? (
                            <QRCodeCanvas data={qrData} size={550} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-[rgba(255,255,255,0.5)] text-base">
                                <div className="w-10 h-10 border-[3px] border-[rgba(0,255,136,0.2)] border-t-[#00ff88] rounded-full animate-spin"></div>
                                <p>Generating QR Code...</p>
                            </div>
                        )}
                    </div>

                    {/* Timer Ring */}
                    <div className="flex flex-col items-center gap-2 mt-4 md:mt-0">
                        <div
                            className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_rgba(0,255,136,0.2)]"
                            style={{
                                background: `conic-gradient(
                  ${timeLeft <= 3 ? "#ff4444" : "#00ff88"} ${(timeLeft / 10) * 360}deg,
                  rgba(255,255,255,0.1) ${(timeLeft / 10) * 360}deg
                )`,
                            }}
                        >
                            <div className="w-[66px] h-[66px] rounded-full bg-[#0a0a1a] flex items-center justify-center">
                                <span
                                    className={`text-2xl font-black tabular-nums transition-colors duration-300 ${timeLeft <= 3 ? "text-[#ff4444]" : "text-[#00ff88]"
                                        }`}
                                >
                                    {timeLeft}s
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-[rgba(255,255,255,0.4)] uppercase tracking-widest m-0">
                            New QR in
                        </p>
                    </div>
                </div>

                {/* Instructions */}
                <div className="flex items-center gap-3 px-6 py-4 bg-[rgba(255,255,255,0.03)] rounded-2xl border border-[rgba(255,255,255,0.06)] mb-6 md:mb-0 hidden sm:flex">
                    <div className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.7)]">
                        <span className="text-xl">📱</span>
                        <span>Open HostelEase App</span>
                    </div>
                    <div className="text-[rgba(0,255,136,0.5)] text-base font-bold">→</div>
                    <div className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.7)]">
                        <span className="text-xl">📸</span>
                        <span>Tap "Scan GETPASS"</span>
                    </div>
                    <div className="text-[rgba(0,255,136,0.5)] text-base font-bold">→</div>
                    <div className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.7)]">
                        <span className="text-xl">✅</span>
                        <span>Done!</span>
                    </div>
                </div>

                {/* Current Time */}
                <div className="text-center">
                    <p className="text-3xl font-bold text-[rgba(255,255,255,0.9)] mb-1 tabular-nums">
                        {mounted ? formatTime(currentTime) : "--:--:-- --"}
                    </p>
                    <p className="text-sm text-[rgba(255,255,255,0.4)] m-0">
                        {mounted ? formatDate(currentTime) : "Loading date..."}
                    </p>
                </div>

                {/* Error display */}
                {error && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-[rgba(255,68,68,0.2)] border border-[rgba(255,68,68,0.4)] rounded-lg text-[#ff6b6b] text-sm">
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* =================== RIGHT PANEL: LIVE OUTING HISTORY =================== */}
            <div className="w-full md:w-1/2 flex flex-col p-6 md:p-8 bg-gradient-to-b from-[#0d1117] to-[#0a0e14] overflow-hidden min-h-[500px] md:h-full">
                {/* Summary Cards */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-white m-0">📊 Live Campus Status</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={handleLogout}
                            className="bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.3)] text-[#ff6b6b] px-4 py-1.5 rounded-lg flex items-center gap-2 font-semibold transition-all hover:bg-[rgba(255,68,68,0.2)]"
                            title="Logout from GETPASS"
                        >
                            <span className="text-sm">Logout</span>
                            <span className="text-lg">🚪</span>
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] text-white px-3 py-1.5 rounded-lg text-lg flex items-center justify-center transition-all hover:bg-[rgba(255,255,255,0.2)]"
                        >
                            {isFullscreen ? "⊡" : "⊞"}
                        </button>
                    </div>
                </div>

                {liveData && (
                    <div className="flex gap-3 mb-5 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                        <div className="flex-1 min-w-[100px] p-4 bg-[rgba(255,255,255,0.04)] rounded-2xl border border-[rgba(255,255,255,0.08)] text-center">
                            <div className="text-2xl mb-1">👥</div>
                            <div className="text-3xl font-extrabold text-white tabular-nums">{liveData.summary.totalStudents}</div>
                            <div className="text-[11px] text-[rgba(255,255,255,0.5)] uppercase tracking-widest mt-1">Total Students</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-4 bg-[rgba(0,255,136,0.05)] rounded-2xl border border-[rgba(0,255,136,0.2)] text-center">
                            <div className="text-2xl mb-1">🏠</div>
                            <div className="text-3xl font-extrabold text-[#00ff88] tabular-nums">{liveData.summary.studentsIn}</div>
                            <div className="text-[11px] text-[rgba(255,255,255,0.5)] uppercase tracking-widest mt-1">In Campus</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-4 bg-[rgba(255,107,107,0.05)] rounded-2xl border border-[rgba(255,107,107,0.2)] text-center">
                            <div className="text-2xl mb-1">🚶</div>
                            <div className="text-3xl font-extrabold text-[#ff6b6b] tabular-nums">{liveData.summary.studentsOut}</div>
                            <div className="text-[11px] text-[rgba(255,255,255,0.5)] uppercase tracking-widest mt-1">Outside</div>
                        </div>
                    </div>
                )}

                {/* Last Scan Result Banner */}
                {lastScanResult && (
                    <div
                        className="flex items-center gap-3 p-3 md:p-4 rounded-xl border mb-4 animate-[fadeIn_0.3s_ease]"
                        style={{
                            background: lastScanResult.action === "checkout"
                                ? "linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 107, 107, 0.05))"
                                : "linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 255, 136, 0.05))",
                            borderColor: lastScanResult.action === "checkout" ? "#ff6b6b" : "#00ff88",
                        }}
                    >
                        <span className="text-3xl">
                            {lastScanResult.action === "checkout" ? "🚶‍♂️" : "🏠"}
                        </span>
                        <div>
                            <p className="text-base font-bold text-white m-0">{lastScanResult.studentName}</p>
                            <p className="text-[13px] text-[rgba(255,255,255,0.7)] m-0">{lastScanResult.message}</p>
                        </div>
                    </div>
                )}

                {/* Currently Outside */}
                <div className="mb-2.5">
                    <h3 className="text-base font-semibold text-[rgba(255,255,255,0.9)] m-0">
                        🔴 Currently Outside ({liveData?.currentlyOut?.length || 0})
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 min-h-[200px] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 bg-[#0a0a1a]/30 custom-scrollbar">
                    {liveData?.currentlyOut && liveData.currentlyOut.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {liveData.currentlyOut.map((record) => (
                                <div key={record._id} className="flex justify-between items-center p-3 bg-[rgba(255,107,107,0.06)] rounded-xl border border-[rgba(255,107,107,0.15)] transition-colors hover:bg-[rgba(255,107,107,0.1)]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff6b6b] to-[#ee5a24] flex items-center justify-center font-bold text-lg text-white">
                                            {record.studentName?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <p className="text-[15px] font-semibold text-white m-0">{record.studentName}</p>
                                            <p className="text-xs text-[rgba(255,255,255,0.5)] mt-0.5">
                                                {record.hostelName} • Room {record.roomNumber}
                                                {record.registrationId && ` • ${record.registrationId}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-base font-bold text-[#ff6b6b] tabular-nums">
                                            {record.currentDurationText || formatDuration(record.currentDurationMinutes || 0)}
                                        </span>
                                        <span className="text-[11px] text-[rgba(255,255,255,0.4)]">
                                            Out at {record.checkOutISTTime}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
                            <span className="text-4xl">✅</span>
                            <p className="text-sm text-[rgba(255,255,255,0.4)]">All students are in campus</p>
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="mb-2.5">
                    <h3 className="text-base font-semibold text-[rgba(255,255,255,0.9)] m-0">📋 Recent Activity</h3>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[250px] min-h-[150px] border border-[rgba(255,255,255,0.05)] rounded-xl p-2 bg-[#0a0a1a]/30 custom-scrollbar">
                    {liveData?.recentActivity && liveData.recentActivity.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {liveData.recentActivity.map((record) => (
                                <div key={record._id} className="flex items-center gap-2 p-2 rounded-lg bg-[rgba(255,255,255,0.02)] text-[13px] hover:bg-[rgba(255,255,255,0.05)]">
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{
                                            background: record.status === "out" ? "#ff6b6b" : "#00ff88",
                                        }}
                                    />
                                    <span className="font-semibold text-[rgba(255,255,255,0.9)] flex-1">{record.studentName}</span>
                                    <span className="text-[rgba(255,255,255,0.4)] text-xs">
                                        {record.status === "out" ? "went out" : "returned"}
                                    </span>
                                    <span className="text-[rgba(255,255,255,0.5)] tabular-nums text-xs min-w-[70px] text-right">
                                        {record.status === "out" ? record.checkOutISTTime : record.checkInISTTime}
                                    </span>
                                    {record.status === "in" && record.durationMinutes !== undefined && (
                                        <span className="px-2 py-0.5 bg-[rgba(0,255,136,0.1)] rounded text-[#00ff88] text-[11px] font-semibold">
                                            {formatDuration(record.durationMinutes)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
                            <span className="text-4xl">📭</span>
                            <p className="text-sm text-[rgba(255,255,255,0.4)]">No activity yet today</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
