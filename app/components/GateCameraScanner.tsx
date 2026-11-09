"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import FastAvatar from "@/app/components/FastAvatar";
import { 
  CheckCircle2, 
  ShieldAlert, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw 
} from "lucide-react";
import { 
  loadFaceApiModels, 
  detectFace, 
  calculateScore, 
  assessPhotoQuality 
} from "@/lib/faceMatching";
import { loadPhoneDetector, detectMobilePhone } from "@/lib/objectDetection";
import { loadBiometricGalleryWithSync } from "@/lib/localFaceGallery";
import { initClientMiniFASNet, checkLivenessClient } from "@/lib/clientMiniFASNet";

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
    pixelW: number;
    pixelH: number;
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
 * 🛡️ Multi-Factor Mobile Screen, Glass Glare & Secondary Device Chassis Analyzer
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

    // 1. SPECULAR GLASS GLARE REFLECTION HOTSPOT
    // Checks strictly the facial skin zone for unnatural flat glass mirror reflections
    const faceData = ctx.getImageData(bx, by, bw, bh).data;
    const totalPixels = bw * bh;
    let saturatedGlareCount = 0;
    let highFreqGridDiffs = 0;

    for (let i = 0; i < faceData.length; i += 4) {
      const r = faceData[i];
      const g = faceData[i + 1];
      const b = faceData[i + 2];

      // Specular glass glare reflection hotspot (pure blown-out white glass reflection)
      if (r >= 252 && g >= 252 && b >= 252 && Math.abs(r - g) < 6 && Math.abs(r - b) < 6) {
        saturatedGlareCount++;
      }

      // Horizontal adjacent pixel gradient (Moiré pattern of digital subpixel matrix)
      if (i > 4 && i % (bw * 4) !== 0) {
        const pr = faceData[i - 4];
        const pg = faceData[i - 3];
        const pb = faceData[i - 2];
        const delta = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
        if (delta > 85) {
          highFreqGridDiffs++;
        }
      }
    }

    const glareRatio = saturatedGlareCount / Math.max(1, totalPixels);
    const moireRatio = highFreqGridDiffs / Math.max(1, totalPixels);

    if (glareRatio > 0.12) {
      return { isSpoof: true, reason: "Glass Screen Glare Reflection Detected! Mobile phone presentation rejected." };
    }
    if (moireRatio > 0.12) {
      return { isSpoof: true, reason: "Digital Screen Moiré Pixel Grid Detected! Mobile display rejected." };
    }

    // 2. 📐 PURE MATHEMATICAL COLLINEAR BORDER & DEVICE CHASSIS DETECTOR
    const searchLeftMin = Math.max(0, Math.floor(bx - bw * 0.55));
    const searchLeftMax = Math.min(imgWidth - 4, Math.floor(bx + bw * 0.10));
    const searchRightMin = Math.max(0, Math.floor(bx + bw * 0.90));
    const searchRightMax = Math.min(imgWidth - 4, Math.floor(bx + bw * 1.55));

    const yStart = Math.max(0, Math.floor(by + bh * 0.05));
    const yEnd = Math.min(imgHeight - 1, Math.floor(by + bh * 0.85));
    const ySpan = yEnd - yStart;

    if (ySpan > 30 && searchLeftMax > searchLeftMin && searchRightMax > searchRightMin) {
      const scanData = ctx.getImageData(0, yStart, imgWidth, ySpan).data;
      const leftHist: { [x: number]: number } = {};
      const rightHist: { [x: number]: number } = {};
      let sampledRows = 0;

      for (let relY = 0; relY < ySpan; relY += 3) {
        sampledRows++;
        const rowOffset = relY * imgWidth * 4;

        let maxGradL = 0;
        let peakXL = -1;
        for (let x = searchLeftMin + 2; x <= searchLeftMax - 2; x += 2) {
          const idxL = rowOffset + (x - 2) * 4;
          const idxR = rowOffset + (x + 2) * 4;
          const bL = 0.299 * scanData[idxL] + 0.587 * scanData[idxL + 1] + 0.114 * scanData[idxL + 2];
          const bR = 0.299 * scanData[idxR] + 0.587 * scanData[idxR + 1] + 0.114 * scanData[idxR + 2];
          const grad = Math.abs(bR - bL);
          if (grad > maxGradL) {
            maxGradL = grad;
            peakXL = x;
          }
        }
        if (maxGradL > 45 && peakXL !== -1) {
          const bin = Math.round(peakXL / 6) * 6;
          leftHist[bin] = (leftHist[bin] || 0) + 1;
        }

        let maxGradR = 0;
        let peakXR = -1;
        for (let x = searchRightMin + 2; x <= searchRightMax - 2; x += 2) {
          const idxL = rowOffset + (x - 2) * 4;
          const idxR = rowOffset + (x + 2) * 4;
          const bL = 0.299 * scanData[idxL] + 0.587 * scanData[idxL + 1] + 0.114 * scanData[idxL + 2];
          const bR = 0.299 * scanData[idxR] + 0.587 * scanData[idxR + 1] + 0.114 * scanData[idxR + 2];
          const grad = Math.abs(bR - bL);
          if (grad > maxGradR) {
            maxGradR = grad;
            peakXR = x;
          }
        }
        if (maxGradR > 45 && peakXR !== -1) {
          const bin = Math.round(peakXR / 6) * 6;
          rightHist[bin] = (rightHist[bin] || 0) + 1;
        }
      }

      let maxLeftCollinear = 0;
      for (const b in leftHist) {
        if (leftHist[b] > maxLeftCollinear) maxLeftCollinear = leftHist[b];
      }
      let maxRightCollinear = 0;
      for (const b in rightHist) {
        if (rightHist[b] > maxRightCollinear) maxRightCollinear = rightHist[b];
      }

      const leftRatio = sampledRows > 0 ? maxLeftCollinear / sampledRows : 0;
      const rightRatio = sampledRows > 0 ? maxRightCollinear / sampledRows : 0;

      const topSearchYMin = Math.max(0, Math.floor(by - bh * 0.45));
      const topSearchYMax = Math.max(0, Math.floor(by - bh * 0.05));
      let topRatio = 0;
      if (topSearchYMax > topSearchYMin) {
        const topYSpan = topSearchYMax - topSearchYMin;
        const topData = ctx.getImageData(bx, topSearchYMin, bw, topYSpan).data;
        const topHist: { [y: number]: number } = {};
        let sampledCols = 0;

        for (let relX = 0; relX < bw; relX += 4) {
          sampledCols++;
          let maxGradT = 0;
          let peakYT = -1;
          for (let relY = 2; relY < topYSpan - 2; relY += 2) {
            const idxT = (relY - 2) * bw * 4 + relX * 4;
            const idxB = (relY + 2) * bw * 4 + relX * 4;
            const bT = 0.299 * topData[idxT] + 0.587 * topData[idxT + 1] + 0.114 * topData[idxT + 2];
            const bB = 0.299 * topData[idxB] + 0.587 * topData[idxB + 1] + 0.114 * topData[idxB + 2];
            const grad = Math.abs(bB - bT);
            if (grad > maxGradT) {
              maxGradT = grad;
              peakYT = relY;
            }
          }
          if (maxGradT > 45 && peakYT !== -1) {
            const bin = Math.round(peakYT / 4) * 4;
            topHist[bin] = (topHist[bin] || 0) + 1;
          }
        }
        let maxTopCollinear = 0;
        for (const b in topHist) {
          if (topHist[b] > maxTopCollinear) maxTopCollinear = topHist[b];
        }
        topRatio = sampledCols > 0 ? maxTopCollinear / sampledCols : 0;
      }

      if (leftRatio >= 0.40 && rightRatio >= 0.40) {
        return { isSpoof: true, reason: "Mobile Phone Screen / Bezel Border Detected! Real human face required." };
      }
      if ((leftRatio >= 0.42 || rightRatio >= 0.42) && topRatio >= 0.38) {
        return { isSpoof: true, reason: "Rectangular Device Casing / Paper Photo Border Detected! Real human face required." };
      }
    }

    return { isSpoof: false };
  } catch (_) {
    return { isSpoof: false };
  }
}

