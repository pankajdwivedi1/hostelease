"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Video, Square, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle, ShieldCheck, Play, Pause } from "lucide-react";

const CONSENT_MIME_TYPES = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
];

function pickConsentMimeType(): { mimeType: string; fileExt: string } {
    for (const mimeType of CONSENT_MIME_TYPES) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return {
                mimeType,
                fileExt: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
            };
        }
    }
    return { mimeType: "video/webm", fileExt: "webm" };
}

function isMobileDevice(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(max-width: 767px)").matches ||
        /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
    );
}

function getCameraConstraints(isMobile: boolean): MediaStreamConstraints {
    if (isMobile) {
        return {
            video: {
                facingMode: "user",
                width: { ideal: 720 },
                height: { ideal: 1280 },
                aspectRatio: { ideal: 9 / 16 },
                frameRate: { ideal: 24 },
            },
            audio: true,
        };
    }

    return {
        video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 },
        },
        audio: true,
    };
}

interface ParentConsentClientProps {
    leaveId: string;
    studentName: string;
    parentName: string;
    startDate: string;
    endDate: string;
    parentConsentUrl?: string | null;
}

export default function ParentConsentClient({
    leaveId,
    studentName,
    parentName,
    startDate,
    endDate,
    parentConsentUrl
}: ParentConsentClientProps) {
    const [recordingState, setRecordingState] = useState<"idle" | "recording" | "review" | "uploading" | "success" | "error">(
        parentConsentUrl ? "success" : "idle"
    );
    const [countdown, setCountdown] = useState(24);
    const [errorMessage, setErrorMessage] = useState("");
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [previewAspectRatio, setPreviewAspectRatio] = useState<number | null>(null);
    const [reviewAspectRatio, setReviewAspectRatio] = useState<number | null>(null);

    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const videoPlaybackRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up streams on unmount
    useEffect(() => {
        setIsMobile(isMobileDevice());
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [stream]);

    // Sync the stream with the video element whenever stream or recordingState changes
    useEffect(() => {
        if (videoPreviewRef.current && stream && (recordingState === "idle" || recordingState === "recording")) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.play().catch(err => {
                console.warn("Failed to autoplay video preview:", err);
            });
        }
    }, [stream, recordingState]);

    // Request camera permission and start preview
    const startCamera = async (): Promise<MediaStream | null> => {
        try {
            setErrorMessage("");
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            // Portrait on mobile, landscape on desktop — avoids black side bars
            const mediaStream = await navigator.mediaDevices.getUserMedia(
                getCameraConstraints(isMobileDevice())
            );

            setStream(mediaStream);
            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = mediaStream;
            }

            const videoTrack = mediaStream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                if (settings.width && settings.height) {
                    setPreviewAspectRatio(settings.width / settings.height);
                } else {
                    setPreviewAspectRatio(null);
                }
            }

            setReviewAspectRatio(null);
            setRecordingState("idle");
            return mediaStream;
        } catch (err: any) {
            console.error("Camera access failed:", err);
            setErrorMessage("असुविधा के लिए खेद है। कैमरा और माइक्रोफ़ोन एक्सेस की अनुमति नहीं मिली। कृपया अपने ब्राउज़र सेटिंग्स में कैमरा अनुमति की जांच करें। (Camera or Microphone permission denied. Please allow camera access in browser settings.)");
            setRecordingState("error");
            return null;
        }
    };

    // Trigger start camera logic handled via user action to avoid mount lag
    useEffect(() => {
        // Camera will be set up when user taps button
    }, []);

    // Start video recording
    const startRecording = (activeStream?: MediaStream) => {
        const currentStream = activeStream || stream;
        if (!currentStream) return;

        chunksRef.current = [];
        const { mimeType: selectedMimeType } = pickConsentMimeType();

        try {
            const mediaRecorder = new MediaRecorder(currentStream, {
                mimeType: selectedMimeType,
                videoBitsPerSecond: 300000, // 300 kbps (low bitrate, clear enough for consent)
                audioBitsPerSecond: 64000   // 64 kbps (clear mono audio)
            });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: selectedMimeType });
                const url = URL.createObjectURL(blob);
                setVideoUrl(url);
                setRecordingState("review");
                
                // Stop camera preview so camera indicator turns off
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    setStream(null);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(100); // chunk every 100ms
            setRecordingState("recording");
            setCountdown(24); // Start countdown at 24s

            // Start countdown
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        stopRecording();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (err: any) {
            console.error("Recorder initialization failed:", err);
            setErrorMessage("वीडियो रिकॉर्डर शुरू करने में विफल। (Failed to initialize video recorder.)");
            setRecordingState("error");
        }
    };

    // Auto-recording helper on click
    const handleStartClick = async () => {
        const mediaStream = await startCamera();
        if (mediaStream) {
            // Tiny timeout to warm up the camera hardware
            setTimeout(() => {
                startRecording(mediaStream);
            }, 300);
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    };

    // Retry recording
    const handleRetry = async () => {
        setVideoUrl(null);
        setReviewAspectRatio(null);
        setPreviewAspectRatio(null);
        await startCamera();
    };

    // Upload video file to server
    const handleUpload = async () => {
        if (chunksRef.current.length === 0) return;

        setRecordingState("uploading");
        setErrorMessage("");

        try {
            const { mimeType, fileExt } = pickConsentMimeType();

            const videoBlob = new Blob(chunksRef.current, { type: mimeType });
            const videoFile = new File([videoBlob], `consent_${leaveId}.${fileExt}`, { type: mimeType });

            const formData = new FormData();
            formData.append("leaveId", leaveId);
            formData.append("video", videoFile);

            console.log("Uploading file of size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");

            const response = await fetch("/api/parent-consent/upload", {
                method: "POST",
                body: formData
            });

            let data: any = {};
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                try {
                    data = await response.json();
                } catch (jsonErr) {
                    console.error("JSON parsing failed:", jsonErr);
                }
            }

            if (!response.ok) {
                if (response.status === 413) {
                    throw new Error("वीडियो का आकार बहुत बड़ा है। कृपया छोटा वीडियो रिकॉर्ड करें। (Video is too large to upload. Please record a shorter video.)");
                }
                throw new Error(data.error || "Failed to upload video to Google Drive");
            }

            setRecordingState("success");
        } catch (err: any) {
            console.error("Upload failed:", err);
            setErrorMessage(err.message || "वीडियो अपलोड करने में विफल रहा। कृपया पुनः प्रयास करें। (Video upload failed. Please try again.)");
            setRecordingState("review");
        }
    };

    // Close window / browser tab handler
    const handleCloseWindow = () => {
        if (typeof window !== "undefined") {
            window.close();
            // Fallback in case window.close() is blocked by browser security rules
            alert("सहमति सुरक्षित रूप से स्वीकृत हो चुकी है। अब आप इस ब्राउज़र टैब को बंद कर सकते हैं। (Consent submitted successfully. You can now close this tab/browser.)");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
            
            {/* Header branding */}
            <div className="text-center mb-6 max-w-lg w-full">
                <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-indigo-400 text-xs font-black uppercase tracking-wider mb-3">
                    <ShieldCheck className="w-3.5 h-3.5" /> Secure Parent Consent Portal
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white leading-tight">
                    Hostel Outing Approval
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                    अभिभावक वीडियो सहमति सत्यापन पोर्टल
                </p>
            </div>

            {/* Main card */}
            <div className="bg-slate-950/40 backdrop-blur-md border border-slate-800/80 w-full max-w-xl rounded-3xl p-5 md:p-6 shadow-2xl space-y-6">

                {recordingState === "success" ? (
                    <div className="text-center py-10 space-y-6 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-md">
                            <CheckCircle2 className="w-10 h-10 animate-bounce" />
                        </div>
                        <div className="space-y-3 w-full">
                            <h2 className="text-[13px] min-[375px]:text-[15px] sm:text-lg md:text-xl font-black text-white whitespace-nowrap tracking-tight">
                                सहमति स्वीकृत! (Consent Submitted!)
                            </h2>
                            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed px-2 text-justify min-[480px]:text-center">
                                आपका सहमति वीडियो सुरक्षित रूप से दर्ज कर लिया गया है। हॉस्टल वार्डन को सत्यापन के लिए सूचित कर दिया गया है और आपकी अवकाश अनुमति जल्द ही स्वीकृत कर दी जाएगी। धन्यवाद।
                            </p>
                            <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed px-4">
                                (Your consent video has been securely uploaded. The hostel warden has been notified for verification and your leave request will be processed shortly.)
                            </p>
                        </div>
                        <button
                            onClick={handleCloseWindow}
                            className="w-full max-w-xs px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 border border-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] mt-2"
                        >
                            Close Tab / विंडो बंद करें
                        </button>
                    </div>
                ) : (
                    <>
                        {errorMessage && (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3.5 text-xs text-rose-400 flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div
                                className={`relative rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-inner flex items-center justify-center mx-auto w-full ${
                                    isMobile ? "max-w-[92vw]" : "max-w-full"
                                } ${!reviewAspectRatio && !previewAspectRatio ? (isMobile ? "aspect-[9/16]" : "aspect-video") : ""}`}
                                style={{
                                    ...(isMobile ? { maxHeight: "calc(100vh - 260px)" } : {}),
                                    aspectRatio: reviewAspectRatio ?? previewAspectRatio ?? undefined
                                }}
                            >
                                {(recordingState === "idle" || recordingState === "recording") && stream && (
                                    <video
                                        ref={videoPreviewRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover object-top scale-x-[-1]"
                                    />
                                )}

                                {recordingState === "review" && videoUrl && (
                                    <video
                                        ref={videoPlaybackRef}
                                        src={videoUrl}
                                        controls
                                        playsInline
                                        onLoadedMetadata={(e) => {
                                            const video = e.target as HTMLVideoElement;
                                            if (video.videoWidth && video.videoHeight) {
                                                setReviewAspectRatio(video.videoWidth / video.videoHeight);
                                            }
                                            if (video.duration === Infinity) {
                                                video.currentTime = 99.99;
                                                video.onseeked = () => {
                                                    video.onseeked = null;
                                                    video.currentTime = 0;
                                                };
                                            }
                                        }}
                                        className="w-full h-full object-cover object-top"
                                    />
                                )}

                                {recordingState === "error" && (
                                    <div className="text-center p-6 text-slate-400 space-y-2">
                                        <AlertTriangle className="w-12 h-12 mx-auto stroke-[1.5] text-rose-500" />
                                        <p className="text-xs font-bold uppercase tracking-wider text-rose-400">कैमरा/माइक त्रुटि (Camera/Mic Error)</p>
                                        <p className="text-[11px] leading-relaxed max-w-xs mx-auto">
                                            कैमरा या माइक्रोफ़ोन कनेक्ट करने में समस्या हुई। कृपया अपने ब्राउज़र की अनुमति जांचें।
                                        </p>
                                    </div>
                                )}

                                {recordingState === "idle" && !stream && (
                                    <div className="text-center p-6 text-slate-500">
                                        <Camera className="w-12 h-12 mx-auto stroke-[1.5] mb-2 text-slate-600 animate-pulse" />
                                        <p className="text-xs font-semibold">कैमरा सक्रिय नहीं है (Camera is offline)</p>
                                    </div>
                                )}

                                {recordingState === "recording" && (
                                    <div className="absolute top-4 left-4 bg-red-600 border border-red-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse shadow-md">
                                        <span className="w-2 h-2 rounded-full bg-white"></span>
                                        Recording ({countdown}s)
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-center justify-center gap-3">
                                {recordingState === "idle" && stream && (
                                    <button
                                        onClick={() => startRecording()}
                                        className="w-full max-w-md px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all flex items-center justify-center gap-2 border border-red-500/20"
                                    >
                                        <Video className="w-4 h-4" /> Start Recording
                                    </button>
                                )}

                                {recordingState === "idle" && !stream && (
                                    <button
                                        onClick={handleStartClick}
                                        className="w-full max-w-md px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all flex items-center justify-center gap-2 border border-red-500/20 hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        <Video className="w-4 h-4 animate-pulse" /> Start Recording
                                    </button>
                                )}

                                {recordingState === "recording" && (
                                    <button
                                        onClick={stopRecording}
                                        className="w-full max-w-md px-8 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 text-slate-200 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 hover:bg-slate-800/80"
                                    >
                                        <Square className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" /> Stop Recording
                                    </button>
                                )}

                                {recordingState === "review" && (
                                    <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
                                        <button
                                            onClick={handleRetry}
                                            className="flex-1 min-w-[140px] px-6 py-3.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-4 h-4" /> Record Again
                                        </button>

                                        <button
                                            onClick={handleUpload}
                                            className="flex-1 min-w-[160px] px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 border border-indigo-500/20"
                                        >
                                            <UploadCloud className="w-4 h-4" /> Upload Consent
                                        </button>
                                    </div>
                                )}

                                {recordingState === "uploading" && (
                                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                                        <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                                            Uploading consent video...
                                        </span>
                                    </div>
                                )}

                                {recordingState === "error" && (
                                    <button
                                        onClick={startCamera}
                                        className="w-full max-w-md px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-md"
                                    >
                                        <RefreshCw className="w-4 h-4" /> Try Reconnecting Camera
                                    </button>
                                )}
                            </div>

                            {/* Dynamic bilingual text container (no outer card border/bg) */}
                            <div className="space-y-4 py-2">
                                <div className="flex flex-row justify-between items-center w-full gap-2 text-slate-300">
                                    <span className="font-extrabold text-indigo-400 text-[10px] min-[375px]:text-[11px] sm:text-[12px] whitespace-nowrap">
                                        📜 Read script aloud / जोर से पढ़ें
                                    </span>
                                    <span className="bg-slate-900/60 border border-slate-800/80 px-2 min-[375px]:px-3 py-1 rounded-full text-[8px] min-[375px]:text-[9px] sm:text-[10px] text-slate-400 font-bold font-mono whitespace-nowrap shrink-0 shadow-sm">
                                        Leave ID: <span className="text-indigo-300 font-black">{leaveId.slice(0, 8)}</span>
                                    </span>
                                </div>

                                <div className="h-px bg-slate-800/60" />

                                {/* Hindi Script */}
                                <div className="leading-relaxed text-sm text-slate-100 text-justify">
                                    <span className="text-xs font-black text-indigo-400 block mb-1">हिंदी में:</span>
                                    "नमस्कार। मेरा नाम <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{parentName}</span> है। मैं अपने पुत्र/पुत्री <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{studentName}</span> को दिनांक <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{startDate}</span> से दिनांक <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{endDate}</span> तक अवकाश लेने की अनुमति देता/देती हूँ। इस अवधि के दौरान मेरे बच्चे की जिम्मेदारी मेरी होगी। कृपया मेरे बच्चे का अवकाश स्वीकृत करने की कृपा करें। धन्यवाद।"
                                </div>

                                <div className="h-px bg-slate-800/30" />

                                {/* English Script */}
                                <div className="leading-relaxed text-sm text-slate-300 text-justify">
                                    <span className="text-xs font-black text-indigo-400 block mb-1">In English:</span>
                                    "Namaskar. My name is <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{parentName}</span>. I grant permission for my son/daughter <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{studentName}</span> to take leave from <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{startDate}</span> to <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{endDate}</span>. I will be responsible for my child during this period. Please kindly approve my child's leave. Thank you."
                                </div>
                            </div>

                        </div>
                    </>
                )}
            </div>
            
            {/* Trust badge footer */}
            <div className="mt-8 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                🛡️ End-to-End Secure File Transmission
            </div>
        </div>
    );
}
