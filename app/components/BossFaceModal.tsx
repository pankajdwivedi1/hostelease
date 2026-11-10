"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, X, Loader2, ShieldCheck, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface BossFaceModalProps {
    isOpen: boolean;
    mode: "login" | "enroll";
    onClose: () => void;
    onSuccess: () => void;
}

export default function BossFaceModal({ isOpen, mode, onClose, onSuccess }: BossFaceModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>("Align your face in the center...");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [holdProgress, setHoldProgress] = useState(0);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    }, []);

    const startCamera = useCallback(async () => {
        setIsConnecting(true);
        setCameraError(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        setHoldProgress(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try {
                    await videoRef.current.play();
                } catch (playErr) {
                    console.warn("Video play error:", playErr);
                }
                setIsCameraActive(true);
            }
            setIsConnecting(false);

            // Preload models in background
            const { loadFaceApiModels } = await import("@/lib/faceMatching");
            loadFaceApiModels(true).catch(console.error);

        } catch (err: any) {
            console.error("Boss camera error:", err);
            setIsConnecting(false);
            setIsCameraActive(false);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraError("Camera permission denied. Please allow camera in browser address bar.");
            } else if (err.name === "NotFoundError") {
                setCameraError("No camera found on this device.");
            } else {
                setCameraError(err.message || "Failed to start camera.");
            }
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            return;
        }
        startCamera();
        return () => {
            stopCamera();
        };
    }, [isOpen, startCamera, stopCamera]);

    const captureAndVerify = async () => {
        if (!videoRef.current || isProcessing) return;
        setIsProcessing(true);
        setErrorMessage(null);
        setStatusMessage("📸 Analyzing face & biometric vector...");

        try {
            const video = videoRef.current;
            const faceMatching = await import("@/lib/faceMatching");

            // 1. Draw frame to 520px neural net canvas
            const maxDim = 520;
            let vw = video.videoWidth || 640;
            let vh = video.videoHeight || 480;
            let cw = vw;
            let ch = vh;
            if (cw > maxDim || ch > maxDim) {
                if (cw > ch) {
                    ch = Math.round((ch / cw) * maxDim);
                    cw = maxDim;
                } else {
                    cw = Math.round((cw / ch) * maxDim);
                    ch = maxDim;
                }
            }

            const aiCanvas = document.createElement("canvas");
            aiCanvas.width = cw;
            aiCanvas.height = ch;
            const ctx = aiCanvas.getContext("2d");
            ctx?.drawImage(video, 0, 0, cw, ch);

            // 2. Detect face
            await faceMatching.loadFaceApiModels(true);
            const res = await faceMatching.detectFace(aiCanvas, true, true);

            if (!res || !res.descriptor) {
                setErrorMessage("No clear face detected! Please face the camera directly.");
                setIsProcessing(false);
                return;
            }

            // 3. Strict Background Lighting Check (Reject dark rooms)
            if (res.detection?.box) {
                const bgCheck = faceMatching.assessBackgroundLighting(aiCanvas, res.detection.box);
                if (bgCheck.isDarkBackground) {
                    setErrorMessage(bgCheck.reason || "Dark room or black background detected. Please turn on lights.");
                    setIsProcessing(false);
                    return;
                }
            }

            // 4. Sharpness Check
            const quality = faceMatching.assessPhotoQuality(aiCanvas);
            if (quality.isPhotoOfPhoto) {
                setErrorMessage("Phone screen or printed photo detected! Please present your live face.");
                setIsProcessing(false);
                return;
            }

            const dataUrl = aiCanvas.toDataURL("image/jpeg", 0.90);
            setStatusMessage("🛡️ Verifying physical liveness...");

            if (mode === "login") {
                // VERIFY LOGIN
                const response = await fetch("/api/super-admin/auth/face", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        image: dataUrl,
                        descriptor: Array.from(res.descriptor),
                        box: res.detection?.box ? {
                            x: res.detection.box.x,
                            y: res.detection.box.y,
                            width: res.detection.box.width,
                            height: res.detection.box.height,
                            canvasWidth: cw,
                            canvasHeight: ch
                        } : undefined
                    })
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    setErrorMessage(result.error || "Biometric authentication failed.");
                    setIsProcessing(false);
                    return;
                }

                setSuccessMessage("✅ Welcome, Boss! Biometrics Verified.");
                setTimeout(() => {
                    stopCamera();
                    onSuccess();
                }, 800);

            } else {
                // ENROLL FACE
                const response = await fetch("/api/super-admin/auth/enroll-face", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        descriptor: Array.from(res.descriptor),
                        photoUrl: dataUrl
                    })
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    setErrorMessage(result.error || "Failed to enroll Face ID.");
                    setIsProcessing(false);
                    return;
                }

                setSuccessMessage("✅ Boss Face ID Enrolled Successfully!");
                setTimeout(() => {
                    stopCamera();
                    onSuccess();
                }, 1000);
            }

        } catch (err: any) {
            console.error("Biometric execution error:", err);
            setErrorMessage(err.message || "Face scanning error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#0a0a16] border border-blue-500/30 rounded-3xl p-6 shadow-2xl shadow-blue-500/20 text-center relative overflow-hidden">
                {/* Close Button */}
                <button
                    onClick={() => {
                        stopCamera();
                        onClose();
                    }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mx-auto mb-2 text-blue-400">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-white tracking-tight uppercase">
                        {mode === "login" ? "Boss Biometric Unlock" : "Enroll Boss Face ID"}
                    </h3>
                    <p className="text-xs text-blue-300/80 font-bold tracking-wide">
                        {mode === "login"
                            ? "Universal Access • Any Authorized Device"
                            : "Registers Dr. Pankaj Dwivedi's 128-D Biometric Vector"}
                    </p>
                </div>

                {/* Camera Viewport */}
                <div className="relative w-64 h-64 mx-auto rounded-3xl overflow-hidden border-2 border-blue-500/40 bg-black/60 shadow-inner flex items-center justify-center mb-4">
                    {isConnecting && (
                        <div className="flex flex-col items-center gap-2 text-blue-400">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <span className="text-xs font-bold">Connecting camera...</span>
                        </div>
                    )}

                    {cameraError ? (
                        <div className="p-4 text-red-400 flex flex-col items-center gap-2">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-xs font-bold leading-relaxed">{cameraError}</p>
                            <button
                                onClick={startCamera}
                                className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-bold border border-red-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                            </button>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                            className="w-full h-full object-cover scale-x-[-1]"
                        />
                    )}

                    {/* Biometric Scanning Ring & Oval */}
                    {isCameraActive && !cameraError && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className={`w-44 h-56 rounded-full border-2 border-dashed transition-all duration-300 ${isProcessing ? "border-emerald-400 animate-pulse" : "border-blue-400/60"}`}></div>
                        </div>
                    )}

                    {/* Processing Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4">
                            <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-2" />
                            <p className="text-xs font-black tracking-wide">{statusMessage}</p>
                        </div>
                    )}
                </div>

                {/* Alerts / Error feedback */}
                {errorMessage && (
                    <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2 text-left">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 text-left">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Action Button */}
                <button
                    onClick={captureAndVerify}
                    disabled={!isCameraActive || isProcessing || !!cameraError}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-blue-600/30 uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                    <Camera className="w-4 h-4" />
                    <span>{mode === "login" ? "Scan Face to Unlock" : "Capture & Save Face ID"}</span>
                </button>
            </div>
        </div>
    );
}