/**
 * 🛡️ Facial Landmark & Geometric Anatomy Validator
 */
function verifyFacialAnatomy(landmarks: any, box: any): boolean {
  if (!landmarks || !box) return false;
  const positions = landmarks.positions || (typeof landmarks.getPositions === "function" ? landmarks.getPositions() : null);
  if (!positions || positions.length < 5) return false;

  let leftEye: any, rightEye: any, nose: any, mouth: any;

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
 * Converts raw video bounding box coordinates to percentage relative to a 1:1 square container
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
    onPassProcessed?: (student: any, action: "in" | "out", passType: string) => void;
}

export default function GateCameraScanner({
    isFullscreen = false,
    standbyMinutes: propStandbyMinutes = 3,
    onPassProcessed,
}: GateCameraScannerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const consecutiveMatchRef = useRef<{ studentId: string | null; count: number }>({ studentId: null, count: 0 });
    const lastProcessedRef = useRef<{ studentId: string | null; timestamp: number }>({ studentId: null, timestamp: 0 });
    const lastActivityRef = useRef<number>(Date.now());
    const isStandbyRef = useRef<boolean>(false);
    const standbyMinutesRef = useRef<number>(3);
    const faceLockStartTimeRef = useRef<number | null>(null);
    const lastFaceSeenTimeRef = useRef<number>(0);

    const updateStandbyState = (newVal: boolean) => {
        isStandbyRef.current = newVal;
        setIsStandby(newVal);
    };

    // States
    const [gallery, setGallery] = useState<IdentifiedStudent[]>([]);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("user");

    // Face detection & tracking
    const [activeFaceBox, setActiveFaceBox] = useState<ActiveFaceBox | null>(null);
    const [scanStatus, setScanStatus] = useState<string>("Initializing Gatepass Camera...");
    const [matchedStudent, setMatchedStudent] = useState<IdentifiedStudent | null>(null);
    const [matchScore, setMatchScore] = useState<number>(0);
    const [spoofWarning, setSpoofWarning] = useState<string | null>(null);
    const [unrecognizedWarning, setUnrecognizedWarning] = useState<string | null>(null);

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
    const [standbyClock, setStandbyClock] = useState({ time: "", date: "", day: "" });

    // Sound feedback - Identical to Gatepass QR Scan sound & announcement
    const playSuccessChime = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 identical arpeggio chord
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + index * 0.08);
                gain.gain.setValueAtTime(0.12, now + index * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + index * 0.08);
                osc.stop(now + index * 0.08 + 0.3);
            });
        } catch (_) {}
    }, []);

    const speak = useCallback((text: string) => {
        try {
            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(text);
                utter.rate = 1.25;
                utter.volume = 1.0;
                window.speechSynthesis.speak(utter);
            }
        } catch (_) {}
    }, []);

    const playWarningBuzz = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.linearRampToValueAtTime(70, now + 0.35);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.38);
        } catch (_) {}
    }, []);

    // 1. Load Biometric Gallery into RAM
    useEffect(() => {
        let isMounted = true;
        loadBiometricGalleryWithSync((students) => {
            if (isMounted && Array.isArray(students) && students.length > 0) {
                setGallery(students);
            }
        });

        const initAI = async () => {
            try {
                await Promise.allSettled([
                    loadFaceApiModels(false),
                    initClientMiniFASNet()
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

    // 2. Camera Stream Lifecycle (Exact Copy of Identifier Modal Settings)
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

        // Give mobile hardware camera driver 100ms to cleanly release sensor
        await new Promise((resolve) => setTimeout(resolve, 100));

        try {
            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                },
                audio: false,
            };

            let stream: MediaStream | null = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (_) {
                // Mobile hardware fallback if 1280x720 is rejected
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode } },
                    audio: false,
                });
            }
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
            setCameraError("Unable to access camera device.");
        }
    }, [facingMode, stopCamera]);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, [startCamera, stopCamera]);

    // 3. Process Gatepass Action
    const handleGatepassAction = async (student: IdentifiedStudent) => {
        if (isProcessingPass) return;
        setIsProcessingPass(true);

        const studentId = student.id || student._id;
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

        try {
            // 🔒 Send request to enforce the strict Anti-Spoof Cooldown & Emergency Outing rules
            const res = await fetch("/api/getpass/manual-toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: studentId,
                    userType: "gatekeeper",
                    requestType: "GATE-PASS",
                    source: "face_camera"
                }),
            });

            const data = await res.json();

            if (data.success) {
                // ✅ PASS ALLOWED: Cooldown rules passed, state updated in database
                const effectiveAction: "in" | "out" = data.newStatus === "out" ? "out" : (data.newStatus === "in" ? "in" : (student.studentStatus === "out" ? "in" : "out"));
                const isEffectiveOut = effectiveAction === "out";
                const badgeType = isEffectiveOut
                    ? (student.outingType?.toLowerCase().includes("leave") ? "HOME-LEAVE" : "GATE-PASS")
                    : "RETURNED";

                setRecentEvent({
                    student,
                    action: effectiveAction,
                    badge: badgeType,
                    time: timeStr,
                });

                const actionText = isEffectiveOut ? "Check out" : "Check in";
                const eventKey = `${studentId}_${isEffectiveOut ? "checkout" : "checkin"}`;
                if (typeof window !== "undefined") {
                    (window as any).__lastGatepassSpoken = { key: eventKey, time: Date.now() };
                }

                if (onPassProcessed) {
                    onPassProcessed(student, effectiveAction, badgeType);
                } else {
                    playSuccessChime();
                    speak(actionText);
                }
            } else {
                // 🚫 COOLDOWN OR VALIDATION REJECTED:
                setRecentEvent(null);
                playWarningBuzz();

                if (data.action === "cooldown_blocked" || data.isDuplicate) {
                    speak("Cooldown active. Please wait.");
                    setScanStatus(`⏳ ${data.message || data.error || "Anti-Spoof Cooldown: Please wait before scanning again."}`);
                    setSpoofWarning(data.message || "Anti-Spoof Cooldown: Please wait before scanning again.");
                } else {
                    speak("Access denied.");
                    setScanStatus(`⚠️ ${data.error || "Failed to verify gatepass"}`);
                }
            }
        } catch (err) {
            console.error("Failed to sync gatepass toggle:", err);
            playWarningBuzz();
            speak("Network error.");
        } finally {
            setTimeout(() => {
                setRecentEvent(null);
                setMatchedStudent(null);
                setActiveFaceBox(null);
                setIsProcessingPass(false);
            }, 3500);
        }
    };

    // 4. Standby Clock Updater
    useEffect(() => {
        if (!isStandby) return;
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
            const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
            const dayStr = now.toLocaleDateString("en-US", { weekday: "long" });
            setStandbyClock({ time: timeStr, date: dateStr, day: dayStr });
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, [isStandby]);

    // 5. ⚡ 60FPS Synchronized Face Tracking & Instant 1-2s Identification (Exact Identifier Modal Engine)
    useEffect(() => {
        if (!isCameraActive || gallery.length === 0) return;

        let isRunning = true;
        let isDetecting = false;

        const processFrame = async () => {
            if (!isRunning || !videoRef.current || isProcessingPass || matchedStudent) return;

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

                // Check for idle standby
                const currentStandbyMins = Math.max(1, standbyMinutesRef.current || 1);
                const standbyMs = currentStandbyMins * 60 * 1000;
                const idleTime = Date.now() - lastActivityRef.current;
                if (idleTime > standbyMs && !isStandbyRef.current) {
                    updateStandbyState(true);
                }

                // ⚡ Instant Face Detection & 128-D Descriptors
                const detection = await detectFace(video, false, true);

                if (!detection || !detection.descriptor) {
                    if (Date.now() - lastFaceSeenTimeRef.current > 1500) {
                        faceLockStartTimeRef.current = null;
                        setUnrecognizedWarning(null);
                    }
                    setActiveFaceBox(null);
                    setSpoofWarning(null);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                    if (!recentEvent) {
                        setScanStatus(unrecognizedWarning || "Looking for student face...");
                    }
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                lastActivityRef.current = Date.now();
                if (isStandbyRef.current) {
                    updateStandbyState(false);
                }

                const rawBox = detection.detection?.box || (detection as any).box;
                const detectionScore = detection.detection?.score ?? (detection as any).score ?? 0;

                // CHECK 1: Confidence
                if (detectionScore < 0.60 || !rawBox || rawBox.width < 50 || rawBox.height < 50) {
                    setScanStatus("Looking for student face...");
                    setActiveFaceBox(null);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                // CHECK 2: Anatomy & Landmark Geometry
                if (!verifyFacialAnatomy(detection.landmarks, rawBox)) {
                    setScanStatus("Looking for student face...");
                    setActiveFaceBox(null);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                // 🎯 TIGHT ACTUAL FACE BOX (forehead to chin, cheek to cheek)
                const tightBox = getTightFaceBox(detection.landmarks, rawBox);
                const isMirrored = facingMode === "user";
                const displayBox = calculateDisplayBox(tightBox, video, isMirrored);

                // Update box on screen in real time at 60 FPS
                setActiveFaceBox(displayBox);
                setSpoofWarning(null);

                lastFaceSeenTimeRef.current = Date.now();
                if (faceLockStartTimeRef.current === null) {
                    faceLockStartTimeRef.current = Date.now();
                }

                // ⏱️ 5-6 SECONDS UNRECOGNIZED FACE GUARD:
                const elapsedLockTime = Date.now() - faceLockStartTimeRef.current;
                if (elapsedLockTime >= 5500 && !matchedStudent) {
                    const unrecMsg = "❌ Face Not Recognized — contact hostel dean/warden";
                    setUnrecognizedWarning(unrecMsg);
                    setScanStatus(unrecMsg);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                    isDetecting = false;
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                }

                const liveDescriptor = Array.from(detection.descriptor) as number[];

                let bestMatch: IdentifiedStudent | null = null;
                let minDistance = 999.0;
                let secondMinDistance = 999.0;

                // ⚡ Instant In-Memory 1:N Euclidean vector comparison across all students (< 1.5ms)
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

                const currentScore = calculateScore(minDistance);
                const isEligibleMatch = (
                    bestMatch !== null &&
                    currentScore >= 85 &&
                    (secondMinDistance - minDistance) >= 0.010
                );

                if (isEligibleMatch && bestMatch) {
                    // 🛡️ High-Confidence Match Found! Perform Ultra-Fast Anti-Spoof Checks
                    const vw = video.videoWidth || 640;
                    const vh = video.videoHeight || 480;

                    const offCanvas = document.createElement("canvas");
                    offCanvas.width = vw;
                    offCanvas.height = vh;
                    const ctx = offCanvas.getContext("2d", { willReadFrequently: true });

                    if (ctx) {
                        ctx.drawImage(video, 0, 0, vw, vh);

                        // Anti-Spoof 1: Skin Chromaticity
                        const skinCheck = checkHumanSkinTone(ctx, rawBox);
                        if (!skinCheck.isSkin) {
                            setScanStatus("Looking for student face...");
                            consecutiveMatchRef.current = { studentId: null, count: 0 };
                            isDetecting = false;
                            animFrameRef.current = requestAnimationFrame(processFrame);
                            return;
                        }

                        // Anti-Spoof 2: MiniFASNetV2 Neural Liveness Engine (<15ms)
                        const neuralCheck = await checkLivenessClient(offCanvas, rawBox, vw, vh);
                        if (neuralCheck.isSpoof) {
                            const warnText = neuralCheck.reason || "Mobile phone display or printed photo detected!";
                            setSpoofWarning(warnText);
                            setScanStatus(`🛑 FRAUD DETECTED: ${warnText}`);
                            consecutiveMatchRef.current = { studentId: null, count: 0 };
                            isDetecting = false;
                            animFrameRef.current = requestAnimationFrame(processFrame);
                            return;
                        }

                        // Anti-Spoof 3: Screen Glare, Moiré & Collinear Device Border
                        const screenCheck = checkScreenAndPhotoSpoof(ctx, rawBox, vw, vh);
                        if (screenCheck.isSpoof) {
                            setSpoofWarning(screenCheck.reason || "Mobile phone screen / glass display detected!");
                            setScanStatus("🛑 FRAUD DETECTED: Secondary Phone Screen / Display Rejected!");
                            consecutiveMatchRef.current = { studentId: null, count: 0 };
                            isDetecting = false;
                            animFrameRef.current = requestAnimationFrame(processFrame);
                            return;
                        }
                    }

                    const currentCandidateId = bestMatch.id || bestMatch.registrationId;
                    if (consecutiveMatchRef.current.studentId === currentCandidateId) {
                        consecutiveMatchRef.current.count += 1;
                    } else {
                        consecutiveMatchRef.current = { studentId: currentCandidateId, count: 1 };
                    }
                } else {
                    consecutiveMatchRef.current = { studentId: null, count: 0 };
                }

                // ✅ Confirmed in 1-2 seconds (clean hands-free consensus):
                const isVerified = (
                    bestMatch !== null &&
                    consecutiveMatchRef.current.count >= 2
                );

                if (isVerified && bestMatch) {
                    const score = calculateScore(minDistance);
                    setMatchedStudent(bestMatch);
                    setMatchScore(score);
                    setScanStatus(`Verified: ${bestMatch.name} (${score}% match)`);
                    faceLockStartTimeRef.current = null;
                    setUnrecognizedWarning(null);
                    consecutiveMatchRef.current = { studentId: null, count: 0 };

                    const nowMs = Date.now();
                    if (
                        lastProcessedRef.current.studentId !== bestMatch.id ||
                        nowMs - lastProcessedRef.current.timestamp > 5000
                    ) {
                        lastProcessedRef.current = { studentId: bestMatch.id, timestamp: nowMs };
                        handleGatepassAction(bestMatch);
                    }
                    isDetecting = false;
                    return;
                } else {
                    setScanStatus("Scanning face against student roster...");
                }

            } catch (frameErr) {
                console.warn("Scan frame error:", frameErr);
            } finally {
                isDetecting = false;
                if (isRunning && !recentEvent && !matchedStudent) {
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
    }, [isCameraActive, gallery, isProcessingPass, recentEvent, matchedStudent, facingMode, standbyMinutes]);

    return (
        <div className={`relative w-full h-full aspect-square rounded-2xl md:rounded-[28px] overflow-hidden bg-black flex items-center justify-center border-2 md:border-[4px] transition-all shadow-2xl ${
            spoofWarning 
              ? "border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse" 
              : unrecognizedWarning
                ? "border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.4)]"
                : matchedStudent 
                  ? "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)]" 
                  : "border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
        }`}>
            {/* Camera Video Element */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-500 ${isStandby ? "opacity-20" : "opacity-100"} ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />

            {/* Camera Switch Pill (Top Left on Mobile, Top Right on Desktop - Compact rounded-md) */}
            <div className="absolute top-2 left-2 md:left-auto md:top-3 md:right-3 z-20 flex items-center gap-1 bg-slate-900/85 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-slate-700 text-[8px] text-white font-bold shadow-md">
                <button
                    type="button"
                    onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Switch Camera (Front/Rear)"
                >
                    <RefreshCw className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="uppercase">{facingMode === "environment" ? "REAR CAMERA" : "FRONT CAMERA"}</span>
                </button>
            </div>

            {/* 🛑 ANTI-SPOOF FRAUD WARNING OVERLAY */}
            {spoofWarning && (
                <div className="absolute top-2 inset-x-2 z-30 bg-red-600/95 backdrop-blur-md px-3 py-2 rounded-xl border border-red-400 shadow-xl text-white flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-150">
                    <ShieldAlert className="w-5 h-5 text-yellow-300 shrink-0 animate-bounce" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-wider text-yellow-200 flex items-center gap-1">
                            🛑 Anti-Spoof Protection Triggered
                        </p>
                        <p className="text-[11px] font-black leading-tight text-white drop-shadow">
                            {spoofWarning}
                        </p>
                    </div>
                </div>
            )}

            {/* ⏱️ UNRECOGNIZED FACE TIMEOUT WARNING (5-6 SECONDS) */}
            {unrecognizedWarning && !spoofWarning && !matchedStudent && (
                <div className="absolute top-2 inset-x-2 z-30 bg-amber-600/95 backdrop-blur-md px-3 py-2 rounded-xl border border-amber-400 shadow-xl text-white flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <AlertTriangle className="w-5 h-5 text-yellow-200 shrink-0 animate-bounce" />
                        <div className="min-w-0">
                            <p className="text-[11px] font-black leading-tight text-white drop-shadow">
                                {unrecognizedWarning}
                            </p>
                            <p className="text-[9px] text-amber-100/90 font-medium mt-0.5">
                                Not registered or match confidence &lt; 85%
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 🟩 REAL-TIME GREEN SQUARE BOX TIGHTLY HUGGING ACTUAL FACE (Exact Identifier Modal Bracket Box) */}
            {activeFaceBox && !spoofWarning && !isStandby && (
                <div
                    className="absolute z-10 pointer-events-none"
                    style={{
                        left: `${activeFaceBox.left}%`,
                        top: `${activeFaceBox.top}%`,
                        width: `${activeFaceBox.width}%`,
                        height: `${activeFaceBox.height}%`,
                    }}
                >
                    <div className={`w-full h-full border-2 rounded-lg relative ${
                        unrecognizedWarning
                            ? "border-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                            : matchedStudent 
                                ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.5)]" 
                                : "border-green-400 bg-green-400/5 shadow-[0_0_12px_rgba(74,222,128,0.3)]"
                    }`}>
                        {/* Corner Targeting Accents */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-300"></div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-300"></div>
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-300"></div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-300"></div>

                        {/* Real Measurement & Name Badge */}
                        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md border text-[9px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md ${
                            unrecognizedWarning
                                ? "bg-amber-950/90 border-amber-400/60 text-amber-300"
                                : "bg-emerald-950/90 border-emerald-400/60 text-emerald-300"
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${unrecognizedWarning ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`}></span>
                            {unrecognizedWarning ? (
                                <span>UNREGISTERED</span>
                            ) : matchedStudent ? (
                                <span>{matchedStudent.name} • {matchScore}%</span>
                            ) : (
                                <span>{activeFaceBox.pixelW}×{activeFaceBox.pixelH}px</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Status Bar (Exact Identifier Modal Bar) */}
            <div className={`absolute bottom-2 inset-x-2 backdrop-blur-md px-3 py-1.5 rounded-lg border flex items-center justify-between transition-colors z-20 ${
                spoofWarning 
                    ? "bg-red-950/90 border-red-700/80" 
                    : unrecognizedWarning
                        ? "bg-amber-950/90 border-amber-700/80"
                        : matchedStudent 
                            ? "bg-emerald-950/90 border-emerald-700/80" 
                            : "bg-slate-900/80 border-slate-700/60"
            }`}>
                <p className="text-[11px] font-semibold truncate flex items-center gap-1.5">
                    {spoofWarning ? (
                        <span className="text-red-300 flex items-center gap-1 font-black truncate">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" /> Synthetic Display / Photo Rejected
                        </span>
                    ) : unrecognizedWarning ? (
                        <span className="text-amber-300 flex items-center gap-1 font-black truncate">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {unrecognizedWarning}
                        </span>
                    ) : matchedStudent ? (
                        <span className="text-green-400 flex items-center gap-1 font-bold truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Identity & Live Human Verified
                        </span>
                    ) : activeFaceBox ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold truncate">
                            <Sparkles className="w-3.5 h-3.5 animate-spin shrink-0" /> Face Locked • Identifying...
                        </span>
                    ) : (
                        <span className="text-slate-200 truncate flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                            {scanStatus}
                        </span>
                    )}
                </p>
                <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest shrink-0 ml-2">
                    1:N BIOMETRIC
                </span>
            </div>

            {/* Standby Dark Clock Overlay */}
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
                    className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 text-center animate-in fade-in duration-300 cursor-pointer"
                    title="Click or step in front of camera to wake up"
                >
                    <div className="p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl mb-3">
                        <span className="text-3xl">🌙</span>
                    </div>
                    <div className="text-3xl sm:text-5xl font-black text-white tabular-nums tracking-wider mb-2">
                        {standbyClock.time}
                    </div>
                    <div className="text-base sm:text-2xl md:text-3xl font-bold text-white tracking-wide mb-4 flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap">
                        <span>{standbyClock.date}</span>
                        <span className="text-[rgba(255,255,255,0.4)] font-normal">•</span>
                        <span>{standbyClock.day}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold animate-pulse">
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
                <div className="absolute inset-x-3 bottom-12 z-40 bg-slate-900/95 border-2 border-emerald-400 rounded-2xl p-3 shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-emerald-400 shrink-0 bg-gray-900">
                            <FastAvatar
                                src={recentEvent.student.profilePicture}
                                name={recentEvent.student.name}
                                size={56}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    recentEvent.action === "out" ? "bg-amber-500/20 text-amber-300 border border-amber-400/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                                }`}>
                                    {recentEvent.badge}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono ml-auto">{recentEvent.time}</span>
                            </div>
                            <h4 className="text-sm font-black text-white truncate">{recentEvent.student.name}</h4>
                            <p className="text-[11px] text-gray-300 font-medium truncate">
                                {recentEvent.student.registrationId} • Room {recentEvent.student.roomNumber}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
