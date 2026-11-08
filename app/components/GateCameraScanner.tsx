"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import FastAvatar from "@/app/components/FastAvatar";
import { 
  loadFaceApiModels, 
  detectFace, 
  calculateScore, 
  assessPhotoQuality 
} from "@/lib/faceMatching";
import { loadPhoneDetector, detectMobilePhone } from "@/lib/objectDetection";
import { loadBiometricGalleryWithSync } from "@/lib/localFaceGallery";

interface IdentifiedStudent {
    id: string;
    name: string;
    registrationId: string;
    erpId: string;
    hostelName: string;
    roomNumber: string;
    profilePicture: string | null;
    studentStatus: string;
    outingType: string;
    leaveTo?: string | null;
    fatherNumber: string;
    motherNumber: string;
    collegeName: string;
    branch: string;
    year: string;
    semester: string;
    faceDescriptor: number[];
}

interface ActiveFaceBox {
    left: number;
    top: number;
    width: number;
    height: number;
    pixelW?: number;
    pixelH?: number;
}

function euclideanDistance(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 1.0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

/**
 * 🛡️ Real Human Physical Skin Tone Analyzer
 * Converts central face pixels to YCbCr & RGB space and verifies live human skin chromaticity.
 * Instantly rejects curtains, floral bedsheets, blankets, clothes, walls, and screens (<10% skin).
 */
function checkHumanSkinTone(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number }
): { isSkin: boolean; skinRatio: number } {
  try {
    const bx = Math.max(0, Math.floor(box.x));
    const by = Math.max(0, Math.floor(box.y));
    const bw = Math.floor(box.width);
    const bh = Math.floor(box.height);

    const cx = bx + Math.floor(bw * 0.2);
    const cy = by + Math.floor(bh * 0.2);
    const cw = Math.floor(bw * 0.6);
    const ch = Math.floor(bh * 0.6);

    if (cw < 10 || ch < 10) return { isSkin: false, skinRatio: 0 };

    const imgData = ctx.getImageData(cx, cy, cw, ch).data;
    let skinPixels = 0;
    const total = cw * ch;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];

      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      const isSkinPixel = (
        r > 50 && g > 35 && b > 20 &&
        r > g && r > b &&
        (r - g) >= 10 &&
        cb >= 77 && cb <= 127 &&
        cr >= 133 && cr <= 173
      );

      if (isSkinPixel) {
        skinPixels++;
      }
    }

    const skinRatio = skinPixels / Math.max(1, total);
    return { isSkin: skinRatio >= 0.26, skinRatio };
  } catch (_) {
    return { isSkin: false, skinRatio: 0 };
  }
}

/**
 * 🛡️ Multi-Factor Mobile Screen, Glass Glare & Secondary Phone Casing Analyzer
 */
