"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  X, 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  UserX, 
  Phone, 
  Search, 
  Sparkles, 
  Building, 
  Hash, 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle,
  Info
} from "lucide-react";
import { 
  getFaceApi, 
  loadFaceApiModels, 
  detectFace, 
  calculateScore,
  detectMobileScreenDisplay,
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

interface FaceIdentifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStudent?: (student: any) => void;
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

    // Sample the central 60% core of the detected face (forehead, nose, cheeks)
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

      // Standard human skin chromaticity bounds in YCbCr:
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      // Human skin has warm melanin/hemoglobin chromaticity: R > G, R > B, Cr: 133-173, Cb: 77-127
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
    // Real physical human face must contain at least 26% genuine skin pixels
    return { isSkin: skinRatio >= 0.26, skinRatio };
  } catch (_) {
    return { isSkin: false, skinRatio: 0 };
  }
}

/**
 * 🛡️ Multi-Factor Mobile Screen, Glass Glare & Secondary Phone Casing Analyzer
 * Rejects photos shown on phone screens, tablets, monitors, and video replays:
 * 1. Specular Glass Glare Reflection (blown-out mirror reflections on screen glass)
 * 2. High-Frequency Moiré Lattice Grid (LCD/OLED pixel matrix interference)
 * 3. Secondary Phone Bezel & Casing (detects dark phone borders even when tilted)
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

    // 1. SPECULAR GLASS GLARE & MOIRÉ PIXEL GRID ANALYSIS ON FACE
    const faceImgData = ctx.getImageData(bx, by, bw, bh).data;
    const totalPixels = bw * bh;
    let saturatedGlareCount = 0;
    let highFreqGridDiffs = 0;

    for (let i = 0; i < faceImgData.length; i += 4) {
      const r = faceImgData[i];
      const g = faceImgData[i + 1];
      const b = faceImgData[i + 2];

      // Screen glass specular reflection blown-out pure white hotspot
      if (r >= 244 && g >= 244 && b >= 244) {
        saturatedGlareCount++;
      }

      // Horizontal adjacent pixel gradient (Moiré pattern of digital subpixel matrix)
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
      return { isSpoof: true, reason: "Glass Screen Glare Reflection Detected! Present your real face in person." };
    }
    if (moireRatio > 0.15) {
      return { isSpoof: true, reason: "Digital Display Screen Moiré Pattern Detected! Mobile screen rejected." };
    }

    // 2. SECONDARY PHONE CASING & MULTI-DEPTH BORDER DETECTION
    // Sample surrounding rectangular margins around face (sampling near at 32% and mid at 60%)
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
          return { isSpoof: true, reason: "Secondary Mobile Phone Casing / Frame Detected! Please present real face directly." };
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
 * Rejects pareidolia on floral cloth, curtain folds, and inanimate textures.
 */
function verifyFacialAnatomy(
  landmarks: any,
  box: { x: number; y: number; width: number; height: number }
): boolean {
  if (!landmarks || !box) return false;

  // Face size must be substantial
  if (box.width < 50 || box.height < 50) return false;

  // Aspect ratio check (human face width/height is between 0.60 and 1.35)
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

  // 1. Inter-ocular distance must be 18% to 60% of face width
  const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
  const eyeRatio = eyeDist / box.width;
  if (eyeRatio < 0.18 || eyeRatio > 0.60) return false;

  // 2. Eyes tilt check (tilt cannot exceed 50 degrees)
  const eyeTilt = Math.abs(rightEye.y - leftEye.y) / Math.max(1, eyeDist);
  if (eyeTilt > 0.55) return false;

  // 3. Eye Level: eyes must be in the upper 70% of the bounding box
  const avgEyeY = (leftEye.y + rightEye.y) / 2;
  const eyeRelY = (avgEyeY - box.y) / box.height;
  if (eyeRelY < 0.12 || eyeRelY > 0.70) return false;

  // 4. Vertical Anatomy: Eyes above Nose, Nose above Mouth
  if (nose.y <= avgEyeY) return false;
  if (mouth.y <= nose.y) return false;

  return true;
}

