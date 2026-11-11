"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, Laptop, Clock, MapPin, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface GooglePromptPhoneScreenProps {
  challengeId: string;
}

export default function GooglePromptPhoneScreen({ challengeId }: GooglePromptPhoneScreenProps) {
  const [loading, setLoading] = useState(true);
  const [challengeData, setChallengeData] = useState<any>(null);
  const [resultState, setResultState] = useState<"IDLE" | "APPROVED" | "REJECTED" | "EXPIRED">("IDLE");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch challenge details
  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const res = await fetch(`/api/super-admin/auth/google-prompt?challengeId=${encodeURIComponent(challengeId)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Prompt expired or invalid");
        }
        setChallengeData(data);
        if (data.status === "EXPIRED") {
          setResultState("EXPIRED");
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load security prompt");
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [challengeId]);

  // Handle number tap
  const handleSelectNumber = async (num: number) => {
    if (isSubmitting || resultState !== "IDLE") return;
    setIsSubmitting(true);

    // Haptic feedback if supported
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }

    try {
      const res = await fetch("/api/super-admin/auth/google-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          challengeId,
          selectedNumber: num
        })
      });

      const data = await res.json();
      if (data.status === "APPROVED") {
        setResultState("APPROVED");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      } else {
        setResultState("REJECTED");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(300);
        }
      }
    } catch (e: any) {
      setErrorMsg("Failed to send response");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle "No, it's not me"
  const handleReject = async () => {
    if (isSubmitting || resultState !== "IDLE") return;
    setIsSubmitting(true);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    try {
      await fetch("/api/super-admin/auth/google-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          challengeId,
          rejected: true
        })
      });
      setResultState("REJECTED");
    } catch (e) {
      setErrorMsg("Failed to reject");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400 font-medium">Loading Security Prompt...</p>
      </div>
    );
  }

  if (errorMsg || resultState === "EXPIRED") {
    return (
      <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black mb-2">Prompt Expired or Invalid</h2>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed mb-6">
          {errorMsg || "This security challenge has already expired. Return to your computer and try logging in again."}
        </p>
      </div>
    );
  }

  // Success Screen
  if (resultState === "APPROVED") {
    return (
      <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-5 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Login Approved!</h2>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          Your computer is now authenticated and unlocked. You may close this window.
        </p>
      </div>
    );
  }

  // Rejection Screen
  if (resultState === "REJECTED") {
    return (
      <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center text-red-400 mb-5 shadow-[0_0_40px_rgba(239,68,68,0.3)]">
          <XCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Login Blocked</h2>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          The login attempt on the computer has been strictly rejected and stopped.
        </p>
      </div>
    );
  }

  const { clientInfo, options } = challengeData;

  return (
    <div className="min-h-screen bg-[#070b12] text-white flex flex-col items-center justify-between p-5 max-w-md mx-auto">
      {/* Top Banner */}
      <div className="w-full flex items-center justify-center gap-2 pt-4 pb-2 border-b border-white/10">
        <ShieldAlert className="w-5 h-5 text-amber-400" />
        <span className="text-xs font-black uppercase tracking-widest text-amber-300">
          Security Alert
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full my-auto flex flex-col items-center text-center py-6">
        <h1 className="text-2xl font-black text-white tracking-tight">
          Is it you trying to sign in?
        </h1>
        <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
          A computer is attempting to log into your Hosteleaze Super Admin account.
        </p>

        {/* Login metadata box */}
        <div className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 mt-5 text-left flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 text-xs text-gray-300 font-semibold">
            <Laptop className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{clientInfo.os} • {clientInfo.browser}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-gray-400 font-medium">
            <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{clientInfo.location} ({clientInfo.ip})</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-gray-400 font-medium">
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{clientInfo.timestamp} (Just now)</span>
          </div>
        </div>

        {/* Number match prompt */}
        <div className="mt-7 w-full flex flex-col items-center">
          <p className="text-xs font-bold text-gray-300 mb-4">
            Tap the number matching your computer screen:
          </p>

          <div className="grid grid-cols-3 gap-3 w-full">
            {options.map((num: number) => (
              <button
                key={num}
                onClick={() => handleSelectNumber(num)}
                disabled={isSubmitting}
                className="h-20 bg-gradient-to-b from-blue-600/20 to-blue-900/40 hover:from-blue-600/30 hover:to-blue-800/50 border-2 border-blue-500/40 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-blue-950 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reject Button at bottom */}
      <div className="w-full pb-6 flex flex-col items-center">
        <button
          onClick={handleReject}
          disabled={isSubmitting}
          className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>No, It&apos;s Not Me</span>
        </button>
        <span className="text-[10px] text-gray-500 font-medium mt-3">
          Tapping &quot;No&quot; will instantly block the attempt.
        </span>
      </div>
    </div>
  );
}