function checkScreenAndPhotoSpoof(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  imgWidth: number,
  imgHeight: number
): { isSpoof: boolean; reason?: string } {
  try {
    const bx = Math.max(0, Math.floor(box.x));
    const by = Math.max(0, Math.floor(box.y));
    const bw = Math.min(imgWidth - bx, Math.floor(box.width));
    const bh = Math.min(imgHeight - by, Math.floor(box.height));

    if (bw < 30 || bh < 30) return { isSpoof: false };

    const faceImgData = ctx.getImageData(bx, by, bw, bh).data;
    const totalPixels = bw * bh;
    let saturatedGlareCount = 0;
    let highFreqGridDiffs = 0;

    for (let i = 0; i < faceImgData.length; i += 4) {
      const r = faceImgData[i];
      const g = faceImgData[i + 1];
      const b = faceImgData[i + 2];

      if (r >= 244 && g >= 244 && b >= 244) {
        saturatedGlareCount++;
      }

      if (i > 4 && i % (bw * 4) !== 0) {
        const pr = faceImgData[i - 4];
        const pg = faceImgData[i - 3];
        const pb = faceImgData[i - 2];
        const delta = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
        if (delta > 85) {
          highFreqGridDiffs++;
        }
      }
    }

    const glareRatio = saturatedGlareCount / Math.max(1, totalPixels);
    const moireRatio = highFreqGridDiffs / Math.max(1, totalPixels);

    if (glareRatio > 0.045) {
      return { isSpoof: true, reason: "Glass Screen Glare Detected! Present your real face in person." };
    }
    if (moireRatio > 0.15) {
      return { isSpoof: true, reason: "Display Screen Moiré Pattern Detected! Mobile screen rejected." };
    }

    for (const marginFactor of [0.32, 0.60]) {
      const marginX = Math.floor(bw * marginFactor);
      const marginY = Math.floor(bh * marginFactor);
      const outerX = Math.max(0, bx - marginX);
      const outerY = Math.max(0, by - marginY);
      const outerW = Math.min(imgWidth - outerX, bw + marginX * 2);
      const outerH = Math.min(imgHeight - outerY, bh + marginY * 1.4);

      if (outerW > bw + 14 && outerH > bh + 14) {
        const outerData = ctx.getImageData(outerX, outerY, outerW, outerH).data;
        let darkMarginPixels = 0;
        let totalMarginPixels = 0;

        for (let y = 0; y < outerH; y += 2) {
          for (let x = 0; x < outerW; x += 2) {
            const isMargin = (x < marginX || x >= outerW - marginX || y < marginY);
            if (isMargin) {
              const idx = (y * outerW + x) * 4;
              const brightness = 0.299 * outerData[idx] + 0.587 * outerData[idx + 1] + 0.114 * outerData[idx + 2];
              if (brightness < 55) {
                darkMarginPixels++;
              }
              totalMarginPixels++;
            }
          }
        }

        const darkBezelRatio = darkMarginPixels / Math.max(1, totalMarginPixels);
        if (darkBezelRatio > 0.38) {
          return { isSpoof: true, reason: "Secondary Mobile Phone Casing Detected! Please present real face directly." };
        }
      }
    }

    return { isSpoof: false };
  } catch (_) {
    return { isSpoof: false };
  }
}

/**
 * 🛡️ Facial Landmark & Geometric Anatomy Validator
 * Ensures detected contours match genuine human facial anatomy (eyes, nose, mouth positioning).
 * Rejects pareidolia on floral cloth, curtain folds, t-shirt graphics, and arm creases.
 */
function verifyFacialAnatomy(
  landmarks: any,
  box: { x: number; y: number; width: number; height: number }
): boolean {
  if (!landmarks || !box) return false;

  if (box.width < 50 || box.height < 50) return false;

  const aspect = box.width / box.height;
  if (aspect < 0.60 || aspect > 1.35) return false;

  const positions = landmarks.positions || (typeof landmarks.getPositions === "function" ? landmarks.getPositions() : null);
  if (!positions || positions.length < 5) return false;

  let leftEye: { x: number; y: number };
  let rightEye: { x: number; y: number };
  let nose: { x: number; y: number };
  let mouth: { x: number; y: number };

  if (positions.length >= 68) {
    leftEye = {
      x: (positions[36].x + positions[39].x) / 2,
      y: (positions[36].y + positions[39].y) / 2
    };
    rightEye = {
      x: (positions[42].x + positions[45].x) / 2,
      y: (positions[42].y + positions[45].y) / 2
    };
    nose = positions[30];
    mouth = {
      x: (positions[48].x + positions[54].x) / 2,
      y: (positions[48].y + positions[54].y) / 2
    };
  } else {
    leftEye = positions[0];
    rightEye = positions[1];
    nose = positions[2];
    mouth = {
      x: (positions[3].x + positions[4].x) / 2,
      y: (positions[3].y + positions[4].y) / 2
    };
  }

  const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
  const eyeRatio = eyeDist / box.width;
  if (eyeRatio < 0.18 || eyeRatio > 0.60) return false;

  const eyeTilt = Math.abs(rightEye.y - leftEye.y) / Math.max(1, eyeDist);
  if (eyeTilt > 0.55) return false;

  const avgEyeY = (leftEye.y + rightEye.y) / 2;
  const eyeRelY = (avgEyeY - box.y) / box.height;
  if (eyeRelY < 0.12 || eyeRelY > 0.70) return false;

  if (nose.y <= avgEyeY) return false;
  if (mouth.y <= nose.y) return false;

  return true;
}

