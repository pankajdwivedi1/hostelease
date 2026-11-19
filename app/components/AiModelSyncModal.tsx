"use client";

import React, { useState, useEffect, useRef } from "react";
import { saveGalleryToIndexedDB } from "@/lib/localFaceGallery";
import { loadFaceApiModels } from "@/lib/faceMatching";
import { initClientMiniFASNet } from "@/lib/clientMiniFASNet";

interface AiModelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (studentCount: number) => void;
}

interface SyncFile {
  url: string;
  name: string;
  size: number;
}

const AI_MODEL_FILES: SyncFile[] = [
  { url: "/models/tiny_face_detector_model-weights_manifest.json", name: "TinyFace Manifest", size: 2953 },
  { url: "/models/tiny_face_detector_model-shard1", name: "TinyFace Weights (Shard 1)", size: 193321 },
  { url: "/models/face_landmark_68_tiny_model-weights_manifest.json", name: "TinyLandmarks Manifest", size: 4441 },
  { url: "/models/face_landmark_68_tiny_model-shard1", name: "TinyLandmarks Weights (Shard 1)", size: 77224 },
  { url: "/models/face_recognition_model-weights_manifest.json", name: "FaceRecognitionNet Manifest", size: 18303 },
  { url: "/models/face_recognition_model-shard1", name: "FaceRecognitionNet Weights (Shard 1)", size: 4194304 },
  { url: "/models/face_recognition_model-shard2", name: "FaceRecognitionNet Weights (Shard 2)", size: 2249728 },
  { url: "/models/MiniFASNetV2.onnx", name: "MiniFASNetV2 Anti-Spoof ONNX", size: 1743581 },
  { url: "/models/face_landmark_68_model-weights_manifest.json", name: "High-Res Landmarks Manifest", size: 7889 },
  { url: "/models/face_landmark_68_model-shard1", name: "High-Res Landmarks Weights", size: 356840 },
  { url: "/models/ssd_mobilenetv1_model-weights_manifest.json", name: "SSD MobileNet Manifest", size: 26548 },
  { url: "/models/ssd_mobilenetv1_model-shard1", name: "SSD MobileNet Weights (Shard 1)", size: 4194304 },
  { url: "/models/ssd_mobilenetv1_model-shard2", name: "SSD MobileNet Weights (Shard 2)", size: 1422653 },
];

const TOTAL_MODEL_BYTES = AI_MODEL_FILES.reduce((acc, f) => acc + f.size, 0);

