"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // ⚡ Added for Realtime updates

// ============================================================
// GATEPASS GATE DESKTOP — Split Screen: QR Code + Outing History
// ============================================================
// This page is designed to run on a desktop/screen at the campus gate.
// Left side: Rotating QR code (changes every 10 seconds)
// Right side: Live outing history and student counts
// ============================================================

import QRCode from "qrcode";

function QRCodeCanvas({ data, size = 550 }: { data: string; size?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !data) return;
        const canvas = canvasRef.current;

        // ⚡ LOCAL GENERATION: Use 'qrcode' library to generate QR on the fly.
        // This makes your bandwidth egress 0 bytes for QR rotation.
        QRCode.toCanvas(canvas, data, {
            width: size,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#ffffff"
            },
            errorCorrectionLevel: 'H'
        }, (error) => {
            if (error) console.error("QR Generation Error:", error);
            else {
                // After generation, we apply the custom styling/rounding to the canvas element
                canvas.style.borderRadius = "24px";
            }
        });

    }, [data, size]);

    return (
        <canvas
            ref={canvasRef}
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block' }}
            className="rounded-2xl border-[3px] border-[#00ff884d] shadow-[0_0_20px_rgba(0,255,136,0.1)]"
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
    type?: "outing" | "leave" | string;
}

interface LiveData {
    summary: {
        totalStudents: number;
        studentsIn: number;
        studentsOut: number;
        leaveCount?: number;
        gatePassCount?: number;
    };
    currentlyOut: OutingRecord[];
    recentActivity: OutingRecord[];
}