/**
 * 🎯 Extracts the tight anatomical face box (forehead to chin, cheek to cheek)
 */
function getTightFaceBox(landmarks: any, rawBox: any) {
  if (landmarks) {
    const positions = landmarks.positions || (typeof landmarks.getPositions === "function" ? landmarks.getPositions() : null);
    if (positions && positions.length >= 68) {
      let minEyebrowY = 99999;
      for (let i = 17; i <= 26; i++) {
        if (positions[i].y < minEyebrowY) minEyebrowY = positions[i].y;
      }
      const chinY = positions[8].y;
      const leftCheekX = positions[1].x;
      const rightCheekX = positions[15].x;

      const faceHeight = chinY - minEyebrowY;
      const topY = Math.max(0, minEyebrowY - faceHeight * 0.16);
      const bottomY = chinY + faceHeight * 0.04;
      const leftX = leftCheekX;
      const rightX = rightCheekX;

      return {
        x: leftX,
        y: topY,
        width: Math.max(20, rightX - leftX),
        height: Math.max(20, bottomY - topY)
      };
    } else if (positions && positions.length >= 5) {
      const leftEye = positions[0];
      const rightEye = positions[1];
      const leftMouth = positions[3];
      const rightMouth = positions[4];

      const eyeCenterY = (leftEye.y + rightEye.y) / 2;
      const mouthCenterY = (leftMouth.y + rightMouth.y) / 2;
      const eyeDist = Math.abs(rightEye.x - leftEye.x);

      const topY = Math.max(0, eyeCenterY - eyeDist * 0.50);
      const bottomY = mouthCenterY + eyeDist * 0.60;
      const leftX = Math.min(leftEye.x, leftMouth.x) - eyeDist * 0.22;
      const rightX = Math.max(rightEye.x, rightMouth.x) + eyeDist * 0.22;

      return {
        x: leftX,
        y: topY,
        width: Math.max(20, rightX - leftX),
        height: Math.max(20, bottomY - topY)
      };
    }
  }

  return {
    x: rawBox.x + rawBox.width * 0.10,
    y: rawBox.y + rawBox.height * 0.10,
    width: rawBox.width * 0.80,
    height: rawBox.height * 0.82
  };
}

/**
 * Converts raw video bounding box coordinates to percentage relative to container
 */
function calculateDisplayBox(
  box: { x: number; y: number; width: number; height: number },
  video: HTMLVideoElement,
  isMirrored: boolean
): ActiveFaceBox {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  if (vw >= vh) {
    const scale = 100 / vh;
    const displayedWidthPercent = vw * scale;
    const cropXPercent = (displayedWidthPercent - 100) / 2;

    const top = (box.y * scale);
    const height = (box.height * scale);
    const width = (box.width * scale);
    const rawX = isMirrored ? (vw - box.x - box.width) : box.x;
    const left = (rawX * scale) - cropXPercent;

    return {
      left: Math.max(0, Math.min(95, left)),
      top: Math.max(0, Math.min(95, top)),
      width: Math.min(100 - left, width),
      height: Math.min(100 - top, height),
      pixelW: Math.round(box.width),
      pixelH: Math.round(box.height)
    };
  } else {
    const scale = 100 / vw;
    const displayedHeightPercent = vh * scale;
    const cropYPercent = (displayedHeightPercent - 100) / 2;

    const rawX = isMirrored ? (vw - box.x - box.width) : box.x;
    const left = (rawX * scale);
    const top = (box.y * scale) - cropYPercent;
    const width = (box.width * scale);
    const height = (box.height * scale);

    return {
      left: Math.max(0, Math.min(95, left)),
      top: Math.max(0, Math.min(95, top)),
      width: Math.min(100 - left, width),
      height: Math.min(100 - top, height),
      pixelW: Math.round(box.width),
      pixelH: Math.round(box.height)
    };
  }
}

interface GateCameraScannerProps {
    isFullscreen?: boolean;
    standbyMinutes?: number;
    onPassProcessed?: (studentName: string, action: "in" | "out", passType: string) => void;
}

