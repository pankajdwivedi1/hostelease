"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { getInstallationId, isPWAInstalled } from "@/lib/installationId";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { formatDateDDMMYYYY, parseFlexibleDate } from "@/lib/dateFormat";

// ============================================================
// GATEPASS STUDENT SCANNER — QR Code Scanner for Students
// ============================================================
// Students open this page on their phone to scan the gate QR
// Uses the device camera to read QR codes
// ============================================================

interface ScanResult {
    success: boolean;
    action?: "checkout" | "checkin";
    message?: string;
    studentName?: string;
    hostelName?: string;
    roomNumber?: string;
    newStatus?: string;
    durationText?: string;
    durationMinutes?: number;
    error?: string;
    requiresFaceRecapture?: boolean;
}

interface OutingRecord {
    _id: string;
    checkOutTime: string;
    checkOutISTTime: string;
    checkOutISTDate: string;
    checkInTime?: string;
    checkInISTTime?: string;
    checkInISTDate?: string;
    status: "out" | "in" | "auto-resolved" | string;
    durationMinutes?: number;
    gateName?: string;
    type?: "outing" | "leave" | string;
}

export default function StudentScannerPage() {
    const router = useRouter();
    const [scanning, setScanning] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [processing, setProcessing] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<"in" | "out">("in");
    const [outingHistory, setOutingHistory] = useState<OutingRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [error, setError] = useState("");
    const [firebaseUID, setFirebaseUID] = useState<string>("");
    const [deviceId, setDeviceId] = useState<string>("");
    const [studentName, setStudentName] = useState<string>("");
    const [isPWA, setIsPWA] = useState<boolean>(true); // assume true until checked

    // Calendar & Single Strip History States
    const [viewMonthDate, setViewMonthDate] = useState<Date>(() => new Date());
    const [selectedDateStr, setSelectedDateStr] = useState<string>(() => formatDateDDMMYYYY(new Date()));
    const [selectedPassIndex, setSelectedPassIndex] = useState<number>(0);
    const hasUserSelectedDateRef = useRef<boolean>(false);

    // Zoom state
    const [zoomLevel, setZoomLevel] = useState(1);
    const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<any>(null);
    const processingRef = useRef(false);

    // ===================== Get student info + Installation ID =====================
    useEffect(() => {
        const init = async () => {
            try {
                // 1. Get student info from localStorage
                let storedUID = localStorage.getItem("firebaseUID") || localStorage.getItem("getpass_uid") || localStorage.getItem("userUid") || "";
                let storedName = localStorage.getItem("studentName") || "";
                let storedStatus = localStorage.getItem("studentStatus") as "in" | "out" | null;

                // Fallback to cachedStudentData if missing
                try {
                    const cachedStr = localStorage.getItem("cachedStudentData");
                    if (cachedStr) {
                        const parsed = JSON.parse(cachedStr);
                        if (!storedUID) storedUID = parsed.firebaseUID || parsed.supabaseId || parsed._id || parsed.id || "";
                        if (!storedName) storedName = parsed.name || "";
                        if (!storedStatus && parsed.studentStatus) storedStatus = parsed.studentStatus as "in" | "out";
                    }
                } catch (e) {
                    console.error("Failed to parse cachedStudentData", e);
                }

                if (auth.currentUser?.uid && !storedUID) {
                    storedUID = auth.currentUser.uid;
                }
                
                const finalStatus = storedStatus || "in";

                if (storedUID) {
                    setFirebaseUID(storedUID);
                    fetchOutingHistory(storedUID);
                }
                if (storedName) setStudentName(storedName);
                setCurrentStatus(finalStatus);

                // 2. Get or generate the persistent PWA Installation ID
                const installId = await getInstallationId();
                setDeviceId(installId);
                localStorage.setItem("deviceId", installId);

                // 3. Check if running as installed PWA
                setIsPWA(isPWAInstalled());

            } catch (e) {
                console.error("Error during init:", e);
            }
        };
        init();

        let unsubAuth: (() => void) | null = null;
        try {
            unsubAuth = onAuthStateChanged(
                auth,
                (user) => {
                    if (user) {
                        setFirebaseUID(user.uid);
                        localStorage.setItem("firebaseUID", user.uid);
                        fetchOutingHistory(user.uid);
                    }
                },
                (error) => {
                    console.warn("Silent fallback: Firebase auth sync skipped:", error?.message || error);
                }
            );
        } catch (e) {
            console.warn("Silent fallback: onAuthStateChanged error:", e);
        }

        return () => {
            if (unsubAuth) unsubAuth();
        };
    }, []);

    // ===================== Fetch outing history =====================
    const fetchOutingHistory = async (uid: string) => {
        if (!uid) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/getpass/history?firebaseUID=${uid}&limit=100&t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                const records: OutingRecord[] = data.records || [];
                setOutingHistory(records);

                // Auto-select latest record if today has no outings and user hasn't explicitly clicked a date yet
                if (records.length > 0 && !hasUserSelectedDateRef.current) {
                    const todayStr = formatDateDDMMYYYY(new Date());
                    const hasToday = records.some(r => formatDateDDMMYYYY(r.checkOutISTDate || r.checkOutTime) === todayStr);
                    if (!hasToday) {
                        const latestDate = formatDateDDMMYYYY(records[0].checkOutISTDate || records[0].checkOutTime);
                        setSelectedDateStr(latestDate);
                        const parsed = parseFlexibleDate(records[0].checkOutTime || records[0].checkOutISTDate);
                        if (parsed) {
                            setViewMonthDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
        setLoadingHistory(false);
    };

    // Fast lookup map for records grouped by DD-MM-YYYY
    const outingsByDate = useMemo(() => {
        const map = new Map<string, OutingRecord[]>();
        for (const record of outingHistory) {
            const key = formatDateDDMMYYYY(record.checkOutISTDate || record.checkOutTime);
            if (!key) continue;
            const list = map.get(key) || [];
            list.push(record);
            map.set(key, list);
        }
        return map;
    }, [outingHistory]);

    // ─── Camera / QR Scanning ────────────────────────────────────────────────
    // Strategy: use a <video> ref-callback.
    //   1. startCamera() gets the MediaStream first (async).
    //   2. Stores stream in pendingStreamRef, then calls setScanning(true).
    //   3. React re-renders → <video> is mounted → videoRefCallback fires
    //      with the real DOM node → we attach the stream immediately.
    //   This is the only approach that avoids all timing races.
    const [startingCamera, setStartingCamera] = useState(false);
    const pendingStreamRef = useRef<MediaStream | null>(null);

    // Audio Feedback helper
    const playAudioFeedback = (action: string) => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            if (action === "checkout") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.25);
            } else {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "triangle";
                osc.frequency.setValueAtTime(523.25, ctx.currentTime);
                osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
                osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
            }
        } catch (e) {
            console.error("Audio feedback error:", e);
        }
    };

    // ===================== Stop Camera =====================
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        setCameraReady(false);
        setScanning(false);
        setStartingCamera(false);
        setZoomCaps(null);
    }, []);

    // Main QR Code Verification Handler (Live Online Only)
    const handleQRCodeDetected = useCallback(async (qrData: string) => {
        if (processingRef.current) return;
        processingRef.current = true;

        try {
            const parsed = JSON.parse(qrData);
            if (parsed.app !== "hosteleaze-getpass") {
                processingRef.current = false;
                return;
            }
        } catch {
            processingRef.current = false;
            return;
        }

        setProcessing(true);
        stopCamera();

        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        if (!navigator.onLine) {
            setScanResult({
                success: false,
                error: "⚠️ No Internet Connection. Please connect to mobile data or Campus WiFi and scan again, or request the Gatekeeper for Manual Entry."
            });
            processingRef.current = false;
            setProcessing(false);
            return;
        }

        try {
            const cachedStr = localStorage.getItem("cachedStudentData");
            let parsedCached: any = {};
            try { parsedCached = cachedStr ? JSON.parse(cachedStr) : {}; } catch {}

            const effectiveUID = firebaseUID || localStorage.getItem("firebaseUID") || localStorage.getItem("getpass_uid") || parsedCached.firebaseUID || parsedCached._id || "";
            const effectiveEmail = localStorage.getItem("studentEmail") || localStorage.getItem("userEmail") || parsedCached.email || "";
            const effectivePhone = parsedCached.phoneNumber || parsedCached.phone || "";
            const effectiveRegId = parsedCached.registrationId || "";

            const res = await fetch("/api/getpass/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    qrData,
                    firebaseUID: effectiveUID,
                    email: effectiveEmail,
                    phoneNumber: effectivePhone,
                    registrationId: effectiveRegId,
                    deviceId,
                }),
            });

            const data = await res.json();

            if (data.success) {
                playAudioFeedback(data.action);
                
                setScanResult({
                    success: true,
                    action: data.action,
                    message: data.message,
                    studentName: data.studentName,
                    hostelName: data.hostelName,
                    roomNumber: data.roomNumber,
                    newStatus: data.newStatus,
                    durationText: data.durationText,
                    durationMinutes: data.durationMinutes,
                });

                setCurrentStatus(data.newStatus);
                localStorage.setItem("studentStatus", data.newStatus);

                try {
                    const cachedStr = localStorage.getItem("cachedStudentData");
                    if (cachedStr) {
                        const parsed = JSON.parse(cachedStr);
                        parsed.studentStatus = data.newStatus;
                        localStorage.setItem("cachedStudentData", JSON.stringify(parsed));
                    }
                } catch (e) {
                    console.error("Failed to update cachedStudentData:", e);
                }

                setSelectedDateStr(formatDateDDMMYYYY(new Date()));
                setSelectedPassIndex(0);
                setViewMonthDate(new Date());
                hasUserSelectedDateRef.current = true;
                fetchOutingHistory(firebaseUID);
            } else {
                if (data.requiresFaceRecapture) {
                    try {
                        const cachedStr = localStorage.getItem("cachedStudentData");
                        if (cachedStr) {
                            const parsed = JSON.parse(cachedStr);
                            parsed.dynamicFields = {
                                ...(parsed.dynamicFields || {}),
                                requiresFaceRecapture: true
                            };
                            localStorage.setItem("cachedStudentData", JSON.stringify(parsed));
                        }
                    } catch (e) {}
                }
                setScanResult({
                    success: false,
                    error: data.error || "Scan failed",
                    studentName: data.studentName,
                    requiresFaceRecapture: data.requiresFaceRecapture
                });
            }
        } catch (err: any) {
            setScanResult({
                success: false,
                error: "⚠️ Network request failed. Please check your internet connection and try again, or request the Gatekeeper for Manual Entry."
            });
        }

        processingRef.current = false;
        setProcessing(false);
    }, [firebaseUID, deviceId, stopCamera]);

    // ─── Start QR scanning on video stream ───
    const startQRScanning = useCallback(() => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }

        if ("BarcodeDetector" in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
            scanIntervalRef.current = setInterval(async () => {
                if (!videoRef.current || processingRef.current) return;
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0 && barcodes[0].rawValue) {
                        handleQRCodeDetected(barcodes[0].rawValue);
                    }
                } catch { /* ignore */ }
            }, 250);
        } else {
            scanIntervalRef.current = setInterval(() => {
                if (!videoRef.current || !canvasRef.current || processingRef.current) return;
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                try {
                    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                    if (code && code.data) handleQRCodeDetected(code.data);
                } catch { /* ignore */ }
            }, 250);
        }
    }, [handleQRCodeDetected]);

    // Attach stream helper
    const attachStream = useCallback((videoEl: HTMLVideoElement, stream: MediaStream) => {
        videoEl.srcObject = stream;
        videoEl.play().catch(e => console.warn("Video play warning:", e));
        setCameraReady(true);

        try {
            const track = stream.getVideoTracks()[0];
            if (track && track.getCapabilities) {
                const caps = track.getCapabilities() as any;
                if (caps && caps.zoom) {
                    setZoomCaps({ min: caps.zoom.min || 1, max: caps.zoom.max || 1, step: caps.zoom.step || 0.1 });
                    setZoomLevel(caps.zoom.min || 1);
                }
            }
        } catch (e) { /* zoom check fallback */ }

        setTimeout(() => {
            startQRScanning();
        }, 200);
    }, [startQRScanning]);

    // Called by React when <video> mounts or unmounts
    const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
        if (node && pendingStreamRef.current) {
            const stream = pendingStreamRef.current;
            pendingStreamRef.current = null;
            attachStream(node, stream);
        }
    }, [attachStream]);

    // ===================== Start Camera =====================
    const startCamera = async () => {
        if (startingCamera) return;
        setStartingCamera(true);
        processingRef.current = false;
        setError("");
        setScanResult(null);
        setScanning(true);

        try {
            if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera is not supported on this browser or connection is not secure (requires HTTPS or localhost).");
            }

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            streamRef.current = stream;

            if (videoRef.current) {
                attachStream(videoRef.current, stream);
            } else {
                pendingStreamRef.current = stream;
            }
        } catch (err: any) {
            console.error("Camera access error:", err);
            const msg = (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError")
                ? "Camera permission was denied. Please allow camera access in your browser site settings and try again."
                : (err?.message || "Could not open camera. Please check your camera permissions.");
            setError(msg);
            alert(msg);
            setScanning(false);
            setCameraReady(false);
        } finally {
            setStartingCamera(false);
        }
    };

    // ===================== Handle Zoom =====================
    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setZoomLevel(val);

        if (streamRef.current) {
            const track = streamRef.current.getVideoTracks()[0];
            if (track) {
                try {
                    track.applyConstraints({
                        advanced: [{ zoom: val } as any]
                    });
                } catch (err) {
                    console.error("Zoom not supported by this device");
                }
            }
        }
    };

    // Permanently wipe any legacy pending offline scans from device storage
    useEffect(() => {
        localStorage.removeItem("pendingOfflineScans");
    }, []);


    // ===================== Cleanup =====================
    useEffect(() => {
        return () => {
            stopCamera();
            if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
            }
        };
    }, [stopCamera]);

    const formatDuration = (minutes: number | null | undefined) => {
        if (!minutes || minutes <= 0) return "---";
        if (minutes >= 1440) {
            const days = Math.floor(minutes / 1440);
            const hrs = Math.floor((minutes % 1440) / 60);
            const mins = minutes % 60;
            return `${days}d ${hrs}h ${mins}m`;
        }
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const handleRetry = () => {
        setScanResult(null);
        setProcessing(false);
        processingRef.current = false;
        startCamera();
    };

    // Calendar calculation helpers
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const viewYear = viewMonthDate.getFullYear();
    const viewMonth = viewMonthDate.getMonth();
    const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = formatDateDDMMYYYY(new Date());

    const yearOptions = useMemo(() => {
        const yearsSet = new Set<number>();
        const curY = new Date().getFullYear();
        for (let y = curY - 2; y <= curY + 2; y++) {
            yearsSet.add(y);
        }
        for (const record of outingHistory) {
            const p = parseFlexibleDate(record.checkOutTime || record.checkOutISTDate);
            if (p && !isNaN(p.getFullYear())) {
                yearsSet.add(p.getFullYear());
            }
        }
        return Array.from(yearsSet).sort((a, b) => a - b);
    }, [outingHistory]);

    const padZero = (n: number) => String(n).padStart(2, "0");
    const getFormattedDateStr = (year: number, monthIndex: number, dayNum: number) => {
        return `${padZero(dayNum)}-${padZero(monthIndex + 1)}-${year}`;
    };

    const handlePrevMonth = () => {
        setViewMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handleToday = () => {
        const now = new Date();
        setViewMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDateStr(formatDateDDMMYYYY(now));
        setSelectedPassIndex(0);
        hasUserSelectedDateRef.current = true;
    };

    const selectedDayRecords = outingsByDate.get(selectedDateStr) || [];
    const safePassIndex = Math.min(selectedPassIndex, Math.max(0, selectedDayRecords.length - 1));
    const activeRecord = selectedDayRecords[safePassIndex];

    return (
        <div style={{
            position: "relative",
            height: "100vh",
            maxHeight: "100dvh",
            backgroundColor: "#030712",
            color: "#f3f4f6",
            fontFamily: "system-ui, -apple-system, sans-serif",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            paddingBottom: "0px"
        }}>
            {/* Top Navigation Bar */}
            <div style={{
                position: "sticky",
                top: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(10, 15, 30, 0.9)",
                backdropFilter: "blur(12px)",
                zIndex: 50
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={() => router.back()}
                        style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            borderRadius: "6px",
                            padding: "3px 10px",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: "9.5px",
                            fontWeight: "800",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                        }}
                    >
                        ← Back
                    </button>
                    <div>
                        <div style={{ fontSize: "16px", fontWeight: "900", letterSpacing: "0.05em", color: "#6ee7b7" }}>
                            GATEPASS SCANNER
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", fontWeight: "500" }}>
                            {studentName || "Student App"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                        padding: "3px 10px",
                        borderRadius: "6px",
                        fontSize: "9.5px",
                        fontWeight: "800",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        backgroundColor: currentStatus === "in" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                        color: currentStatus === "in" ? "#34d399" : "#fbbf24",
                        border: `1px solid ${currentStatus === "in" ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                    }}>
                        {currentStatus === "in" ? "🏠 In Campus" : "🚶 Outside"}
                    </div>
                </div>
            </div>



            {/* Scanner Area */}
            {!scanResult ? (
                <div style={styles.scannerArea}>
                    {scanning ? (
                        <div style={styles.cameraContainer}>
                            <video
                                ref={videoRefCallback}
                                style={styles.video}
                                playsInline
                                muted
                                autoPlay
                            />
                            <canvas ref={canvasRef} style={{ display: "none" }} />

                            {/* Scanner overlay */}
                            <div style={styles.scannerOverlay}>
                                <div style={styles.scannerFrame}>
                                    <div style={{ ...styles.scannerCorner, top: 0, left: 0 }} />
                                    <div style={{ ...styles.scannerCorner, top: 0, right: 0, transform: "rotate(90deg)" }} />
                                    <div style={{ ...styles.scannerCorner, bottom: 0, left: 0, transform: "rotate(-90deg)" }} />
                                    <div style={{ ...styles.scannerCorner, bottom: 0, right: 0, transform: "rotate(180deg)" }} />
                                </div>
                                <p style={styles.scannerText}>
                                    Point at the QR code on the gate screen
                                </p>

                                {/* Zoom Slider */}
                                {zoomCaps && zoomCaps.max > zoomCaps.min && (
                                    <div style={styles.zoomContainer}>
                                        <div style={styles.zoomIcon}>🔍</div>
                                        <input
                                            type="range"
                                            min={zoomCaps.min}
                                            max={zoomCaps.max}
                                            step={zoomCaps.step}
                                            value={zoomLevel}
                                            onChange={handleZoomChange}
                                            style={styles.zoomSlider}
                                        />
                                        <div style={styles.zoomValue}>{zoomLevel.toFixed(1)}x</div>
                                    </div>
                                )}
                            </div>

                            {processing && (
                                <div style={styles.processingOverlay}>
                                    <div style={styles.processingSpinner}></div>
                                    <p style={styles.processingText}>Processing...</p>
                                </div>
                            )}

                            <button onClick={stopCamera} style={styles.cancelBtn}>
                                ✕ Cancel
                            </button>
                        </div>
                    ) : (
                        <div style={styles.startScanContainer}>
                            <div style={styles.scanIconContainer}>
                                <span style={styles.scanIcon}>📸</span>
                            </div>
                            <h2 style={styles.scanTitle}>
                                {currentStatus === "in" ? "Going Out?" : "Coming Back?"}
                            </h2>
                            <p style={styles.scanDescription}>
                                {currentStatus === "in"
                                    ? "Scan the QR code at the gate to check out from campus"
                                    : "Scan the QR code at the gate to check back in"}
                            </p>
                            <button
                                onClick={startCamera}
                                style={{
                                    ...styles.scanButton,
                                    background: currentStatus === "in"
                                        ? "linear-gradient(135deg, #ff6b6b, #ee5a24)"
                                        : "linear-gradient(135deg, #00ff88, #00cc6a)",
                                    opacity: startingCamera ? 0.75 : 1,
                                    cursor: startingCamera ? "wait" : "pointer",
                                }}
                                disabled={startingCamera || (!firebaseUID && !studentName)}
                            >
                                {startingCamera
                                    ? "⏳ Starting Camera..."
                                    : currentStatus === "in"
                                        ? "🚶 Scan to Check OUT"
                                        : "🏠 Scan to Check IN"}
                            </button>

                            {!firebaseUID && !studentName && (
                                <p style={styles.loginWarning}>
                                    ⚠️ Please login to the app first
                                </p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* Scan Result */
                <div style={styles.resultContainer}>
                    <div style={{
                        ...styles.resultCard,
                        borderColor: scanResult.success
                            ? scanResult.action === "checkout" ? "#ff6b6b" : "#00ff88"
                            : "#ff4444",
                    }}>
                        <div style={styles.resultIcon}>
                            {scanResult.success
                                ? scanResult.action === "checkout" ? "🚶‍♂️" : "🏠"
                                : "❌"}
                        </div>
                        <h2 style={{
                            ...styles.resultTitle,
                            color: scanResult.success
                                ? scanResult.action === "checkout" ? "#ff6b6b" : "#00ff88"
                                : "#ff4444",
                        }}>
                            {scanResult.success
                                ? scanResult.action === "checkout" ? "Checked OUT" : "Checked IN"
                                : "Scan Failed"}
                        </h2>
                        {scanResult.studentName && (
                            <div style={{
                                fontSize: "14px",
                                fontWeight: "700",
                                color: "#f1f5f9",
                                marginBottom: "6px",
                                letterSpacing: "0.5px",
                                textTransform: "uppercase"
                            }}>
                                {scanResult.studentName}
                            </div>
                        )}
                        <p style={styles.resultMessage}>
                            {scanResult.success ? scanResult.message : scanResult.error}
                        </p>
                        {scanResult.durationText && (
                            <div style={styles.durationBadge}>
                                ⏱️ Duration: {scanResult.durationText}
                            </div>
                        )}
                        {scanResult.requiresFaceRecapture ? (
                            <button
                                onClick={() => {
                                    router.push("/");
                                }}
                                style={{
                                    ...styles.doneButton,
                                    background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                                    color: "#fff",
                                    fontWeight: 900,
                                    marginTop: "12px",
                                    boxShadow: "0 4px 14px rgba(219, 39, 119, 0.35)"
                                }}
                            >
                                📸 Retake Profile Photo Now
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    processingRef.current = false;
                                    setScanResult(null);
                                }}
                                style={styles.doneButton}
                            >
                                Done
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Outing History */}
            <div style={{
                padding: "2px 14px 4px",
                maxWidth: "540px",
                width: "100%",
                margin: "0 auto",
            }}>
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                }}>
                    <h3 style={{
                        fontSize: "10.5px",
                        fontWeight: "800",
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                    }}>
                        <span>📋</span> Your Outing History
                    </h3>

                    {outingHistory.length > 0 && (
                        <span style={{
                            fontSize: "9.5px",
                            fontWeight: "700",
                            color: "#9ca3af",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            padding: "2px 7px",
                            borderRadius: "9999px",
                            border: "1px solid rgba(255, 255, 255, 0.1)"
                        }}>
                            {outingHistory.length} Total Passes
                        </span>
                    )}
                </div>

                {loadingHistory ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#6b7280", fontSize: "11px" }}>
                        Loading Outing History...
                    </div>
                ) : (
                    <>
                        {/* CALENDAR COMPONENT (Marked Blue Area) */}
                        <div style={{
                            backgroundColor: "#0d1527",
                            borderRadius: "12px",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            padding: "7px 10px 5px",
                            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
                            marginBottom: "6px"
                        }}>
                            {/* Calendar Header: Month/Year & Navigation */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "5px"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <button
                                        type="button"
                                        onClick={handlePrevMonth}
                                        style={{
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "8px",
                                            border: "1px solid rgba(255, 255, 255, 0.15)",
                                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                                            color: "#e5e7eb",
                                            fontSize: "14px",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer"
                                        }}
                                        aria-label="Previous Month"
                                    >
                                        ‹
                                    </button>

                                    {/* Month Picker Dropdown */}
                                    <select
                                        value={viewMonth}
                                        onChange={(e) => {
                                            const newMonth = parseInt(e.target.value, 10);
                                            setViewMonthDate(new Date(viewYear, newMonth, 1));
                                        }}
                                        style={{
                                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                                            color: "#ffffff",
                                            border: "1px solid rgba(255, 255, 255, 0.2)",
                                            borderRadius: "8px",
                                            padding: "3px 6px",
                                            fontSize: "11px",
                                            fontWeight: "800",
                                            cursor: "pointer",
                                            outline: "none",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.03em"
                                        }}
                                    >
                                        {monthNames.map((name, idx) => (
                                            <option key={name} value={idx} style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
                                                {name.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Year Picker Dropdown */}
                                    <select
                                        value={viewYear}
                                        onChange={(e) => {
                                            const newYear = parseInt(e.target.value, 10);
                                            setViewMonthDate(new Date(newYear, viewMonth, 1));
                                        }}
                                        style={{
                                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                                            color: "#ffffff",
                                            border: "1px solid rgba(255, 255, 255, 0.2)",
                                            borderRadius: "8px",
                                            padding: "3px 6px",
                                            fontSize: "11px",
                                            fontWeight: "800",
                                            cursor: "pointer",
                                            outline: "none",
                                            letterSpacing: "0.03em"
                                        }}
                                    >
                                        {yearOptions.map((y) => (
                                            <option key={y} value={y} style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
                                                {y}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        onClick={handleNextMonth}
                                        style={{
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "8px",
                                            border: "1px solid rgba(255, 255, 255, 0.15)",
                                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                                            color: "#e5e7eb",
                                            fontSize: "14px",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer"
                                        }}
                                        aria-label="Next Month"
                                    >
                                        ›
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleToday}
                                    style={{
                                        padding: "3px 10px",
                                        borderRadius: "6px",
                                        border: "1px solid rgba(59, 130, 246, 0.5)",
                                        backgroundColor: "rgba(59, 130, 246, 0.15)",
                                        color: "#60a5fa",
                                        fontSize: "9.5px",
                                        fontWeight: "800",
                                        letterSpacing: "0.05em",
                                        textTransform: "uppercase",
                                        cursor: "pointer"
                                    }}
                                >
                                    Today
                                </button>
                            </div>

                            {/* Days of Week Header */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(7, 1fr)",
                                gap: "3px",
                                textAlign: "center",
                                marginBottom: "6px"
                            }}>
                                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
                                    <span
                                        key={dayName}
                                        style={{
                                            fontSize: "9.5px",
                                            fontWeight: "800",
                                            color: "#9ca3af",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.03em"
                                        }}
                                    >
                                        {dayName}
                                    </span>
                                ))}
                            </div>

                            {/* Days Grid */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(7, 1fr)",
                                rowGap: "1px",
                                columnGap: "3px"
                            }}>
                                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                                    <div key={`empty-${i}`} style={{ height: "23px" }} />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dayStr = getFormattedDateStr(viewYear, viewMonth, day);
                                    const isSelected = selectedDateStr === dayStr;
                                    const isToday = todayStr === dayStr;
                                    const dayRecords = outingsByDate.get(dayStr) || [];
                                    const hasOuting = dayRecords.length > 0;
                                    const hasLeave = dayRecords.some(r => String(r.type || '').toLowerCase().includes('leave') || String(r.type || '').toLowerCase() === 'hleave');

                                    return (
                                        <button
                                            key={dayStr}
                                            type="button"
                                            onClick={() => {
                                                hasUserSelectedDateRef.current = true;
                                                setSelectedDateStr(dayStr);
                                                setSelectedPassIndex(0);
                                            }}
                                            style={{
                                                position: "relative",
                                                height: "23px",
                                                borderRadius: "5px",
                                                border: isSelected
                                                    ? "2px solid #3b82f6"
                                                    : isToday
                                                    ? "1px solid rgba(56, 189, 248, 0.6)"
                                                    : "1px solid transparent",
                                                backgroundColor: isSelected
                                                    ? "#2563eb"
                                                    : hasOuting
                                                    ? "rgba(255, 255, 255, 0.08)"
                                                    : "transparent",
                                                color: isSelected
                                                    ? "#ffffff"
                                                    : hasOuting
                                                    ? "#ffffff"
                                                    : "#9ca3af",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                cursor: "pointer",
                                                padding: 0,
                                                transition: "all 0.15s ease",
                                                boxShadow: isSelected ? "0 2px 8px rgba(37, 99, 235, 0.5)" : "none"
                                            }}
                                        >
                                            <span style={{
                                                fontSize: "10.5px",
                                                fontWeight: isSelected || hasOuting || isToday ? "800" : "500",
                                                lineHeight: "1"
                                            }}>
                                                {day}
                                            </span>

                                            {/* Dot indicator for outing or home leave */}
                                            {hasOuting && (
                                                <span style={{
                                                    width: "3.5px",
                                                    height: "3.5px",
                                                    borderRadius: "50%",
                                                    backgroundColor: isSelected
                                                        ? "#fbbf24"
                                                        : hasLeave
                                                        ? "#60a5fa"
                                                        : "#f59e0b",
                                                    marginTop: "1px",
                                                    boxShadow: "0 0 3px rgba(245, 158, 11, 0.7)"
                                                }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Calendar Legend / Footer */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginTop: "4px",
                                paddingTop: "4px",
                                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                                fontSize: "8.5px",
                                fontWeight: "700",
                                color: "#9ca3af"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#f59e0b", display: "inline-block" }} />
                                        Outing
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#60a5fa", display: "inline-block" }} />
                                        Home Leave
                                    </span>
                                </div>
                                <span style={{ color: "#cbd5e1" }}>
                                    Selected: {selectedDateStr}
                                </span>
                            </div>
                        </div>

                        {/* SINGLE STRIP ONLY (as circled by black pen) */}
                        {activeRecord ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {selectedDayRecords.length > 1 && (
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "0 4px",
                                        marginBottom: "2px"
                                    }}>
                                        <span style={{
                                            fontSize: "10px",
                                            fontWeight: "800",
                                            color: "#9ca3af",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em"
                                        }}>
                                            Pass {safePassIndex + 1} of {selectedDayRecords.length} on {selectedDateStr}
                                        </span>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            <button
                                                type="button"
                                                disabled={safePassIndex === 0}
                                                onClick={() => setSelectedPassIndex(p => Math.max(0, p - 1))}
                                                style={{
                                                    padding: "2px 8px",
                                                    borderRadius: "4px",
                                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                                                    color: "#ffffff",
                                                    fontSize: "10px",
                                                    fontWeight: "bold",
                                                    cursor: safePassIndex === 0 ? "not-allowed" : "pointer",
                                                    opacity: safePassIndex === 0 ? 0.35 : 1
                                                }}
                                            >
                                                ‹ Prev
                                            </button>
                                            <button
                                                type="button"
                                                disabled={safePassIndex === selectedDayRecords.length - 1}
                                                onClick={() => setSelectedPassIndex(p => Math.min(selectedDayRecords.length - 1, p + 1))}
                                                style={{
                                                    padding: "2px 8px",
                                                    borderRadius: "4px",
                                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                                                    color: "#ffffff",
                                                    fontSize: "10px",
                                                    fontWeight: "bold",
                                                    cursor: safePassIndex === selectedDayRecords.length - 1 ? "not-allowed" : "pointer",
                                                    opacity: safePassIndex === selectedDayRecords.length - 1 ? 0.35 : 1
                                                }}
                                            >
                                                Next ›
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {(() => {
                                    const record = activeRecord;
                                    const isLeave = String(record.type || '').toLowerCase().includes('leave') || String(record.type || '').toLowerCase() === 'hleave';
                                    const isOut = record.status === "out";

                                    return (
                                        <div
                                            key={record._id}
                                            style={{
                                                backgroundColor: "#ffffff",
                                                borderRadius: "10px",
                                                border: "1px solid rgba(229, 231, 235, 0.9)",
                                                padding: "7px 12px",
                                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "4px",
                                            }}
                                        >
                                            {/* Top Row: Type Pill + Status Pill */}
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{
                                                    padding: "1px 6px",
                                                    borderRadius: "9999px",
                                                    fontSize: "8px",
                                                    fontWeight: "800",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    backgroundColor: isLeave ? "#dbeafe" : "#f3e8ff",
                                                    color: isLeave ? "#1d4ed8" : "#7e22ce"
                                                }}>
                                                    {isLeave ? "🏠 Home Leave" : "🚶 Short Outing"}
                                                </span>

                                                <span style={{
                                                    padding: "1px 6px",
                                                    borderRadius: "9999px",
                                                    fontSize: "8px",
                                                    fontWeight: "800",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    backgroundColor: isOut ? "#ffe4e6" : "#d1fae5",
                                                    color: isOut ? "#be123c" : "#047857",
                                                    border: isOut ? "1px solid #fecdd3" : "1px solid #a7f3d0"
                                                }}>
                                                    {isOut ? "Still Outside" : "Returned"}
                                                </span>
                                            </div>

                                            {/* Middle Rows: Full horizontal row matching Screenshot 2 */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: "3px", paddingTop: "2px" }}>
                                                <div style={{ display: "flex", alignItems: "center", fontSize: "10.5px", fontWeight: "800", color: "#111827" }}>
                                                    <span style={{ width: "80px", textTransform: "uppercase", letterSpacing: "-0.02em", flexShrink: 0 }}>CHECK OUT</span>
                                                    <span style={{ color: "#d1d5db", fontWeight: "normal", padding: "0 6px", flexShrink: 0 }}>|</span>
                                                    <span style={{ textAlign: "center", flex: 1, fontVariantNumeric: "tabular-nums" }}>{record.checkOutISTTime}</span>
                                                    <span style={{ color: "#d1d5db", fontWeight: "normal", padding: "0 6px", flexShrink: 0 }}>|</span>
                                                    <span style={{ textAlign: "right", flex: 1, fontVariantNumeric: "tabular-nums" }}>{formatDateDDMMYYYY(record.checkOutISTDate || record.checkOutTime)}</span>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", fontSize: "10.5px", fontWeight: "800", color: "#111827" }}>
                                                    <span style={{ width: "80px", textTransform: "uppercase", letterSpacing: "-0.02em", flexShrink: 0 }}>CHECK IN</span>
                                                    <span style={{ color: "#d1d5db", fontWeight: "normal", padding: "0 6px", flexShrink: 0 }}>|</span>
                                                    {record.status === "in" || record.status === "auto-resolved" ? (
                                                        <>
                                                            <span style={{ textAlign: "center", flex: 1, fontVariantNumeric: "tabular-nums" }}>{record.checkInISTTime || "---"}</span>
                                                            <span style={{ color: "#d1d5db", fontWeight: "normal", padding: "0 6px", flexShrink: 0 }}>|</span>
                                                            <span style={{ textAlign: "right", flex: 1, fontVariantNumeric: "tabular-nums" }}>{formatDateDDMMYYYY(record.checkInISTDate || record.checkInTime || record.checkOutISTDate)}</span>
                                                        </>
                                                    ) : (
                                                        <span style={{ flex: 1, textAlign: "center", color: "#f43f5e", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "9.5px" }}>
                                                            Outside Campus
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bottom Row: Centered TOTAL DURATION */}
                                            {record.durationMinutes !== undefined && record.durationMinutes !== null && (
                                                <div style={{
                                                    fontSize: "9.5px",
                                                    fontWeight: "800",
                                                    color: "#111827",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    paddingTop: "3px",
                                                    borderTop: "1px solid #f3f4f6",
                                                    textAlign: "center"
                                                }}>
                                                    TOTAL DURATION: {(() => {
                                                        const minutes = record.durationMinutes;
                                                        if (minutes >= 1440) {
                                                            const days = Math.floor(minutes / 1440);
                                                            const hrs = Math.floor((minutes % 1440) / 60);
                                                            const mins = minutes % 60;
                                                            return `${days}D ${hrs}H ${mins}M`;
                                                        }
                                                        const h = Math.floor(minutes / 60);
                                                        const mins = minutes % 60;
                                                        return h > 0 ? `${h}H ${mins}M` : `${mins}M`;
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div style={{
                                padding: "20px 16px",
                                textAlign: "center",
                                backgroundColor: "rgba(255, 255, 255, 0.03)",
                                borderRadius: "12px",
                                border: "1px dashed rgba(255, 255, 255, 0.15)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "6px"
                            }}>
                                <span style={{ fontSize: "20px" }}>📅</span>
                                <p style={{ margin: 0, fontSize: "11px", color: "rgba(255, 255, 255, 0.5)", fontWeight: "600" }}>
                                    No outing recorded on {selectedDateStr}
                                </p>
                                {outingHistory.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const latest = outingHistory[0];
                                            const latestDate = formatDateDDMMYYYY(latest.checkOutISTDate || latest.checkOutTime);
                                            hasUserSelectedDateRef.current = true;
                                            setSelectedDateStr(latestDate);
                                            setSelectedPassIndex(0);
                                            const parsed = parseFlexibleDate(latest.checkOutTime || latest.checkOutISTDate);
                                            if (parsed) {
                                                setViewMonthDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
                                            }
                                        }}
                                        style={{
                                            marginTop: "4px",
                                            padding: "5px 12px",
                                            borderRadius: "8px",
                                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                                            border: "1px solid rgba(59, 130, 246, 0.35)",
                                            color: "#60a5fa",
                                            fontSize: "10.5px",
                                            fontWeight: "700",
                                            cursor: "pointer"
                                        }}
                                    >
                                        Jump to Latest Outing ({formatDateDDMMYYYY(outingHistory[0].checkOutISTDate || outingHistory[0].checkOutTime)})
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {error && (
                <div style={styles.errorBanner}>
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}

// ===================== Styles =====================
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0a1a 0%, #0d1420 100%)",
        fontFamily: "'Lora', Cambria",
        color: "#ffffff",
        paddingBottom: "40px",
    },

    header: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px 20px",
        background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
    },

    backBtn: {
        color: "#fff",
        textDecoration: "none",
        fontSize: "24px",
        padding: "4px 8px",
    },

    headerContent: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flex: 1,
    },

    headerTitle: {
        fontSize: "22px",
        fontWeight: "800",
        background: "linear-gradient(135deg, #00ff88, #00cc6a)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        margin: 0,
        letterSpacing: "2px",
    },

    statusBadge: {
        padding: "6px 14px",
        borderRadius: "20px",
        fontSize: "13px",
        fontWeight: "600",
        border: "1px solid",
    },

    scannerArea: {
        padding: "4px 14px 2px",
    },

    cameraContainer: {
        position: "relative" as const,
        borderRadius: "20px",
        overflow: "hidden",
        background: "#000",
        aspectRatio: "4/3",
    },

    video: {
        width: "100%",
        height: "100%",
        objectFit: "cover" as const,
    },

    scannerOverlay: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
    },

    scannerFrame: {
        width: "250px",
        height: "250px",
        position: "relative" as const,
        border: "2px solid rgba(0, 255, 136, 0.3)",
        borderRadius: "16px",
    },

    scannerCorner: {
        position: "absolute" as const,
        width: "30px",
        height: "30px",
        borderTop: "4px solid #00ff88",
        borderLeft: "4px solid #00ff88",
        borderRadius: "4px 0 0 0",
    },

    scannerText: {
        marginTop: "20px",
        color: "rgba(255,255,255,0.8)",
        fontSize: "14px",
        textAlign: "center" as const,
        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
    },

    processingOverlay: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        gap: "16px",
    },

    processingSpinner: {
        width: "40px",
        height: "40px",
        border: "3px solid rgba(0, 255, 136, 0.2)",
        borderTop: "3px solid #00ff88",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
    },

    processingText: {
        color: "#00ff88",
        fontSize: "16px",
        fontWeight: "600",
    },

    cancelBtn: {
        position: "absolute" as const,
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "10px 24px",
        background: "rgba(255,255,255,0.2)",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: "12px",
        color: "#fff",
        fontSize: "15px",
        cursor: "pointer",
        backdropFilter: "blur(10px)",
        zIndex: 10,
    },

    zoomContainer: {
        position: "absolute" as const,
        bottom: "80px", // Higher than cancel btn
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "rgba(0,0,0,0.6)",
        padding: "10px 20px",
        borderRadius: "30px",
        width: "80%",
        maxWidth: "300px",
        backdropFilter: "blur(15px)",
        border: "1px solid rgba(255,255,255,0.15)",
        zIndex: 20,
    },

    zoomIcon: {
        fontSize: "16px",
    },

    zoomSlider: {
        flex: 1,
        height: "4px",
        WebkitAppearance: "none",
        background: "rgba(255,255,255,0.2)",
        borderRadius: "2px",
        outline: "none",
        cursor: "pointer",
    },

    zoomValue: {
        fontSize: "13px",
        fontWeight: "700",
        minWidth: "35px",
        color: "#00ff88",
        fontFamily: "'Lora', Cambria",
    },

    startScanContainer: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        padding: "3px 14px 2px",
        gap: "4px",
    },

    scanIconContainer: {
        width: "44px",
        height: "44px",
        borderRadius: "12px",
        background: "rgba(0, 255, 136, 0.1)",
        border: "1.5px solid rgba(0, 255, 136, 0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "0px",
    },

    scanIcon: {
        fontSize: "22px",
    },

    scanTitle: {
        fontSize: "15px",
        fontWeight: "800",
        color: "#fff",
        margin: 0,
        textAlign: "center" as const,
    },

    scanDescription: {
        fontSize: "10.5px",
        color: "rgba(255,255,255,0.6)",
        textAlign: "center" as const,
        margin: 0,
        maxWidth: "270px",
        lineHeight: "1.3",
    },

    scanButton: {
        padding: "7px 22px",
        borderRadius: "10px",
        border: "none",
        color: "#fff",
        fontSize: "12.5px",
        fontWeight: "800",
        cursor: "pointer",
        marginTop: "1px",
        boxShadow: "0 4px 16px rgba(0, 255, 136, 0.25)",
        transition: "all 0.2s ease",
    },

    loginWarning: {
        color: "#ff6b6b",
        fontSize: "13px",
        margin: 0,
    },

    resultContainer: {
        padding: "40px 20px",
        display: "flex",
        justifyContent: "center",
    },

    resultCard: {
        maxWidth: "360px",
        width: "100%",
        padding: "40px 24px",
        borderRadius: "24px",
        background: "rgba(255,255,255,0.04)",
        border: "2px solid",
        textAlign: "center" as const,
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: "12px",
    },

    resultIcon: {
        fontSize: "64px",
        marginBottom: "8px",
    },

    resultTitle: {
        fontSize: "28px",
        fontWeight: "800",
        margin: 0,
    },

    resultMessage: {
        fontSize: "15px",
        color: "rgba(255,255,255,0.7)",
        margin: 0,
        lineHeight: "1.5",
    },

    durationBadge: {
        padding: "8px 20px",
        background: "rgba(0, 255, 136, 0.1)",
        borderRadius: "12px",
        color: "#00ff88",
        fontSize: "16px",
        fontWeight: "600",
    },

    doneButton: {
        padding: "12px 40px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "pointer",
        marginTop: "12px",
    },

    historySection: {
        padding: "0 20px",
        marginTop: "20px",
    },

    historyTitle: {
        fontSize: "17px",
        fontWeight: "600",
        color: "rgba(255,255,255,0.9)",
        margin: "0 0 12px 0",
    },

    loadingText: {
        color: "rgba(255,255,255,0.4)",
        textAlign: "center" as const,
    },

    historyList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "8px",
    },

    historyCard: {
        padding: "12px 16px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
    },

    historyCardHeader: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px",
    },

    historyStatusDot: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
    },

    historyDate: {
        fontSize: "13px",
        color: "rgba(255,255,255,0.5)",
        flex: 1,
    },

    liveTag: {
        padding: "2px 8px",
        borderRadius: "4px",
        background: "rgba(255, 107, 107, 0.2)",
        color: "#ff6b6b",
        fontSize: "10px",
        fontWeight: "700",
        letterSpacing: "1px",
    },

    historyCardBody: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },

    historyTimeBlock: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
    },

    historyLabel: {
        fontSize: "10px",
        color: "rgba(255,255,255,0.3)",
        textTransform: "uppercase" as const,
        letterSpacing: "1px",
    },

    historyTime: {
        fontSize: "16px",
        fontWeight: "600",
        color: "#fff",
        fontVariantNumeric: "tabular-nums" as const,
    },

    historyArrow: {
        color: "rgba(255,255,255,0.3)",
        fontSize: "14px",
    },

    historyDuration: {
        marginLeft: "auto",
        padding: "4px 10px",
        borderRadius: "8px",
        background: "rgba(0, 255, 136, 0.1)",
        color: "#00ff88",
        fontSize: "13px",
        fontWeight: "600",
    },

    noHistory: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        padding: "40px",
        gap: "8px",
        color: "rgba(255,255,255,0.4)",
        fontSize: "14px",
    },

    errorBanner: {
        position: "fixed" as const,
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "12px 24px",
        background: "rgba(255, 68, 68, 0.9)",
        borderRadius: "12px",
        color: "#fff",
        fontSize: "14px",
        fontWeight: "500",
        zIndex: 1000,
    },
};
