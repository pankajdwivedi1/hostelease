"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Video, Square, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle, ShieldCheck, Play, Pause } from "lucide-react";

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

    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const videoPlaybackRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up streams on unmount
    useEffect(() => {
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
    const startCamera = async () => {
        try {
            setErrorMessage("");
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            // Constraints optimized for small file size (low resolution, lower framerate)
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 15 }
                },
                audio: true
            });

            setStream(mediaStream);
            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = mediaStream;
            }
            setRecordingState("idle");
        } catch (err: any) {
            console.error("Camera access failed:", err);
            setErrorMessage("असुविधा के लिए खेद है। कैमरा और माइक्रोफ़ोन एक्सेस की अनुमति नहीं मिली। कृपया अपने ब्राउज़र सेटिंग्स में कैमरा अनुमति की जांच करें। (Camera or Microphone permission denied. Please allow camera access in browser settings.)");
            setRecordingState("error");
        }
    };

    // Trigger start camera on load if not already submitted
    useEffect(() => {
        if (!parentConsentUrl) {
            startCamera();
        }
    }, []);

    // Start video recording
    const startRecording = () => {
        if (!stream) return;

        chunksRef.current = [];
        let selectedMimeType = "video/mp4";
        if (MediaRecorder.isTypeSupported("video/mp4")) {
            selectedMimeType = "video/mp4";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
            selectedMimeType = "video/webm;codecs=vp8,opus";
        } else {
            selectedMimeType = "video/webm";
        }

        try {
            const mediaRecorder = new MediaRecorder(stream, {
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
        await startCamera();
    };

    // Upload video file to server
    const handleUpload = async () => {
        if (chunksRef.current.length === 0) return;

        setRecordingState("uploading");
        setErrorMessage("");

        try {
            // Find correct mime type
            let fileExt = "mp4";
            let mimeType = "video/mp4";
            if (MediaRecorder.isTypeSupported("video/mp4")) {
                mimeType = "video/mp4";
                fileExt = "mp4";
            } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
                mimeType = "video/webm;codecs=vp8,opus";
                fileExt = "webm";
            } else {
                mimeType = "video/webm";
                fileExt = "webm";
            }

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
                    <div className="text-center py-10 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">सहमति स्वीकृत! (Consent Submitted!)</h2>
                            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                                आपका सहमति वीडियो सुरक्षित रूप से अपलोड कर दिया गया है। हॉस्टल वार्डन को सूचित कर दिया गया है और छुट्टी जल्द ही स्वीकृत कर दी जाएगी। धन्यवाद।
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                (Your video has been uploaded. The hostel warden is notified and will review it shortly. You can close this window now.)
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Dynamic bilingual text card */}
                        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4 space-y-4">
                            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex justify-between">
                                <span>📜 Read script aloud / जोर से पढ़ें</span>
                                <span className="text-slate-400">Leave ID: {leaveId.slice(0, 8)}</span>
                            </div>

                            {/* Hindi Script */}
                            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 leading-relaxed text-sm text-slate-100">
                                <span className="text-xs font-bold text-indigo-400 block mb-1">हिंदी में:</span>
                                "नमस्कार। मेरा नाम <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{parentName}</span> है। मैं अपने पुत्र/पुत्री <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{studentName}</span> को दिनांक <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{startDate}</span> से दिनांक <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{endDate}</span> तक अवकाश लेने की अनुमति देता/देती हूँ। इस अवधि के दौरान मेरे बच्चे की जिम्मेदारी मेरी होगी। कृपया मेरे बच्चे का अवकाश स्वीकृत करने की कृपा करें। धन्यवाद।"
                            </div>

                            {/* English Script */}
                            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 leading-relaxed text-sm text-slate-300">
                                <span className="text-xs font-bold text-indigo-400 block mb-1">In English:</span>
                                "Namaskar. My name is <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{parentName}</span>. I grant permission for my son/daughter <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{studentName}</span> to take leave from <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{startDate}</span> to <span className="text-indigo-300 font-bold border-b border-indigo-500/30 pb-0.5">{endDate}</span>. I will be responsible for my child during this period. Please kindly approve my child's leave. Thank you."
                            </div>
                        </div>

                        {/* Error Alert */}
                        {errorMessage && (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-xs text-rose-400 flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* Camera Recorder Section */}
                        <div className="space-y-4">
                            
                            {/* Video Viewport Container */}
                            <div className="relative aspect-video rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-inner flex items-center justify-center">
                                
                                {/* 1. Active Camera Preview */}
                                {(recordingState === "idle" || recordingState === "recording") && (
                                    <video
                                        ref={videoPreviewRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover scale-x-[-1]"
                                    />
                                )}

                                {/* 2. Playback / Review Video */}
                                {recordingState === "review" && videoUrl && (
                                    <video
                                        ref={videoPlaybackRef}
                                        src={videoUrl}
                                        controls
                                        playsInline
                                        onLoadedMetadata={(e) => {
                                            const video = e.target as HTMLVideoElement;
                                            if (video.duration === Infinity) {
                                                // Workaround for WebM MediaRecorder duration bug
                                                video.currentTime = 99.99;
                                                video.onseeked = () => {
                                                    video.onseeked = null;
                                                    video.currentTime = 0;
                                                };
                                            }
                                        }}
                                        className="w-full h-full object-cover"
                                    />
                                )}

                                {/* 3. Offline / Error State Placeholder */}
                                {(recordingState === "error" || (!stream && recordingState !== "review")) && (
                                    <div className="text-center p-6 text-slate-500">
                                        <Camera className="w-12 h-12 mx-auto stroke-[1.5] mb-2 text-slate-600" />
                                        <p className="text-xs font-semibold">कैमरा सक्रिय नहीं है (Camera is offline)</p>
                                    </div>
                                )}

                                {/* 4. Recording Overlay */}
                                {recordingState === "recording" && (
                                    <div className="absolute top-4 left-4 bg-red-600 border border-red-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse shadow-md">
                                        <span className="w-2 h-2 rounded-full bg-white"></span>
                                        Recording ({countdown}s)
                                    </div>
                                )}
                            </div>

                            {/* Controls Panel */}
                            <div className="flex flex-col items-center justify-center gap-3">
                                
                                {/* Idle State controls */}
                                {recordingState === "idle" && stream && (
                                    <button
                                        onClick={startRecording}
                                        className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all flex items-center gap-2 border border-red-500/20"
                                    >
                                        <Video className="w-4 h-4" /> Start Consent Recording
                                    </button>
                                )}

                                {/* Recording state controls */}
                                {recordingState === "recording" && (
                                    <button
                                        onClick={stopRecording}
                                        className="px-8 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 text-slate-200 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 hover:bg-slate-800/80"
                                    >
                                        <Square className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" /> Stop Recording
                                    </button>
                                )}

                                {/* Review/Playback state controls */}
                                {recordingState === "review" && (
                                    <div className="flex flex-wrap items-center justify-center gap-3 w-full">
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

                                {/* Uploading state spinner */}
                                {recordingState === "uploading" && (
                                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                                        <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                                            Uploading video to Google Drive...
                                        </span>
                                    </div>
                                )}

                                {/* Error/Offline State retry option */}
                                {recordingState === "error" && (
                                    <button
                                        onClick={startCamera}
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-500 transition-all flex items-center gap-2 shadow-md"
                                    >
                                        <RefreshCw className="w-4 h-4" /> Try Reconnecting Camera
                                    </button>
                                )}

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
