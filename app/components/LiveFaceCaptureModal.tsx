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

// Global AI model warmup tracker (matching Onboarding structure)
let globalIsAIWarmedUp = false;
let warmupPromise: Promise<void> | null = null;

const loadAIModels = async () => {
    if (globalIsAIWarmedUp) return;
    if (warmupPromise) return warmupPromise;

    warmupPromise = (async () => {
        try {
            console.log("⚡ [AI LOADING] Starting SSD model load for Face Retake...");
            await faceMatching.loadFaceApiModels(true);
            globalIsAIWarmedUp = true;
            console.log("⚡ [AI LOADING] SSD models loaded successfully for Face Retake!");
        } catch (e) {
            console.error("⚡ [AI LOADING] Failed to load models:", e);
        } finally {
            warmupPromise = null;
        }
    })();
    return warmupPromise;
};

export default function LiveFaceCaptureModal({
    isOpen,
    studentId,
    firebaseUID,
    studentName,
    onSuccess
}: LiveFaceCaptureModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isConnectingCamera, setIsConnectingCamera] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [faceError, setFaceError] = useState<string | null>(null);
    const [isFaceInFrame, setIsFaceInFrame] = useState(false);

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
        setIsCameraActive(false);
        setIsConnectingCamera(false);
        setIsFaceInFrame(false);
    }, []);

    const startCamera = useCallback(async () => {
        try {
            setCameraError(null);
            setFaceError(null);
            setCapturedImage(null);
            setIsConnectingCamera(true);

            if (!navigator?.mediaDevices?.getUserMedia) {
                throw new Error("Camera access is not supported in this browser. Please open in Google Chrome or Safari.");
            }

            // Yield briefly to let React render connecting state
            await new Promise(resolve => setTimeout(resolve, 100));

            // Stop any existing stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    try { track.stop(); } catch (e) {}
                });
                streamRef.current = null;
            }

            // 1. Adaptive hardware fallback matching Student Onboarding
            let stream: MediaStream | null = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
            } catch (e) {
                // Fallback for budget phones or older mobile WebViews
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
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

            // Pre-load AI models in the background without blocking camera stream (matching Onboarding)
            loadAIModels().catch(console.error);

        } catch (err: any) {
            console.error("Camera access error:", err);
            setIsConnectingCamera(false);
            setIsCameraActive(false);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraError("Camera permission was denied. Please tap the 🔒 lock icon in your browser address bar, set Camera to 'Allow', and tap Retry.");
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                setCameraError("No camera found on this device. Please connect a webcam or use a mobile device.");
            } else {
                setCameraError(err.message || "Failed to access camera. Please check camera permissions.");
            }
        }
    }, []);

    // Start camera automatically on open
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

    // Live Face Guard with Concurrency Lock (Matching Onboarding structure)
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isCameraActive && videoRef.current && !capturedImage) {
            let isDetecting = false; // Prevent overlapping heavy AI inferences on mobile

            interval = setInterval(async () => {
                if (isDetecting) return; // Wait for current detection before starting a new one
                if (videoRef.current && videoRef.current.readyState === 4) {
                    isDetecting = true;
                    try {
                        const res = await faceMatching.detectFace(videoRef.current, false, false);
                        if (!res) {
                            setIsFaceInFrame(false);
                            return;
                        }
                        setIsFaceInFrame(true);
                    } catch (e) {
                        // ignore interval errors
                    } finally {
                        isDetecting = false; // Release lock
                    }
                }
            }, 250);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isCameraActive, capturedImage]);

    // Background Face Vector Processing (Exact Onboarding Architecture)
    const processFaceInBackground = async (dataUrl: string) => {
        try {
            setIsProcessing(true);
            setFaceError(null);

            // 1. Yield to let React render the scanning feedback state
            await new Promise(resolve => setTimeout(resolve, 100));

            // 2. Load static image into memory to bypass DOM canvas lifecycle limitations on mobile
            const img = await faceMatching.loadImage(dataUrl);

            // 3. Downscale the image while preserving aspect ratio (optimal 640px for neural net)
            const maxDim = 640;
            let aiWidth = img.width;
            let aiHeight = img.height;
            if (aiWidth > maxDim || aiHeight > maxDim) {
                if (aiWidth > aiHeight) {
                    aiHeight = Math.round((aiHeight / aiWidth) * maxDim);
                    aiWidth = maxDim;
                } else {
                    aiWidth = Math.round((aiWidth / aiHeight) * maxDim);
                    aiHeight = maxDim;
                }
            }

            const aiCanvas = document.createElement("canvas");
            aiCanvas.width = aiWidth;
            aiCanvas.height = aiHeight;
            const ctx = aiCanvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0, aiWidth, aiHeight);
            } else {
                throw new Error("Could not initialize canvas for face scanning");
            }

            // Ensure SSD models are loaded
            await loadAIModels();
            await new Promise(resolve => setTimeout(resolve, 100)); // Yield to event loop

            // 🛡️ 1. Photo Quality & Screen Recapture Check
            const quality = faceMatching.assessPhotoQuality(aiCanvas);
            if (quality.isPhotoOfPhoto) {
                setFaceError(quality.reason || "Photo of a screen or reprint detected. Please take a live direct selfie.");
                setIsProcessing(false);
                return;
            }

            // 🛡️ 2. Multi-tier SSD Face Vector Extraction
            let descriptor = await faceMatching.detectFace(aiCanvas, true, true);
            if (!descriptor || !descriptor.descriptor) {
                descriptor = await faceMatching.detectFace(img, true, true);
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // Yield to event loop

            if (!descriptor || !descriptor.descriptor) {
                if (quality.isBlurry) {
                    setFaceError(quality.reason || `Photo too blurry (Sharpness: ${quality.sharpnessScore}%). Please hold steady in good lighting.`);
                } else {
                    setFaceError("No clear face detected. Please ensure your face is well lit and look directly at the camera.");
                }
                setIsProcessing(false);
                return;
            }

            if (descriptor.multipleFacesDetected) {
                setFaceError("Multiple faces detected! Please ensure ONLY YOU are in the frame.");
                setIsProcessing(false);
                return;
            }

            // 🛡️ 3. Anti-Spoof Screen Verification
            if (descriptor.detection?.box) {
                const spoofCheck = faceMatching.detectMobileScreenDisplay(aiCanvas, descriptor.detection.box);
                if (spoofCheck.isSpoof) {
                    setFaceError(spoofCheck.reason || "Mobile screen spoof detected. Please present your real physical face.");
                    setIsProcessing(false);
                    return;
                }
            }

            if (!descriptor.descriptor || descriptor.descriptor.length !== 128) {
                setFaceError("Failed to extract full 128-D biometric vector. Please retake photo.");
                setIsProcessing(false);
                return;
            }

            const descriptorArray = Array.from(descriptor.descriptor);

            // 4. Save to server
            setIsSaving(true);
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

            // Instant unlock & notify parent
            setTimeout(() => {
                onSuccess(data.student);
            }, 600);

        } catch (err: any) {
            console.error("Capture & Save error:", err);
            setFaceError(err.message || "Failed to process face. Please try again.");
        } finally {
            setIsProcessing(false);
            setIsSaving(false);
        }
    };

    // Instant Photo Capture (5ms reaction time matching Onboarding)
    const handleCapture = async () => {
        if (!videoRef.current || isProcessing || isSaving) return;

        const video = videoRef.current;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (context) {
            context.drawImage(video, 0, 0, width, height);

            // 1. Instant snapshot
            const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
            setCapturedImage(dataUrl);
            setFaceError(null);
            stopCamera();

            // 2. Process face descriptor in the background without freezing mobile UI
            processFaceInBackground(dataUrl);
        }
    };

    const handleRetry = () => {
        setCapturedImage(null);
        setFaceError(null);
        startCamera();
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
                                        className="w-full h-full object-cover scale-x-[-1]"
                                    />

                                    {/* Loading / Connecting Overlay */}
                                    {(!isCameraActive || isConnectingCamera) && (
                                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-10">
                                            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider animate-pulse">
                                                Starting AI Camera...
                                            </p>
                                        </div>
                                    )}

                                    {/* Live Face Guard Guide Box */}
                                    {isCameraActive && (
                                        <div className={`absolute inset-4 pointer-events-none border-2 rounded-2xl transition-all duration-300 flex items-center justify-center ${
                                            isFaceInFrame 
                                                ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.4)]" 
                                                : "border-dashed border-white/30"
                                        }`}>
                                            <div className="absolute top-2.5">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow flex items-center gap-1.5 ${
                                                    isFaceInFrame 
                                                        ? "bg-emerald-600 text-white" 
                                                        : "bg-slate-900/80 text-white/80"
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isFaceInFrame ? "bg-white animate-ping" : "bg-amber-400"}`} />
                                                    {isFaceInFrame ? "Face Aligned & Ready" : "Position Face in Frame"}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="relative w-full h-full">
                                    <img
                                        src={capturedImage}
                                        alt="Captured Selfie"
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Processing Overlay */}
                                    {isProcessing && (
                                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 z-20">
                                            <div className="w-9 h-9 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">
                                                Extracting 128-D Biometric Vector...
                                            </p>
                                        </div>
                                    )}

                                    {/* Saving State Overlay */}
                                    {isSaving && (
                                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 z-20">
                                            <div className="w-9 h-9 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">
                                                Saving Profile & Unlocking...
                                            </p>
                                        </div>
                                    )}

                                    {/* Success Badge */}
                                    {!isProcessing && !isSaving && !faceError && (
                                        <>
                                            <div className="absolute top-3 right-3">
                                                <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow">
                                                    ✓ 128-D Vector Ready
                                                </span>
                                            </div>
                                            <div className="absolute bottom-3 inset-x-3 bg-emerald-950/90 backdrop-blur-md border border-emerald-400/40 rounded-xl p-2.5 text-center">
                                                <p className="text-xs font-black text-emerald-300 uppercase tracking-wider animate-pulse">
                                                    🎉 Face Verified! Unlocking Dashboard...
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Face Processing Error Feedback */}
                    {faceError && (
                        <div className="w-full max-w-[380px] p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
                            <p className="text-xs text-rose-700 font-bold uppercase">⚠️ {faceError}</p>
                            <button
                                onClick={handleRetry}
                                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-rose-700 transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                🔄 Retake Photo
                            </button>
                        </div>
                    )}

                    {/* Requirements Checklist */}
                    <div className="w-full max-w-[380px] bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-around text-[10px] font-bold text-slate-600">
                        <span className="flex items-center gap-1">
                            <span className="text-emerald-500 font-black">✓</span> Plain Background
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-emerald-500 font-black">✓</span> Good Lighting
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-emerald-500 font-black">✓</span> Single Face
                        </span>
                    </div>

                    {/* Action Button */}
                    <div className="w-full max-w-[380px] pt-1">
                        {!capturedImage ? (
                            <button
                                onClick={handleCapture}
                                disabled={!isCameraActive || isConnectingCamera}
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Capture Live Selfie</span>
                            </button>
                        ) : faceError ? (
                            <button
                                onClick={handleRetry}
                                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                🔄 Tap to Retake
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
