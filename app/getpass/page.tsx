"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// GATEPASS GATE DESKTOP — Split Screen: QR Code + Outing History
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

// ===================== Rectangle Timer with running border bars =====================
function RectangleTimer({ timeLeft, maxTime = 10 }: { timeLeft: number; maxTime?: number }) {
    const progress = timeLeft / maxTime; // 1 = full, 0 = empty
    const isLow = timeLeft <= 3;
    const color = isLow ? "#ff4444" : "#00ff88";
    const glowColor = isLow ? "rgba(255,68,68,0.6)" : "rgba(0,255,136,0.6)";

    // Animation offset for running bars — moves around the rectangle perimeter
    // We use CSS keyframes injected via style tag for the running effect
    return (
        <>
            <style>{`
                @keyframes runTop {
                    0%   { left: -100%; }
                    100% { left: 100%; }
                }
                @keyframes runRight {
                    0%   { top: -100%; }
                    100% { top: 100%; }
                }
                @keyframes runBottom {
                    0%   { right: -100%; }
                    100% { right: 100%; }
                }
                @keyframes runLeft {
                    0%   { bottom: -100%; }
                    100% { bottom: 100%; }
                }
                .rect-timer-bar-top {
                    animation: runTop 1s linear infinite;
                }
                .rect-timer-bar-right {
                    animation: runRight 1s linear infinite;
                    animation-delay: 0.25s;
                }
                .rect-timer-bar-bottom {
                    animation: runBottom 1s linear infinite;
                    animation-delay: 0.5s;
                }
                .rect-timer-bar-left {
                    animation: runLeft 1s linear infinite;
                    animation-delay: 0.75s;
                }
            `}</style>

            <div
                className="relative flex items-center justify-center"
                style={{
                    width: 120,
                    height: 52,
                    borderRadius: 8,
                    background: "#0a0a1a",
                    border: `2px solid ${color}33`,
                    boxShadow: `0 0 16px ${glowColor}40, inset 0 0 8px ${glowColor}10`,
                    overflow: "hidden",
                }}
            >
                {/* Progress fill */}
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100%",
                        width: `${progress * 100}%`,
                        background: `linear-gradient(90deg, ${color}22, ${color}44)`,
                        transition: "width 1s linear",
                        borderRadius: 6,
                    }}
                />

                {/* Running bar — TOP edge */}
                <div
                    className="rect-timer-bar-top"
                    style={{
                        position: "absolute",
                        top: 0,
                        height: 3,
                        width: "50%",
                        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                        filter: `drop-shadow(0 0 4px ${color})`,
                        borderRadius: 2,
                    }}
                />

                {/* Running bar — RIGHT edge */}
                <div
                    className="rect-timer-bar-right"
                    style={{
                        position: "absolute",
                        right: 0,
                        width: 3,
                        height: "50%",
                        background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
                        filter: `drop-shadow(0 0 4px ${color})`,
                        borderRadius: 2,
                    }}
                />

                {/* Running bar — BOTTOM edge */}
                <div
                    className="rect-timer-bar-bottom"
                    style={{
                        position: "absolute",
                        bottom: 0,
                        height: 3,
                        width: "50%",
                        background: `linear-gradient(270deg, transparent, ${color}, transparent)`,
                        filter: `drop-shadow(0 0 4px ${color})`,
                        borderRadius: 2,
                    }}
                />

                {/* Running bar — LEFT edge */}
                <div
                    className="rect-timer-bar-left"
                    style={{
                        position: "absolute",
                        left: 0,
                        width: 3,
                        height: "50%",
                        background: `linear-gradient(0deg, transparent, ${color}, transparent)`,
                        filter: `drop-shadow(0 0 4px ${color})`,
                        borderRadius: 2,
                    }}
                />

                {/* Center text */}
                <span
                    style={{
                        position: "relative",
                        zIndex: 1,
                        fontSize: 22,
                        fontWeight: 900,
                        color,
                        letterSpacing: 1,
                        fontVariantNumeric: "tabular-nums",
                        textShadow: `0 0 8px ${glowColor}`,
                    }}
                >
                    {timeLeft}s
                </span>
            </div>
        </>
    );
}

