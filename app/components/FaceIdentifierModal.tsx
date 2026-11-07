"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Camera, RefreshCw, CheckCircle2, UserX, Phone, Search, Sparkles, Building, Hash, ShieldCheck } from "lucide-react";
import { getFaceApi, loadFaceApiModels, detectFace, calculateScore } from "@/lib/faceMatching";

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

export default function FaceIdentifierModal({
  isOpen,
  onClose,
  onSelectStudent
}: FaceIdentifierModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const [gallery, setGallery] = useState<IdentifiedStudent[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);
  const [isAIWarming, setIsAIWarming] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Recognition state
  const [isScanning, setIsScanning] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<IdentifiedStudent | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [scanStatus, setScanStatus] = useState<string>("Initializing Identifier...");

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
        const cached = sessionStorage.getItem("hosteleaze_identifier_gallery");
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
            sessionStorage.setItem("hosteleaze_identifier_gallery", JSON.stringify(data.students));
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
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      stopCamera();

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera is not supported on this device or connection.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

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

  // 3. Real-Time Facial Identification Loop
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
          isBusy = false;
          return;
        }

        setIsScanning(true);
        setScanStatus("Face detected — comparing with 720+ student records...");

        const liveDescriptor = Array.from(detection.descriptor) as number[];

        let bestMatch: IdentifiedStudent | null = null;
        let minDistance = 999.0;

        // Perform 1:N Euclidean vector comparison against cached gallery
        for (let i = 0; i < gallery.length; i++) {
          const candidate = gallery[i];
          if (!candidate.faceDescriptor || candidate.faceDescriptor.length === 0) continue;

          const dist = euclideanDistance(liveDescriptor, candidate.faceDescriptor);
          if (dist < minDistance) {
            minDistance = dist;
            bestMatch = candidate;
          }
        }

        // Calibrated Threshold: distance <= 0.48 equates to >= 75% biometric match
        if (bestMatch && minDistance <= 0.48) {
          const score = calculateScore(minDistance);
          setMatchedStudent(bestMatch);
          setMatchScore(score);
          setScanStatus(`Verified: ${bestMatch.name} (${score}% match)`);
          if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        } else {
          setScanStatus("Unknown student or poor lighting. Hold steady...");
        }
      } catch (err) {
        console.warn("Scan frame error:", err);
      } finally {
        isBusy = false;
        setIsScanning(false);
      }
    }, 350);

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
    setScanStatus("Point camera at student's face...");
    startCamera();
  };

  if (!isOpen) return null;

  // Filtered list for manual search fallback
  const filteredSearch = searchQuery.trim()
    ? gallery.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.registrationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.erpId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
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
              className="p-1.5 rounded-lg bg-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* CAMERA VIEWER & SCANNER */}
          <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
            {cameraError ? (
              <div className="p-4 text-center space-y-2">
                <Camera className="w-8 h-8 text-red-400 mx-auto" />
                <p className="text-xs text-red-300 font-medium">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
                >
                  Retry Camera
                </button>
              </div>
            ) : isAIWarming ? (
              <div className="p-4 text-center space-y-2">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-300 font-medium">Warming up Biometric Neural Models...</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                />

                {/* Target Frame Overlay */}
                {!matchedStudent && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative w-44 h-56 sm:w-52 sm:h-64 border-2 border-dashed border-purple-400/60 rounded-3xl flex items-center justify-center">
                      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-purple-400"></div>
                      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-purple-400"></div>
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-purple-400"></div>
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-purple-400"></div>

                      {isScanning && (
                        <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-bounce"></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status Bar */}
                <div className="absolute bottom-2 inset-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <p className="text-[11px] text-slate-200 font-semibold truncate flex items-center gap-1.5">
                    {matchedStudent ? (
                      <span className="text-green-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Identity Verified
                      </span>
                    ) : isScanning ? (
                      <span className="text-purple-300 flex items-center gap-1 font-bold">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" /> Scanning Roster...
                      </span>
                    ) : (
                      scanStatus
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
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-green-500/20 text-green-300 border border-green-500/40">
                      {matchScore}% Match
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
                  <div className="mt-2 flex items-center gap-1.5">
                    {matchedStudent.studentStatus === "out" ? (
                      matchedStudent.outingType?.toLowerCase().includes("leave") ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                          🏠 On Home-Leave
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          🚪 Outside (Gate-Pass)
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-green-500/20 text-green-300 border border-green-500/40 flex items-center gap-1">
                        ● In Campus
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 font-semibold">
                      {matchedStudent.branch} {matchedStudent.year}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-700/60">
                {matchedStudent.fatherNumber && (
                  <a
                    href={`tel:${matchedStudent.fatherNumber}`}
                    className="flex-1 py-1.5 px-2 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-green-400" />
                    Father
                  </a>
                )}
                {matchedStudent.motherNumber && (
                  <a
                    href={`tel:${matchedStudent.motherNumber}`}
                    className="flex-1 py-1.5 px-2 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-green-400" />
                    Mother
                  </a>
                )}
                {onSelectStudent && (
                  <button
                    onClick={() => {
                      onSelectStudent(matchedStudent);
                      onClose();
                    }}
                    className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    Full Profile
                  </button>
                )}
                <button
                  onClick={handleResetScan}
                  className="py-1.5 px-3 bg-slate-750 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-purple-400" />
                  Scan Next
                </button>
              </div>
            </div>
          ) : (
            /* MANUAL SEARCH FALLBACK */
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Or search student by name, registration ID, room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/90 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-700 focus:outline-none focus:border-purple-500"
                />
              </div>

              {filteredSearch.length > 0 && (
                <div className="bg-slate-800/90 rounded-xl border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
                  {filteredSearch.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => {
                        setMatchedStudent(student);
                        setMatchScore(100);
                        setSearchQuery("");
                      }}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 overflow-hidden flex-shrink-0">
                          {student.profilePicture ? (
                            <img src={student.profilePicture} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                              {student.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{student.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {student.registrationId} • Room {student.roomNumber} ({student.hostelName})
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase text-purple-400">Select</span>
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
