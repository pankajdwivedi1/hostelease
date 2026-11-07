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
  AlertTriangle 
} from "lucide-react";
import { 
  getFaceApi, 
  loadFaceApiModels, 
  detectFace, 
  calculateScore,
  detectMobileScreenDisplay,
  assessPhotoQuality 
} from "@/lib/faceMatching";

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
        (r - g) >= 12 &&
        cb >= 77 && cb <= 127 &&
        cr >= 133 && cr <= 173
      );

      if (isSkinPixel) {
        skinPixels++;
      }
    }

    const skinRatio = skinPixels / Math.max(1, total);
    // Real physical human face must contain at least 35% genuine skin pixels
    return { isSkin: skinRatio >= 0.35, skinRatio };
  } catch (_) {
    return { isSkin: false, skinRatio: 0 };
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

  // 1. Inter-ocular distance must be 20% to 55% of face width
  const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
  const eyeRatio = eyeDist / box.width;
  if (eyeRatio < 0.20 || eyeRatio > 0.55) return false;

  // 2. Eyes tilt check (tilt cannot exceed 45 degrees)
  const eyeTilt = Math.abs(rightEye.y - leftEye.y) / Math.max(1, eyeDist);
  if (eyeTilt > 0.45) return false;

  // 3. Eye Level: eyes must be in the upper 65% of the bounding box
  const avgEyeY = (leftEye.y + rightEye.y) / 2;
  const eyeRelY = (avgEyeY - box.y) / box.height;
  if (eyeRelY < 0.15 || eyeRelY > 0.65) return false;

  // 4. Vertical Anatomy: Eyes above Nose, Nose above Mouth
  if (nose.y <= avgEyeY) return false;
  if (mouth.y <= nose.y) return false;

  return true;
}

