"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Video, Square, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle, ShieldCheck, Play, Pause } from "lucide-react";

const CONSENT_MIME_TYPES = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
    "video/quicktime",
];

function pickConsentMimeType(): { mimeType: string; fileExt: string } {
    if (typeof MediaRecorder !== "undefined") {
        // Test formats in order of guaranteed voice & video universal decoding:
        // 1. WebM with Opus (100% native on Android Chrome, Firefox, Desktop)
        // 2. MP4 with H.264 + AAC audio (100% native on iOS Safari / macOS)
        const types = [
            { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
            { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
            { mime: "video/webm", ext: "webm" },
            { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
            { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
            { mime: "video/mp4", ext: "mp4" },
        ];
        for (const t of types) {
            if (MediaRecorder.isTypeSupported(t.mime)) {
                return { mimeType: t.mime, fileExt: t.ext };
            }
        }
    }
    return { mimeType: "", fileExt: "webm" };
}

function isMobileDevice(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(max-width: 767px)").matches ||
        /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
    );
}

function getCameraConstraints(isMobile: boolean): MediaStreamConstraints {
    const audioConstraints = {
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
    };

    if (isMobile) {
        return {
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24 },
            },
            audio: audioConstraints,
        };
    }

    return {
        video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 },
        },
        audio: audioConstraints,
    };
}

interface ParentConsentClientProps {
    leaveId: string;
    studentName: string;
    parentName: string;
    startDate: string;
    endDate: string;
    parentConsentUrl?: string | null;
    parentUserId?: string;
}