// ===================== Types =====================
interface OutingRecord {
    _id: string;
    studentId: string;
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
    const router = useRouter();
    const [qrData, setQrData] = useState<string>("");
    const [qrToken, setQrToken] = useState<string>("");
    const [qrExpiry, setQrExpiry] = useState<Date | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(10);
    const [liveData, setLiveData] = useState<LiveData | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [gateName] = useState("Main Gate");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastScanResult, setLastScanResult] = useState<{
        studentId?: string;
        studentName: string;
        action: "checkin" | "checkout";
        message: string;
        timestamp: Date;
    } | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ===================== Logout =====================
    const handleLogout = () => {
        localStorage.clear();
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
    const fetchStudentProfile = async (studentId: string) => {
        setIsLoadingProfile(true);
        setIsProfileModalOpen(true);
        try {
            const response = await fetch(`/api/students/${studentId}`);
            const data = await response.json();

            if (data.student) {
                setSelectedStudent(data.student);
            } else {
                console.error("Student not found");
                setSelectedStudent(null);
            }
        } catch (err) {
            console.error("Error fetching student profile:", err);
            setSelectedStudent(null);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleStudentClick = (studentId: string) => {
        if (!studentId) return;
        setSelectedStudentId(studentId);
        fetchStudentProfile(studentId);
    };

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

    // ===================== Auto-Banner logic for new scans =====================
    useEffect(() => {
        if (liveData?.recentActivity && liveData.recentActivity.length > 0) {
            const latest = liveData.recentActivity[0];
            const timeStr = latest.status === 'out' ? latest.checkOutTime : (latest.checkInTime || new Date().toISOString());
            const activityTime = new Date(timeStr).getTime();
            const now = new Date().getTime();

            // If activity happened in the last 15 seconds, show the banner
            if (now - activityTime < 15000) {
                setLastScanResult({
                    studentId: latest.studentId,
                    studentName: latest.studentName,
                    action: latest.status === 'out' ? 'checkout' : 'checkin',
                    message: latest.status === 'out' ? 'Checked out of campus' : 'Returned to hostel',
                    timestamp: new Date(activityTime)
                });

                const clearTimer = setTimeout(() => {
                    setLastScanResult(null);
                }, 10000);
                return () => clearTimeout(clearTimer);
            }
        }
    }, [liveData?.recentActivity]);

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
        const raw = date.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
        return raw.replace(/am/i, "AM").replace(/pm/i, "PM");
    };

    const formatDate = (date: Date) => {
        const ist = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const dd = String(ist.getDate()).padStart(2, "0");
        const mm = String(ist.getMonth() + 1).padStart(2, "0");
        const yyyy = ist.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
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
            <div className="w-full md:w-1/2 flex flex-col items-center justify-start gap-5 p-6 md:p-8 bg-gradient-to-b from-[#0a0a1a] via-[#0d1420] to-[#0a0a1a] border-b md:border-b-0 md:border-r border-[#00ff881a] relative shrink-0 transition-all duration-300 overflow-hidden">

                {/* ── TOP ROW: Logo left + Instructions right ── */}
                <div className="flex items-start justify-between w-full mb-2">
                    {/* Logo block */}
                    <div className="flex flex-col">
                        <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-br from-[#00ff88] to-[#00cc6a] bg-clip-text text-transparent tracking-widest m-0 leading-tight">
                            GATEPASS
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="inline-block px-2 py-0.5 bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.3)] rounded-full text-[10px] md:text-xs text-[#00ff88] font-bold">
                                📍 {gateName}
                            </span>
                            <p className="text-[10px] md:text-[11px] text-[rgba(255,255,255,0.45)] tracking-widest uppercase m-0 leading-none">
                                Campus Outing System
                            </p>
                        </div>
                    </div>

                    {/* Instructions bar */}
                    <div className="hidden sm:flex items-center gap-3 px-4 py-3 bg-[rgba(0,255,136,0.07)] rounded-2xl border border-[rgba(0,255,136,0.3)] shadow-[0_0_16px_rgba(0,255,136,0.10)] flex-shrink-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span className="text-base">📱</span>
                            <span>Open HostelEase App</span>
                        </div>
                        <div className="text-[#00ff88] font-black text-sm">→</div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span className="text-base">📸</span>
                            <span>Tap &quot;Scan GATEPASS&quot;</span>
                        </div>
                        <div className="text-[#00ff88] font-black text-sm">→</div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <span className="text-base">✅</span>
                            <span>Done!</span>
                        </div>
                    </div>
                </div>

                {/* ── Timer | Time | Date — single centered row ── */}
                <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex items-center justify-center gap-3 md:gap-4 w-full px-2">
                        {/* Timer */}
                        <div className="scale-75 md:scale-100 origin-center shrink-0">
                            <RectangleTimer timeLeft={timeLeft} maxTime={10} />
                        </div>

                        {/* Divider */}
                        <div className="w-px h-8 md:h-12 bg-[rgba(255,255,255,0.2)] shrink-0" />

                        {/* Time & Date Container */}
                        <div className="flex flex-col items-center md:flex-row md:items-center md:gap-4 shrink-0">
                            <p className="text-xl md:text-3xl font-bold text-white tabular-nums m-0 leading-tight whitespace-nowrap">
                                {mounted ? formatTime(currentTime) : "--:--:-- --"}
                            </p>

                            {/* Divider - Desktop Only */}
                            <div className="hidden md:block w-px h-12 bg-[rgba(255,255,255,0.2)]" />

                            <p className="text-sm md:text-3xl md:font-bold text-[rgba(255,255,255,0.5)] md:text-white m-0 leading-tight whitespace-nowrap">
                                {mounted ? formatDate(currentTime) : "Loading..."}
                            </p>
                        </div>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-[rgba(0,255,136,0.2)] to-transparent" />
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center w-full py-2">
                    <div className="p-3 md:p-4 bg-white rounded-[24px] md:rounded-[28px] border-[8px] md:border-[12px] border-[#00ff88] shadow-[0_0_60px_rgba(0,255,136,0.15)] md:shadow-[0_0_100px_rgba(0,255,136,0.25)] relative flex items-center justify-center w-full max-w-[min(70vw,50vh,580px)] md:max-w-[min(44vw,68vh,580px)]"
                        style={{ aspectRatio: '1/1' }}>
                        {qrData ? (
                            <QRCodeCanvas data={qrData} size={550} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-[rgba(255,255,255,0.5)] text-base">
                                <div className="w-10 h-10 border-[3px] border-[rgba(0,255,136,0.2)] border-t-[#00ff88] rounded-full animate-spin"></div>
                                <p className="text-gray-400 font-medium">Wait...</p>
                            </div>
                        )}
                    </div>
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
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                    <h2 className="text-lg md:text-xl font-bold text-white m-0 flex items-center gap-2">
                        <span className="p-2 bg-[rgba(59,130,246,0.1)] rounded-lg text-blue-400">📊</span>
                        Live Campus Status
                    </h2>
                    <div className="flex gap-2 self-end sm:self-auto">
                        <button
                            onClick={handleLogout}
                            className="bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.2)] text-[#ff6b6b] px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold transition-all hover:bg-[rgba(255,68,68,0.2)] active:scale-95"
                            title="Logout"
                        >
                            <span className="text-[10px] uppercase tracking-wider">Logout</span>
                            <span className="text-sm">🚪</span>
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-[rgba(255,255,255,0.1)] active:scale-95"
                        >
                            {isFullscreen ? "⊡" : "⊞"}
                        </button>
                    </div>
                </div>

                {liveData && (
                    <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2 md:gap-3 mb-4">
                        <div className="p-3 bg-[rgba(255,255,255,0.04)] rounded-2xl border border-[rgba(255,255,255,0.08)] text-center flex flex-col justify-center lg:flex-1">
                            <div className="text-xl mb-1">👥</div>
                            <div className="text-2xl font-extrabold text-white tabular-nums leading-tight">{liveData.summary.totalStudents}</div>
                            <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest mt-0.5">Total</div>
                        </div>
                        <div className="p-3 bg-[rgba(0,255,136,0.05)] rounded-2xl border border-[rgba(0,255,136,0.2)] text-center flex flex-col justify-center lg:flex-1">
                            <div className="text-xl mb-1">🏠</div>
                            <div className="text-2xl font-extrabold text-[#00ff88] tabular-nums leading-tight">{liveData.summary.studentsIn}</div>
                            <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest mt-0.5">In Campus</div>
                        </div>
                        <div className="p-3 bg-[rgba(255,107,107,0.05)] rounded-2xl border border-[rgba(255,107,107,0.2)] text-center flex flex-col justify-center lg:flex-1">
                            <div className="text-xl mb-1">🚶</div>
                            <div className="text-2xl font-extrabold text-[#ff6b6b] tabular-nums leading-tight">{liveData.summary.studentsOut}</div>
                            <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest mt-0.5">Outside</div>
                        </div>
                        <div
                            onClick={() => router.push('/getpass/history')}
                            className="p-3 bg-[rgba(59,130,246,0.05)] rounded-2xl border border-[rgba(59,130,246,0.2)] text-center cursor-pointer hover:bg-[rgba(59,130,246,0.1)] transition-all group active:scale-95 flex flex-col justify-center lg:flex-1"
                        >
                            <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📜</div>
                            <div className="text-2xl font-extrabold text-[#3b82f6] tabular-nums group-hover:text-[#60a5fa] transition-colors flex items-center justify-center gap-1 leading-tight">
                                GO
                                <span className="text-sm font-black">→</span>
                            </div>
                            <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest mt-0.5 group-hover:text-[rgba(255,255,255,0.8)] transition-colors">History</div>
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
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                            {liveData.currentlyOut.map((record) => (
                                <div key={record._id} className="flex justify-between items-center py-2.5 px-3 bg-[#161b2e] rounded-2xl border border-[#ff6b6b15] transition-all hover:border-[#ff6b6b30] group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            onClick={() => handleStudentClick(record.studentId)}
                                            className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6b6b] to-[#ee5253] flex items-center justify-center font-black text-sm text-white cursor-pointer shadow-[0_4px_12px_rgba(238,82,83,0.3)] transition-transform hover:scale-105 shrink-0"
                                        >
                                            {record.studentName?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div className="min-w-0">
                                            <p
                                                onClick={() => handleStudentClick(record.studentId)}
                                                className="text-[14px] font-bold text-white m-0 cursor-pointer hover:text-[#ff6b6b] transition-colors leading-tight truncate"
                                            >
                                                {record.studentName}
                                            </p>
                                            <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5 font-medium truncate">
                                                {record.hostelName} • {record.roomNumber}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        <span className="text-[14px] font-black text-[#ff6b6b] tabular-nums tracking-tight">
                                            {record.currentDurationText || formatDuration(record.currentDurationMinutes || 0)}
                                        </span>
                                        <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-bold uppercase tracking-wider">
                                            {record.checkOutISTTime}
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
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-1">
                            {liveData.recentActivity.map((record) => (
                                <div key={record._id} className="flex items-center gap-2 py-1.5 px-2 border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-all min-w-0">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{
                                            background: record.status === "out" ? "#ff6b6b" : "#00ff88",
                                            boxShadow: record.status === "in" ? "0 0 10px rgba(0,255,136,0.25)" : "0 0 10px rgba(255,107,107,0.25)"
                                        }}
                                    />
                                    <span
                                        onClick={() => handleStudentClick(record.studentId)}
                                        className="text-[13px] font-bold text-[rgba(255,255,255,0.9)] flex-1 cursor-pointer hover:text-[#00ff88] transition-colors truncate"
                                    >
                                        {record.studentName}
                                    </span>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[11px] text-[rgba(255,255,255,0.4)] tabular-nums font-bold min-w-[60px] text-right">
                                            {record.status === "out" ? record.checkOutISTTime : record.checkInISTTime}
                                        </span>
                                        {record.status === "in" && record.durationMinutes !== undefined && (
                                            <span className="px-1.5 py-0.5 bg-[rgba(0,255,136,0.08)] rounded text-[#00ff88] text-[10px] font-black uppercase tracking-tighter">
                                                {formatDuration(record.durationMinutes)}
                                            </span>
                                        )}
                                    </div>
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

            {/* Student Profile Modal */}
            {isProfileModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in transition-all cursor-pointer"
                    onClick={() => setIsProfileModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col relative animate-in zoom-in-95 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setIsProfileModalOpen(false)}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-800 transition-colors z-10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="overflow-hidden">
                            {isLoadingProfile ? (
                                <div className="h-[400px] flex flex-col items-center justify-center gap-4 p-8 text-center text-gray-500">
                                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="font-medium">Fetching secure profile...</p>
                                </div>
                            ) : selectedStudent ? (
                                <div className="flex flex-col">
                                    {/* Modal Header/Cover */}
                                    <div className="h-28 bg-gradient-to-r from-blue-600 to-indigo-700 relative shrink-0" />

                                    {/* Profile Summary & Basic Info in a Row */}
                                    <div className="px-6 md:px-10 py-6 flex flex-col md:flex-row items-center gap-6 md:gap-10">
                                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white p-1.5 shadow-xl shadow-blue-900/10 relative group overflow-hidden shrink-0 -mt-16 md:-mt-20">
                                            <div className="w-full h-full rounded-2xl bg-gray-50 flex items-center justify-center text-3xl md:text-4xl font-black text-blue-600 overflow-hidden">
                                                {selectedStudent.profilePicture ? (
                                                    <img
                                                        src={selectedStudent.profilePicture}
                                                        alt={selectedStudent.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    selectedStudent.name?.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="absolute top-2 right-2">
                                                <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-4 border-white shadow-sm ${selectedStudent.studentStatus === 'out' ? 'bg-red-500' : 'bg-green-500'}`} />
                                            </div>
                                        </div>

                                        <div className="flex flex-col text-center md:text-left flex-1 w-full">
                                            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
                                                <h2 className="text-2xl md:text-3xl font-black text-gray-900 m-0">{selectedStudent.name}</h2>
                                                <span className={`inline-block self-center md:self-auto px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider ${selectedStudent.studentStatus === 'out' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {selectedStudent.studentStatus === 'out' ? 'Currently Outside' : 'Inside Campus'}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6">
                                                <div>
                                                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Registration ID</p>
                                                    <p className="text-blue-600 font-bold text-base md:text-lg select-all m-0">{selectedStudent.registrationId || "N/A"}</p>
                                                </div>
                                                <div className="hidden md:block w-px h-10 bg-gray-100" />
                                                <div>
                                                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Hostel & Room</p>
                                                    <p className="text-gray-800 font-bold text-base md:text-lg m-0">{selectedStudent.hostelName || "Official"} • No. {selectedStudent.roomNumber || "0"}</p>
                                                </div>
                                                <div className="hidden md:block w-px h-10 bg-gray-100" />
                                                <div>
                                                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Biometric</p>
                                                    <div className="flex items-center justify-center md:justify-start gap-1.5">
                                                        <span className={`w-2 h-2 rounded-full ${selectedStudent.faceDescriptor ? 'bg-green-500' : 'bg-orange-500'}`} />
                                                        <p className="text-gray-700 font-bold text-sm md:text-base m-0">{selectedStudent.faceDescriptor ? 'Verified' : 'Pending'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details Grid - Responsive Columns */}
                                    <div className="px-6 md:px-10 pb-10">
                                        <div className="bg-gray-50/50 rounded-3xl border border-gray-100 p-6 md:p-8">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 md:gap-x-12 gap-y-6 md:gap-y-8">
                                                <DetailItem label="Email Address" value={selectedStudent.email} icon="📧" className="col-span-1 sm:col-span-2" />
                                                <DetailItem label="Mobile Number" value={selectedStudent.phoneNumber} icon="📱" />
                                                <DetailItem label="Father's Name" value={selectedStudent.fatherName} icon="👨" />

                                                <div className="hidden sm:block col-span-1 sm:col-span-2 md:col-span-4 h-px bg-gray-100 my-2" />

                                                <DetailItem label="Father's Phone" value={selectedStudent.fatherNumber} icon="📞" />
                                                <DetailItem label="College Name" value={selectedStudent.collegeName} icon="🎓" className="col-span-1 sm:col-span-2" />
                                                <DetailItem label="Course / Branch" value={selectedStudent.branch} icon="📚" />

                                                <div className="hidden sm:block col-span-1 sm:col-span-2 md:col-span-4 h-px bg-gray-100 my-2" />

                                                <DetailItem label="Academic Year" value={selectedStudent.year} icon="📅" />
                                                <DetailItem label="Semester" value={selectedStudent.semester} icon="⏱️" />
                                                <DetailItem label="Enrollment ID" value={selectedStudent.erpInformation} icon="🆔" textColor="text-blue-600" />
                                                <DetailItem label="Gender/Category" value={selectedStudent.category || 'N/A'} icon="👤" />

                                                <div className="col-span-1 sm:col-span-2 md:col-span-4 h-px bg-gray-100 my-2" />

                                                <DetailItem label="Permanent Address" value={selectedStudent.permanentAddress} icon="🏠" className="col-span-1 sm:col-span-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-4">
                                    <span className="text-5xl">👤</span>
                                    <div>
                                        <p className="font-bold text-gray-900">Unable to load profile</p>
                                        <p className="text-sm mt-1">Please try again or contact system administrator.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsProfileModalOpen(false)}
                                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm"
                                    >
                                        Close Window
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for detail items
function DetailItem({ label, value, icon, className = "col-span-1", textColor = "text-gray-800" }: { label: string, value?: string, icon: string, className?: string, textColor?: string }) {
    return (
        <div className={`${className} flex flex-col gap-1.5 min-w-0`}>
            <div className="flex items-center gap-2">
                <span className="text-sm grayscale opacity-70 leading-none">{icon}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
            </div>
            <p
                className={`text-[15px] font-bold ${textColor} leading-tight break-words`}
                title={value || "-"}
            >
                {value || "-"}
            </p>
        </div>
    );
}