// ===================== Main Component =====================
export default function GatepassView({ onClose }: { onClose?: () => void }) {
    const router = useRouter();
    const [qrData, setQrData] = useState<string>("");
    const [qrToken, setQrToken] = useState<string>("");
    const [qrExpiry, setQrExpiry] = useState<Date | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(10); // Standard security interval
    const [liveData, setLiveData] = useState<LiveData | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [lastOuting, setLastOuting] = useState<OutingRecord | null>(null);
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
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [manualSearchId, setManualSearchId] = useState("");
    const [isProcessingManual, setIsProcessingManual] = useState(false);
    const [manualError, setManualError] = useState("");
    const [manualSuccess, setManualSuccess] = useState("");
    const [foundStudent, setFoundStudent] = useState<any>(null);
    const [showProfileCard, setShowProfileCard] = useState(false);
    const manualInputRef = useRef<HTMLInputElement>(null);

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
                setTimeLeft(15);
                setError("");
            } else {
                setError("Failed to generate QR code");
            }
        } catch (err) {
            setError("Network error - retrying...");
        }
    }, [gateName]);

    // ===================== Fetch live data =====================
    const fetchStudentProfile = async (idOrObject: any) => {
        const studentId = typeof idOrObject === 'object' ? idOrObject._id || idOrObject.id : idOrObject;
        if (!studentId || studentId === "[object Object]") return;

        setIsLoadingProfile(true);
        setIsProfileModalOpen(true);
        try {
            const response = await fetch(`/api/students/${studentId}`);
            const data = await response.json();

            if (data.student) {
                setSelectedStudent(data.student);

                // ⚡ Fetch last history record
                try {
                    const historyRes = await fetch(`/api/getpass/history?studentId=${studentId}&limit=1`);
                    const historyData = await historyRes.json();
                    if (historyData.success && historyData.records && historyData.records.length > 0) {
                        setLastOuting(historyData.records[0]);
                    } else {
                        setLastOuting(null);
                    }
                } catch (hErr) {
                    console.error("Error fetching student history:", hErr);
                    setLastOuting(null);
                }
            } else {
                console.error("Student not found");
                setSelectedStudent(null);
                setLastOuting(null);
            }
        } catch (err) {
            console.error("Error fetching student profile:", err);
            setSelectedStudent(null);
            setLastOuting(null);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleStudentClick = (studentId: string) => {
        if (!studentId) return;
        setSelectedStudentId(studentId);
        fetchStudentProfile(studentId);
    };

    const fetchLiveData = useCallback(async (isMinimal = false) => {
        try {
            const res = await fetch(`/api/getpass/live?minimal=${isMinimal}`);
            const data = await res.json();

            if (data.success) {
                // ⚡ SMART MERGE: If it's a minimal update, keep the old summary/currentlyOut
                // to prevent the UI from "emptying" while background updates happen.
                setLiveData(prev => {
                    if (data.minimal && prev) {
                        return {
                            ...prev,
                            summary: data.summary || prev.summary, // ⚡ Merge updated counts
                            recentActivity: data.recentActivity || prev.recentActivity
                        };
                    }
                    return data;
                });
                setLoading(false);
            }
        } catch (err) {
            console.error("Failed to fetch live data:", err);
        }
    }, []);

    // ⚡ CLEANUP: fetchActivityHeartbeat removed. Realtime is now used.

    // ===================== Timer: Rotate QR every 30 seconds (Optimized for Bandwidth) =====================
    useEffect(() => {
        fetchNewQR();
        const qrInterval = setInterval(() => {
            // ⚡ OPTIMIZATION: Stop QR rotation if tab is not visible
            if (document.visibilityState === 'visible') {
                fetchNewQR();
            }
        }, 15000); // 15 seconds (Matches display time to server logic)
        return () => clearInterval(qrInterval);
    }, [fetchNewQR]);

    // ===================== Timer: Refresh live data every 5 minutes =====================
    useEffect(() => {
        // ⚡ Initial load is ALWAYS FULL for instant visibility
        fetchLiveData(false);
        const liveInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                // Background updates are MINIMAL and infrequent (5m) to save 90% bandwidth
                // Realtime handles the instant updates for scans.
                fetchLiveData(true);
            }
        }, 300000); // 5 Minutes (Massive Bandwidth Saving)
        return () => clearInterval(liveInterval);
    }, [fetchLiveData]);

    // ===================== Supabase Realtime Subscription =====================
    // ⚡ Provides INSTANT scan feedback with ZERO idle bandwidth
    useEffect(() => {
        if (!mounted) return;

        // Listen for BOTH Check-outs (INSERT) and Check-ins (UPDATE)
        const channel = supabase
            .channel('gatepass-updates')
            .on(
                'postgres_changes',
                {
                    event: '*', // ⚡ Listen for all changes (Insert/Update)
                    schema: 'public',
                    table: 'gate_passes'
                },
                (payload: any) => {
                    console.log('⚡ Scan Detected via Realtime:', payload.eventType, payload.new);

                    // ⚡ INSTANT FEEDBACK: Update local state immediately from the Realtime payload
                    setLiveData((prev: any) => {
                        if (!prev) return prev;
                        const newSummary = { ...prev.summary };
                        const newCurrentlyOut = [...(prev.currentlyOut || [])];
                        const newRecent = [...(prev.recentActivity || [])];

                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const raw = payload.new;
                            const mapped: any = {
                                _id: raw._id || raw.id,
                                studentName: raw.student_name || raw.studentName,
                                hostelName: raw.hostel_name || raw.hostelName,
                                roomNumber: raw.room_number || raw.roomNumber,
                                registrationId: raw.registration_id || raw.registrationId,
                                status: raw.status,
                                type: raw.type,
                                checkOutTime: raw.check_out_time || raw.checkOutTime,
                                checkInTime: raw.check_in_time || raw.checkInTime,
                                checkOutISTTime: raw.check_out_ist_time || raw.checkOutISTTime,
                                checkOutISTDate: raw.check_out_ist_date || raw.checkOutISTDate,
                                phoneNumber: raw.phone_number || raw.phoneNumber
                            };

                            if (payload.eventType === 'INSERT') {
                                // STUDENT SCANNING OUT
                                // Add to currentlyOut if not already there
                                if (!newCurrentlyOut.some(r => r._id === mapped._id)) {
                                    newCurrentlyOut.unshift({
                                        ...mapped,
                                        currentDurationText: 'Just now',
                                        currentDurationMinutes: 0
                                    });
                                    newSummary.studentsOut++;
                                    newSummary.studentsIn--;
                                    if (mapped.type === 'leave') newSummary.leaveCount++;
                                    else newSummary.gatePassCount++;
                                }
                                newRecent.unshift(mapped);
                            } else if (payload.eventType === 'UPDATE' && (mapped.status === 'in' || mapped.status === 'auto-resolved')) {
                                // STUDENT SCANNING IN (Check-in)
                                // Remove from currentlyOut
                                const index = newCurrentlyOut.findIndex(r => r._id === mapped._id);
                                if (index !== -1) {
                                    newCurrentlyOut.splice(index, 1);
                                    newSummary.studentsOut--;
                                    newSummary.studentsIn++;
                                    if (mapped.type === 'leave') newSummary.leaveCount--;
                                    else newSummary.gatePassCount--;

                                    // Add to Recent Activity
                                    newRecent.unshift(mapped);
                                }
                            }
                            if (newRecent.length > 20) newRecent.pop();
                        }

                        return {
                            ...prev,
                            summary: newSummary,
                            currentlyOut: newCurrentlyOut,
                            recentActivity: newRecent
                        };
                    });

                    // 🔄 Background Refresh: Still do a fresh fetch to ensure server sync
                    if (payload.eventType === 'INSERT') {
                        fetchLiveData(false);
                    } else {
                        fetchLiveData(true);
                        setTimeout(() => fetchLiveData(false), 2000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mounted, fetchLiveData]);

    // ===================== Audio Synth & Speech Synthesis Helpers =====================
    const playSuccessChime = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + index * 0.08);
                gain.gain.setValueAtTime(0.12, now + index * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + index * 0.08);
                osc.stop(now + index * 0.08 + 0.3);
            });
        } catch (e) {
            console.error("Audio chime error:", e);
        }
    };

    const playWarningBuzz = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.linearRampToValueAtTime(70, now + 0.35);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.38);
        } catch (e) {
            console.error("Audio buzzer error:", e);
        }
    };

    const speakStatus = (text: string) => {
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.25;
                utterance.volume = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) {
            console.error("Speech synthesis error:", e);
        }
    };

    // ===================== Trigger audio feedback on new scan results =====================
    useEffect(() => {
        if (lastScanResult) {
            playSuccessChime();
            const actionText = lastScanResult.action === 'checkout' ? 'Check out' : 'Check in';
            speakStatus(actionText);
        }
    }, [lastScanResult]);

    // Cleanup: Heartbeat fetcher and timer removed as they are no longer needed
    // fetchActivityHeartbeat was here - removed to save 200MB/day bandwidth.

    // ===================== Countdown timer =====================
    useEffect(() => {
        const countdownInterval = setInterval(() => {
            // Only countdown if page is active
            if (document.visibilityState === 'visible') {
                setTimeLeft((prev) => (prev > 0 ? prev - 1 : 15));
            }
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
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // ===================== Manual Status Toggle =====================
    // STEP 1: Search for student
    const handleManualSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!manualSearchId.trim()) return;

        const s = manualSearchId.trim();
        const isEmail = s.includes('@');
        const isNumeric = /^[0-9]+$/.test(s);
        const hasPhoneLength = /^\+?[0-9]{10,13}$/.test(s);
        const hasSpecialChars = /[^a-zA-Z0-9\s\-\/\.\']/.test(s);

        if (isEmail || isNumeric || hasPhoneLength || hasSpecialChars) {
            setManualError("Enter only Name, Registration or ERP ID");
            return;
        }

        setIsProcessingManual(true);
        setManualError("");
        setManualSuccess("");
        setFoundStudent(null);
        setShowProfileCard(false);

        try {
            const res = await fetch("/api/getpass/manual-toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    searchId: manualSearchId.trim(),
                    action: "find",
                    userType: "gatekeeper"
                })
            });

            const data = await res.json();

            if (data.success && data.student) {
                setFoundStudent(data.student);
                setShowProfileCard(true);
            } else {
                setManualError(data.error || "No information exists in the database for the entered details.");
                playWarningBuzz();
                speakStatus("Search failed.");
            }
        } catch (err) {
            setManualError("Network error. Try again.");
            playWarningBuzz();
            speakStatus("Network error.");
        } finally {
            setIsProcessingManual(false);
        }
    };

    // STEP 2: Final Toggle Action
    const handleFinalToggle = async () => {
        if (!foundStudent) return;

        setIsProcessingManual(true);
        setManualError("");

        try {
            const res = await fetch("/api/getpass/manual-toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: foundStudent._id,
                    userType: "gatekeeper"
                })
            });

            const data = await res.json();

            if (data.success) {
                setManualSuccess(data.message);
                playSuccessChime();
                const directionText = foundStudent.studentStatus === 'out' ? 'Check in' : 'Check out';
                speakStatus(directionText);
                // Refresh data
                fetchLiveData();

                // Reset after success
                setTimeout(() => {
                    setManualSuccess("");
                    setFoundStudent(null);
                    setShowProfileCard(false);
                    setManualSearchId("");
                    setIsManualModalOpen(false);
                }, 2500);
            } else {
                setManualError(data.error || "Failed to toggle status");
                playWarningBuzz();
                speakStatus("Access Denied.");
            }
        } catch (err) {
            setManualError("Network error. Try again.");
        } finally {
            setIsProcessingManual(false);
        }
    };

    const resetManualSearch = () => {
        setFoundStudent(null);
        setShowProfileCard(false);
        setManualSearchId("");
        setManualError("");
        setManualSuccess("");
        setTimeout(() => manualInputRef.current?.focus(), 100);
    };

    useEffect(() => {
        if (isManualModalOpen && manualInputRef.current) {
            manualInputRef.current.focus();
        }
    }, [isManualModalOpen]);

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
        if (minutes >= 1440) {
            const days = Math.floor(minutes / 1440);
            const hrs = Math.floor((minutes % 1440) / 60);
            const mins = minutes % 60;
            return `${days}d ${hrs}h ${mins}m`;
        }
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    const formatHostelDisplay = (name: string) => {
        if (!name) return name;
        const n = name.toUpperCase();
        if (n.includes("GUEST") || n.includes("GHB")) return "GHB Hostel";
        return name;
    };

    return (
        <div className="flex flex-col md:flex-row w-screen min-h-screen md:h-screen bg-[#0a0a1a] font-sans text-white overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500/20 scrollbar-track-transparent">
            {/* =================== LEFT PANEL: QR CODE =================== */}
            <div className="w-full md:w-[42%] flex flex-col items-center justify-center gap-6 p-6 md:p-6 bg-gradient-to-b from-[#0a0a1a] via-[#0d1420] to-[#0a0a1a] border-b md:border-b-0 md:border-r border-[#00ff881a] relative shrink-0 transition-all duration-300 overflow-hidden">

                {/* ── TOP ROW: Logo left + Instructions right ── */}
                <div className="flex items-start justify-between w-full mb-2">
                    {/* Logo block */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="md:hidden p-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 active:scale-90 transition-all"
                                    title="Back to Dashboard"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-br from-[#00ff88] to-[#00cc6a] bg-clip-text text-transparent tracking-widest m-0 leading-tight">
                                GATEPASS
                            </h1>
                        </div>
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
                    <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-[rgba(0,255,136,0.07)] rounded-xl border border-[rgba(0,255,136,0.3)] shadow-[0_0_12px_rgba(0,255,136,0.08)] flex-shrink-0">
                        <div className="flex items-center gap-1.5 text-[11px] md:text-xs font-semibold text-white">
                            <span className="text-sm">📱</span>
                            <span>Open App</span>
                        </div>
                        <div className="text-[#00ff88] font-black text-xs">→</div>
                        <div className="flex items-center gap-1.5 text-[11px] md:text-xs font-semibold text-white">
                            <span className="text-sm">📸</span>
                            <span>Scan QR</span>
                        </div>
                        <div className="text-[#00ff88] font-black text-xs">→</div>
                        <div className="flex items-center gap-1.5 text-[11px] md:text-xs font-semibold text-white">
                            <span className="text-base">✅</span>
                            <span>Done</span>
                        </div>
                    </div>
                </div>

                {/* ── Timer | Time | Date — single centered row ── */}
                <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex items-center justify-center gap-3 md:gap-4 w-full px-2">
                        {/* Timer */}
                        <div className="scale-75 md:scale-100 origin-center shrink-0">
                            <RectangleTimer timeLeft={timeLeft} maxTime={15} />
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
                <div className="flex-1 flex flex-col items-center justify-center w-full py-2 md:py-4 min-h-0">
                    <div
                        className={`p-3 bg-white rounded-[24px] md:rounded-[28px] border-[6px] md:border-[8px] border-[#00ff88] shadow-[0_0_60px_rgba(0,255,136,0.15)] md:shadow-[0_0_100px_rgba(0,255,136,0.25)] flex items-center justify-center overflow-hidden transition-all duration-500 ${
                            isFullscreen
                                ? 'w-[min(75vw,65vh,580px)] md:w-[min(42vw,70vh,580px)]'
                                : 'w-[min(82vw,55vh,380px)] md:w-[min(32vw,58vh,430px)]'
                        }`}
                        style={{ aspectRatio: '1/1' }}
                    >
                        {qrData ? (
                            <QRCodeCanvas data={qrData} size={isFullscreen ? 580 : 450} />
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
            <div className="w-full md:w-[58%] flex flex-col p-6 md:p-8 bg-gradient-to-b from-[#0d1117] to-[#0a0e14] min-h-[500px] md:h-full md:overflow-hidden overflow-visible">
                {/* Summary Cards */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
                    <h2 className="text-lg md:text-xl font-bold text-white m-0 flex items-center gap-2">
                        <span className="p-2 bg-[rgba(59,130,246,0.1)] rounded-lg text-blue-400">📊</span>
                        Live Campus Status
                    </h2>
                    <div className="flex gap-2 self-end sm:self-auto">
                        <button
                            onClick={() => {
                                resetManualSearch();
                                setIsManualModalOpen(true);
                            }}
                            className="bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] text-[#60a5fa] px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold transition-all hover:bg-[rgba(59,130,246,0.2)] active:scale-95"
                            title="Manual ID Entry"
                        >
                            <span className="text-[10px] uppercase tracking-wider">Manual Entry</span>
                            <span className="text-sm">⌨️</span>
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="hidden md:flex bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)] text-[#60a5fa] px-4 py-1.5 rounded-xl items-center gap-2 font-black transition-all hover:bg-[rgba(59,130,246,0.2)] active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.15)] group"
                            >
                                <span className="text-sm transition-transform group-hover:-translate-x-1">🔙</span>
                                <span className="text-[10px] uppercase tracking-wider">Back Dashboard</span>
                            </button>
                        )}
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
                    <div className="mb-2">
                        {!isManualModalOpen ? (
                            <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2 md:gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="py-1.5 px-3 bg-[rgba(255,255,255,0.04)] rounded-2xl border border-[rgba(255,255,255,0.08)] text-center flex flex-col justify-center lg:flex-1">
                                    <div className="text-xl mb-0.5">👥</div>
                                    <div className="text-2xl font-extrabold text-white tabular-nums leading-tight">{liveData.summary.totalStudents}</div>
                                    <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest">Total</div>
                                </div>
                                <div className="py-1.5 px-3 bg-[rgba(0,255,136,0.05)] rounded-2xl border border-[rgba(0,255,136,0.2)] text-center flex flex-col justify-center lg:flex-1">
                                    <div className="text-xl mb-0.5">🏠</div>
                                    <div className="text-2xl font-extrabold text-[#00ff88] tabular-nums leading-tight">{liveData.summary.studentsIn}</div>
                                    <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest">In Campus</div>
                                </div>
                                <div className="py-1.5 px-3 bg-[rgba(255,107,107,0.05)] rounded-2xl border border-[rgba(255,107,107,0.2)] text-center flex flex-col justify-between lg:flex-1 relative overflow-hidden">
                                    {/* Top Label: Outside Total */}
                                    <div className="mb-1">
                                        <div className="text-3xl font-extrabold text-[#ff6b6b] tabular-nums leading-none mb-0.5">
                                            {liveData.summary.studentsOut}
                                        </div>
                                        <div className="text-[11px] text-[rgba(255,255,255,0.6)] uppercase tracking-[0.2em] font-black">
                                            OUTSIDE
                                        </div>
                                    </div>

                                    {/* Bottom Split Section */}
                                    <div className="flex border-t border-[rgba(255,107,107,0.2)] h-9 pt-1.5 mt-1">
                                        <div className="flex-1 border-r border-[rgba(255,107,107,0.15)] flex flex-col items-center justify-center">
                                            <span className="text-[14px] font-black text-white leading-none">
                                                {liveData.summary.leaveCount || 0}
                                            </span>
                                            <span className="text-[8px] text-[rgba(255,255,255,0.45)] font-black uppercase tracking-widest mt-0.5">
                                                LEAVE
                                            </span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center">
                                            <span className="text-[14px] font-black text-white leading-none">
                                                {liveData.summary.gatePassCount || 0}
                                            </span>
                                            <span className="text-[8px] text-[rgba(255,255,255,0.45)] font-black uppercase tracking-widest mt-0.5">
                                                PASS
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    onClick={() => router.push('/getpass/history')}
                                    className="py-1.5 px-3 bg-[rgba(59,130,246,0.05)] rounded-2xl border border-[rgba(59,130,246,0.2)] text-center cursor-pointer hover:bg-[rgba(59,130,246,0.1)] transition-all group active:scale-95 flex flex-col justify-center lg:flex-1"
                                >
                                    <div className="text-xl mb-0.5 group-hover:scale-110 transition-transform">📜</div>
                                    <div className="text-2xl font-extrabold text-[#3b82f6] tabular-nums group-hover:text-[#60a5fa] transition-colors flex items-center justify-center gap-1 leading-tight">
                                        GO
                                        <span className="text-sm font-black">→</span>
                                    </div>
                                    <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-widest group-hover:text-[rgba(255,255,255,0.8)] transition-colors">History</div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[rgba(59,130,246,0.05)] border border-[rgba(59,130,246,0.3)] rounded-[24px] p-4 md:p-6 animate-in zoom-in-95 duration-300 relative shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🔑</span>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-white uppercase tracking-wider">
                                                {showProfileCard ? "Verify Profile" : "Manual Entry"}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-medium tracking-tight whitespace-nowrap">
                                                {showProfileCard ? "Verify student details below" : "Enter Name, Registration or ERP ID"}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            resetManualSearch();
                                            setIsManualModalOpen(false);
                                        }}
                                        className="text-gray-500 hover:text-white transition-colors text-xl p-1"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {!showProfileCard ? (
                                    <form onSubmit={handleManualSearch} className="relative animate-in slide-in-from-bottom-2 duration-300">
                                        <input
                                            ref={manualInputRef}
                                            type="text"
                                            placeholder="Enter Name, Registration or ERP ID..."
                                            value={manualSearchId}
                                            onChange={e => {
                                                setManualSearchId(e.target.value);
                                                setManualError("");
                                            }}
                                            className="w-full bg-[#0a0f18] border border-white/10 rounded-2xl px-6 py-4 text-xl font-bold text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500 transition-all text-center tracking-wide"
                                            disabled={isProcessingManual}
                                            autoComplete="off"
                                        />

                                        {manualError && (
                                            <div className="mt-3 text-red-400 text-xs font-bold text-center animate-shake">
                                                ⚠️ {manualError}
                                            </div>
                                        )}

                                        {manualSuccess && (
                                            <div className="mt-3 text-green-400 text-xs font-bold text-center">
                                                ✅ {manualSuccess}
                                            </div>
                                        )}

                                        <div className="mt-4 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    resetManualSearch();
                                                    setIsManualModalOpen(false);
                                                }}
                                                className="flex-1 px-4 py-3 bg-white/5 text-white text-sm font-bold rounded-xl hover:bg-white/10 transition-all active:scale-95"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isProcessingManual || !manualSearchId.trim()}
                                                className="flex-[2] px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isProcessingManual ? "Searching..." : "FIND STUDENT"}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="animate-in zoom-in-95 duration-200">
                                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 mb-4 shadow-inner">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 border border-white/20">
                                                {foundStudent.profilePicture ? (
                                                    <img src={foundStudent.profilePicture} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-2xl bg-blue-500/10 text-blue-400 font-bold">
                                                        {foundStudent.name?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-lg font-black text-white m-0 truncate">{foundStudent.name}</h4>
                                                <p className="text-xs text-blue-400 font-bold m-0 mt-0.5 tracking-wider">{foundStudent.registrationId}</p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${foundStudent.studentStatus === 'out' ? 'bg-[#ff6b6b]' : 'bg-[#00ff88]'}`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${foundStudent.studentStatus === 'out' ? 'text-[#ff6b6b]' : 'text-[#00ff88]'}`}>
                                                        {foundStudent.studentStatus === 'out' ? 'Currently Outside' : 'Inside Campus'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {manualError && (
                                            <div className="mb-3 text-red-400 text-xs font-bold text-center">
                                                ⚠️ {manualError}
                                            </div>
                                        )}

                                        {manualSuccess && (
                                            <div className="mb-3 text-green-400 text-xs font-bold text-center">
                                                ✅ {manualSuccess}
                                            </div>
                                        )}

                                        {!manualSuccess && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={resetManualSearch}
                                                    className="flex-1 px-4 py-3 bg-white/5 text-white text-sm font-bold rounded-xl hover:bg-white/10 transition-all active:scale-95"
                                                    disabled={isProcessingManual}
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    onClick={handleFinalToggle}
                                                    disabled={isProcessingManual}
                                                    className={`flex-[2] px-4 py-3 ${foundStudent.studentStatus === 'out' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white text-sm font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
                                                >
                                                    {isProcessingManual ? (
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <>
                                                            <span>{foundStudent.studentStatus === 'out' ? 'MARK CHECK-IN' : 'MARK CHECK-OUT'}</span>
                                                            <span className="text-lg">{foundStudent.studentStatus === 'out' ? '🏠' : '🚶'}</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}


                {/* Side-by-Side Lists Container */}
                <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
                    {/* LEFT COLUMN: Currently Outside */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="mb-2">
                            <h3 className="text-sm font-semibold text-[rgba(255,255,255,0.9)] m-0 flex items-center gap-2">
                                🔴 Outside ({liveData?.summary?.studentsOut || 0})
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto border border-[rgba(255,255,255,0.05)] rounded-xl p-2 bg-[#0a0a1a]/30 custom-scrollbar">
                            {liveData?.currentlyOut && liveData.currentlyOut.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                    {liveData.currentlyOut.map((record) => (
                                        <div key={record._id} className="flex justify-between items-center py-1.5 px-2.5 bg-[#161b2e] rounded-xl border border-[#ff6b6b15] transition-all hover:border-[#ff6b6b30] group">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div
                                                    onClick={() => handleStudentClick(record.studentId)}
                                                    className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff6b6b] to-[#ee5253] flex items-center justify-center font-black text-[10px] text-white cursor-pointer shadow-[0_4px_12px_rgba(238,82,83,0.3)] transition-transform hover:scale-105 shrink-0"
                                                >
                                                    {record.studentName?.charAt(0)?.toUpperCase() || "?"}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <h4
                                                            onClick={() => handleStudentClick(record.studentId)}
                                                            className="text-[12px] font-bold text-white m-0 cursor-pointer hover:text-[#ff6b6b] transition-colors leading-tight truncate tracking-wide"
                                                        >
                                                            {record.studentName}
                                                        </h4>
                                                        <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all flex items-center gap-1 shrink-0 ${record.type === "leave"
                                                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                                            }`}>
                                                            <span className="text-[9px]">{record.type === "leave" ? "🏠" : "🎫"}</span>
                                                            <span>{record.type === "leave" ? "LEAVE" : "PASS"}</span>
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-[rgba(255,255,255,0.3)] tracking-tight uppercase m-0 mt-0.5 font-bold truncate">
                                                        {formatHostelDisplay(record.hostelName)} • {record.roomNumber}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="text-[12px] font-black text-[#ff6b6b] tabular-nums tracking-tighter">
                                                    {record.currentDurationText || formatDuration(record.currentDurationMinutes || 0)}
                                                </span>
                                                <span className="text-[8px] text-[rgba(255,255,255,0.25)] font-bold uppercase tracking-widest">
                                                    {record.checkOutISTTime}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
                                    <span className="text-3xl">✅</span>
                                    <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-bold uppercase tracking-widest text-center px-4">All students are in campus</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Recent Returns */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="mb-2">
                            <h3 className="text-sm font-semibold text-[rgba(255,255,255,0.9)] m-0 flex items-center gap-2">
                                🟢 Returns Today
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto border border-[rgba(255,255,255,0.05)] rounded-xl p-2 bg-[#0a0a1a]/30 custom-scrollbar">
                            {liveData?.recentActivity && liveData.recentActivity.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                    {liveData.recentActivity.map((record) => (
                                        <div key={record._id} className="flex justify-between items-center py-1.5 px-2.5 bg-[#161b2e] rounded-xl border border-[#00ff8815] transition-all hover:border-[#00ff8830] group">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div
                                                    onClick={() => handleStudentClick(record.studentId)}
                                                    className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00ff88] to-[#00cc6a] flex items-center justify-center font-black text-[10px] text-white cursor-pointer shadow-[0_4px_12px_rgba(0,255,136,0.3)] transition-transform hover:scale-105 shrink-0"
                                                >
                                                    {record.studentName?.charAt(0)?.toUpperCase() || "?"}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4
                                                        onClick={() => handleStudentClick(record.studentId)}
                                                        className="text-[12px] font-bold text-white m-0 cursor-pointer hover:text-[#00ff88] transition-colors leading-tight truncate tracking-wide"
                                                    >
                                                        {record.studentName}
                                                    </h4>
                                                    <p className="text-[9px] text-[rgba(255,255,255,0.3)] tracking-tight uppercase m-0 mt-0.5 font-bold truncate">
                                                        {formatHostelDisplay(record.hostelName)} • {record.roomNumber}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="text-[12px] font-black text-[#00ff88] tabular-nums tracking-tighter">
                                                    {record.durationMinutes !== undefined ? formatDuration(record.durationMinutes) : '-'}
                                                </span>
                                                <span className="text-[8px] text-[rgba(255,255,255,0.25)] font-bold uppercase tracking-widest">
                                                    {record.checkInISTTime}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
                                    <span className="text-3xl">📭</span>
                                    <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-bold uppercase tracking-widest">No returns yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Student Profile Modal */}
            {isProfileModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in transition-all cursor-pointer"
                    onClick={() => setIsProfileModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-5xl max-h-[95vh] overflow-y-auto shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col relative animate-in zoom-in-95 cursor-default text-gray-900 custom-scrollbar"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isLoadingProfile ? (
                            <div className="h-[400px] flex flex-col items-center justify-center gap-4 p-8">
                                <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin" />
                                <p className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Searching Profile...</p>
                            </div>
                        ) : selectedStudent ? (
                            <div className="flex flex-col">
                                {/* Header Banner */}
                                <div className="h-14 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 shrink-0 relative">
                                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />

                                    {/* Sticky Close Button inside scrollable area */}
                                    <button
                                        onClick={() => setIsProfileModalOpen(false)}
                                        className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all z-[110] border border-white/10"
                                    >
                                        <span className="text-xl">✕</span>
                                    </button>
                                </div>

                                {/* Profile Section */}
                                <div className="px-5 sm:px-10 pb-8 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-10 relative">
                                    {/* Profile Picture Box */}
                                    <div className="w-32 h-32 sm:w-48 sm:h-48 rounded-[2rem] bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.2)] -mt-8 shrink-0 z-10 border border-white/50">
                                        <div className="w-full h-full rounded-[1.6rem] bg-gray-50 flex items-center justify-center text-4xl sm:text-7xl font-black text-blue-600 overflow-hidden shadow-inner ring-1 ring-black/5">
                                            {selectedStudent.profilePicture ? (
                                                <img src={selectedStudent.profilePicture} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                                                    {selectedStudent.name?.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 text-center sm:text-left pt-2 sm:pt-0">
                                        <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-4 mb-3 sm:mb-4">
                                            <h2 className="text-2xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight uppercase">{selectedStudent.name}</h2>
                                            <span className={`px-4 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm ${selectedStudent.studentStatus === 'out' ? 'bg-red-500 text-white shadow-red-200' : 'bg-green-500 text-white shadow-green-200'}`}>
                                                {selectedStudent.studentStatus === 'out' ? 'Outside' : 'Inside Campus'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10">
                                            <div className="flex flex-col items-center sm:items-start group">
                                                <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1 group-hover:text-blue-500 transition-colors">Registration ID</p>
                                                <p className="text-blue-600 font-extrabold text-lg sm:text-2xl tracking-tight">{selectedStudent.registrationId || "N/A"}</p>
                                            </div>
                                            <div className="hidden sm:block w-px h-10 sm:h-12 bg-gray-100/80" />
                                            <div className="flex flex-col items-center sm:items-start group">
                                                <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1 group-hover:text-blue-500 transition-colors">Hostel & Room</p>
                                                <p className="text-gray-900 font-extrabold text-lg sm:text-2xl tracking-tight">{formatHostelDisplay(selectedStudent.hostelName)} • {selectedStudent.roomNumber}</p>
                                            </div>

                                            {/* ⚡ Recent History Section */}
                                            {lastOuting && (
                                                <>
                                                    <div className="hidden sm:block w-px h-10 sm:h-12 bg-gray-100/80" />
                                                    <div className="flex flex-col items-center sm:items-start p-2 sm:p-3 bg-red-50/50 rounded-2xl border border-red-100/50 group hover:bg-red-50 transition-colors min-w-[140px]">
                                                        <p className="text-[8px] sm:text-[9px] font-black text-red-500 uppercase tracking-widest mb-1 group-hover:text-red-600 transition-colors">Recent History</p>
                                                        <div className="flex flex-col items-center sm:items-start gap-1">
                                                            <p className="text-gray-900 font-extrabold text-[11px] sm:text-sm tracking-tight leading-none">
                                                                Date: <span className="text-red-600">{lastOuting.checkInISTDate || lastOuting.checkOutISTDate || "N/A"}</span>
                                                            </p>
                                                            <p className="text-gray-900 font-extrabold text-[11px] sm:text-sm tracking-tight leading-none">
                                                                Time: <span className="text-red-600">{lastOuting.checkInISTTime || lastOuting.checkOutISTTime || "N/A"}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="px-4 sm:px-10 pb-8 grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-12 gap-y-4 sm:gap-y-8 bg-gray-50/50 pt-6 sm:pt-8 border-t border-gray-100">
                                    {[
                                        { label: "College Name", value: selectedStudent.collegeName || "N/A", icon: "🎓" },
                                        { label: "ERP ID", value: selectedStudent.erpInformation || "N/A", icon: "🆔", valueClass: "text-blue-600" },
                                        { label: "Branch", value: selectedStudent.branch || "N/A", icon: "📚" },
                                        { label: "Year & Sem", value: `${selectedStudent.year || "N/A"} • ${selectedStudent.semester || "N/A"}`, icon: "📅" },
                                        { label: "Mobile", value: selectedStudent.phoneNumber || "N/A", icon: "📞" },
                                        { label: "Email", value: selectedStudent.email || "N/A", icon: <span className="text-[#FBBC05]">📧</span> },
                                        { label: "Father Name", value: selectedStudent.fatherName || "N/A", icon: "👨‍👦" },
                                        { label: "Father Mobile", value: selectedStudent.fatherNumber || "N/A", icon: "📱" },
                                        { label: "Mother Name", value: selectedStudent.motherName || "N/A", icon: "👩‍👦" },
                                        { label: "Mother Mobile", value: selectedStudent.motherNumber || "N/A", icon: "📱" },
                                        { label: "Permanent Address", value: `${selectedStudent.permanentAddress || "N/A"}${selectedStudent.homeState ? `, ${selectedStudent.homeState}` : ""}`, icon: "🏠", fullWidth: true },
                                    ].map((item: any, idx) => (
                                        <div key={idx} className={`flex gap-3 sm:gap-4 items-start bg-white/60 p-2.5 sm:p-0 rounded-xl sm:bg-transparent border border-white sm:border-0 shadow-sm sm:shadow-none ${item.fullWidth ? 'col-span-2 lg:col-span-3' : ''}`}>
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white shadow-sm flex items-center justify-center text-base sm:text-lg shrink-0 border border-gray-50">{item.icon}</div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[7px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">{item.label}</p>
                                                <p className={`text-[10px] sm:text-sm font-black m-0 break-words ${item.fullWidth ? '' : 'line-clamp-2'} ${item.valueClass || 'text-gray-900'}`}>
                                                    {item.value !== "N/A" && (item.label.toLowerCase().includes("mobile") || item.label.toLowerCase().includes("phone")) ? (
                                                        <a href={`tel:${item.value}`} className="hover:text-blue-600 transition-colors flex items-center gap-1.5 group/link">
                                                            {item.value}
                                                            <span className="text-[10px] sm:text-[12px] text-[#FBBC05] group-hover/link:text-yellow-600 transition-colors">📞</span>
                                                        </a>
                                                    ) : item.value !== "N/A" && item.label.toLowerCase().includes("email") ? (
                                                        <a href={`mailto:${item.value}`} className="hover:text-blue-600 transition-colors flex items-center gap-1.5 group/link">
                                                            {item.value}
                                                            <span className="text-[10px] sm:text-[12px] text-[#FBBC05] group-hover/link:text-yellow-600 transition-colors">✉️</span>
                                                        </a>
                                                    ) : (
                                                        item.value
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-[300px] flex flex-col items-center justify-center p-8 text-center">
                                <span className="text-4xl mb-4">🔍</span>
                                <h3 className="text-lg font-bold text-gray-800">Profile Not Found</h3>
                                <p className="text-gray-500 text-sm mt-1">Could not retrieve detailed information for this student ID.</p>
                                <button
                                    onClick={() => setIsProfileModalOpen(false)}
                                    className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs"
                                >
                                    Close Window
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}



            <style jsx global>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                    opacity: 0.5;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