export default function ParentConsentClient({
    leaveId,
    studentName,
    parentName,
    startDate,
    endDate,
    parentConsentUrl,
    parentUserId
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

    // 🎙️ Live Decibel & Voice Verification States
    const [liveAudioLevel, setLiveAudioLevel] = useState<number>(0);
    const [isVoiceVerified, setIsVoiceVerified] = useState<boolean>(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioAnimFrameRef = useRef<number | null>(null);
    const maxAudioLevelRef = useRef<number>(0);
    const voiceFramesCountRef = useRef<number>(0);

    // Register parent for Web Push notifications on mount
    useEffect(() => {
        const initParentPush = async () => {
            try {
                if (parentUserId) {
                    const { registerPushNotifications } = await import("@/lib/pushRegister");
                    await registerPushNotifications(parentUserId, "parent");
                }
            } catch (e) {
                console.error("Failed to register parent push notifications:", e);
            }
        };
        initParentPush();
    }, [parentUserId]);

    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const videoPlaybackRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up streams & audio context on unmount
    useEffect(() => {
        setIsMobile(isMobileDevice());
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (audioAnimFrameRef.current) {
                cancelAnimationFrame(audioAnimFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
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

    // Guarantee unmuted playback with full volume during review
    useEffect(() => {
        if (videoPlaybackRef.current && videoUrl && recordingState === "review") {
            videoPlaybackRef.current.muted = false;
            videoPlaybackRef.current.volume = 1.0;
        }
    }, [videoUrl, recordingState]);

    // Request camera permission and start preview with microphone verification
    const startCamera = async (): Promise<MediaStream | null> => {
        try {
            setErrorMessage("");
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            let mediaStream: MediaStream;
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia(
                    getCameraConstraints(isMobileDevice())
                );
            } catch (initialErr) {
                console.warn("Primary camera constraints failed, attempting basic fallback...", initialErr);
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: true
                });
            }

            // Verify active audio track presence
            const audioTracks = mediaStream.getAudioTracks();
            if (audioTracks.length === 0 || !audioTracks[0].enabled) {
                console.warn("⚠️ Main stream missing active audio track. Acquiring separate audio track...");
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const micTrack = audioStream.getAudioTracks()[0];
                    if (micTrack) {
                        mediaStream.addTrack(micTrack);
                        console.log("✅ Microphone audio track attached successfully.");
                    }
                } catch (micErr) {
                    console.error("Microphone fallback acquisition failed:", micErr);
                }
            }

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
            console.error("Camera/mic access failed:", err);
            setErrorMessage("असुविधा के लिए खेद है। कैमरा और माइक्रोफ़ोन एक्सेस की अनुमति नहीं मिली। कृपया अपने ब्राउज़र सेटिंग्स में कैमरा और माइक्रोफ़ोन अनुमति की जांच करें। (Camera or Microphone permission denied. Please allow camera and mic access in browser settings.)");
            setRecordingState("error");
            return null;
        }
    };

    // Trigger start camera logic handled via user action to avoid mount lag
    useEffect(() => {
        // Camera will be set up when user taps button
    }, []);

    // Start video recording with guaranteed audio & live decibel analysis
    const startRecording = async (activeStream?: MediaStream) => {
        let currentStream = activeStream || stream;
        if (!currentStream) return;

        // Ensure currentStream has an active audio track; if missing, request fresh combined stream
        if (currentStream.getAudioTracks().length === 0) {
            try {
                const freshCombined = await navigator.mediaDevices.getUserMedia(getCameraConstraints(isMobileDevice()));
                currentStream = freshCombined;
                setStream(freshCombined);
            } catch (e) {
                console.warn("Could not re-acquire combined video+audio stream:", e);
            }
        }

        chunksRef.current = [];
        const { mimeType: selectedMimeType } = pickConsentMimeType();

        // 🎙️ Initialize real-time Web Audio Decibel Analyzer
        try {
            if (typeof window !== "undefined") {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    const audioCtx = new AudioContextClass();
                    if (audioCtx.state === "suspended") {
                        await audioCtx.resume();
                    }
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.3;
                    const source = audioCtx.createMediaStreamSource(currentStream);
                    source.connect(analyser);

                    audioContextRef.current = audioCtx;
                    analyserRef.current = analyser;
                    maxAudioLevelRef.current = 0;
                    voiceFramesCountRef.current = 0;
                    setIsVoiceVerified(false);

                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    const checkAudioLevel = () => {
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                            analyser.getByteFrequencyData(dataArray);
                            let sum = 0;
                            for (let i = 0; i < dataArray.length; i++) {
                                sum += dataArray[i];
                            }
                            const avg = sum / dataArray.length; // 0 to 255
                            const normalizedLevel = Math.min(avg / 60, 1.0); // 0.0 to 1.0
                            setLiveAudioLevel(normalizedLevel);

                            if (normalizedLevel > 0.06) {
                                voiceFramesCountRef.current += 1;
                            }
                            maxAudioLevelRef.current = Math.max(maxAudioLevelRef.current, normalizedLevel);

                            audioAnimFrameRef.current = requestAnimationFrame(checkAudioLevel);
                        }
                    };
                    audioAnimFrameRef.current = requestAnimationFrame(checkAudioLevel);
                }
            }
        } catch (audioMeterErr) {
            console.warn("Audio meter initialization error:", audioMeterErr);
        }

        try {
            let mediaRecorder: MediaRecorder;
            try {
                if (selectedMimeType) {
                    mediaRecorder = new MediaRecorder(currentStream, { mimeType: selectedMimeType });
                } else {
                    mediaRecorder = new MediaRecorder(currentStream);
                }
            } catch (optErr) {
                console.warn("MediaRecorder initialization fallback to default constructor...", optErr);
                mediaRecorder = new MediaRecorder(currentStream);
            }

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Stop audio monitoring
                if (audioAnimFrameRef.current) {
                    cancelAnimationFrame(audioAnimFrameRef.current);
                    audioAnimFrameRef.current = null;
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close().catch(() => {});
                    audioContextRef.current = null;
                }
                setLiveAudioLevel(0);

                // 🎙️ Voice energy validation
                const peakVoice = maxAudioLevelRef.current;
                const framesWithVoice = voiceFramesCountRef.current;
                console.log(`🎙️ [Voice Analysis] Peak: ${peakVoice.toFixed(2)}, Audible frames: ${framesWithVoice}`);

                // If voice was completely silent / muted (under threshold)
                if (peakVoice < 0.05 || framesWithVoice < 4) {
                    console.warn("⚠️ Silent recording detected. Rejecting silent consent video.");
                    setErrorMessage("⚠️ कोई आवाज़ दर्ज नहीं हुई! (No voice detected!) कृपया अपने फ़ोन के माइक्रोफ़ोन के पास साफ़ और स्पष्ट आवाज़ में बोलें और पुनः रिकॉर्ड करें। (Please speak loudly and clearly near your phone microphone and record again.)");
                    setRecordingState("idle");
                    setIsVoiceVerified(false);
                    chunksRef.current = [];
                    handleRetry();
                    return;
                }

                setIsVoiceVerified(true);
                setErrorMessage("");

                const actualType = mediaRecorder.mimeType || selectedMimeType || "video/webm";
                const blob = new Blob(chunksRef.current, { type: actualType });
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
            mediaRecorder.start(); // Start recording without chunk slicing to preserve contiguous container headers
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

    // Trigger start camera logic handled via user action to avoid mount lag
    const handleStartClick = async () => {
        await startCamera();
    };

    // Stop active camera stream
    const stopCamera = () => {
        if (audioAnimFrameRef.current) {
            cancelAnimationFrame(audioAnimFrameRef.current);
            audioAnimFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        setLiveAudioLevel(0);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setRecordingState("idle");
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
        if (audioAnimFrameRef.current) {
            cancelAnimationFrame(audioAnimFrameRef.current);
            audioAnimFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        setLiveAudioLevel(0);
        setIsVoiceVerified(false);
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

                            <div className="h-px bg-slate-800/40 my-2" />

                            {/* Camera / Recording Card Container (Matches Add Student Profile Photo Dimensions) */}
                            <div className="space-y-3 border-2 border-dashed border-slate-700/80 p-3 sm:p-4 rounded-2xl flex flex-col items-center justify-center bg-slate-900/40 transition-all min-h-[160px] w-full max-w-[280px] sm:max-w-[320px] mx-auto shadow-md">
                                
                                {/* Initial State: Before camera is opened (Screenshot 2 structure) */}
                                {recordingState === "idle" && !stream && (
                                    <div className="flex flex-col items-center gap-3 py-3">
                                        <button
                                            type="button"
                                            onClick={handleStartClick}
                                            className="px-5 py-2.5 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 rounded-xl text-xs font-bold flex items-center gap-2 border border-purple-500/30 shadow-sm transition-all active:scale-95 cursor-pointer"
                                        >
                                            <Camera className="w-4 h-4 text-purple-400" />
                                            <span>📷 OPEN CAMERA</span>
                                        </button>
                                    </div>
                                )}

                                {/* Active Camera Preview & Recording State (Screenshot 1 structure) */}
                                {(recordingState === "idle" || recordingState === "recording") && stream && (
                                    <div className="flex flex-col items-center gap-3 w-full">
                                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-700 bg-black shadow-md">
                                            <video
                                                ref={videoPreviewRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-full h-full object-cover scale-x-[-1]"
                                            />
                                            {recordingState === "recording" && (
                                                <div className="absolute top-3 left-3 bg-red-600 border border-red-500/30 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse shadow-md text-white">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                                    Recording ({countdown}s)
                                                </div>
                                            )}
                                        </div>

                                        {/* 🎙️ Real-time Voice Decibel Meter */}
                                        {recordingState === "recording" && (
                                            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-inner">
                                                <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1 shrink-0">
                                                    🎙️ Mic Level:
                                                </span>
                                                <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden flex items-center p-0.5">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-75 ${
                                                            liveAudioLevel > 0.08 ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500/60'
                                                        }`}
                                                        style={{ width: `${Math.max(5, liveAudioLevel * 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-[9px] font-black uppercase shrink-0 ${
                                                    liveAudioLevel > 0.08 ? 'text-emerald-400' : 'text-amber-400'
                                                }`}>
                                                    {liveAudioLevel > 0.08 ? 'Speaking 🔊' : 'Speak up 🔇'}
                                                </span>
                                            </div>
                                        )}

                                        {/* Action buttons directly beneath video preview */}
                                        <div className="flex items-center justify-center gap-2 w-full">
                                            {recordingState === "idle" && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => startRecording()}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                                                    >
                                                        <Video className="w-3.5 h-3.5" />
                                                        <span>START RECORDING</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={stopCamera}
                                                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-slate-700 active:scale-95 cursor-pointer"
                                                    >
                                                        CANCEL
                                                    </button>
                                                </>
                                            )}

                                            {recordingState === "recording" && (
                                                <button
                                                    type="button"
                                                    onClick={stopRecording}
                                                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                                                >
                                                    <Square className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
                                                    <span>STOP RECORDING</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Video Review State */}
                                {recordingState === "review" && videoUrl && (
                                    <div className="flex flex-col items-center gap-3 w-full">
                                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-700 bg-black shadow-md">
                                            <video
                                                ref={videoPlaybackRef}
                                                src={videoUrl}
                                                controls
                                                playsInline
                                                onLoadedMetadata={(e) => {
                                                    const video = e.target as HTMLVideoElement;
                                                    if (video.duration === Infinity || isNaN(video.duration) || video.duration > 3600) {
                                                        video.currentTime = 0;
                                                    }
                                                }}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* 🎙️ Voice Verified Indicator Badge */}
                                        {isVoiceVerified && (
                                            <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 flex items-center justify-center gap-1.5 text-emerald-400 text-[10px] font-bold shadow-sm">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>✅ आवाज़ सत्यापित (Voice & Sound Recorded)</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-center gap-2 w-full">
                                            <button
                                                type="button"
                                                onClick={handleRetry}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                <span>RECORD AGAIN</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleUpload}
                                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 shadow-md active:scale-95 cursor-pointer"
                                            >
                                                <UploadCloud className="w-3 h-3" />
                                                <span>SUBMIT CONSENT</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Error State */}
                                {recordingState === "error" && (
                                    <div className="text-center p-4 text-slate-400 space-y-2">
                                        <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Camera/Mic Access Denied</p>
                                        <button
                                            type="button"
                                            onClick={handleStartClick}
                                            className="px-3 py-1.5 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[10px] font-bold rounded-lg border border-rose-500/30 cursor-pointer"
                                        >
                                            Retry Camera
                                        </button>
                                    </div>
                                )}

                                {/* Uploading State */}
                                {recordingState === "uploading" && (
                                    <div className="text-center p-6 text-indigo-300 space-y-2">
                                        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                                        <p className="text-[10px] font-black uppercase tracking-wider">Uploading Video Consent...</p>
                                    </div>
                                )}
                            </div>

                            {recordingState === "review" && (
                                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-200 leading-relaxed max-w-md mx-auto text-center mt-2 flex flex-col gap-1 shadow-sm">
                                    <span className="font-bold text-indigo-300">📢 आवाज नहीं आने पर सलाह (Audio Tip):</span>
                                    <span>यदि आपको आवाज नहीं आ रही है, तो कृपया सुनिश्चित करें कि आपका मोबाइल <strong>साइलेंट मोड (Silent Mode)</strong> पर न हो और फोन की आवाज बढ़ाएं।</span>
                                    <span className="text-[10px] text-indigo-400 opacity-90">(If you cannot hear your voice, please check that your device is <strong>not on Silent/Vibrate Mode</strong> and increase your volume.)</span>
                                </div>
                            )}

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
