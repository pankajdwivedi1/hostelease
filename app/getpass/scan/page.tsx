"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// GETPASS STUDENT SCANNER — QR Code Scanner for Students
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
}

export default function StudentScannerPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<any>(null);

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

    // Zoom state
    const [zoomLevel, setZoomLevel] = useState(1);
    const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);

    // ===================== Get student info from localStorage =====================
    useEffect(() => {
        // Try to get student info from localStorage (set by the main app)
        try {
            const storedUID = localStorage.getItem("firebaseUID") || "";
            const storedDeviceId = localStorage.getItem("deviceId") || "";
            const storedName = localStorage.getItem("studentName") || "";
            const storedStatus = localStorage.getItem("studentStatus") as "in" | "out" || "in";

            setFirebaseUID(storedUID);
            setDeviceId(storedDeviceId);
            setStudentName(storedName);
            setCurrentStatus(storedStatus);

            if (storedUID) {
                fetchOutingHistory(storedUID);
            }
        } catch (e) {
            console.error("Error reading localStorage:", e);
        }
    }, []);

    // ===================== Fetch outing history =====================
    const fetchOutingHistory = async (uid: string) => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/getpass/history?firebaseUID=${uid}&limit=10`);
            const data = await res.json();
            if (data.success) {
                setOutingHistory(data.records);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
        setLoadingHistory(false);
    };

    // ===================== Start Camera =====================
    const startCamera = async () => {
        setError("");
        setScanResult(null);
        setScanning(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", // Use back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setCameraReady(true);

                // Detect zoom capabilities
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities() as any;

                if (capabilities.zoom) {
                    setZoomCaps({
                        min: capabilities.zoom.min || 1,
                        max: capabilities.zoom.max || 1,
                        step: capabilities.zoom.step || 0.1
                    });
                    setZoomLevel(capabilities.zoom.min || 1);
                }

                // Start scanning for QR codes
                startQRScanning();
            }
        } catch (err: any) {
            setError("Camera access denied. Please allow camera permission.");
            setScanning(false);
        }
    };

    // ===================== Stop Camera =====================
    const stopCamera = () => {
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
        setZoomCaps(null);
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

    // ===================== QR Code Scanning (using BarcodeDetector API) =====================
    const startQRScanning = () => {
        // Check if BarcodeDetector is available (modern browsers)
        if ("BarcodeDetector" in window) {
            const detector = new (window as any).BarcodeDetector({
                formats: ["qr_code"],
            });

            scanIntervalRef.current = setInterval(async () => {
                if (!videoRef.current || processing) return;

                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        const qrData = barcodes[0].rawValue;
                        if (qrData) {
                            handleQRCodeDetected(qrData);
                        }
                    }
                } catch (err) {
                    // Ignore detection errors
                }
            }, 300); // Scan every 300ms
        } else {
            // Fallback: Use canvas-based detection for older browsers
            scanWithCanvas();
        }
    };

    // ===================== Canvas-based fallback scanning =====================
    const scanWithCanvas = () => {
        scanIntervalRef.current = setInterval(() => {
            if (!videoRef.current || !canvasRef.current || processing) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Try using BarcodeDetector on ImageData
            if ("BarcodeDetector" in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
                detector.detect(canvas).then((barcodes: any[]) => {
                    if (barcodes.length > 0) {
                        handleQRCodeDetected(barcodes[0].rawValue);
                    }
                }).catch(() => { });
            }
        }, 500);
    };

    // ===================== Handle QR Code Detection =====================
    const handleQRCodeDetected = useCallback(async (qrData: string) => {
        if (processing) return;

        // Verify it's a GETPASS QR code
        try {
            const parsed = JSON.parse(qrData);
            if (parsed.app !== "hostelease-getpass") {
                return; // Not our QR code, keep scanning
            }
        } catch {
            return; // Invalid JSON, not our QR code
        }

        setProcessing(true);
        stopCamera();

        // Vibrate for haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        try {
            const res = await fetch("/api/getpass/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    qrData,
                    firebaseUID,
                    deviceId,
                }),
            });

            const data = await res.json();

            if (data.success) {
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

                // Refresh history
                fetchOutingHistory(firebaseUID);
            } else {
                setScanResult({
                    success: false,
                    error: data.error || "Scan failed",
                });
            }
        } catch (err: any) {
            setScanResult({
                success: false,
                error: "Network error. Please try again.",
            });
        }

        setProcessing(false);
    }, [processing, firebaseUID, deviceId]);

    // ===================== Cleanup =====================
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    // ===================== Format duration =====================
    const formatDuration = (minutes: number) => {
        if (!minutes) return "Just now";
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}min`;
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <a href="/" style={styles.backBtn}>←</a>
                <div style={styles.headerContent}>
                    <h1 style={styles.headerTitle}>🎫 GETPASS</h1>
                    <div style={{
                        ...styles.statusBadge,
                        background: currentStatus === "in"
                            ? "rgba(0, 255, 136, 0.15)"
                            : "rgba(255, 107, 107, 0.15)",
                        color: currentStatus === "in" ? "#00ff88" : "#ff6b6b",
                        borderColor: currentStatus === "in"
                            ? "rgba(0, 255, 136, 0.3)"
                            : "rgba(255, 107, 107, 0.3)",
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
                                ref={videoRef}
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
                                }}
                                disabled={!firebaseUID}
                            >
                                {currentStatus === "in" ? "🚶 Scan to Check OUT" : "🏠 Scan to Check IN"}
                            </button>
                            {!firebaseUID && (
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
                        <p style={styles.resultMessage}>
                            {scanResult.success ? scanResult.message : scanResult.error}
                        </p>
                        {scanResult.durationText && (
                            <div style={styles.durationBadge}>
                                ⏱️ Duration: {scanResult.durationText}
                            </div>
                        )}
                        <button
                            onClick={() => setScanResult(null)}
                            style={styles.doneButton}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* Outing History */}
            <div style={styles.historySection}>
                <h3 style={styles.historyTitle}>📋 Your Outing History</h3>

                {loadingHistory ? (
                    <p style={styles.loadingText}>Loading...</p>
                ) : outingHistory.length > 0 ? (
                    <div style={styles.historyList}>
                        {outingHistory.map((record) => (
                            <div key={record._id} style={styles.historyCard}>
                                <div style={styles.historyCardHeader}>
                                    <span style={{
                                        ...styles.historyStatusDot,
                                        background: record.status === "out" ? "#ff6b6b" : "#00ff88",
                                    }} />
                                    <span style={styles.historyDate}>{record.checkOutISTDate}</span>
                                    {record.status === "out" && (
                                        <span style={styles.liveTag}>LIVE</span>
                                    )}
                                </div>
                                <div style={styles.historyCardBody}>
                                    <div style={styles.historyTimeBlock}>
                                        <span style={styles.historyLabel}>Out</span>
                                        <span style={styles.historyTime}>{record.checkOutISTTime}</span>
                                    </div>
                                    <span style={styles.historyArrow}>→</span>
                                    <div style={styles.historyTimeBlock}>
                                        <span style={styles.historyLabel}>In</span>
                                        <span style={styles.historyTime}>
                                            {record.checkInISTTime || "---"}
                                        </span>
                                    </div>
                                    <div style={styles.historyDuration}>
                                        {record.durationMinutes !== undefined
                                            ? formatDuration(record.durationMinutes)
                                            : "Ongoing..."}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={styles.noHistory}>
                        <span style={{ fontSize: "32px" }}>📭</span>
                        <p>No outings recorded yet</p>
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
        fontFamily: "'Inter', system-ui, sans-serif",
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
        fontFamily: "monospace",
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
