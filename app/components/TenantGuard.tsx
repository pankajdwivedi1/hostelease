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

function AdminExpiredPortal({ status, handleLogout, utr, setUtr, submitting, error, setError, successMsg, isResubmitting, setIsResubmitting, handleRenewalSubmit, handleRazorpayPayment, billingHistory, loadingBillingHistory, generateInvoicePDF }: any) {
    const [view, setView] = useState<"suspended" | "history" | "renew">("suspended");

    if (view === "suspended") {
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
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setView("history")}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                            >
                                📊 View Subscription History
                            </button>
                            <button
                                onClick={() => setView("renew")}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                            >
                                💳 Renew Subscription Now
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white font-bold py-3 rounded-2xl transition-all text-[10px] uppercase tracking-widest mt-2"
                            >
                                Return to Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === "history") {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#050510] flex items-center justify-center p-4 text-white overflow-y-auto">
                <div className="w-full max-w-xl relative z-10 animate-in fade-in zoom-in duration-500">
                    <div className="text-center mb-6 space-y-2">
                        <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl text-white">
                            {status.name}
                        </h1>
                        <p className="text-gray-400 text-xs tracking-widest font-black uppercase">
                            Subscription History
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 border border-white/5 p-5 rounded-2xl">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Status</p>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                    <p className="text-lg font-black text-white uppercase">
                                        Expired
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-5 rounded-2xl">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Activated On</p>
                                <p className="text-lg font-black text-white">
                                    {status.startDate ? new Date(status.startDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                                </p>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-5 rounded-2xl col-span-2">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Expired On</p>
                                <p className="text-lg font-black text-rose-400">
                                    {status.endDate ? new Date(status.endDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                                </p>
                            </div>
                        </div>

                        {/* Invoice & Payment History */}
                        <div className="space-y-3 pt-2">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest px-1">Payment History & Invoices</p>
                            {loadingBillingHistory ? (
                                <div className="text-center py-4 text-xs text-gray-400">
                                    <div className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                    Loading history...
                                </div>
                            ) : !billingHistory || billingHistory.length === 0 ? (
                                <div className="text-center py-4 bg-white/5 rounded-2xl text-xs text-gray-500 font-bold uppercase">
                                    No transaction logs found
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {billingHistory.map((tx: any) => (
                                        <div key={tx.id} className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center justify-between text-xs font-bold">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white">₹{tx.amount?.toLocaleString("en-IN")}</span>
                                                    <span className="text-[9px] text-gray-500 font-medium">({tx.billingPeriod || "1 Year"})</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-medium font-mono select-all">
                                                    ID: {tx.utr || "N/A"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[9px] text-gray-500">{new Date(tx.date).toLocaleDateString("en-IN")}</span>
                                                <button
                                                    onClick={() => generateInvoicePDF(tx, status.name)}
                                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all text-[9px] uppercase tracking-wider"
                                                >
                                                    Invoice
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-white/10">
                            <button
                                onClick={() => setView("suspended")}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-black py-4 rounded-2xl transition-all text-xs uppercase tracking-widest"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setView("renew")}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all text-xs uppercase tracking-widest"
                            >
                                Renew Now
                            </button>
                        </div>
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
                <button onClick={() => setView("suspended")} className="mb-4 text-[10px] text-gray-400 hover:text-white uppercase tracking-widest font-black flex items-center gap-2">
                    ← Back to Notice
                </button>
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
                                    Your transaction reference is currently undergoing manual reconciliation by the Hosteleaze Finance Department. The portal will reactivate immediately upon confirmation.
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

                            {/* Razorpay Option */}
                            {status?.paymentSettings?.enableRazorpay ? (
                                <div className="bg-white/5 border border-white/5 p-6 rounded-2xl text-center space-y-4">
                                    <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/5 mb-2">
                                        <CreditCard className="w-8 h-8 text-indigo-400" />
                                    </div>
                                    <h3 className="font-black text-white text-lg uppercase tracking-tight">Instant Renewal</h3>
                                    <p className="text-gray-400 text-xs max-w-sm mx-auto">
                                        Pay via Razorpay for immediate automated subscription reactivation.
                                    </p>
                                    <button
                                        onClick={handleRazorpayPayment}
                                        disabled={submitting}
                                        className="inline-block mt-4 w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {submitting ? "Processing..." : "Pay with Razorpay"}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-6 bg-white/5 border border-white/5 p-5 rounded-2xl">
                                    {/* Bank details */}
                                    <div className="flex-1 space-y-4 text-xs">
                                        <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Developer Account</h3>

                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-gray-500 font-medium">Bank Name</p>
                                                <p className="text-white font-black tracking-tight text-sm">{status?.paymentSettings?.bankName || "PNB Bank"}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 font-medium">Account Name</p>
                                                <p className="text-white font-black tracking-tight text-sm">{status?.paymentSettings?.accountName || "DR. PANKAJ DWIVEDI"}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-gray-500 font-medium">Account Number</p>
                                                    <p className="text-white font-black tracking-tight text-sm select-all">{status?.paymentSettings?.accountNumber || "06102413001048"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 font-medium">IFSC Code</p>
                                                    <p className="text-white font-black tracking-tight text-sm select-all">{status?.paymentSettings?.ifsc || "PUNB0061010"}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 font-medium">UPI ID</p>
                                                <p className="text-[#00ff88] font-black tracking-tight text-sm select-all">{status?.paymentSettings?.upiId || "pankaj86.dwivedi-1@okicici"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* QR Code Column */}
                                    <div className="flex flex-col items-center justify-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                                        <div className="bg-white p-2 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden" style={{ width: 136, height: 136 }}>
                                            {status?.paymentSettings?.customQrCodeUrl ? (
                                                <img 
                                                    src={status.paymentSettings.customQrCodeUrl} 
                                                    alt="Payment QR Code" 
                                                    className="w-full h-full object-cover rounded-[10px]"
                                                />
                                            ) : (
                                                <QRCodeCanvas 
                                                    data={`upi://pay?pa=${status?.paymentSettings?.upiId || "pankaj86.dwivedi-1@okicici"}&pn=${encodeURIComponent(status?.paymentSettings?.accountName || "DR. PANKAJ DWIVEDI")}&cu=INR`} 
                                                    size={120} 
                                                />
                                            )}
                                        </div>
                                        <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                            <QrCode className="w-3.5 h-3.5" /> Scan QR to Pay
                                        </span>
                                    </div>
                                </div>
                            )}

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
                            <span>Need urgent activation? Contact support at <a href="mailto:support@hosteleaze.com" className="text-blue-400 hover:underline">support@hosteleaze.com</a></span>
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
                    </div>
                </div>
            </div>
        </div>
    );
}

function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && (window as any).Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
            resolve(true);
        };
        script.onerror = () => {
            resolve(false);
        };
        document.body.appendChild(script);
    });
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

    const [billingHistory, setBillingHistory] = useState<any[]>([]);
    const [loadingBillingHistory, setLoadingBillingHistory] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setUserType(localStorage.getItem("userType"));
        }
    }, [status]);

    const fetchBillingHistory = async () => {
        setLoadingBillingHistory(true);
        try {
            const res = await fetch("/api/admin/billing-history");
            const data = await res.json();
            if (data.success) {
                setBillingHistory(data.logs || []);
            }
        } catch (e) {
            console.error("Failed to fetch billing history:", e);
        } finally {
            setLoadingBillingHistory(false);
        }
    };

    useEffect(() => {
        if (status?.isExpired) {
            fetchBillingHistory();
        }
    }, [status?.isExpired]);

    const generateInvoicePDF = (tx: any, collegeName: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Popup blocker prevented opening invoice. Please allow popups for this site.");
            return;
        }
        
        const formattedDate = new Date(tx.date).toLocaleDateString("en-IN", { dateStyle: "long" });
        const invoiceNo = tx.id.replace('tx_', 'INV-').toUpperCase();
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice ${invoiceNo}</title>
                    <style>
                        * { box-sizing: border-box; }
                        body, table, th, td, h1, h2, h3, h4, p, div, span, button {
                            font-family: 'Cambria Math', Cambria, Georgia, serif !important;
                        }
                        body {
                            font-family: 'Cambria Math', Cambria, Georgia, serif !important;
                            margin: 0;
                            padding: 40px;
                            color: #333;
                            line-height: 1.5;
                        }
                        .invoice-box {
                            max-width: 800px;
                            margin: auto;
                            background: #fff;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #f3f4f6;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }
                        .logo {
                            font-size: 28px;
                            font-weight: 900;
                            color: #4f46e5;
                            text-transform: uppercase;
                            letter-spacing: -0.5px;
                        }
                        .title {
                            text-align: right;
                        }
                        .title h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 900;
                            color: #1f2937;
                            letter-spacing: -0.5px;
                        }
                        .details {
                            display: grid;
                            grid-template-cols: 1fr 1fr;
                            gap: 20px;
                            margin-bottom: 40px;
                        }
                        .details h3 {
                            margin: 0 0 8px 0;
                            font-size: 11px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            color: #9ca3af;
                            font-weight: 800;
                        }
                        .details p {
                            margin: 0;
                            font-size: 14px;
                            font-weight: 700;
                            color: #4b5563;
                        }
                        .table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 40px;
                        }
                        .table th {
                            background: #f9fafb;
                            border-bottom: 2px solid #e5e7eb;
                            color: #4b5563;
                            font-size: 11px;
                            font-weight: 800;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            padding: 12px 16px;
                            text-align: left;
                        }
                        .table td {
                            padding: 16px;
                            border-bottom: 1px solid #f3f4f6;
                            font-size: 14px;
                            font-weight: 600;
                            color: #1f2937;
                        }
                        .table tr:last-child td {
                            border-bottom: none;
                        }
                        .total-box {
                            display: flex;
                            justify-content: flex-end;
                            margin-bottom: 50px;
                        }
                        .total-table {
                            width: 250px;
                            font-size: 14px;
                        }
                        .total-table tr td {
                            padding: 8px 0;
                        }
                        .total-table tr td:last-child {
                            text-align: right;
                            font-weight: 700;
                        }
                        .grand-total {
                            font-size: 18px;
                            font-weight: 900;
                            color: #111827;
                            border-top: 2px solid #e5e7eb;
                            padding-top: 12px;
                        }
                        .footer {
                            border-top: 2px solid #f3f4f6;
                            padding-top: 20px;
                            text-align: center;
                            font-size: 12px;
                            color: #9ca3af;
                            font-weight: 600;
                            margin-top: 50px;
                        }
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                        .print-btn {
                            background: #4f46e5;
                            color: #fff;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-weight: 700;
                            font-size: 14px;
                            cursor: pointer;
                            box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06);
                            transition: all 0.2s;
                            margin-bottom: 20px;
                        }
                        .print-btn:hover {
                            background: #4338ca;
                        }
                    </style>
                </head>
                <body>
                    <div style="max-width: 800px; margin: auto;" class="no-print">
                        <button onclick="window.print()" class="print-btn">Print / Save as PDF</button>
                    </div>
                    <div class="invoice-box">
                        <div class="header">
                            <div class="logo">Hosteleaze</div>
                            <div class="title">
                                <h1>TAX INVOICE</h1>
                                <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 700; color: #6b7280;">No: ${invoiceNo}</p>
                            </div>
                        </div>
                        
                        <div class="details">
                            <div>
                                <h3>Billed To</h3>
                                <p style="font-size: 16px; color: #111827; margin-bottom: 4px;">${collegeName || "Partner College"}</p>
                                <p style="font-size: 12px; font-weight: 500; color: #9ca3af;">Subscription Client</p>
                            </div>
                            <div style="text-align: right;">
                                <h3>Billed From</h3>
                                <p style="font-size: 16px; color: #111827; margin-bottom: 4px;">Hosteleaze Inc.</p>
                                <p style="font-size: 12px; font-weight: 500; color: #9ca3af; margin-bottom: 2px;">Developer Account: DR. PANKAJ DWIVEDI</p>
                                <p style="font-size: 12px; font-weight: 500; color: #9ca3af;">Email: support@hosteleaze.com</p>
                            </div>
                        </div>

                        <div class="details" style="margin-bottom: 30px;">
                            <div>
                                <h3>Invoice Date</h3>
                                <p>${formattedDate}</p>
                            </div>
                            <div style="text-align: right;">
                                <h3>Payment Method</h3>
                                <p>Razorpay (Instant Online Renewal)</p>
                            </div>
                        </div>

                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Item Description</th>
                                    <th style="text-align: right;">Billing Period</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <div style="font-weight: 700; color: #111827;">Hosteleaze Campus Management Software License</div>
                                        <div style="font-size: 12px; color: #6b7280; font-weight: 500; margin-top: 4px;">Full Administrative & Warden Gatepass Portals Access</div>
                                    </td>
                                    <td style="text-align: right;">${tx.billingPeriod || "1 Year"}</td>
                                    <td style="text-align: right;">₹${tx.amount?.toLocaleString("en-IN") || 0}.00</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="total-box">
                            <table class="total-table">
                                <tr>
                                    <td>Subtotal</td>
                                    <td>₹${tx.amount?.toLocaleString("en-IN") || 0}.00</td>
                                </tr>
                                ${(tx.extraDiscountType === "amount" || (tx.extraDiscountAmount && Number(tx.extraDiscountAmount) > 0)) ? `
                                <tr>
                                    <td style="color: #7e22ce; font-weight: 700;">🌟 Special Concession</td>
                                    <td style="color: #7e22ce; font-weight: 700;">-₹${(Number(tx.extraDiscountAmount) || Number(tx.extraDiscountValue) || 0).toLocaleString("en-IN")}.00</td>
                                </tr>
                                ` : (tx.extraDiscountPercent && Number(tx.extraDiscountPercent) > 0) ? `
                                <tr>
                                    <td style="color: #7e22ce; font-weight: 700;">🌟 Special Concession (${tx.extraDiscountPercent}%)</td>
                                    <td style="color: #7e22ce; font-weight: 700;">Applied</td>
                                </tr>
                                ` : ''}
                                <tr>
                                    <td>Tax (0%)</td>
                                    <td>₹0.00</td>
                                </tr>
                                <tr class="grand-total">
                                    <td>Total Paid</td>
                                    <td style="color: #4f46e5;">₹${tx.amount?.toLocaleString("en-IN") || 0}.00</td>
                                </tr>
                            </table>
                        </div>

                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 12px; margin-bottom: 40px;">
                            <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 800; margin-bottom: 6px;">Payment Verification Proof</p>
                            <p style="margin: 0; font-family: monospace; font-size: 13px; font-weight: 700; color: #1f2937;">Transaction / Payment ID: ${tx.utr || "N/A"}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 500; color: #10b981;">✓ Paid Successfully & Verified</p>
                        </div>

                        <div class="footer">
                            <p style="margin: 0; font-size: 14px; font-weight: 800; color: #4b5563; margin-bottom: 6px;">Thank you for using Hosteleaze!</p>
                            <p style="margin: 0;">This is a computer-generated tax invoice receipt. No signature is required.</p>
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

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

    const handleRazorpayPayment = async () => {
        try {
            setSubmitting(true);
            setError("");

            // 1. Load Razorpay Script
            const res = await loadRazorpayScript();
            if (!res) {
                setError("Razorpay SDK failed to load. Please check your internet connection.");
                setSubmitting(false);
                return;
            }

            // 2. Create Order
            const orderRes = await fetch("/api/admin/create-razorpay-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId: status.tenantId })
            });
            const orderData = await orderRes.json();

            if (!orderData.success) {
                setError(orderData.error || "Failed to initiate payment. Please contact support.");
                setSubmitting(false);
                return;
            }

            // 3. Open Razorpay Checkout
            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: orderData.collegeName,
                description: "Software Subscription Renewal (1 Year)",
                order_id: orderData.orderId,
                handler: async function (response: any) {
                    try {
                        setSubmitting(true);
                        // 4. Verify Payment on our backend
                        const verifyRes = await fetch("/api/admin/verify-razorpay-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                tenantId: status.tenantId
                            })
                        });
                        
                        const verifyData = await verifyRes.json();
                        if (verifyData.success) {
                            // Instantly grant access by reloading the page
                            window.location.reload();
                        } else {
                            setError(verifyData.error || "Payment verification failed. Please contact support.");
                            setSubmitting(false);
                        }
                    } catch (err) {
                        setError("An error occurred during verification.");
                        setSubmitting(false);
                    }
                },
                prefill: {
                    name: "College Administrator"
                },
                theme: {
                    color: "#4f46e5"
                }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.on('payment.failed', function (response: any) {
                setError(`Payment failed: ${response.error.description}`);
                setSubmitting(false);
            });
            paymentObject.open();

        } catch (err) {
            setError("Network error initializing payment.");
            setSubmitting(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = "/login?logout=success";
    };

    // ⚡ IN-MEMORY CACHE: Prevent firing /api/admin/subscription-status on every sub-route transition
    const lastCheckRef = useRef<{ data: any; timestamp: number } | null>(null);

    useEffect(() => {
        // Don't guard the superadmin, login, or impersonation pages
        if (pathname.startsWith("/superadmin") || pathname.startsWith("/login") || pathname.startsWith("/auth/impersonate")) {
            setLoading(false);
            return;
        }

        // Check if we checked subscription status in the last 5 minutes
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        if (lastCheckRef.current && Date.now() - lastCheckRef.current.timestamp < CACHE_TTL) {
            setStatus(lastCheckRef.current.data);
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
                    lastCheckRef.current = { data, timestamp: Date.now() };
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

    // We removed the 'loading' blocking screen. 
    // The page will now load INSTANTLY. 
    // If the tenant is expired, the Guard check will silently finish in the background 
    // and overlay the Suspended screen dynamically without making the user wait for the API!
    if (status?.isExpired) {
        // Only allow staff/admin/superadmin roles to see the payment renewal portal
        const canSeeRenewal = userType && ["admin", "dean", "gatepass", "warden", "campus", "superadmin"].includes(userType.toLowerCase());

        // Basic user suspended screen (Screenshot 2)
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

        // Admin Flow
        return (
            <AdminExpiredPortal 
                status={status} 
                handleLogout={handleLogout} 
                utr={utr} 
                setUtr={setUtr} 
                submitting={submitting} 
                error={error} 
                setError={setError} 
                successMsg={successMsg} 
                isResubmitting={isResubmitting} 
                setIsResubmitting={setIsResubmitting} 
                handleRenewalSubmit={handleRenewalSubmit} 
                handleRazorpayPayment={handleRazorpayPayment}
                billingHistory={billingHistory}
                loadingBillingHistory={loadingBillingHistory}
                generateInvoicePDF={generateInvoicePDF}
            />
        );
    }

    return children;
}
