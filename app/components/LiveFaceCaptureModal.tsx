"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as faceMatching from "@/lib/faceMatching";
import { showToast } from "@/lib/toast";

interface LiveFaceCaptureModalProps {
    isOpen: boolean;
    studentId: string;
    firebaseUID?: string;
    studentName: string;
    onSuccess: (updatedStudent: any) => void;
}

export default function LiveFaceCaptureModal({
    isOpen,
    studentId,
    firebaseUID,
    studentName,
    onSuccess
}: LiveFaceCaptureModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const qualityIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isConnectingCamera, setIsConnectingCamera] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [extractedDescriptor, setExtractedDescriptor] = useState<number[] | null>(null);

    // Live Quality Status: 'good' | 'cluttered_bg' | 'low_light' | 'no_face'
    const [qualityStatus, setQualityStatus] = useState<"good" | "cluttered_bg" | "low_light" | "no_face">("no_face");
    const [qualityMessage, setQualityMessage] = useState<string>("Align your face inside the oval frame");

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {}
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if (qualityIntervalRef.current) {
            clearInterval(qualityIntervalRef.current);
            qualityIntervalRef.current = null;
        }
        setIsCameraActive(false);
        setIsConnectingCamera(false);
    }, []);

    const startCamera = useCallback(async () => {
        try {
            setCameraError(null);
            setCapturedImage(null);
            setExtractedDescriptor(null);
            setIsConnectingCamera(true);

            // Pre-load SSD (accurate) AI models in the background (NON-BLOCKING)
            // ⚠️ Must pre-load SSD specifically — we always use SSD for descriptor extraction
            faceMatching.loadFaceApiModels(true).catch(e => console.warn("Background SSD model load:", e));

            // Stop any existing stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    try { track.stop(); } catch (e) {}
                });
                streamRef.current = null;
            }

            if (!navigator?.mediaDevices?.getUserMedia) {
                throw new Error("Camera is not supported on this browser or connection is not secure (HTTPS/localhost required).");
            }

            // Attempt user-facing front camera first, fallback to generic video if overconstrained
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    },
                    audio: false
                });
            } catch (firstErr) {
                console.warn("Front camera constraint failed, falling back to default camera:", firstErr);
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.muted = true;
                videoRef.current.setAttribute("playsinline", "true");
                videoRef.current.setAttribute("autoplay", "true");
                
                try {
                    await videoRef.current.play();
                } catch (playErr) {
                    console.warn("Video play error:", playErr);
                }
                setIsCameraActive(true);
            }
            setIsConnectingCamera(false);
        } catch (err: any) {
            console.error("Camera access error:", err);
            setIsConnectingCamera(false);
            setIsCameraActive(false);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraError("Camera permission was denied. Please click the camera icon in your browser URL bar and allow access, then click Retry.");
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                setCameraError("No camera found on this device. Please connect a webcam or use a mobile device.");
            } else {
                setCameraError(err.message || "Failed to access camera. Please check camera permissions.");
            }
        }
    }, []);

    // Start camera immediately on mount / open
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            return;
        }

        startCamera();

        // Background & lighting validator loop every 500ms
        qualityIntervalRef.current = setInterval(() => {
            if (!videoRef.current || capturedImage) return;

            const video = videoRef.current;
            if (!video.videoWidth || !video.videoHeight || video.paused || video.ended) return;

            try {
                const canvas = document.createElement("canvas");
                canvas.width = 160;
                canvas.height = 120;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (!ctx) return;

                ctx.drawImage(video, 0, 0, 160, 120);
                const imgData = ctx.getImageData(0, 0, 160, 120);
                const data = imgData.data;

                // 1. Calculate overall brightness
                let totalBrightness = 0;
                for (let i = 0; i < data.length; i += 16) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
                }
                const avgBrightness = totalBrightness / (data.length / 16);

                // 2. Check background corner variance
                const cornerPixels: number[] = [];
                const sampleArea = 20;
                for (let y = 0; y < sampleArea; y++) {
                    for (let x = 0; x < sampleArea; x++) {
                        const idx1 = (y * 160 + x) * 4;
                        const idx2 = (y * 160 + (160 - sampleArea + x)) * 4;
                        cornerPixels.push((data[idx1] + data[idx1 + 1] + data[idx1 + 2]) / 3);
                        cornerPixels.push((data[idx2] + data[idx2 + 1] + data[idx2 + 2]) / 3);
                    }
                }

                const mean = cornerPixels.reduce((a, b) => a + b, 0) / cornerPixels.length;
                const variance = cornerPixels.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / cornerPixels.length;
                const stdDev = Math.sqrt(variance);

                if (avgBrightness < 45) {
                    setQualityStatus("low_light");
                    setQualityMessage("⚠️ Low lighting. Please face a light source");
                } else if (stdDev > 52) {
                    setQualityStatus("cluttered_bg");
                    setQualityMessage("⚠️ Background is cluttered. Stand in front of a plain wall");
                } else {
                    setQualityStatus("good");
                    setQualityMessage("✅ Great! Plain background & good lighting");
                }
            } catch (e) {}
        }, 500);

        return () => {
            stopCamera();
        };
    }, [isOpen, startCamera, stopCamera, capturedImage]);

    // Attach stream whenever videoRef becomes ready
    useEffect(() => {
        if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().then(() => {
                setIsCameraActive(true);
            }).catch(() => {});
        }
    }, [isCameraActive, isConnectingCamera]);

    const handleCapture = async () => {
        if (!videoRef.current || isProcessing || isSaving) return;
        try {
            setIsProcessing(true);
            const video = videoRef.current;
            const width = video.videoWidth || 640;
            const height = video.videoHeight || 480;

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) throw new Error("Could not initialize canvas");

            // Draw current live frame
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

            // Ensure SSD face-api models are ready (must be SSD — not TinyFace)
            await faceMatching.loadFaceApiModels(true);

            // Create downscaled AI canvas for instant <250ms vector extraction
            const aiCanvas = document.createElement("canvas");
            const maxDim = 320;
            let aiW = width;
            let aiH = height;
            if (aiW > maxDim || aiH > maxDim) {
                if (aiW > aiH) { aiH = Math.round((aiH * maxDim) / aiW); aiW = maxDim; }
                else { aiW = Math.round((aiW * maxDim) / aiH); aiH = maxDim; }
            }
            aiCanvas.width = aiW;
            aiCanvas.height = aiH;
            const aiCtx = aiCanvas.getContext("2d");
            if (aiCtx) aiCtx.drawImage(video, 0, 0, aiW, aiH);

            // Run real-time face detection & embedding extraction using SSD-MobileNet
            // ⚠️ MUST use accurate=true (SSD) here — the server also uses SSD at attendance time.
            // Using TinyFaceDetector here would produce incompatible vectors that never match.
            let res = await faceMatching.detectFace(aiCtx ? aiCanvas : canvas, true, true);
            if (!res || !res.descriptor) {
                // Retry with full-res canvas in case downscaled was too small for SSD
                res = await faceMatching.detectFace(canvas, true, true);
            }

            if (!res || !res.descriptor) {
                showToast("No clear face detected! Please look straight at the camera.", "warning");
                setIsProcessing(false);
                return;
            }

            if (res.multipleFacesDetected) {
                showToast("Multiple faces detected! Only you should be in the frame.", "warning");
                setIsProcessing(false);
                return;
            }

            const descriptorArray = Array.from(res.descriptor);
            setCapturedImage(dataUrl);
            setExtractedDescriptor(descriptorArray);
            setIsSaving(true);
            stopCamera();

            // Auto-save to server immediately
            const saveRes = await fetch("/api/student/retake-photo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId,
                    firebaseUID,
                    profilePicture: dataUrl,
                    faceDescriptor: descriptorArray
                })
            });

            const data = await saveRes.json();

            if (!saveRes.ok || !data.success) {
                throw new Error(data.error || "Failed to save photo to server");
            }

            showToast("🎉 Face verification successful! Profile updated.", "success");

            // Instant redirect to student dashboard
            setTimeout(() => {
                onSuccess(data.student);
            }, 600);

        } catch (err: any) {
            console.error("Capture & Save error:", err);
            showToast(err.message || "Failed to process face. Please try again.", "error");
            setCapturedImage(null);
            setExtractedDescriptor(null);
            startCamera();
        } finally {
            setIsProcessing(false);
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-white/20 flex flex-col">
                
                {/* Header */}
                <div className="p-5 pb-3 text-center bg-gradient-to-b from-indigo-50/80 to-white border-b border-slate-100">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                        Hostel Face Verification
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Hello <span className="text-indigo-600 font-bold">{studentName}</span>, please take a live selfie with a plain background to enable instant camera attendance.
                    </p>
                </div>

                {/* Body / Camera Frame */}
                <div className="p-5 flex flex-col items-center gap-4">
                    {cameraError ? (
                        <div className="w-full py-10 px-4 bg-rose-50 border-2 border-rose-100 rounded-2xl text-center space-y-3">
                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <p className="text-xs font-bold text-rose-800">{cameraError}</p>
                            <button
                                onClick={startCamera}
                                className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-rose-700 transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                                🔄 Grant Permission & Retry
                            </button>
                        </div>
                    ) : (
                        <div className="relative w-full aspect-[4/3] max-w-[380px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner border-2 border-slate-200 flex items-center justify-center">
                            {!capturedImage ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        onLoadedMetadata={() => {
                                            videoRef.current?.play().catch(() => {});
                                            setIsCameraActive(true);
                                        }}
                                        onCanPlay={() => {
                                            setIsCameraActive(true);
                                        }}
                                        className="w-full h-full object-cover scale-x-[-1]"
                                    />

                                    {/* Loading / Connecting Overlay */}
                                    {(!isCameraActive || isConnectingCamera) && (
                                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-10">
                                            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider animate-pulse">
                                                Connecting to Camera...
                                            </p>
                                            <button
                                                onClick={startCamera}
                                                className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
                                            >
                                                Click to Start Camera
                                            </button>
                                        </div>
                                    )}

                                    {/* Oval Face Guide Overlay */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div
                                            className={`w-[62%] h-[78%] rounded-[50%] border-4 transition-all duration-300 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] ${
                                                qualityStatus === "good"
                                                    ? "border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]"
                                                    : qualityStatus === "cluttered_bg" || qualityStatus === "low_light"
                                                    ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                                                    : "border-white/80"
                                            }`}
                                        />
                                    </div>

                                    {/* Live Quality Indicator Badge */}
                                    <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none">
                                        <span
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg transition-all ${
                                                qualityStatus === "good"
                                                    ? "bg-emerald-600/90 text-white border border-emerald-400/50"
                                                    : qualityStatus === "cluttered_bg" || qualityStatus === "low_light"
                                                    ? "bg-amber-600/90 text-white border border-amber-400/50"
                                                    : "bg-slate-900/80 text-white/90 border border-white/20"
                                            }`}
                                        >
                                            {qualityMessage}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="relative w-full h-full">
                                    <img
                                        src={capturedImage}
                                        alt="Captured Selfie"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-3 right-3">
                                        <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow">
                                            ✓ 128-D Vector Extracted
                                        </span>
                                    </div>
                                    <div className="absolute bottom-3 inset-x-3 bg-emerald-950/90 backdrop-blur-md border border-emerald-400/40 rounded-xl p-2.5 text-center">
                                        <p className="text-xs font-black text-emerald-300 uppercase tracking-wider animate-pulse">
                                            🎉 Saved! Unlocking Dashboard...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {(isProcessing || isSaving) && !capturedImage && (
                                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 z-20">
                                    <div className="w-9 h-9 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">
                                        {isSaving ? "Saving Vector & Unlocking..." : "Extracting 128-D Face Vector..."}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Requirements Checklist */}
                    <div className="w-full max-w-[380px] bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-around text-[10px] font-bold text-slate-600">
                        <span className="flex items-center gap-1">
                            <span className="text-emerald-500">✓</span> Plain Wall
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-emerald-500">✓</span> Good Light
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-emerald-500">✓</span> Single Face
                        </span>
                    </div>

                    {/* Action Button */}
                    <div className="w-full max-w-[380px] pt-1">
                        <button
                            onClick={handleCapture}
                            disabled={!isCameraActive || isProcessing || isSaving || !!capturedImage}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {isSaving ? (
                                <span className="animate-pulse">Saving to Server & Unlocking...</span>
                            ) : isProcessing ? (
                                <span className="animate-pulse">Extracting Face Vector...</span>
                            ) : capturedImage ? (
                                <span>✓ Verification Complete</span>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Capture Live Selfie</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
