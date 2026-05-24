"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { AlertCircle, Lock, ShieldAlert, CheckCircle2, CreditCard, Calendar, RefreshCw, QrCode, Loader2 } from "lucide-react";
import QRCode from "qrcode";

function QRCodeCanvas({ data, size = 120 }: { data: string; size?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !data) return;
        QRCode.toCanvas(canvasRef.current, data, {
            width: size,
            margin: 1,
            color: {
                dark: "#000000",
                light: "#ffffff"
            },
            errorCorrectionLevel: 'M'
        }, (error) => {
            if (error) console.error("QR Generation Error:", error);
            else if (canvasRef.current) {
                canvasRef.current.style.borderRadius = "16px";
            }
        });
    }, [data, size]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: size, height: size, display: 'block' }}
            className="border border-emerald-500/10 shadow-md shadow-emerald-500/5"
        />
    );
}

export default function TenantGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();
    const [userType, setUserType] = useState<string | null>(null);
    const [utr, setUtr] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [isResubmitting, setIsResubmitting] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setUserType(localStorage.getItem("userType"));
        }
    }, [status]);

    const handleRenewalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!utr || utr.trim().length < 6 || utr.trim().length > 25) {
            setError("Please enter a valid transaction UTR reference.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const res = await fetch("/api/admin/submit-renewal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ utr: utr.trim() })
            });

            const data = await res.json();
            if (data.success) {
                setSuccessMsg(data.renewalUtr);
                setIsResubmitting(false);
                setStatus((prev: any) => ({
                    ...prev,
                    renewalUtr: data.renewalUtr,
                    renewalStatus: data.renewalStatus,
                    renewalSubmittedAt: data.renewalSubmittedAt
                }));
            } else {
                setError(data.error || "Failed to submit renewal request.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = "/login?logout=success";
    };

    useEffect(() => {
        // Don't guard the superadmin, login, or impersonation pages
        if (pathname.startsWith("/superadmin") || pathname.startsWith("/login") || pathname.startsWith("/auth/impersonate")) {
            setLoading(false);
            return;
        }

        const checkStatus = async () => {
            try {
                const url = new URL("/api/admin/subscription-status", window.location.origin);
                const res = await fetch(url.href, { cache: "no-store" });
                
                if (!res.ok) {
                    console.warn(`Guard check failed with status: ${res.status}`);
                    return;
                }

                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    console.warn("Guard check returned non-JSON response");
                    return;
                }

                const data = await res.json();
                if (data.success) {
                    setStatus(data);
                }
            } catch (e) {
                console.error("Guard check failed", e);
            } finally {
                setLoading(false);
            }
        };

        checkStatus();
    }, [pathname]);

    if (loading) return children;

    // If expired or deactivated, show the RENEWAL PORTAL for the entire college
    if (status?.isExpired) {
        // Only allow staff/admin roles to see the payment renewal portal
        const canSeeRenewal = userType && ["admin", "dean", "gatepass", "warden", "campus"].includes(userType.toLowerCase());

        if (!canSeeRenewal) {
            return (
                <div className="fixed inset-0 z-[9999] bg-[#050510] flex flex-col items-center justify-center p-4 text-white overflow-y-auto">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>

                    <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500 flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center shadow-lg shadow-red-500/5 mb-2">
                            <ShieldAlert className="w-10 h-10 text-red-500" />
                        </div>
                        
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 font-bold uppercase tracking-wider mb-2">
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                                Access Suspended
                            </div>
                            <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                                {status.name || "University Node"}
                            </h1>
                            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-2">
                                Portal Offline
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl w-full">
                            <p className="text-gray-300 text-sm leading-relaxed mb-6">
                                Access to the digital campus portal is currently suspended. Please contact your college administration for further assistance.
                            </p>
                            <button
                                onClick={handleLogout}
                                className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                            >
                                Return to Login
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 z-[9999] bg-[#050510] flex items-center justify-center p-4 text-white overflow-y-auto">
                    {/* Animated Background Elements */}
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

                    <div className="w-full max-w-2xl my-8 relative z-10 animate-in fade-in zoom-in duration-500">
                        {/* Header */}
                        <div className="text-center mb-6 space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 font-bold uppercase tracking-wider">
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                                Subscription Expired
                            </div>
                            <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                                {status.name || "University Node"}
                            </h1>
                            <p className="text-gray-400 text-xs tracking-widest font-black uppercase">
                                Portal Offline • Action Required
                            </p>
                        </div>

                        {/* Renewal Portal Card */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl space-y-6 shadow-2xl relative">
                            {/* Previous subscription timeline */}
                            <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl text-center">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Activated On</p>
                                    <p className="text-sm font-black text-white mt-1">
                                        {status.startDate ? new Date(status.startDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                                    </p>
                                </div>
                                <div className="border-l border-white/5">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Expired On</p>
                                    <p className="text-sm font-black text-rose-400 mt-1">
                                        {status.endDate ? new Date(status.endDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                                    </p>
                                </div>
                            </div>

                            {/* Content based on submission status */}
                            {(status.renewalStatus === 'pending' || successMsg) && !isResubmitting ? (
                                <div className="space-y-6 text-center py-4 animate-in fade-in slide-in-from-bottom duration-300">
                                    <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/5">
                                        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-amber-400 uppercase tracking-tight">Payment Verification Pending</h3>
                                        <p className="text-gray-400 text-xs leading-relaxed max-w-md mx-auto">
                                            Your transaction reference is currently undergoing manual reconciliation by the Hostelease Finance Department. The portal will reactivate immediately upon confirmation.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-left max-w-sm mx-auto space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 font-medium">Submitted UTR:</span>
                                            <span className="text-white font-black tracking-wider uppercase">{successMsg || status.renewalUtr}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 font-medium">Status:</span>
                                            <span className="text-amber-400 font-black uppercase tracking-wider">Awaiting Verification</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 font-medium">Submitted At:</span>
                                            <span className="text-gray-300 font-bold">
                                                {status.renewalSubmittedAt ? new Date(status.renewalSubmittedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            onClick={() => setIsResubmitting(true)}
                                            className="text-[10px] text-gray-500 hover:text-white font-bold uppercase tracking-widest underline transition-colors"
                                        >
                                            Submit a different UTR
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="space-y-2 text-center md:text-left">
                                        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center justify-center md:justify-start gap-2">
                                            <CreditCard className="w-5 h-5 text-blue-500" />
                                            Renew Subscription
                                        </h2>
                                        <p className="text-gray-400 text-xs">
                                            Please transfer the subscription fee to the developer account and input the transaction UTR reference below.
                                        </p>
                                    </div>

                                    {/* Bank Details & QR code */}
                                    <div className="flex flex-col md:flex-row gap-6 bg-white/5 border border-white/5 p-5 rounded-2xl">
                                        {/* Bank details */}
                                        <div className="flex-1 space-y-4 text-xs">
                                            <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Developer Account</h3>

                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-gray-500 font-medium">Bank Name</p>
                                                    <p className="text-white font-black tracking-tight text-sm">PNB Bank</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 font-medium">Account Name</p>
                                                    <p className="text-white font-black tracking-tight text-sm">DR. PANKAJ DWIVEDI</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-gray-500 font-medium">Account Number</p>
                                                        <p className="text-white font-black tracking-tight text-sm select-all">06102413001048</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 font-medium">IFSC Code</p>
                                                        <p className="text-white font-black tracking-tight text-sm select-all">PUNB0061010</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 font-medium">UPI ID</p>
                                                    <p className="text-[#00ff88] font-black tracking-tight text-sm select-all">pankaj86.dwivedi-1@okicici</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* QR Code Column */}
                                        <div className="flex flex-col items-center justify-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                                            <div className="bg-white p-2 rounded-2xl shadow-xl">
                                                <QRCodeCanvas data="upi://pay?pa=pankaj86.dwivedi-1@okicici&pn=DR.%20PANKAJ%20DWIVEDI&cu=INR" size={120} />
                                            </div>
                                            <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                                <QrCode className="w-3.5 h-3.5" /> Scan QR to Pay
                                            </span>
                                        </div>
                                    </div>

                                    {/* UTR Form */}
                                    <form onSubmit={handleRenewalSubmit} className="space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <label htmlFor="utrInput" className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                Transaction Reference / UTR Number (12-Digit)
                                            </label>
                                            <input
                                                id="utrInput"
                                                type="text"
                                                placeholder="Enter UTR reference e.g., 215478965412"
                                                value={utr}
                                                onChange={(e) => {
                                                    setUtr(e.target.value);
                                                    if (error) setError("");
                                                }}
                                                disabled={submitting}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono tracking-widest text-center"
                                            />
                                            {error && (
                                                <p className="text-red-400 text-xs font-semibold text-center mt-1 animate-pulse">
                                                    {error}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            {isResubmitting && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsResubmitting(false)}
                                                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-4 px-6 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-blue-900/30 uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    "Submit Verification Request"
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
                                    <span>Need urgent activation? Contact support at <a href="mailto:support@hostelease.com" className="text-blue-400 hover:underline">support@hostelease.com</a></span>
                                    <span className="hidden sm:inline text-gray-600">•</span>
                                    <a 
                                        href="https://wa.me/918269418956" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center justify-center gap-1.5 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="text-[#25D366] shrink-0">
                                            <path d="M12.012 2C6.48 2 2 6.48 2 12.01c0 1.83.49 3.62 1.43 5.2L2 22l4.95-1.42a9.98 9.98 0 0 0 5.06 1.43h.01c5.53 0 10.01-4.48 10.01-10.01C22.03 6.48 17.54 2 12.012 2zm6.2 14.15c-.27.76-1.34 1.39-2.02 1.48-.68.09-1.57.12-2.52-.18a11.16 11.16 0 0 1-5.11-3.26c-1.36-1.36-2.28-2.92-2.52-3.87-.24-.95-.03-1.47.25-1.78.27-.3.6-.36.79-.36.19 0 .38 0 .54.01.17.01.39-.06.6.45.23.55.79 1.93.86 2.07.07.15.12.32.02.5-.09.19-.19.3-.38.53-.19.22-.38.37-.55.57-.19.21-.39.44-.17.82.22.38.97 1.6 2.08 2.58 1.43 1.28 2.62 1.67 3 1.85.38.18.61.15.83-.1.22-.26.97-1.12 1.22-1.51.25-.39.51-.32.86-.19.36.13 2.27 1.07 2.66 1.27.39.2.66.3.76.47.1.17.1.99-.17 1.75z"/>
                                        </svg>
                                        <span>WhatsApp: +91 82694 18956</span>
                                    </a>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="text-[10px] text-red-400 hover:text-red-300 font-black uppercase tracking-widest underline cursor-pointer self-center sm:self-auto"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
    }

    return children;
}
