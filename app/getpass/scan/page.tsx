"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { getInstallationId, isPWAInstalled } from "@/lib/installationId";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
}

interface OutingRecord {
    _id: string;
    checkOutTime: string;
    checkOutISTTime: string;
    checkOutISTDate: string;
    checkInTime?: string;
    checkInISTTime?: string;
    checkInISTDate?: string;
    status: "out" | "in";
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
            const res = await fetch(`/api/getpass/history?firebaseUID=${uid}&limit=10&t=${Date.now()}`);
            const data = await res.json();
            if (data.success) {
                setOutingHistory(data.records || []);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
        setLoadingHistory(false);
    };

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

                fetchOutingHistory(firebaseUID);
            } else {
                setScanResult({
                    success: false,
                    error: data.error || "Scan failed",
                    studentName: data.studentName,
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

    return (
        <div style={{
            position: "relative",
            minHeight: "100vh",
            backgroundColor: "#030712",
            color: "#f3f4f6",
            fontFamily: "system-ui, -apple-system, sans-serif",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "40px"
        }}>
            {/* Top Navigation Bar */}
            <div style={{
                position: "sticky",
                top: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
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
                            border: "none",
                            borderRadius: "10px",
                            padding: "8px 12px",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: "14px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
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
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: "700",
                        letterSpacing: "0.05em",
                        backgroundColor: currentStatus === "in" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                        color: currentStatus === "in" ? "#34d399" : "#fbbf24",
                        border: `1px solid ${currentStatus === "in" ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`
                    }}>
                        {currentStatus === "in" ? "🏠 In Campus" : "🚶 Outside"}
                    </div>
                </div>
            </div>


            {/* ⚠️ PWA Install Warning — shown when opened in browser tab instead of installed app */}
            {!isPWA && (
                <div style={{
                    margin: "12px 16px 0",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "rgba(255, 165, 0, 0.12)",
                    border: "1px solid rgba(255, 165, 0, 0.4)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                }}>
                    <span style={{ fontSize: "20px", flexShrink: 0 }}>📲</span>
                    <div>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#ffaa00" }}>
                            Install the app for secure attendance
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.55)", lineHeight: "1.4" }}>
                            You're using the browser. Tap <strong style={{ color: "#ffaa00" }}>Share → Add to Home Screen</strong> to install the app. Your device binding will be more secure and won't be affected by clearing browser data.
                        </p>
                    </div>
                </div>
            )}

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
                        <button
                            onClick={() => {
                                processingRef.current = false;
                                setScanResult(null);
                            }}
                            style={styles.doneButton}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* Outing History */}
            <div style={{
                padding: "24px 16px",
                maxWidth: "640px",
                width: "100%",
                margin: "0 auto",
            }}>
                <h3 style={{
                    fontSize: "13px",
                    fontWeight: "900",
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                }}>
                    <span>📋</span> Your Outing History
                </h3>

                {loadingHistory ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                        Loading Outing History...
                    </div>
                ) : outingHistory.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {outingHistory.map((record) => {
                            const isLeave = String(record.type || '').toLowerCase().includes('leave') || String(record.type || '').toLowerCase() === 'hleave';
                            const isOut = record.status === "out";

                            return (
                                <div
                                    key={record._id}
                                    style={{
                                        backgroundColor: "#ffffff",
                                        borderRadius: "16px",
                                        border: "1px solid rgba(229, 231, 235, 0.9)",
                                        padding: "16px",
                                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "12px",
                                        transition: "transform 0.15s ease",
                                    }}
                                >
                                    {/* Top Row: Type Pill + Status Pill */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{
                                            padding: "3px 10px",
                                            borderRadius: "9999px",
                                            fontSize: "9px",
                                            fontWeight: "900",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            backgroundColor: isLeave ? "#dbeafe" : "#f3e8ff",
                                            color: isLeave ? "#1d4ed8" : "#7e22ce"
                                        }}>
                                            {isLeave ? "🏠 Home Leave" : "🚶 Short Outing"}
                                        </span>

                                        <span style={{
                                            padding: "3px 10px",
                                            borderRadius: "9999px",
                                            fontSize: "9px",
                                            fontWeight: "900",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            backgroundColor: isOut ? "#ffe4e6" : "#d1fae5",
                                            color: isOut ? "#be123c" : "#047857",
                                            border: isOut ? "1px solid #fecdd3" : "1px solid #a7f3d0"
                                        }}>
                                            {isOut ? "Still Outside" : "Returned"}
                                        </span>
                                    </div>

                                    {/* Middle Grid: CHECK OUT | CHECK IN */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                        <div>
                                            <p style={{
                                                fontSize: "9px",
                                                fontWeight: "800",
                                                color: "#9ca3af",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.08em",
                                                margin: "0 0 3px 0"
                                            }}>
                                                Check Out
                                            </p>
                                            <p style={{
                                                fontSize: "13px",
                                                fontWeight: "900",
                                                color: "#1f2937",
                                                margin: 0,
                                                lineHeight: "1.3"
                                            }}>
                                                {record.checkOutISTTime} <span style={{ color: "#9ca3af", fontWeight: "600", fontSize: "11px" }}>| {record.checkOutISTDate}</span>
                                            </p>
                                        </div>

                                        <div>
                                            <p style={{
                                                fontSize: "9px",
                                                fontWeight: "800",
                                                color: "#9ca3af",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.08em",
                                                margin: "0 0 3px 0"
                                            }}>
                                                Check In
                                            </p>
                                            {record.status === "in" || record.status === "auto-resolved" ? (
                                                <p style={{
                                                    fontSize: "13px",
                                                    fontWeight: "900",
                                                    color: "#1f2937",
                                                    margin: 0,
                                                    lineHeight: "1.3"
                                                }}>
                                                    {record.checkInISTTime || "---"} <span style={{ color: "#9ca3af", fontWeight: "600", fontSize: "11px" }}>| {record.checkInISTDate}</span>
                                                </p>
                                            ) : (
                                                <p style={{
                                                    fontSize: "11px",
                                                    fontWeight: "900",
                                                    color: "#f43f5e",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.08em",
                                                    margin: 0
                                                }}>
                                                    Outside Campus
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Row: TOTAL DURATION */}
                                    {record.durationMinutes !== undefined && record.durationMinutes !== null && (
                                        <div style={{
                                            fontSize: "10px",
                                            fontWeight: "800",
                                            color: "#9ca3af",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.08em",
                                            paddingTop: "8px",
                                            borderTop: "1px solid #f3f4f6"
                                        }}>
                                            Total Duration: <span style={{ color: "#374151", fontWeight: "900" }}>{(() => {
                                                const minutes = record.durationMinutes;
                                                if (minutes >= 1440) {
                                                    const days = Math.floor(minutes / 1440);
                                                    const hrs = Math.floor((minutes % 1440) / 60);
                                                    const mins = minutes % 60;
                                                    return `${days}d ${hrs}h ${mins}m`;
                                                }
                                                const h = Math.floor(minutes / 60);
                                                const m = minutes % 60;
                                                return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                            })()}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{
                        padding: "36px 20px",
                        textAlign: "center",
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        borderRadius: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.08)"
                    }}>
                        <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>📭</span>
                        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255, 255, 255, 0.4)" }}>No outings recorded yet</p>
                    </div>
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
        padding: "20px",
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
        padding: "40px 20px",
        gap: "16px",
    },

    scanIconContainer: {
        width: "100px",
        height: "100px",
        borderRadius: "24px",
        background: "rgba(0, 255, 136, 0.1)",
        border: "2px solid rgba(0, 255, 136, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "8px",
    },

    scanIcon: {
        fontSize: "48px",
    },

    scanTitle: {
        fontSize: "24px",
        fontWeight: "700",
        color: "#fff",
        margin: 0,
        textAlign: "center" as const,
    },

    scanDescription: {
        fontSize: "14px",
        color: "rgba(255,255,255,0.5)",
        textAlign: "center" as const,
        margin: 0,
        maxWidth: "300px",
        lineHeight: "1.5",
    },

    scanButton: {
        padding: "16px 40px",
        borderRadius: "16px",
        border: "none",
        color: "#fff",
        fontSize: "18px",
        fontWeight: "700",
        cursor: "pointer",
        marginTop: "8px",
        boxShadow: "0 8px 30px rgba(0, 255, 136, 0.3)",
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