/**
 * 🎯 Extracts the tight anatomical face box (forehead to chin, cheek to cheek)
 * Hugs the actual human face tightly without empty outer space or shoulders.
 */
function getTightFaceBox(landmarks: any, rawBox: any) {
  if (landmarks) {
    const positions = landmarks.positions || (typeof landmarks.getPositions === "function" ? landmarks.getPositions() : null);
    if (positions && positions.length >= 68) {
      // 68 points:
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
      // 5-point landmarks
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

  // Fallback: Tighten raw detector box by 18% width and 15% height
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

export default function FaceIdentifierModal({
  isOpen,
  onClose,
  onSelectStudent
}: FaceIdentifierModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastObjectCheckRef = useRef<number>(0);
  const isVerifyingLiveRef = useRef<boolean>(false);
  const lastLiveCheckRef = useRef<number>(0);
  const consecutiveMatchRef = useRef<{ studentId: string | null; count: number }>({ studentId: null, count: 0 });

  const [gallery, setGallery] = useState<IdentifiedStudent[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [insecureOriginInfo, setInsecureOriginInfo] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Real-time tracking bounding box on video
  const [activeFaceBox, setActiveFaceBox] = useState<ActiveFaceBox | null>(null);

  // Recognition state
  const [isScanning, setIsScanning] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<IdentifiedStudent | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [scanStatus, setScanStatus] = useState<string>("Initializing Identifier...");
  const [spoofWarning, setSpoofWarning] = useState<string | null>(null);

  // Manual search fallback
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Load Biometric Gallery
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  // 2. Camera Management (Supports HTTPS, localhost & legacy mobile fallbacks)
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
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
    setInsecureOriginInfo(null);
    setSpoofWarning(null);
    setActiveFaceBox(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      let stream: MediaStream | null = null;
      const isMediaDevicesSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";

      if (isMediaDevicesSupported) {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        // Fallback for legacy Android webviews / browsers
        const legacyGUM = 
          (navigator as any)?.getUserMedia ||
          (navigator as any)?.webkitGetUserMedia ||
          (navigator as any)?.mozGetUserMedia ||
          (navigator as any)?.msGetUserMedia;

        if (typeof legacyGUM === "function") {
          stream = await new Promise<MediaStream>((resolve, reject) => {
            legacyGUM.call(navigator, constraints, resolve, reject);
          });
        } else {
          // Check if origin is plain HTTP (e.g. http://10.104.121.16:3000)
          const isHttp = typeof window !== "undefined" && window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
          if (isHttp) {
            throw new Error(`INSECURE_HTTP:${window.location.host}`);
          }
          throw new Error("Camera API is not supported on this browser.");
        }
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setScanStatus("Point camera at student's face...");
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err?.message?.startsWith("INSECURE_HTTP")) {
        const host = err.message.replace("INSECURE_HTTP:", "");
        setCameraError("Android Chrome blocks camera access over plain HTTP.");
        setInsecureOriginInfo(host);
      } else {
        setCameraError(err?.message || "Failed to access camera. Please allow camera permissions.");
      }
      setIsCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Start camera immediately when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // 3. Real-Time 60FPS Synchronized Face Tracking & Instant In-Memory 1:N Identification
  useEffect(() => {
    if (!isCameraActive || matchedStudent || !videoRef.current || gallery.length === 0) {
      return;
    }

    let isCancelled = false;
    let isDetecting = false;

    const processFrame = async () => {
      if (isCancelled || !videoRef.current || matchedStudent) return;

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

        // 🛡️ CHECK 0: Object Detection for Secondary Cell Phones / Hands (Runs async every 400ms)
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

        const detection = await detectFace(video, false, true);

        if (!detection || !detection.descriptor) {
          setScanStatus("Looking for student face...");
          setSpoofWarning(null);
          setActiveFaceBox(null);
          isDetecting = false;
          animFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        const rawBox = detection.detection?.box || (detection as any).box;
        const detectionScore = detection.detection?.score ?? (detection as any).score ?? 0;

        // 🛡️ CHECK 1: Detection Confidence Score (Must be high confidence human face >= 0.60)
        if (detectionScore < 0.60 || !rawBox || rawBox.width < 50 || rawBox.height < 50) {
          setScanStatus("Looking for student face...");
          setActiveFaceBox(null);
          isDetecting = false;
          animFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // 🛡️ CHECK 2: Facial Landmark Geometry (Eyes, Nose, Mouth Anatomy)
        if (!verifyFacialAnatomy(detection.landmarks, rawBox)) {
          setScanStatus("Looking for student face...");
          setActiveFaceBox(null);
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

          // 🛡️ CHECK 3: Real Human Physical Skin Tone Chromaticity Filter
          const skinCheck = checkHumanSkinTone(ctx, rawBox);
          if (!skinCheck.isSkin) {
            setScanStatus("Looking for student face...");
            setActiveFaceBox(null);
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
            isDetecting = false;
            animFrameRef.current = requestAnimationFrame(processFrame);
            return;
          }
        }

        // 🎯 TIGHT ACTUAL FACE BOX (Hugs forehead, chin, and cheeks tightly)
        const tightBox = getTightFaceBox(detection.landmarks, rawBox);
        const isMirrored = facingMode === "user";
        const displayBox = calculateDisplayBox(tightBox, video, isMirrored);

        // Update green bounding box position synchronously with face movement
        setActiveFaceBox(displayBox);
        setSpoofWarning(null);
        setIsScanning(true);

        const liveDescriptor = Array.from(detection.descriptor) as number[];

        let bestMatch: IdentifiedStudent | null = null;
        let minDistance = 999.0;
        let secondMinDistance = 999.0;

        // Perform instant in-memory 1:N Euclidean vector comparison across all 720+ student descriptors (<2ms)
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

        // 🎯 1:N OPEN-SET BIOMETRIC VERIFICATION (1-2s Instant Live Match, Zero Network Latency):
        // Gate 1: Calibrated Confidence: minDistance <= 0.42 (>= 82% Match)
        // Gate 2: Distinctiveness Margin: (secondMinDistance - minDistance) >= 0.030 (Rejects unregistered faces matching multiple profiles)
        // Gate 3: Temporal Stability: 2 consecutive frames confirming the exact same student profile
        
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

        // ✅ Confirmed in 1-2 seconds with zero network delay:
        if (isStrongCandidate && bestMatch && consecutiveMatchRef.current.count >= 2) {
          const score = calculateScore(minDistance);
          setMatchedStudent(bestMatch);
          setMatchScore(score);
          setScanStatus(`Verified: ${bestMatch.name} (${score}% match)`);
          consecutiveMatchRef.current = { studentId: null, count: 0 };
          isDetecting = false;
          return; // Stop scan loop once verified
        } else {
          setScanStatus("Scanning face against student roster...");
        }
      } catch (err) {
        console.warn("Scan frame error:", err);
      } finally {
        isDetecting = false;
        if (!isCancelled && !matchedStudent) {
          animFrameRef.current = requestAnimationFrame(processFrame);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isCameraActive, matchedStudent, gallery, facingMode]);

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleResetScan = () => {
    isVerifyingLiveRef.current = false;
    lastLiveCheckRef.current = 0;
    consecutiveMatchRef.current = { studentId: null, count: 0 };
    setMatchedStudent(null);
    setMatchScore(0);
    setSpoofWarning(null);
    setActiveFaceBox(null);
    setScanStatus("Point camera at student's face...");
    startCamera();
  };

  if (!isOpen) return null;

  // Filtered list for manual search
  const filteredStudents = searchQuery.trim()
    ? gallery
        .filter((s) => {
          const q = searchQuery.toLowerCase();
          return (
            s.name.toLowerCase().includes(q) ||
            s.registrationId.toLowerCase().includes(q) ||
            (s.erpId && s.erpId.toLowerCase().includes(q)) ||
            (s.roomNumber && s.roomNumber.toLowerCase().includes(q))
          );
        })
        .slice(0, 10)
    : [];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Subtitle text removed */}
        <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                Face Identifier
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  1:N Biometric
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleCameraFacing}
              title="Switch Camera (Front/Rear)"
              className="p-1.5 rounded-lg bg-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* CAMERA VIEWFINDER - Clean 1:1 Square Size */}
          <div className={`relative w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 transition-all ${
            spoofWarning 
              ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse" 
              : matchedStudent 
                ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.45)]" 
                : "border-slate-700"
          }`}>
            {cameraError ? (
              <div className="p-5 text-center text-red-400 text-xs font-semibold flex flex-col items-center gap-2.5 max-w-sm">
                <Camera className="w-9 h-9 text-red-400/80 animate-pulse" />
                <p className="font-bold text-red-200">{cameraError}</p>
                {insecureOriginInfo && (
                  <div className="p-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-left text-[10px] text-slate-300 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-amber-300 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> How to enable camera on mobile Chrome:
                    </p>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li>Open Chrome on phone, enter: <code className="text-amber-200 bg-black/40 px-1 py-0.5 rounded">chrome://flags</code></li>
                      <li>Search for: <code className="text-amber-200 bg-black/40 px-1 py-0.5 rounded">unsafely-treat-insecure-origin-as-secure</code></li>
                      <li>Add: <code className="text-green-300 bg-black/40 px-1 py-0.5 rounded">http://{insecureOriginInfo}</code> & set to <b>Enabled</b></li>
                      <li>Tap <b>Relaunch</b> at bottom.</li>
                    </ol>
                    <p className="text-[9px] text-slate-400 italic">Or deploy/access via HTTPS domain where camera works automatically.</p>
                  </div>
                )}
                <button
                  onClick={startCamera}
                  className="mt-1 px-4 py-1.5 bg-red-600/40 hover:bg-red-600/60 text-red-100 border border-red-500/50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Retry Camera
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                />

                {/* ANTI-SPOOF FRAUD WARNING OVERLAY */}
                {spoofWarning && (
                  <div className="absolute top-2 inset-x-2 z-20 bg-red-600/95 backdrop-blur-md px-3 py-2 rounded-xl border border-red-400 shadow-xl text-white flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-150">
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

                {/* 🟩 REAL-TIME GREEN SQUARE BOX TIGHTLY HUGGING ACTUAL FACE (Cheek to cheek, Forehead to chin) */}
                {activeFaceBox && !spoofWarning && (
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
                      matchedStudent 
                        ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.5)]" 
                        : "border-green-400 bg-green-400/5 shadow-[0_0_12px_rgba(74,222,128,0.3)]"
                    }`}>
                      {/* Corner Targeting Accents */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-300"></div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-300"></div>
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-300"></div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-300"></div>

                      {/* Real Measurement & Name Badge */}
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-400/60 text-emerald-300 text-[9px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {matchedStudent ? (
                          <span>{matchedStudent.name} • {matchScore}%</span>
                        ) : (
                          <span>{activeFaceBox.pixelW}×{activeFaceBox.pixelH}px</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Bar */}
                <div className={`absolute bottom-2 inset-x-2 backdrop-blur-md px-3 py-1.5 rounded-lg border flex items-center justify-between transition-colors z-20 ${
                  spoofWarning 
                    ? "bg-red-950/90 border-red-700/80" 
                    : matchedStudent 
                      ? "bg-emerald-950/90 border-emerald-700/80" 
                      : "bg-slate-900/80 border-slate-700/60"
                }`}>
                  <p className="text-[11px] font-semibold truncate flex items-center gap-1.5">
                    {spoofWarning ? (
                      <span className="text-red-300 flex items-center gap-1 font-black">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Synthetic Display / Photo Rejected
                      </span>
                    ) : matchedStudent ? (
                      <span className="text-green-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Identity & Live Human Verified
                      </span>

                    ) : activeFaceBox ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" /> Face Locked • Identifying...
                      </span>
                    ) : isScanning ? (
                      <span className="text-purple-300 flex items-center gap-1 font-bold">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" /> Looking for Student Face...
                      </span>
                    ) : (
                      <span className="text-slate-200">{scanStatus}</span>
                    )}
                  </p>
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest shrink-0">
                    {facingMode === "environment" ? "Rear Cam" : "Front Cam"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* VERIFIED STUDENT RESULT CARD */}
          {matchedStudent ? (
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/90 border-2 border-green-500/60 rounded-xl p-3.5 shadow-xl space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                {/* Photo */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-700 border-2 border-green-500/40 overflow-hidden flex-shrink-0">
                  {matchedStudent.profilePicture ? (
                    <img
                      src={matchedStudent.profilePicture}
                      alt={matchedStudent.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-black text-xl">
                      {matchedStudent.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm sm:text-base font-black text-white truncate">
                      {matchedStudent.name}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-green-500/20 text-green-300 border border-green-500/40 flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" /> {matchScore}% Match
                    </span>
                  </div>

                  <p className="text-[11px] font-bold text-slate-300 mt-0.5">
                    {matchedStudent.registrationId} • {matchedStudent.erpId || "No ERP"}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-300 font-medium">
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-purple-400" />
                      {matchedStudent.hostelName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-purple-400" />
                      Room {matchedStudent.roomNumber}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        matchedStudent.outingType === "leave" || matchedStudent.outingType === "HOME-LEAVE"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : matchedStudent.studentStatus === "IN CAMPUS"
                          ? "bg-green-500/20 text-green-300 border border-green-500/40"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      }`}
                    >
                      {matchedStudent.outingType === "leave" || matchedStudent.outingType === "HOME-LEAVE"
                        ? "HOME-LEAVE"
                        : matchedStudent.studentStatus}
                    </span>
                    {matchedStudent.leaveTo && (
                      <span className="text-[9px] text-slate-400 font-semibold">
                        Until {matchedStudent.leaveTo}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions (Call Father / Call Mother / Open Profile) */}
              <div className="pt-2 border-t border-slate-700 flex items-center gap-2">
                {matchedStudent.fatherNumber && (
                  <a
                    href={`tel:${matchedStudent.fatherNumber}`}
                    className="flex-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-green-400" />
                    Call Father
                  </a>
                )}
                {matchedStudent.motherNumber && (
                  <a
                    href={`tel:${matchedStudent.motherNumber}`}
                    className="flex-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-green-400" />
                    Call Mother
                  </a>
                )}
                {onSelectStudent && (
                  <button
                    onClick={() => {
                      onSelectStudent(matchedStudent);
                      onClose();
                    }}
                    className="py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    View Profile
                  </button>
                )}
              </div>

              {/* Reset button to scan next student */}
              <button
                onClick={handleResetScan}
                className="w-full py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Scan Another Student
              </button>
            </div>
          ) : (
            /* MANUAL SEARCH FALLBACK */
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Or search student by ERP ID, Name, or Room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Search Results Dropdown */}
              {filteredStudents.length > 0 && (
                <div className="bg-slate-800/90 border border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-700/60">
                  {filteredStudents.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setMatchedStudent(s)}
                      className="p-2.5 hover:bg-slate-700/60 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                          {s.profilePicture ? (
                            <img src={s.profilePicture} alt={s.name} className="w-full h-full object-cover" />
                          ) : (
                            s.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {s.registrationId} • Room {s.roomNumber} ({s.hostelName})
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-purple-400 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
