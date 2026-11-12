"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, ShieldCheck, ArrowLeft, Smartphone } from "lucide-react";

export interface SuperAdminQRChallengeData {
    challengeId: string;
    token?: string;
    qrPayload: string;
    expiresInSeconds?: number;
}

interface SuperAdminDesktopQRLoginProps {
    challengeData?: SuperAdminQRChallengeData | null;
    onCancel?: () => void;
    onSuccess?: () => void;
}

export default function SuperAdminDesktopQRLogin({
    challengeData,
    onCancel,
    onSuccess
}: SuperAdminDesktopQRLoginProps) {
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const pollIntervalRef = useRef<any>(null);
    const countdownIntervalRef = useRef<any>(null);

    const [challengeId, setChallengeId] = useState<string | null>(challengeData?.challengeId || null);
    const [timeLeft, setTimeLeft] = useState<number>(challengeData?.expiresInSeconds || 90);
    const [isLoading, setIsLoading] = useState<boolean>(!challengeData);
    const [isApproved, setIsApproved] = useState<boolean>(false);
    const [isExpired, setIsExpired] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Audio chime on desktop login success
    const playSuccessChime = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                gain.gain.setValueAtTime(0.15, now + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.28);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.3);
            });
        } catch (_) {}
    };

    const clearTimers = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
    };

    // Render payload to canvas and kick off timers & polling
    const renderQRAndStartListening = async (cid: string, payload: string, seconds: number = 90) => {
        clearTimers();
        setChallengeId(cid);
        setTimeLeft(seconds);
        setIsLoading(false);
        setIsApproved(false);
        setIsExpired(false);
        setError(null);

        // Draw QR code onto canvas
        if (canvasRef.current && payload) {
            try {
                await QRCode.toCanvas(canvasRef.current, payload, {
                    width: 175,
                    margin: 1,
                    color: {
                        dark: "#0f172a",
                        light: "#ffffff"
                    }
                });
            } catch (qrErr: any) {
                console.error("QR canvas render error:", qrErr);
            }
        }

        // Countdown timer
        let currentSeconds = seconds;
        countdownIntervalRef.current = setInterval(() => {
            currentSeconds -= 1;
            setTimeLeft(currentSeconds);
            if (currentSeconds <= 0) {
                clearTimers();
                setIsExpired(true);
            }
        }, 1000);

        // Polling approval status
        pollIntervalRef.current = setInterval(() => {
            checkApprovalStatus(cid);
        }, 1500);
    };

    // Generate new QR Login challenge (via API if expired or reloading)
    const generateChallenge = async () => {
        clearTimers();
        setIsLoading(true);
        setIsApproved(false);
        setIsExpired(false);
        setError(null);
        setTimeLeft(90);

        try {
            const res = await fetch("/api/super-admin/auth/qr-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create" })
            });

            const data = await res.json();

            if (!res.ok || !data.challengeId) {
                throw new Error(data.error || "Failed to generate QR code");
            }

            await renderQRAndStartListening(data.challengeId, data.qrPayload, data.expiresInSeconds || 90);
        } catch (err: any) {
            console.error("QR Code Generation Error:", err);
            setError(err.message || "Failed to load QR code");
            setIsLoading(false);
        }
    };

    // Poll for mobile phone approval
    const checkApprovalStatus = async (cid: string) => {
        try {
            const res = await fetch(`/api/super-admin/auth/qr-login?challengeId=${encodeURIComponent(cid)}`);
            const data = await res.json();

            if (data.status === "APPROVED") {
                clearTimers();
                setIsApproved(true);
                playSuccessChime();

                // Save userType to storage and cookie
                if (typeof window !== "undefined") {
                    localStorage.setItem("userType", "superadmin");
                    document.cookie = "userType=superadmin; path=/; max-age=315360000; SameSite=Lax";
                    document.cookie = "tenant-expired=false; path=/; max-age=315360000; SameSite=Lax";
                }

                if (onSuccess) {
                    onSuccess();
                } else {
                    setTimeout(() => {
                        router.push("/");
                    }, 1100);
                }
            } else if (data.status === "EXPIRED") {
                clearTimers();
                setIsExpired(true);
            }
        } catch (e) {
            // Transient network poll error, ignore
        }
    };

    useEffect(() => {
        if (challengeData?.challengeId && challengeData.qrPayload) {
            renderQRAndStartListening(
                challengeData.challengeId,
                challengeData.qrPayload,
                challengeData.expiresInSeconds || 90
            );
        } else {
            generateChallenge();
        }

        return () => {
            clearTimers();
        };
    }, [challengeData]);

    return (
        <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            {/* Security Badge Header */}
            <div className="flex items-center gap-2 mb-2 px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-full">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                    Step 2: Scan with Super Admin Phone
                </span>
            </div>

            <p className="text-[10.5px] text-slate-500 font-medium text-center mb-3 max-w-[260px] leading-snug">
                Password confirmed. Point your mobile scanner at this QR code to unlock the dashboard.
            </p>

            {/* QR Canvas Box */}
            <div className="relative p-3 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-sm flex flex-col items-center">
                <div className="relative w-[175px] h-[175px] bg-white rounded-xl overflow-hidden border border-slate-200/80 flex items-center justify-center p-1.5 shadow-inner">
                    <canvas
                        ref={canvasRef}
                        className={`transition-all duration-300 ${isLoading || isExpired || isApproved ? "opacity-10 blur-[2px]" : "opacity-100"}`}
                    />

                    {/* Loading State */}
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90">
                            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                            <span className="text-[9.5px] font-bold text-slate-500">Generating Secure QR...</span>
                        </div>
                    )}

                    {/* Expired State */}
                    {isExpired && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/95 text-white p-3 text-center rounded-xl">
                            <p className="text-[10px] font-bold text-slate-300">QR Code Expired</p>
                            <button
                                type="button"
                                onClick={generateChallenge}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[9.5px] font-black uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Reload QR</span>
                            </button>
                        </div>
                    )}

                    {/* Approved Success State */}
                    {isApproved && (
                        <div className="absolute inset-0 bg-emerald-950/95 text-white flex flex-col items-center justify-center gap-2 p-3 text-center rounded-xl animate-in zoom-in-95 duration-200">
                            <div className="w-11 h-11 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-lg">
                                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                                Verified & Approved!
                            </span>
                            <span className="text-[8.5px] text-emerald-200/90 font-medium">
                                Entering Super Admin Dashboard...
                            </span>
                        </div>
                    )}
                </div>

                {/* Status indicator */}
                <div className="mt-2 text-center">
                    {!isExpired && !isApproved && (
                        <div className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold text-slate-600 mb-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>Auto-expires in {timeLeft}s</span>
                        </div>
                    )}
                    <p className="text-[8.5px] text-slate-500 font-medium max-w-[200px] leading-tight">
                        On your phone: <span className="font-bold text-slate-700">Settings → PASS → Scan Desktop QR</span>
                    </p>
                </div>
            </div>

            {/* Back / Cancel Button */}
            {onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    className="mt-3.5 text-[9.5px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center gap-1 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back to Password</span>
                </button>
            )}
        </div>
    );
}