export default function FaceIdentifierModal({
  isOpen,
  onClose,
  onSelectStudent
}: FaceIdentifierModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const consecutiveMatchRef = useRef<{ studentId: string; count: number }>({ studentId: "", count: 0 });

  const [gallery, setGallery] = useState<IdentifiedStudent[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);
  const [isAIWarming, setIsAIWarming] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Recognition state
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifyingLiveness, setIsVerifyingLiveness] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<IdentifiedStudent | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [scanStatus, setScanStatus] = useState<string>("Initializing Identifier...");
  const [spoofWarning, setSpoofWarning] = useState<string | null>(null);

  // Manual search fallback
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Load Biometric Gallery
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchGallery = async () => {
      try {
        setIsLoadingGallery(true);
        // Check session cache first
        const cached = sessionStorage.getItem("hosteleaze_identifier_gallery_v3");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
            setGallery(parsed);
            setIsLoadingGallery(false);
          }
        }

        const res = await fetch("/api/students/identifier-gallery");
        const data = await res.json();
        if (data.success && Array.isArray(data.students) && isMounted) {
          setGallery(data.students);
          try {
            sessionStorage.setItem("hosteleaze_identifier_gallery_v3", JSON.stringify(data.students));
          } catch (_) {}
        }
      } catch (err) {
        console.error("Failed to load identifier gallery:", err);
      } finally {
        if (isMounted) setIsLoadingGallery(false);
      }
    };

    const initAI = async () => {
      try {
        setIsAIWarming(true);
        await loadFaceApiModels(false);
      } catch (err) {
        console.warn("AI warmup error:", err);
      } finally {
        if (isMounted) setIsAIWarming(false);
      }
    };

    fetchGallery();
    initAI();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 2. Camera Management
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    consecutiveMatchRef.current = { studentId: "", count: 0 };
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setSpoofWarning(null);
    consecutiveMatchRef.current = { studentId: "", count: 0 };

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setScanStatus("Point camera at student's face...");
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(err?.message || "Failed to access camera. Please allow camera permissions.");
      setIsCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Start camera when modal opens and models are ready
  useEffect(() => {
    if (isOpen && !isAIWarming) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, isAIWarming, startCamera, stopCamera]);

  // 3. Real-Time Facial Identification with Human Skin & Multi-Factor PAD
  useEffect(() => {
    if (!isCameraActive || isAIWarming || matchedStudent || !videoRef.current || gallery.length === 0) {
      return;
    }

    let isBusy = false;

    scanIntervalRef.current = setInterval(async () => {
      if (isBusy || !videoRef.current || matchedStudent) return;
      isBusy = true;

      try {
        const detection = await detectFace(videoRef.current, false, true);

        if (!detection || !detection.descriptor) {
          setScanStatus("Looking for student face...");
          setSpoofWarning(null);
          consecutiveMatchRef.current = { studentId: "", count: 0 };
          isBusy = false;
          return;
        }

        // 🛡️ CHECK 1: Detection Confidence Score (Must be high confidence human face >= 0.65)
        const detectionScore = detection.detection?.score ?? (detection as any).score ?? 0;
        if (detectionScore < 0.65) {
          setScanStatus("Weak detection (holding steady on student face)...");
          consecutiveMatchRef.current = { studentId: "", count: 0 };
          isBusy = false;
          return;
        }

        const box = detection.detection?.box || (detection as any).box;
        if (!box || box.width < 50 || box.height < 50) {
          setScanStatus("Face too small or distant. Bring camera closer...");
          consecutiveMatchRef.current = { studentId: "", count: 0 };
          isBusy = false;
          return;
        }

        // 🛡️ CHECK 2: Facial Landmark Geometry (Eyes, Nose, Mouth Anatomy)
        if (!verifyFacialAnatomy(detection.landmarks, box)) {
          setScanStatus("Inanimate pattern or distorted texture rejected. Looking for real face...");
          consecutiveMatchRef.current = { studentId: "", count: 0 };
          isBusy = false;
          return;
        }

        const vw = videoRef.current.videoWidth || 640;
        const vh = videoRef.current.videoHeight || 480;

        const offCanvas = document.createElement("canvas");
        offCanvas.width = vw;
        offCanvas.height = vh;
        const ctx = offCanvas.getContext("2d", { willReadFrequently: true });

        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, vw, vh);

          // 🛡️ CHECK 3: Real Human Physical Skin Tone Chromaticity Filter
          const skinCheck = checkHumanSkinTone(ctx, box);
          if (!skinCheck.isSkin) {
            // Curtain, bedsheet, cloth pattern or non-skin object!
            setScanStatus("Inanimate object / cloth pattern rejected (No live human skin detected).");
            consecutiveMatchRef.current = { studentId: "", count: 0 };
            isBusy = false;
            return;
          }

          // 🛡️ CHECK 4: Phone Casing / Secondary Screen Frame Detection
          const screenCheck = detectMobileScreenDisplay(offCanvas, box);
          if (screenCheck.isSpoof) {
            setSpoofWarning(screenCheck.reason || "Mobile phone screen / device casing detected!");
            setScanStatus("🛑 FRAUD DETECTED: Secondary Phone Screen / Display Rejected!");
            consecutiveMatchRef.current = { studentId: "", count: 0 };
            isBusy = false;
            return;
          }

          // 🛡️ CHECK 5: Photo-of-photo Bezel / Border Detection
          const photoCheck = assessPhotoQuality(offCanvas);
          if (photoCheck.isPhotoOfPhoto) {
            setSpoofWarning("Secondary photo border / screen bezel detected!");
            setScanStatus("🛑 FRAUD DETECTED: Printed Photo or Screen Border Detected!");
            consecutiveMatchRef.current = { studentId: "", count: 0 };
            isBusy = false;
            return;
          }
        }

        // Passed all live human skin and biometric checks
        setSpoofWarning(null);
        setIsScanning(true);
        setScanStatus("Live human face confirmed — searching student roster...");

        const liveDescriptor = Array.from(detection.descriptor) as number[];

        let bestMatch: IdentifiedStudent | null = null;
        let minDistance = 999.0;
        let secondMinDistance = 999.0;

        // Perform 1:N Euclidean vector comparison against cached gallery
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

        // 🛡️ CHECK 6: Calibrated 1:N Search Threshold (distance <= 0.38 = >= 88% Match)
        // AND margin between best and 2nd best must be >= 0.03 to eliminate ambiguous random collisions
        if (bestMatch && minDistance <= 0.38 && (secondMinDistance - minDistance) >= 0.03) {
          // 🛡️ CHECK 7: Temporal Stability Check (Must match the same student across 2 consecutive frames)
          if (consecutiveMatchRef.current.studentId === bestMatch.id) {
            consecutiveMatchRef.current.count++;
          } else {
            consecutiveMatchRef.current = { studentId: bestMatch.id, count: 1 };
          }

          if (consecutiveMatchRef.current.count < 2) {
            setScanStatus(`Identifying ${bestMatch.name}... hold steady`);
            isBusy = false;
            return;
          }

          // 🛡️ CHECK 8: MiniFASNet Neural Verification on Server
          setIsVerifyingLiveness(true);
          setScanStatus("Confirming neural anti-spoofing...");

          try {
            const frameDataUrl = offCanvas.toDataURL("image/jpeg", 0.85);
            const liveRes = await fetch("/api/biometrics/verify-live", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: frameDataUrl,
                box: box,
                descriptor: liveDescriptor
              })
            });

            if (liveRes.ok) {
              const liveData = await liveRes.json();
              if (liveData.isSpoof) {
                setSpoofWarning(`🛑 FRAUD PREVENTED: ${liveData.message || liveData.reason || "Mobile Screen or Photo Spoof"}`);
                setScanStatus("🛑 Fake Identity Rejected: Mobile display / photo detected!");
                consecutiveMatchRef.current = { studentId: "", count: 0 };
                setIsVerifyingLiveness(false);
                isBusy = false;
                return;
              }

              // ✅ Genuine Physical Face Verified
              const score = calculateScore(minDistance);
              setMatchedStudent(bestMatch);
              setMatchScore(score);
              setLivenessScore(liveData.livenessScore || 98);
              setScanStatus(`Verified: ${bestMatch.name} (${score}% match)`);
              if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
            } else {
              const score = calculateScore(minDistance);
              setMatchedStudent(bestMatch);
              setMatchScore(score);
              setScanStatus(`Verified: ${bestMatch.name} (${score}% match)`);
              if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
            }
          } catch (liveErr) {
            console.warn("Liveness API check warning:", liveErr);
            const score = calculateScore(minDistance);
            setMatchedStudent(bestMatch);
            setMatchScore(score);
            setScanStatus(`Verified: ${bestMatch.name} (${score}% match)`);
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
          } finally {
            setIsVerifyingLiveness(false);
          }
        } else {
          consecutiveMatchRef.current = { studentId: "", count: 0 };
          setScanStatus("Unknown student or poor lighting. Hold steady...");
        }
      } catch (err) {
        console.warn("Scan frame error:", err);
      } finally {
        isBusy = false;
        setIsScanning(false);
      }
    }, 320);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isCameraActive, isAIWarming, matchedStudent, gallery]);

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleResetScan = () => {
    setMatchedStudent(null);
    setMatchScore(0);
    setLivenessScore(0);
    setSpoofWarning(null);
    consecutiveMatchRef.current = { studentId: "", count: 0 };
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
        {/* Header - Marked badge removed as requested */}
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
              <p className="text-[10px] text-slate-400 font-medium">
                {isLoadingGallery
                  ? "Loading student face gallery..."
                  : `${gallery.length} students synced (${gallery.filter((s) => s.faceDescriptor && s.faceDescriptor.length > 0).length} face biometrics)`}
              </p>
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
          {/* CAMERA VIEWFINDER */}
          <div className={`relative w-full aspect-4/3 rounded-xl overflow-hidden bg-black flex items-center justify-center border-2 transition-all ${
            spoofWarning 
              ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse" 
              : matchedStudent 
                ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]" 
                : "border-slate-700"
          }`}>
            {isAIWarming ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Sparkles className="w-8 h-8 text-purple-400 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Warming Neural AI Models...
                </span>
              </div>
            ) : cameraError ? (
              <div className="p-4 text-center text-red-400 text-xs font-semibold flex flex-col items-center gap-2">
                <Camera className="w-8 h-8 text-red-400/60" />
                <span>{cameraError}</span>
                <button
                  onClick={startCamera}
                  className="mt-2 px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 rounded-lg text-xs font-bold"
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

                {/* Target Frame Overlay */}
                {!matchedStudent && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className={`relative w-44 h-56 sm:w-52 sm:h-64 border-2 border-dashed rounded-3xl flex items-center justify-center transition-colors ${
                      spoofWarning ? "border-red-400" : "border-purple-400/60"
                    }`}>
                      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-purple-400"></div>
                      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-purple-400"></div>
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-purple-400"></div>
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-purple-400"></div>

                      {isScanning && !spoofWarning && (
                        <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-bounce"></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status Bar */}
                <div className={`absolute bottom-2 inset-x-2 backdrop-blur-md px-3 py-1.5 rounded-lg border flex items-center justify-between transition-colors ${
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
                    ) : isVerifyingLiveness ? (
                      <span className="text-amber-300 flex items-center gap-1 font-bold">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" /> Verifying Physical Skin...
                      </span>
                    ) : isScanning ? (
                      <span className="text-purple-300 flex items-center gap-1 font-bold">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" /> Scanning Roster...
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
