"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import GooglePromptPCModal from "@/app/components/GooglePromptPCModal";
import MasterPhoneBindingCard from "@/app/components/MasterPhoneBindingCard";
import { ShieldCheck, Smartphone, Laptop, QrCode, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SecurityTestPage() {
  const [isPCModalOpen, setIsPCModalOpen] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [correctNum, setCorrectNum] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate a live test challenge with QR code for immediate phone scanning
  const startTest = async () => {
    setLoginSuccess(false);
    try {
      const res = await fetch("/api/super-admin/auth/google-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" })
      });
      const data = await res.json();
      if (data.challengeId) {
        setActiveChallengeId(data.challengeId);
        setCorrectNum(data.correctNumber);

        // Generate full phone URL (use window.location.origin or local IP)
        const phoneUrl = `${window.location.origin}/security-prompt?challengeId=${data.challengeId}`;
        setQrCodeUrl(phoneUrl);

        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, phoneUrl, {
            width: 220,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
          });
        }
      }
    } catch (e) {
      console.error("Test start error:", e);
    }
  };

  useEffect(() => {
    startTest();
  }, []);

  // Poll for status while QR is active
  useEffect(() => {
    if (!activeChallengeId || loginSuccess) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/super-admin/auth/google-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", challengeId: activeChallengeId })
        });
        const data = await res.json();
        if (data.status === "APPROVED") {
          setLoginSuccess(true);
          clearInterval(interval);
        }
      } catch (e) {
        console.warn(e);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeChallengeId, loginSuccess]);

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 sm:p-8 flex flex-col items-center">
      {/* Header */}
      <div className="max-w-3xl w-full text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero-SMS Instant Security Test Lab</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          Test Instant Phone Verification Live
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-2 max-w-xl mx-auto leading-relaxed">
          Experience how computer login challenges work over the internet without cellular SMS.
        </p>
      </div>

      <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Scan QR or Open on Mobile */}
        <div className="bg-[#0c121e] border border-white/10 rounded-3xl p-6 flex flex-col items-center text-center shadow-xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-400 mb-2">
            <QrCode className="w-4 h-4" />
            <span>Test on Your Mobile</span>
          </div>

          <p className="text-xs text-gray-300 mb-4">
            Computer shows number:{" "}
            <span className="text-2xl font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 ml-1">
              {correctNum || "--"}
            </span>
          </p>

          {/* QR Canvas */}
          <div className="p-3 bg-white rounded-2xl shadow-lg mb-4 flex items-center justify-center">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>

          <p className="text-[11px] text-gray-400 leading-snug">
            1. Open your phone camera & scan this QR code.<br />
            2. Tap the matching number (<strong>{correctNum}</strong>) on your phone screen.<br />
            3. Watch this page approve instantly below!
          </p>

          {/* Direct link for testing in new tab or copying */}
          {qrCodeUrl && (
            <div className="mt-4 w-full">
              <a
                href={qrCodeUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Or Open Phone Screen in New Tab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Real-time verification badge */}
          {loginSuccess && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-black flex items-center justify-center gap-2 animate-bounce">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified & Approved in Real-Time!</span>
            </div>
          )}

          <button
            onClick={startTest}
            className="mt-4 text-[11px] text-gray-500 hover:text-white underline font-medium cursor-pointer"
          >
            Generate New Test Number
          </button>
        </div>

        {/* Step 2: Test the Modal Dialog & Register Phone */}
        <div className="flex flex-col gap-6">
          {/* PC Modal Simulator */}
          <div className="bg-[#0c121e] border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-400 mb-2">
                <Laptop className="w-4 h-4" />
                <span>Simulate PC Login Popup</span>
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Full-Screen PC Login Modal
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Click below to see the exact modal that will appear on a laptop or desktop when a Super Admin attempts to sign in.
              </p>
            </div>

            <button
              onClick={() => setIsPCModalOpen(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              <span>Launch PC Security Modal</span>
            </button>
          </div>

          {/* Master Phone Binding Card */}
          <MasterPhoneBindingCard />
        </div>
      </div>

      {/* PC Modal */}
      <GooglePromptPCModal
        isOpen={isPCModalOpen}
        onClose={() => setIsPCModalOpen(false)}
        onSuccess={() => {
          setIsPCModalOpen(false);
          alert("🎉 Access Granted! Computer is authenticated.");
        }}
      />
    </div>
  );
}