export default function AiModelSyncModal({ isOpen, onClose, onSyncComplete }: AiModelSyncModalProps) {
  const [stage, setStage] = useState<"idle" | "downloading_models" | "syncing_gallery" | "warming_gpu" | "complete" | "error">("idle");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [currentAction, setCurrentAction] = useState<string>("Ready to sync AI models and biometric data to this PC.");
  const [studentCount, setStudentCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webGlStatus, setWebGlStatus] = useState<"checking" | "supported" | "disabled">("checking");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check WebGL / GPU support on mount
  useEffect(() => {
    if (!isOpen) return;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        setWebGlStatus("supported");
      } else {
        setWebGlStatus("disabled");
      }
    } catch (_) {
      setWebGlStatus("disabled");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startSync = async () => {
    setStage("downloading_models");
    setProgressPercent(0);
    setDownloadedBytes(0);
    setErrorMessage(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let accumulatedBytes = 0;

    try {
      // Open permanent browser Cache Storage if available
      let cache: Cache | null = null;
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          cache = await window.caches.open("hosteleaze-ai-models-v1");
        } catch (cErr) {
          console.warn("CacheStorage open note:", cErr);
        }
      }

      // Step 1: Download each model file with live percentage tracking
      for (let i = 0; i < AI_MODEL_FILES.length; i++) {
        if (abortController.signal.aborted) return;
        const file = AI_MODEL_FILES[i];
        setCurrentAction(`Downloading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);

        const res = await fetch(file.url, {
          signal: abortController.signal,
          cache: "reload", // force fresh download once to populate disk cache
        });

        if (!res.ok) {
          throw new Error(`Failed to download ${file.name} (HTTP ${res.status})`);
        }

        // Store into persistent browser CacheStorage
        if (cache) {
          try {
            await cache.put(file.url, res.clone());
          } catch (_) {}
        }

        // Stream reader to track accurate downloaded bytes
        const reader = res.body?.getReader();
        if (reader) {
          let fileBytesRead = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              fileBytesRead += value.length;
              accumulatedBytes += value.length;
              setDownloadedBytes(accumulatedBytes);
              const pct = Math.min(80, Math.round((accumulatedBytes / TOTAL_MODEL_BYTES) * 80));
              setProgressPercent(pct);
            }
          }
        } else {
          accumulatedBytes += file.size;
          setDownloadedBytes(accumulatedBytes);
          const pct = Math.min(80, Math.round((accumulatedBytes / TOTAL_MODEL_BYTES) * 80));
          setProgressPercent(pct);
        }
      }

      // Step 2: Download & permanently save all student biometric face descriptors
      if (abortController.signal.aborted) return;
      setStage("syncing_gallery");
      setCurrentAction("Syncing student biometric face descriptors from server...");
      setProgressPercent(85);

      const galleryRes = await fetch("/api/students/identifier-gallery", {
        signal: abortController.signal,
        cache: "no-store",
      });

      if (!galleryRes.ok) {
        throw new Error(`Failed to fetch student biometrics (HTTP ${galleryRes.status})`);
      }

      const galleryData = await galleryRes.json();
      const students = Array.isArray(galleryData?.students) ? galleryData.students : [];
      setStudentCount(students.length);

      // Save to IndexedDB & sessionStorage
      await saveGalleryToIndexedDB(students);

      // Broadcast event so active camera scanners update instantly in memory
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("hosteleaze:gallery_synced", { detail: students }));
      }

      setProgressPercent(92);

      // Step 3: Warm up TensorFlow.js & ONNX in GPU/WebGL RAM
      if (abortController.signal.aborted) return;
      setStage("warming_gpu");
      setCurrentAction("Compiling WebGL GPU shaders & pre-warming neural engine in RAM...");

      await Promise.allSettled([
        loadFaceApiModels(true),
        initClientMiniFASNet(),
      ]);

      setProgressPercent(100);
      setStage("complete");
      setCurrentAction(`Sync Complete! All ${AI_MODEL_FILES.length} AI models and ${students.length} student biometrics are permanently cached on this local PC.`);

      if (onSyncComplete) {
        onSyncComplete(students.length);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setCurrentAction("Sync cancelled.");
        setStage("idle");
      } else {
        console.error("Sync error:", err);
        setStage("error");
        setErrorMessage(err?.message || "Failed to complete AI and biometric sync. Check internet connection.");
      }
    }
  };

  const cancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStage("idle");
  };

  const isBusy = stage === "downloading_models" || stage === "syncing_gallery" || stage === "warming_gpu";

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-white">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-xl sm:text-2xl shadow-lg shadow-emerald-500/20">
              ⚡
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                Sync AI Models & Data
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Permanent Local Offline Cache for Campus PC
              </p>
            </div>
          </div>
          {!isBusy && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Hardware & GPU Diagnostics Pill */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-sm">🖥️</span>
              <span className="font-semibold text-slate-300">GPU / WebGL Shaders:</span>
            </div>
            {webGlStatus === "supported" ? (
              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold rounded-md text-[10px] uppercase">
                ✅ GPU Accelerated
              </span>
            ) : webGlStatus === "disabled" ? (
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-md text-[10px] uppercase" title="Enable Hardware Acceleration in Chrome Settings">
                ⚠️ GPU Disabled
              </span>
            ) : (
              <span className="text-slate-400 text-[10px]">Detecting...</span>
            )}
          </div>

          {/* Progress Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {stage === "complete" ? "✅" : isBusy ? "🔄" : "📦"}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {stage === "downloading_models" && "Step 1/3: AI Neural Weights"}
                  {stage === "syncing_gallery" && "Step 2/3: Biometric Descriptors"}
                  {stage === "warming_gpu" && "Step 3/3: Pre-Warming Shaders"}
                  {stage === "complete" && "Ready for Instant 1:N Matching"}
                  {stage === "idle" && "Ready To Provision Local PC"}
                  {stage === "error" && "Sync Interrupted"}
                </span>
              </div>
              <span className="text-base sm:text-xl font-black text-emerald-400 tabular-nums">
                {progressPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 border border-slate-700/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Current Action / File status */}
            <div className="text-[11px] text-slate-300 flex items-center justify-between">
              <span className="truncate pr-2">{currentAction}</span>
              {stage === "downloading_models" && (
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {(downloadedBytes / 1024 / 1024).toFixed(1)} / {(TOTAL_MODEL_BYTES / 1024 / 1024).toFixed(1)} MB
                </span>
              )}
            </div>
          </div>

          {/* Success summary badge */}
          {stage === "complete" && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                <span>🎉</span> This Campus PC is now 100% configured!
              </div>
              <p className="text-[11px] text-emerald-300/80">
                All 13 AI models ({((TOTAL_MODEL_BYTES) / 1024 / 1024).toFixed(1)} MB) and {studentCount} student face descriptors are stored permanently on this computer's hard disk. Face matching will now run with zero lag even offline.
              </p>
            </div>
          )}

          {/* Error Message */}
          {stage === "error" && errorMessage && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-300">
                <span>⚠️</span> Sync Failed
              </div>
              <p className="text-[11px] text-rose-300/80">{errorMessage}</p>
            </div>
          )}

          {/* WebGL warning if disabled */}
          {webGlStatus === "disabled" && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200">
              <span className="font-bold">⚠️ Notice for Campus PC:</span> Hardware acceleration is disabled in this browser. To ensure 60 FPS face tracking, open Chrome → Settings → System → Turn ON "Use graphics acceleration when available".
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2 sm:gap-3">
          {isBusy ? (
            <button
              onClick={cancelSync}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel
            </button>
          ) : stage === "complete" ? (
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              Done - Ready
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={startSync}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>Start Full Sync</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
