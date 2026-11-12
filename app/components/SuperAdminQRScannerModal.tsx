"use client";

import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { X, Camera, CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { showToast } from "@/lib/toast";

interface SuperAdminQRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function SuperAdminQRScannerModal({
    isOpen,
    onClose,
    onSuccess
}: SuperAdminQRScannerModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<any>(null);

    const [isScanning, setIsScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [isApproved, setIsApproved] = useState(false);

    // Audio chime on successful desktop authorization
    const playSuccessChime = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                gain.gain.setValueAtTime(0.15, now + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.28);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.3);
            });
        } catch (_) {}
    };

    const stopCamera = () => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsScanning(false);
    };

    const startCamera = async () => {
        setCameraError(null);
        setIsApproved(false);
        setIsApproving(false);

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera access is not supported by your browser.");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setIsScanning(true);

                // Start scan loop
                scanIntervalRef.current = setInterval(captureFrameAndScan, 120);
            }
        } catch (err: any) {
            console.error("Camera access error:", err);
            setCameraError(err.message || "Failed to access camera. Please allow camera permissions.");
        }
    };

    const captureFrameAndScan = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2 || video.paused || video.ended) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });

        if (code && code.data) {
            handleScannedData(code.data);
        }
    };

    const handleScannedData = async (rawData: string) => {
        try {
            let parsed: any;
            try {
                parsed = JSON.parse(rawData);
            } catch {
                return; // Not a JSON QR code
            }

            if (parsed.app !== "hosteleaze-superadmin-qr" || !parsed.challengeId || !parsed.token) {
                return; // Ignore other QR codes
            }

            // Stop scanning once detected
            stopCamera();
            setIsApproving(true);

            // Send approval to backend
            const res = await fetch("/api/super-admin/auth/qr-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "approve",
                    challengeId: parsed.challengeId,
                    token: parsed.token
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Approval failed.");
            }

            // Approved!
            setIsApproving(false);
            setIsApproved(true);
            playSuccessChime();
            showToast("Desktop Login Approved! Computer is now logging in.", "success");

            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1800);

        } catch (err: any) {
            console.error("QR Approval error:", err);
            showToast(err.message || "Failed to approve desktop login.", "error");
            setIsApproving(false);
            // Restart camera after error
            startCamera();
        }
    };

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-gradient-to-br from-[#0c1322] to-[#070b12] border border-blue-500/30 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center">
                
                {/* Header */}
                <div className="w-full px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                            <Camera className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                Scan Desktop Login QR
                            </h3>
                            <p className="text-[9px] text-gray-400">
                                Point camera at the QR code on your computer screen
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Camera Viewfinder Area */}
                <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${isApproved ? "opacity-20 blur-sm" : ""}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Reticle / Target Box */}
                    {isScanning && !isApproving && !isApproved && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="relative w-56 h-56 border-2 border-dashed border-blue-400/80 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center">
                                {/* Corner Accents */}
                                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400" />
                                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400" />
                                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400" />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400" />

                                {/* Moving Laser Scanline */}
                                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#38bdf8] animate-pulse" />
                            </div>
                        </div>
                    )}

                    {/* Camera Loading / Error */}
                    {cameraError && (
                        <div className="absolute inset-0 p-4 bg-slate-950/90 flex flex-col items-center justify-center text-center gap-2">
                            <AlertTriangle className="w-8 h-8 text-amber-400" />
                            <p className="text-xs font-bold text-red-300 max-w-[240px]">{cameraError}</p>
                            <button
                                onClick={startCamera}
                                className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
                            >
                                Retry Camera
                            </button>
                        </div>
                    )}

                    {/* Approving in progress */}
                    {isApproving && (
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                            <p className="text-xs font-black text-white uppercase tracking-wider">
                                Authorizing Desktop Login...
                            </p>
                        </div>
                    )}

                    {/* Approved Success Splash */}
                    {isApproved && (
                        <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-2.5 animate-in zoom-in-95 duration-200">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(52,211,153,0.5)]">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h4 className="text-sm font-black text-white uppercase tracking-wider">
                                Login Approved!
                            </h4>
                            <p className="text-[10px] text-emerald-300 font-medium text-center px-4">
                                Computer is now opening Super Admin Dashboard
                            </p>
                        </div>
                    )}
                </div>

                {/* Bottom Instruction */}
                <div className="w-full p-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
                    <span className="flex items-center gap-1.5 font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Instant Zero-SMS Verification
                    </span>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white font-bold cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
