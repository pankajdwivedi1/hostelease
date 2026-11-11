"use client";

import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, Smartphone, AlertCircle, CheckCircle2, RefreshCw, X } from "lucide-react";

interface GooglePromptPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GooglePromptPCModal({
  isOpen,
  onClose,
  onSuccess
}: GooglePromptPCModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [correctNumber, setCorrectNumber] = useState<number | null>(null);
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "EXPIRED">("PENDING");
  const [timeLeft, setTimeLeft] = useState(90);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize a new challenge when modal opens
  const initChallenge = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatus("PENDING");
    setTimeLeft(90);

    try {
      const res = await fetch("/api/super-admin/auth/google-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initialize prompt challenge");
      }

      setChallengeId(data.challengeId);
      setCorrectNumber(data.correctNumber);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to contact Master Security Phone");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initChallenge();
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || status !== "PENDING" || isLoading) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus("EXPIRED");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status, isLoading]);

  // Live polling (every 1s) to check if user approved on their phone
  useEffect(() => {
    if (!challengeId || status !== "PENDING" || !isOpen) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/super-admin/auth/google-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", challengeId })
        });

        const data = await res.json();
        if (data.status === "APPROVED") {
          setStatus("APPROVED");
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setTimeout(() => {
            onSuccess();
          }, 800);
        } else if (data.status === "REJECTED") {
          setStatus("REJECTED");
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        } else if (data.status === "EXPIRED") {
          setStatus("EXPIRED");
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      } catch (e) {
        console.warn("Polling error:", e);
      }
    }, 1000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [challengeId, status, isOpen, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#0d121d] border border-blue-500/30 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(59,130,246,0.2)] text-center flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Shield Icon / Status Indicator */}
        <div className="relative mb-4 mt-2">
          {status === "APPROVED" ? (
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
          ) : status === "REJECTED" ? (
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 animate-shake">
              <AlertCircle className="w-9 h-9" />
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full bg-blue-500/10 animate-ping" />
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Smartphone className="w-8 h-8 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-white tracking-wide">
          {status === "APPROVED"
            ? "Access Approved!"
            : status === "REJECTED"
            ? "Login Rejected"
            : status === "EXPIRED"
            ? "Prompt Expired"
            : "Check Your Phone"}
        </h3>

        <p className="text-xs text-gray-400 mt-1 max-w-[260px] leading-relaxed">
          {status === "APPROVED"
            ? "Your identity was confirmed on your Master Security Phone. Unlocking..."
            : status === "REJECTED"
            ? "This login attempt was rejected on your phone. Access denied."
            : status === "EXPIRED"
            ? "Verification took too long. Please try again."
            : "Hosteleaze sent a security prompt to your registered Master Phone."}
        </p>

        {/* Challenge Number Box */}
        {status === "PENDING" && !isLoading && correctNumber && (
          <div className="mt-5 w-full flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-1">
              Tap the matching number on phone:
            </span>
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-950/80 to-[#0a101f] border-2 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)] flex items-center justify-center">
              <span className="text-5xl font-black text-white tracking-tight tabular-nums drop-shadow-[0_2px_10px_rgba(59,130,246,0.5)]">
                {correctNumber}
              </span>
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-full mt-5">
              <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-1">
                <span>Expires in</span>
                <span className="tabular-nums text-blue-400">{timeLeft}s</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(timeLeft / 90) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="my-8 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs text-gray-400 font-medium">Connecting to Master Phone...</span>
          </div>
        )}

        {/* Error / Retry */}
        {(errorMessage || status === "EXPIRED" || status === "REJECTED") && (
          <div className="mt-4 w-full">
            <button
              onClick={initChallenge}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Send New Prompt</span>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-white/5 w-full flex items-center justify-center gap-1.5 text-[9.5px] text-gray-500 font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Zero-SMS Instant Phone Verification</span>
        </div>
      </div>
    </div>
  );
}