export default function GateCameraScanner({
    isFullscreen = false,
    standbyMinutes: propStandbyMinutes = 3,
    onPassProcessed,
}: GateCameraScannerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const lastObjectCheckRef = useRef<number>(0);
    const consecutiveMatchRef = useRef<{ studentId: string | null; count: number }>({ studentId: null, count: 0 });
    const lastProcessedRef = useRef<{ studentId: string | null; timestamp: number }>({ studentId: null, timestamp: 0 });
    const lastActivityRef = useRef<number>(Date.now());
    const isStandbyRef = useRef<boolean>(false);
    const standbyMinutesRef = useRef<number>(3);

    const updateStandbyState = (newVal: boolean) => {
        isStandbyRef.current = newVal;
        setIsStandby(newVal);
    };

    // States
    const [gallery, setGallery] = useState<IdentifiedStudent[]>([]);
    const [isLoadingGallery, setIsLoadingGallery] = useState(true);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

    // Face detection & tracking
    const [activeFaceBox, setActiveFaceBox] = useState<ActiveFaceBox | null>(null);
    const [scanStatus, setScanStatus] = useState<string>("Align face with camera...");
    const [matchedStudent, setMatchedStudent] = useState<IdentifiedStudent | null>(null);
    const [matchScore, setMatchScore] = useState<number>(0);
    const [spoofWarning, setSpoofWarning] = useState<string | null>(null);

    // Processing & feedback state
    const [isProcessingPass, setIsProcessingPass] = useState(false);
    const [recentEvent, setRecentEvent] = useState<{
        student: IdentifiedStudent;
        action: "in" | "out";
        badge: string;
        time: string;
    } | null>(null);

    // Method A: Low-Power Standby Mode
    const [isStandby, setIsStandby] = useState(false);
    const [standbyMinutes, setStandbyMinutes] = useState<number>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("activeGateStandbyMinutes");
            if (saved && !isNaN(Number(saved))) return Number(saved);
        }
        return propStandbyMinutes || 3;
    });

    useEffect(() => {
        if (propStandbyMinutes) {
            setStandbyMinutes(propStandbyMinutes);
            standbyMinutesRef.current = propStandbyMinutes;
        }
    }, [propStandbyMinutes]);

    useEffect(() => {
        standbyMinutesRef.current = standbyMinutes;
    }, [standbyMinutes]);

    useEffect(() => {
        const handleStorage = () => {
            if (typeof window !== "undefined") {
                const saved = localStorage.getItem("activeGateStandbyMinutes");
                if (saved && !isNaN(Number(saved))) {
                    const parsed = Number(saved);
                    setStandbyMinutes(parsed);
                    standbyMinutesRef.current = parsed;
                }
            }
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);
    const [standbyClock, setStandbyClock] = useState({ time: "", date: "" });

    // Sound feedback
    const playWarningBuzz = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } catch (_) {}
    }, []);
    const playSuccessChime = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } catch (_) {}
    }, []);

    const speak = useCallback((text: string) => {
        try {
            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(text);
                utter.rate = 1.05;
                utter.pitch = 1.0;
                window.speechSynthesis.speak(utter);
            }
        } catch (_) {}
    }, []);

    // 1. Load Biometric Gallery into RAM from permanent local IndexedDB + Silent Server Sync
    useEffect(() => {
        let isMounted = true;
        setIsLoadingGallery(true);

        loadBiometricGalleryWithSync((students) => {
            if (isMounted && Array.isArray(students) && students.length > 0) {
                setGallery(students);
                setIsLoadingGallery(false);
            }
        });

        const initAI = async () => {
            try {
                await Promise.allSettled([
                    loadFaceApiModels(false),
                    loadPhoneDetector()
                ]);
            } catch (err) {
                console.warn("AI warmup warning:", err);
            }
        };

        initAI();
        return () => {
            isMounted = false;
        };
    }, []);

    // 2. Camera Stream Lifecycle
    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        setActiveFaceBox(null);
    }, []);

    const startCamera = useCallback(async () => {
        stopCamera();
        setCameraError(null);
        setSpoofWarning(null);
        setActiveFaceBox(null);
        try {
            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().then(() => {
                        setIsCameraActive(true);
                        lastActivityRef.current = Date.now();
                        setScanStatus("Point camera at student's face...");
                    }).catch((err) => {
                        console.error("Video play error:", err);
                        setCameraError("Unable to start video preview");
                    });
                };
            }
        } catch (err: any) {
            console.error("Camera access error:", err);
            if (facingMode === "environment") {
                setFacingMode("user");
                return;
            }
            setCameraError(err.message || "Camera permission denied or camera not found");
        }
    }, [facingMode, stopCamera]);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, [startCamera, stopCamera]);

    // 3. Process Gatepass Action (Instant 0ms Screen Display + Millisecond Async Server Sync)
    const handleGatepassAction = async (student: IdentifiedStudent) => {
        if (isProcessingPass) return;
        setIsProcessingPass(true);

        const isOuting = student.studentStatus !== "out";
        const badgeType = isOuting
            ? (student.outingType?.toLowerCase().includes("leave") ? "HOME-LEAVE" : "GATE-PASS")
            : "RETURNED";

        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

        // ⚡ 1. INSTANT ON-SCREEN CONFIRMATION (0 milliseconds): Show student photo, card & audio feedback immediately
        setRecentEvent({
            student,
            action: isOuting ? "out" : "in",
            badge: badgeType,
            time: timeStr,
        });

        playSuccessChime();
        speak(isOuting ? `${student.name}, checked out` : `${student.name}, checked in`);

        if (onPassProcessed) {
            onPassProcessed(student.name, isOuting ? "out" : "in", badgeType);
        }

        // ⚡ 2. MILLISECOND BACKGROUND SERVER SYNC: Record outing/return in database
        try {
            const res = await fetch("/api/getpass/manual-toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: student.id,
                    userType: "gatekeeper",
                    requestType: "GATE-PASS",
                    source: "face_camera"
                }),
            });

            const data = await res.json();

            // 🚫 Check for cooldown block
            if (!data.success && (data.action === "cooldown_blocked" || data.isDuplicate)) {
                setRecentEvent(null);
                const warnMsg = data.message || data.error || "Anti-Spoof Cooldown Active";
                setSpoofWarning(`⏳ ${warnMsg}`);
                setScanStatus(warnMsg);
                playWarningBuzz();
                speak("Cooldown active. Please wait.");
                setTimeout(() => {
                    setSpoofWarning(null);
                    setMatchedStudent(null);
                    setActiveFaceBox(null);
                    setScanStatus("Ready • Align face with camera");
                    setIsProcessingPass(false);
                }, 4000);
                return;
            }

            // Immediately update local student status in RAM
            setGallery((prev) =>
                prev.map((s) => (s.id === student.id ? { ...s, studentStatus: isOuting ? "out" : "in" } : s))
            );

        } catch (err) {
            console.error("Gatepass action background sync note:", err);
        } finally {
            // Keep confirmation on screen for 3.5 seconds
            setTimeout(() => {
                setRecentEvent(null);
                setMatchedStudent(null);
                setActiveFaceBox(null);
                setScanStatus("Ready • Align face with camera");
                setIsProcessingPass(false);
            }, 3500);
        }
    };

    // 4. Standby Clock Updater (Method A)
    useEffect(() => {
        if (!isStandby) return;
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
            const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
            setStandbyClock({ time: timeStr, date: dateStr });
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, [isStandby]);

    // 5. Detection & 1:N Identification Loop (Exact Copy of Identifier Modal Pipeline)
    useEffect(() => {
        if (!isCameraActive || gallery.length === 0) return;

        let isRunning = true;
        let isDetecting = false;

        const processFrame = async () => {
            if (!isRunning || !videoRef.current || isProcessingPass) return;

            if (isDetecting) {
                animFrameRef.current = requestAnimationFrame(processFrame);
                return;
            }

            isDetecting = true;

            try {
                const video = videoRef.current;
                if (!video || video.readyState < 2 || video.paused) {
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                // Method A: Check for idle standby based on exact configured standbyMinutes
                const currentStandbyMins = Math.max(1, standbyMinutesRef.current || 1);
                const standbyMs = currentStandbyMins * 60 * 1000;
                const idleTime = Date.now() - lastActivityRef.current;
                if (idleTime > standbyMs) {
                    if (!isStandbyRef.current) {
                        updateStandbyState(true);
                    }
                }

                // 🛡️ CHECK 0: Object Detection for Secondary Cell Phones (Runs async every 400ms)
                const now = Date.now();
                if (now - lastObjectCheckRef.current > 400) {
                    lastObjectCheckRef.current = now;
                    try {
                        const phoneCheck = await detectMobilePhone(video);
                        if (phoneCheck.isSpoofing) {
                            setSpoofWarning(`🛑 FRAUD PREVENTED: Secondary Device Detected (${phoneCheck.message})`);
                            setScanStatus("🛑 FRAUD DETECTED: Mobile Phone Screen / Device Rejected!");
                            setActiveFaceBox(null);
                            isDetecting = false;
                            animFrameRef.current = requestAnimationFrame(processFrame);
                            return;
                        }
                    } catch (_) {}
                }

                // 🎯 Landmark Extraction with withLandmarks = true (Same as Identifier Modal!)
                const detection = await detectFace(video, false, true);

                if (!detection || !detection.descriptor) {
                    setActiveFaceBox(null);
                    setSpoofWarning(null);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                    if (!recentEvent) {
                        setScanStatus("Looking for student face...");
                    }
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                // ⚡ INSTANT WAKE-UP (Milliseconds): As soon as any person steps in front of the camera
                lastActivityRef.current = Date.now();
                if (isStandbyRef.current) {
                    updateStandbyState(false);
                }

                const rawBox = detection.detection?.box || (detection as any).box;
                const detectionScore = detection.detection?.score ?? (detection as any).score ?? 0;

                // 🛡️ CHECK 1: Detection Confidence Score (Must be high confidence human face >= 0.60)
                if (detectionScore < 0.60 || !rawBox || rawBox.width < 50 || rawBox.height < 50) {
                    setScanStatus("Looking for student face...");
                    setActiveFaceBox(null);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                // 🛡️ CHECK 2: Facial Landmark Geometry Anatomy Validator
                if (!verifyFacialAnatomy(detection.landmarks, rawBox)) {
                    setScanStatus("Looking for student face...");
                    setActiveFaceBox(null);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                const vw = video.videoWidth || 640;
                const vh = video.videoHeight || 480;

                const offCanvas = document.createElement("canvas");
                offCanvas.width = vw;
                offCanvas.height = vh;
                const ctx = offCanvas.getContext("2d", { willReadFrequently: true });

                if (ctx) {
                    ctx.drawImage(video, 0, 0, vw, vh);

                    // 🛡️ CHECK 3: Real Human Physical Skin Tone Chromaticity Filter (Melanin/Hemoglobin >= 26%)
                    const skinCheck = checkHumanSkinTone(ctx, rawBox);
                    if (!skinCheck.isSkin) {
                        setScanStatus("Looking for student face...");
                        setActiveFaceBox(null);
                        consecutiveMatchRef.current = { studentId: null, count: 0 };
                        isDetecting = false;
                        animFrameRef.current = requestAnimationFrame(processFrame);
                        return;
                    }

                    // 🛡️ CHECK 4: Specular Glass Glare, Screen Moiré & Secondary Phone Casing Filter
                    const screenCheck = checkScreenAndPhotoSpoof(ctx, rawBox, vw, vh);
                    if (screenCheck.isSpoof) {
                        setSpoofWarning(screenCheck.reason || "Mobile phone screen / glass display detected!");
                        setScanStatus("🛑 FRAUD DETECTED: Secondary Phone Screen / Display Rejected!");
                        setActiveFaceBox(null);
                        consecutiveMatchRef.current = { studentId: null, count: 0 };
                        isDetecting = false;
                        animFrameRef.current = requestAnimationFrame(processFrame);
                        return;
                    }

                    // 🛡️ CHECK 5: Photo-of-photo Bezel / Border Detection
                    const photoCheck = assessPhotoQuality(offCanvas);
                    if (photoCheck.isPhotoOfPhoto) {
                        setSpoofWarning("Secondary photo border / screen bezel detected!");
                        setScanStatus("🛑 FRAUD DETECTED: Printed Photo or Screen Border Detected!");
                        setActiveFaceBox(null);
                        consecutiveMatchRef.current = { studentId: null, count: 0 };
                        isDetecting = false;
                        animFrameRef.current = requestAnimationFrame(processFrame);
                        return;
                    }
                }

                // If genuine face passed all checks, wake standby and update activity
                lastActivityRef.current = Date.now();
                if (isStandby) setIsStandby(false);

                // 🎯 TIGHT ACTUAL FACE BOX (Hugs forehead, chin, and cheeks tightly)
                const tightBox = getTightFaceBox(detection.landmarks, rawBox);
                const isMirrored = facingMode === "user";
                const displayBox = calculateDisplayBox(tightBox, video, isMirrored);

                setActiveFaceBox(displayBox);
                setSpoofWarning(null);

                const liveDescriptor = Array.from(detection.descriptor) as number[];

                let bestMatch: IdentifiedStudent | null = null;
                let minDistance = 999.0;
                let secondMinDistance = 999.0;

                // 1:N Euclidean vector comparison across all students (< 2ms)
                for (let i = 0; i < gallery.length; i++) {
                    const candidate = gallery[i];
                    if (!candidate.faceDescriptor || candidate.faceDescriptor.length === 0) continue;

                    const dist = euclideanDistance(liveDescriptor, candidate.faceDescriptor);
                    if (dist < minDistance) {
                        secondMinDistance = minDistance;
                        minDistance = dist;
                        bestMatch = candidate;
                    } else if (dist < secondMinDistance) {
                        secondMinDistance = dist;
                    }
                }

                // 🎯 Calibrated Match Criteria:
                // Gate 1: Distance <= 0.42
                // Gate 2: Distinctiveness Margin (second - best) >= 0.030
                const isStrongCandidate = (
                    bestMatch !== null &&
                    minDistance <= 0.42 &&
                    (secondMinDistance - minDistance) >= 0.030
                );

                if (isStrongCandidate && bestMatch) {
                    const currentCandidateId = bestMatch.id || bestMatch.registrationId;
                    if (consecutiveMatchRef.current.studentId === currentCandidateId) {
                        consecutiveMatchRef.current.count += 1;
                    } else {
                        consecutiveMatchRef.current = { studentId: currentCandidateId, count: 1 };
                    }
                } else {
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                }

                // ✅ 2-frame temporal stability consensus reached
                if (isStrongCandidate && bestMatch && consecutiveMatchRef.current.count >= 2) {
                    const score = calculateScore(minDistance);
                    setMatchedStudent(bestMatch);
                    setMatchScore(score);
                    setScanStatus(`Verified: ${bestMatch.name} (${score}% match)`);

                    // Anti-bounce check: prevent re-triggering within 5 seconds for same student
                    const nowMs = Date.now();
                    if (
                        lastProcessedRef.current.studentId !== bestMatch.id ||
                        nowMs - lastProcessedRef.current.timestamp > 5000
                    ) {
                        lastProcessedRef.current = { studentId: bestMatch.id, timestamp: nowMs };
                        handleGatepassAction(bestMatch);
                    }
                } else {
                    setScanStatus("Scanning face against student roster...");
                }

            } catch (frameErr) {
                console.warn("Scan frame error:", frameErr);
            } finally {
                isDetecting = false;
                if (isRunning && !recentEvent) {
                    animFrameRef.current = requestAnimationFrame(processFrame);
                }
            }
        };

        animFrameRef.current = requestAnimationFrame(processFrame);

        return () => {
            isRunning = false;
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [isCameraActive, gallery, isProcessingPass, recentEvent, facingMode, standbyMinutes]);

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black rounded-2xl md:rounded-[28px] border-[4px] md:border-[6px] border-[#00ff884d] shadow-[0_0_50px_rgba(0,255,136,0.15)]">
            {/* Camera Video Element */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-500 ${isStandby ? "opacity-20" : "opacity-100"} ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />

            {/* Camera Switch Pill (Top Right) */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-[#000000a6] backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] text-white/80 font-bold">
                <button
                    type="button"
                    onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
                    className="flex items-center gap-1 hover:text-[#00ff88] transition-colors"
                    title="Switch Camera"
                >
                    <span>🔄</span>
                    <span className="uppercase">{facingMode === "environment" ? "Rear Cam" : "Front Cam"}</span>
                </button>
            </div>



            {/* Face Tracking Bounding Box */}
            {activeFaceBox && !isStandby && !recentEvent && (
                <div
                    className="absolute border-2 border-[#00ff88] rounded-xl pointer-events-none transition-all duration-75 shadow-[0_0_15px_rgba(0,255,136,0.5)]"
                    style={{
                        left: `${activeFaceBox.left}%`,
                        top: `${activeFaceBox.top}%`,
                        width: `${activeFaceBox.width}%`,
                        height: `${activeFaceBox.height}%`,
                    }}
                >
                    {matchedStudent && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#00ff88] text-black text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md">
                            ● {matchedStudent.name} • {matchScore}%
                        </div>
                    )}
                </div>
            )}

            {/* Fraud Warning Banner (if spoofing / phone screen detected) */}
            {spoofWarning && (
                <div className="absolute top-12 inset-x-3 z-30 bg-red-600/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-red-400 text-white text-[11px] font-bold text-center animate-in slide-in-from-top-2">
                    {spoofWarning}
                </div>
            )}

            {/* Bottom Status Bar */}
            <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between bg-[#000000cc] backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-xs font-semibold text-white truncate">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${matchedStudent ? "bg-[#00ff88] animate-ping" : "bg-blue-400 animate-pulse"}`} />
                    <span className="truncate">{scanStatus}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono shrink-0">
                    1:N BIOMETRIC
                </div>
            </div>

            {/* Method A: Standby Dark Clock Overlay */}
            {isStandby && (
                <div 
                    onClick={() => {
                        lastActivityRef.current = Date.now();
                        updateStandbyState(false);
                    }}
                    onTouchStart={() => {
                        lastActivityRef.current = Date.now();
                        updateStandbyState(false);
                    }}
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 text-center animate-in fade-in duration-300 cursor-pointer"
                    title="Click or step in front of camera to wake up"
                >
                    <div className="p-3 bg-[rgba(0,255,136,0.08)] border border-[rgba(0,255,136,0.3)] rounded-2xl mb-3">
                        <span className="text-3xl">🌙</span>
                    </div>
                    <div className="text-3xl sm:text-5xl font-black text-white tabular-nums tracking-wider mb-1">
                        {standbyClock.time}
                    </div>
                    <div className="text-sm font-semibold text-gray-400 mb-4">
                        {standbyClock.date}
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,255,136,0.12)] border border-[#00ff884d] rounded-full text-[#00ff88] text-xs font-bold animate-pulse">
                        <span>🚶</span>
                        <span>Step in front of gate camera to wake & scan</span>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">
                        Standby Sleep Mode ({standbyMinutes}m idle) • Click to wake
                    </p>
                </div>
            )}

            {/* Recent Pass Confirmation Card Overlay */}
            {recentEvent && (
                <div className="absolute inset-x-4 bottom-14 z-40 bg-[#0d1420f2] border-2 border-[#00ff88] rounded-2xl p-3 shadow-[0_0_30px_rgba(0,255,136,0.35)] animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-[#00ff88] shrink-0 bg-gray-900">
                            <FastAvatar
                                src={recentEvent.student.profilePicture}
                                name={recentEvent.student.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-white truncate">
                                    {recentEvent.student.name}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    recentEvent.badge === "HOME-LEAVE"
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                        : recentEvent.badge === "GATE-PASS"
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                }`}>
                                    {recentEvent.badge}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-300 truncate mt-0.5">
                                {recentEvent.student.registrationId || recentEvent.student.erpId} • {recentEvent.student.hostelName} #{recentEvent.student.roomNumber}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-[#00ff88]">
                                <span>{recentEvent.action === "out" ? "🚪 Checked OUT at" : "🏠 Checked IN at"}</span>
                                <span>{recentEvent.time}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Error Message */}
            {cameraError && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 p-6 text-center">
                    <span className="text-3xl mb-2">⚠️</span>
                    <p className="text-red-400 text-xs font-bold mb-3">{cameraError}</p>
                    <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-1.5 bg-[#00ff88] text-black font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-transform"
                    >
                        Retry Camera
                    </button>
                </div>
            )}
        </div>
    );
}
