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

function AdminExpiredPortal({ 
    status, 
    handleLogout, 
    utr, 
    setUtr, 
    submitting, 
    setSubmitting,
    error, 
    setError, 
    successMsg, 
    isResubmitting, 
    setIsResubmitting, 
    handleRenewalSubmit, 
    handleRazorpayPayment, 
    billingHistory, 
    loadingBillingHistory, 
    generateInvoicePDF,
    handleDirectPaymentSubmit
}: any) {
    const [view, setView] = useState<"suspended" | "history" | "renew">("suspended");
    const [selectedPlanMonths, setSelectedPlanMonths] = useState<number>(3);
    const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "bank">("razorpay");
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const switchView = (newView: "suspended" | "history" | "renew") => {
        if (setSubmitting) setSubmitting(false);
        if (setError) setError("");
        setView(newView);
    };

    // Pricing & Student calculations
    const studentCount = Number(status?.studentCount) || 524;
    const pricePerStudent = Number(status?.paymentSettings?.pricePerStudentPerMonth) || 25;
    const bankBonusPercent = status?.paymentSettings?.bankTransferDiscount !== undefined ? Number(status?.paymentSettings?.bankTransferDiscount) : 3;
    const d1 = status?.paymentSettings?.discount1Month !== undefined ? Number(status?.paymentSettings?.discount1Month) : 10;
    const d3 = status?.paymentSettings?.discount3Month !== undefined ? Number(status?.paymentSettings?.discount3Month) : 20;
    const d6 = status?.paymentSettings?.discount6Month !== undefined ? Number(status?.paymentSettings?.discount6Month) : 30;
    const d12 = status?.paymentSettings?.discount12Month !== undefined ? Number(status?.paymentSettings?.discount12Month) : 40;

    let planDiscountPercent = 0;
    if (selectedPlanMonths === 1) planDiscountPercent = d1;
    else if (selectedPlanMonths === 3) planDiscountPercent = d3;
    else if (selectedPlanMonths === 6) planDiscountPercent = d6;
    else if (selectedPlanMonths >= 12) planDiscountPercent = d12;

    const baseTotal = studentCount * pricePerStudent * selectedPlanMonths;
    const planDiscountAmount = (baseTotal * planDiscountPercent) / 100;
    const subtotalAfterPlanDiscount = baseTotal - planDiscountAmount;
    const bankBonusAmount = paymentMethod === "bank" ? (subtotalAfterPlanDiscount * bankBonusPercent) / 100 : 0;
    const finalTotal = Math.max(0, subtotalAfterPlanDiscount - bankBonusAmount);

    const bankName = status?.paymentSettings?.bankName || "PNB Bank";
    const accountName = status?.paymentSettings?.accountName || "DR. PANKAJ DWIVEDI";
    const accountNumber = status?.paymentSettings?.accountNumber || "06102413001048";
    const ifsc = status?.paymentSettings?.ifsc || "PUNB0061010";
    const upiId = status?.paymentSettings?.upiId || "pankaj86.dwivedi-1@okicici";
    const customQrUrl = status?.paymentSettings?.customQrCodeUrl || "";

    const upiNote = `Hosteleaze Renewal (${selectedPlanMonths}M) - ${status?.name || 'Node'}`;
    const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(accountName)}&am=${finalTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(upiNote)}`;

    const copyToClipboard = (text: string, fieldKey: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedField(fieldKey);
            setTimeout(() => setCopiedField(null), 2000);
        }
    };

    const formatINR = (val: number) => {
        return Number.isInteger(val)
            ? val.toLocaleString("en-IN")
            : val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const planOptions = [
        {
            months: 1,
            label: "1 MONTH",
            tag: "Monthly",
            discount: d1,
            points: [
                "Standard Base Tariff",
                `+${bankBonusPercent}% Bank or QR Bonus`,
                "GPS/WIFI Attendance & Gatepass",
                "Warden Controls & Parent Portal"
            ]
        },
        {
            months: 3,
            label: "3 MONTHS",
            tag: "Quarterly",
            discount: d3,
            points: [
                `${d3}% Plan Discount Applied`,
                `+${bankBonusPercent}% Bank or QR Bonus`,
                "GPS/WIFI Attendance & Gatepass",
                "Warden Controls & Parent Portal"
            ]
        },
        {
            months: 6,
            label: "6 MONTHS",
            tag: "Half-Yearly",
            discount: d6,
            badge: "Popular",
            points: [
                `${d6}% Plan Discount Applied`,
                `+${bankBonusPercent}% Bank or QR Bonus`,
                "GPS/WIFI Attendance & Gatepass",
                "Warden Controls & Parent Portal"
            ]
        },
        {
            months: 12,
            label: "12 MONTHS",
            tag: "Annual Plan",
            discount: d12,
            badge: "BEST VALUE",
            points: [
                `${d12}% Maximum Plan Discount`,
                `+${bankBonusPercent}% Bank or QR Bonus`,
                "GPS/WIFI Attendance & Gatepass",
                "Priority Server & Instant Support"
            ]
        },
    ];

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
                            {status?.daysRemaining && status.daysRemaining > 0 ? "Expiring Soon" : "Access Suspended"}
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
                                onClick={() => switchView("history")}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                            >
                                📊 View Subscription History
                            </button>
                            <button
                                onClick={() => switchView("renew")}
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
            <div className="fixed inset-0 z-[9999] bg-[#050510] flex items-center justify-center p-3 sm:p-4 text-white overflow-y-auto">
                <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in duration-500 my-auto">
                    <div className="text-center mb-4 sm:mb-6 space-y-1 sm:space-y-2">
                        <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight uppercase text-white">
                            {status.name}
                        </h1>
                        <p className="text-gray-400 text-[10px] sm:text-xs tracking-widest font-black uppercase">
                            Subscription History
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-xl space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                            <div className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                                <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Status</p>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${status.daysRemaining && status.daysRemaining > 0 ? "bg-amber-400" : "bg-red-500"}`}></span>
                                    <p className="text-sm sm:text-base md:text-lg font-black text-white uppercase">
                                        {status.daysRemaining && status.daysRemaining > 0 ? `${status.daysRemaining} Days Left` : "Expired"}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                                <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Activated On</p>
                                <p className="text-sm sm:text-base md:text-lg font-black text-white">
                                    {status.startDate ? new Date(status.startDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                                </p>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl col-span-2">
                                <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Subscription Valid Until (Midnight)</p>
                                <p className="text-sm sm:text-base md:text-lg font-black text-rose-400">
                                    {status.endDate ? `${new Date(status.endDate).toLocaleDateString("en-IN", { dateStyle: "medium" })} (11:59:59 PM)` : "N/A"}
                                </p>
                            </div>
                        </div>

                        {/* Invoice & Payment History */}
                        <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
                            <p className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-widest px-1">Payment History & Invoices</p>
                            {loadingBillingHistory ? (
                                <div className="text-center py-3 text-xs text-gray-400">
                                    <div className="inline-block w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                    Loading history...
                                </div>
                            ) : !billingHistory || billingHistory.length === 0 ? (
                                <div className="text-center py-3 bg-white/5 rounded-xl text-[10px] sm:text-xs text-gray-500 font-bold uppercase">
                                    No transaction logs found
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-40 sm:max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {billingHistory.map((tx: any) => (
                                        <div key={tx.id || tx.utr} className="bg-white/5 border border-white/5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between text-xs font-bold">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-white text-xs sm:text-sm">₹{tx.amount?.toLocaleString("en-IN")}</span>
                                                    <span className="text-[8px] sm:text-[9px] text-gray-500 font-medium">({tx.billingPeriod || "1 Year"})</span>
                                                </div>
                                                <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono select-all">
                                                    ID: {tx.utr || "N/A"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <span className="text-[8px] sm:text-[9px] text-gray-500">{new Date(tx.date || tx.createdAt).toLocaleDateString("en-IN")}</span>
                                                <button
                                                    onClick={() => generateInvoicePDF(tx, status.name)}
                                                    className="px-2 py-1 sm:px-2.5 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg sm:rounded-xl transition-all text-[8px] sm:text-[9px] uppercase tracking-wider"
                                                >
                                                    Invoice
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2.5 sm:gap-4 pt-3 sm:pt-4 border-t border-white/10">
                            <button
                                onClick={() => switchView("suspended")}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-black py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all text-[11px] sm:text-xs uppercase tracking-widest"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => switchView("renew")}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all text-[11px] sm:text-xs uppercase tracking-widest"
                            >
                                Renew Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // View: RENEW
    return (
        <div className="fixed inset-0 z-[9999] bg-[#050510]/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 text-white overflow-y-auto">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-5xl my-auto relative z-10 animate-in fade-in zoom-in duration-300">
                {/* Modal Container */}
                <div className="bg-[#0b1120] border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0e1629]">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg shadow-sm">
                                💳
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                                    SUBSCRIPTION PLAN RENEWAL
                                </h2>
                                <p className="text-[10px] text-gray-400 font-bold">
                                    {status.name || "University Portal"} • {status?.daysRemaining && status.daysRemaining > 0 ? `Expires in ${status.daysRemaining} Days` : 'Subscription Expired'}
                                </p>
                            </div>
                        </div>

                        <button 
                            onClick={() => switchView("suspended")} 
                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white flex items-center justify-center transition-colors text-sm font-bold"
                            title="Close / Back"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Pending Verification Banner (if submitted) */}
                    {(status.renewalStatus === 'pending' || successMsg) && !isResubmitting ? (
                        <div className="m-6 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-3">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                            </div>
                            <h3 className="text-sm font-black text-amber-400 uppercase tracking-tight">Payment Verification In Progress</h3>
                            <p className="text-gray-300 text-xs max-w-md mx-auto">
                                Your transaction reference <strong className="text-white font-mono">{successMsg || status.renewalUtr}</strong> has been submitted and is undergoing reconciliation.
                            </p>
                            <button
                                onClick={() => setIsResubmitting(true)}
                                className="text-[10px] text-amber-300 hover:text-white font-black uppercase tracking-widest underline"
                            >
                                Submit a different UTR or Plan
                            </button>
                        </div>
                    ) : (
                        /* 2-Column Content Grid */
                        <div className="p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
                            {/* Left Column (5 Cols): Stats & Plans */}
                            <div className="lg:col-span-5 space-y-3 sm:space-y-4 flex flex-col justify-between">
                                {/* Active Student Count & Tariff Card */}
                                <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between text-slate-800 shadow-md">
                                    <div>
                                        <p className="text-[8px] sm:text-[9.5px] font-black uppercase text-slate-400 tracking-wider">
                                            ACTIVE STUDENTS COUNT
                                        </p>
                                        <p className="text-base sm:text-2xl font-black text-slate-900 mt-0.5">
                                            {studentCount} Students
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] sm:text-[9.5px] font-black uppercase text-slate-400 tracking-wider">
                                            BASE TARIFF
                                        </p>
                                        <p className="text-base sm:text-2xl font-black text-blue-600 mt-0.5">
                                            ₹{pricePerStudent} <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">/ student / mo</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Select Duration Header */}
                                <div>
                                    <label className="block text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 sm:mb-2">
                                        SELECT SUBSCRIPTION DURATION
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                                        {planOptions.map((plan) => {
                                            const isSelected = selectedPlanMonths === plan.months;
                                            return (
                                                <button
                                                    key={plan.months}
                                                    type="button"
                                                    onClick={() => {
                                                        if (setSubmitting) setSubmitting(false);
                                                        if (setError) setError("");
                                                        setSelectedPlanMonths(plan.months);
                                                    }}
                                                    className={`relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 text-left flex flex-col justify-between transition-all bg-white shadow-sm ${
                                                        isSelected
                                                            ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20"
                                                            : "border-slate-200 hover:border-slate-300"
                                                    }`}
                                                >
                                                    {plan.badge && (
                                                        <span className={`absolute -top-2.5 left-2 px-1.5 py-0.5 text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-wider rounded shadow ${
                                                            plan.months === 12 ? "bg-amber-500 text-black font-extrabold" : "bg-blue-600 text-white"
                                                        }`}>
                                                            {plan.badge}
                                                        </span>
                                                    )}

                                                    <div className="flex items-start justify-between gap-1 w-full mt-0.5">
                                                        <div>
                                                            <p className={`text-[11px] sm:text-xs font-black uppercase ${isSelected ? "text-blue-600" : "text-slate-900"}`}>
                                                                {plan.label}
                                                            </p>
                                                            <p className="text-[8px] sm:text-[9px] text-slate-500 font-medium">{plan.tag}</p>
                                                        </div>
                                                        {plan.discount > 0 && (
                                                            <span className="text-[7px] sm:text-[8px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded uppercase">
                                                                {plan.discount}% OFF
                                                            </span>
                                                        )}
                                                    </div>

                                                    <ul className="space-y-0.5 mt-1.5 sm:mt-2 text-[7px] min-[400px]:text-[7.5px] sm:text-[8px] font-medium text-slate-600">
                                                        {plan.points.map((pt, idx) => (
                                                            <li key={idx} className="flex items-start gap-1 leading-tight">
                                                                <span className="text-blue-600 font-bold shrink-0">✓</span>
                                                                <span className="truncate">{pt}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Payment Method Toggle */}
                                <div>
                                    <label className="block text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 sm:mb-2">
                                        PAYMENT METHOD
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (setSubmitting) setSubmitting(false);
                                                if (setError) setError("");
                                                setPaymentMethod("razorpay");
                                            }}
                                            className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl border-2 font-black text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-all ${
                                                paymentMethod === "razorpay"
                                                    ? "border-blue-600 bg-blue-600 text-white shadow-md"
                                                    : "border-slate-700 bg-slate-800/80 text-gray-300 hover:bg-slate-700"
                                            }`}
                                        >
                                            <span>💳 Online Gateway</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (setSubmitting) setSubmitting(false);
                                                if (setError) setError("");
                                                setPaymentMethod("bank");
                                            }}
                                            className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl border-2 font-black text-[9px] min-[360px]:text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all relative ${
                                                paymentMethod === "bank"
                                                    ? "border-emerald-600 bg-emerald-600 text-white shadow-md"
                                                    : "border-slate-700 bg-slate-800/80 text-gray-300 hover:bg-slate-700"
                                            }`}
                                        >
                                            <span className="whitespace-nowrap">🏦 Direct Bank / QR</span>
                                            <span className="bg-amber-400 text-black text-[6.5px] min-[360px]:text-[7px] sm:text-[7.5px] font-black px-1 py-0.5 rounded shadow-sm shrink-0 whitespace-nowrap">
                                                +{bankBonusPercent}% OFF
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column (7 Cols): Payment Details & Summary */}
                            <div className="lg:col-span-7 flex flex-col justify-between space-y-3 sm:space-y-4">
                                {/* Top Content Box */}
                                {paymentMethod === "razorpay" ? (
                                    /* Razorpay Options Cards (Screenshot 2 Match) */
                                    <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 text-slate-800 shadow-md space-y-2.5 sm:space-y-3">
                                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                                <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-800">
                                                    SUPPORTED PAYMENT OPTIONS
                                                </h3>
                                            </div>
                                            <span className="px-1.5 sm:px-2 py-0.5 bg-blue-600 text-white text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-wider rounded">
                                                INSTANT RENEWAL
                                            </span>
                                        </div>

                                        {/* 4 White Tiles */}
                                        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                                            <div className="bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-center gap-2 sm:gap-2.5 shadow-sm">
                                                <div className="text-lg sm:text-xl">📱</div>
                                                <div>
                                                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-900">UPI & QR</p>
                                                    <p className="text-[8px] sm:text-[9px] text-slate-500">GPay, PhonePe, Paytm</p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-center gap-2 sm:gap-2.5 shadow-sm">
                                                <div className="text-lg sm:text-xl">💳</div>
                                                <div>
                                                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-900">CARDS</p>
                                                    <p className="text-[8px] sm:text-[9px] text-slate-500">Visa, Mastercard, RuPay</p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-center gap-2 sm:gap-2.5 shadow-sm">
                                                <div className="text-lg sm:text-xl">🏦</div>
                                                <div>
                                                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-900">NETBANKING</p>
                                                    <p className="text-[8px] sm:text-[9px] text-slate-500">SBI, HDFC, ICICI, Axis</p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-center gap-2 sm:gap-2.5 shadow-sm">
                                                <div className="text-lg sm:text-xl">👛</div>
                                                <div>
                                                    <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-900">WALLET & EMI</p>
                                                    <p className="text-[8px] sm:text-[9px] text-slate-500">Paytm, Mobikwik, EMI</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] sm:text-[9.5px] text-slate-500 font-medium">
                                            <span>🔒 256-Bit SSL Encrypted & Compliant</span>
                                            <span className="text-blue-600 font-bold">Razorpay Checkout</span>
                                        </div>
                                    </div>
                                ) : (
                                    /* Bank & QR Details View */
                                    <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 text-slate-800 shadow-md space-y-2.5 sm:space-y-3">
                                        
                                        {/* 🖥️ DESKTOP VIEW: Bank Details on LEFT, QR on RIGHT (Screenshot 4 Match) */}
                                        <div className="hidden sm:grid sm:grid-cols-12 gap-3.5 items-center">
                                            {/* Left Side: Bank Details (7 Cols) */}
                                            <div className="sm:col-span-7 space-y-1.5 text-xs">
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span className="text-slate-500 text-[10px] font-bold">Bank:</span>
                                                    <span className="font-black text-slate-800">{bankName}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span className="text-slate-500 text-[10px] font-bold">Account Holder:</span>
                                                    <span className="font-black text-slate-800">{accountName}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span className="text-slate-500 text-[10px] font-bold">Account No:</span>
                                                    <button type="button" onClick={() => copyToClipboard(accountNumber, "acc")} className="font-mono font-bold text-blue-600 flex items-center gap-1">
                                                        {accountNumber} {copiedField === "acc" ? "✓" : "📋"}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span className="text-slate-500 text-[10px] font-bold">IFSC Code:</span>
                                                    <button type="button" onClick={() => copyToClipboard(ifsc, "ifsc")} className="font-mono font-bold text-blue-600 flex items-center gap-1">
                                                        {ifsc} {copiedField === "ifsc" ? "✓" : "📋"}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 text-[10px] font-bold">UPI ID:</span>
                                                    <button type="button" onClick={() => copyToClipboard(upiId, "upi")} className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                                                        {upiId} {copiedField === "upi" ? "✓" : "📋"}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Right Side: Larger QR Code (5 Cols) (Screenshot 4 Match) */}
                                            <div className="sm:col-span-5 flex flex-col items-center justify-center text-center">
                                                <div className="relative p-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                                                    {customQrUrl ? (
                                                        <img src={customQrUrl} alt="QR" className="w-32 h-32 object-contain rounded-lg" />
                                                    ) : (
                                                        <div className="relative flex items-center justify-center">
                                                            <QRCodeCanvas data={upiDeepLink} size={120} level="H" />
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-5 h-5 bg-white rounded-full p-0.5 shadow-md flex items-center justify-center border border-slate-100">
                                                                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                                                                        <path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="white"/>
                                                                        <path d="M12 5.5C13.6 5.5 14.7 6.2 15.3 6.8L17.5 4.6C16.1 3.3 14.2 2.5 12 2.5C8.4 2.5 5.3 4.6 3.9 7.6L6.9 9.9C7.6 7.4 9.6 5.5 12 5.5Z" fill="#EA4335"/>
                                                                        <path d="M21.5 12.3C21.5 11.6 21.4 10.9 21.3 10.3H12V14.1H17.3C17.1 15.3 16.4 16.3 15.3 17L18.3 19.3C20.1 17.6 21.5 15.2 21.5 12.3Z" fill="#4285F4"/>
                                                                        <path d="M6.9 14.1C6.7 13.5 6.6 12.8 6.6 12C6.6 11.2 6.7 10.5 6.9 9.9L3.9 7.6C3.3 8.9 3 10.4 3 12C3 13.6 3.3 15.1 3.9 16.4L6.9 14.1Z" fill="#FBBC05"/>
                                                                        <path d="M12 21.5C14.7 21.5 17 20.6 18.3 19.3L15.3 17C14.5 17.6 13.4 18 12 18C9.6 18 7.6 16.1 6.9 13.6L3.9 15.9C5.3 18.9 8.4 21.5 12 21.5Z" fill="#34A853"/>
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <a
                                                    href={upiDeepLink}
                                                    className="text-[8.5px] font-black text-emerald-700 hover:text-emerald-800 uppercase mt-1 tracking-wide inline-flex items-center gap-0.5"
                                                >
                                                    📲 Tap QR to Pay
                                                </a>
                                            </div>
                                        </div>

                                        {/* 📱 MOBILE VIEW: Bank Details Top, QR on LEFT + UTR on RIGHT (Screenshot 1 & 3 Match) */}
                                        <div className="sm:hidden space-y-2">
                                            {/* Bank Details Table at Top */}
                                            <div className="space-y-1 text-[10px] border-b border-slate-100 pb-1.5">
                                                <div className="flex justify-between border-b border-slate-50 pb-0.5">
                                                    <span className="text-slate-500 text-[9px] font-bold">Bank:</span>
                                                    <span className="font-black text-slate-800">{bankName}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-50 pb-0.5">
                                                    <span className="text-slate-500 text-[9px] font-bold">Account Holder:</span>
                                                    <span className="font-black text-slate-800">{accountName}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-50 pb-0.5">
                                                    <span className="text-slate-500 text-[9px] font-bold">Account No:</span>
                                                    <button type="button" onClick={() => copyToClipboard(accountNumber, "acc")} className="font-mono font-bold text-blue-600 flex items-center gap-1">
                                                        {accountNumber} {copiedField === "acc" ? "✓" : "📋"}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-50 pb-0.5">
                                                    <span className="text-slate-500 text-[9px] font-bold">IFSC Code:</span>
                                                    <button type="button" onClick={() => copyToClipboard(ifsc, "ifsc")} className="font-mono font-bold text-blue-600 flex items-center gap-1">
                                                        {ifsc} {copiedField === "ifsc" ? "✓" : "📋"}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 text-[9px] font-bold">UPI ID:</span>
                                                    <button type="button" onClick={() => copyToClipboard(upiId, "upi")} className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                                                        {upiId} {copiedField === "upi" ? "✓" : "📋"}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Side-by-Side: Enlarged QR on LEFT, UTR Box on RIGHT */}
                                            <div className="grid grid-cols-12 gap-3 items-center pt-1">
                                                {/* Left: Enlarged QR Code (Screenshot 2 Match) */}
                                                <div className="col-span-7 flex flex-col items-center justify-center text-center">
                                                    <div className="relative p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center w-full max-w-[170px]">
                                                        {customQrUrl ? (
                                                            <img src={customQrUrl} alt="QR" className="w-full aspect-square object-contain rounded-lg" />
                                                        ) : (
                                                            <div className="relative flex items-center justify-center w-full">
                                                                <QRCodeCanvas data={upiDeepLink} size={140} level="H" className="w-full h-auto max-w-[140px]" />
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="w-5 h-5 bg-white rounded-full p-0.5 shadow-md flex items-center justify-center border border-slate-100">
                                                                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                                                                            <path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="white"/>
                                                                            <path d="M12 5.5C13.6 5.5 14.7 6.2 15.3 6.8L17.5 4.6C16.1 3.3 14.2 2.5 12 2.5C8.4 2.5 5.3 4.6 3.9 7.6L6.9 9.9C7.6 7.4 9.6 5.5 12 5.5Z" fill="#EA4335"/>
                                                                            <path d="M21.5 12.3C21.5 11.6 21.4 10.9 21.3 10.3H12V14.1H17.3C17.1 15.3 16.4 16.3 15.3 17L18.3 19.3C20.1 17.6 21.5 15.2 21.5 12.3Z" fill="#4285F4"/>
                                                                            <path d="M6.9 14.1C6.7 13.5 6.6 12.8 6.6 12C6.6 11.2 6.7 10.5 6.9 9.9L3.9 7.6C3.3 8.9 3 10.4 3 12C3 13.6 3.3 15.1 3.9 16.4L6.9 14.1Z" fill="#FBBC05"/>
                                                                            <path d="M12 21.5C14.7 21.5 17 20.6 18.3 19.3L15.3 17C14.5 17.6 13.4 18 12 18C9.6 18 7.6 16.1 6.9 13.6L3.9 15.9C5.3 18.9 8.4 21.5 12 21.5Z" fill="#34A853"/>
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <a
                                                        href={upiDeepLink}
                                                        className="text-[8px] font-black text-emerald-700 hover:text-emerald-800 uppercase mt-1 tracking-tight inline-flex items-center gap-0.5"
                                                    >
                                                        📲 Tap QR to Pay
                                                    </a>
                                                </div>

                                                {/* Right: UTR Input & helper box */}
                                                <div className="col-span-5 flex flex-col justify-center space-y-1.5">
                                                    <label className="block text-[8.5px] font-black uppercase text-slate-600 tracking-wider">
                                                        Enter UTR / Ref ID:
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="12-Digit UTR ID"
                                                        value={utr}
                                                        onChange={(e) => {
                                                            setUtr(e.target.value);
                                                            if (error) setError("");
                                                        }}
                                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-[11px] font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 text-center shadow-inner"
                                                    />
                                                    {error && <p className="text-red-500 text-[8px] font-bold text-center">{error}</p>}
                                                    <p className="text-[7.5px] font-bold text-slate-400 leading-tight pt-0.5">
                                                        Transfer via QR/Bank, then enter transaction UTR here.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop UTR Input Span */}
                                        <div className="hidden sm:block pt-2 border-t border-slate-100">
                                            <input
                                                type="text"
                                                placeholder="Enter 12-Digit Transaction UTR / Ref ID"
                                                value={utr}
                                                onChange={(e) => {
                                                    setUtr(e.target.value);
                                                    if (error) setError("");
                                                }}
                                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 text-center"
                                            />
                                            {error && <p className="text-red-500 text-[10px] font-bold text-center mt-1">{error}</p>}
                                        </div>
                                    </div>
                                )}

                                {/* Instructions & WhatsApp Verification Box (Screenshot 1 Match) */}
                                {paymentMethod === "bank" && (
                                    <div className="bg-[#fffbeb] border border-amber-200/80 rounded-xl sm:rounded-2xl p-2 sm:p-3 text-[8px] sm:text-[10px] text-amber-900 flex items-start gap-1.5 sm:gap-2 shadow-sm">
                                        <span className="text-xs sm:text-base leading-none shrink-0 mt-0.5">📱</span>
                                        <div className="space-y-0.5 leading-snug flex-1">
                                            <p className="font-black text-amber-950 uppercase tracking-wider text-[7.5px] sm:text-[9.5px]">
                                                Instructions & WhatsApp Verification:
                                            </p>
                                            <p className="font-bold text-amber-900/90 text-[7.5px] sm:text-[9.5px]">
                                                Make payment via Bank/QR code. Enter 12-digit <span className="font-black text-amber-950">UTR Number</span> below &amp; send screenshot to{" "}
                                                {(() => {
                                                    const planNameStr = selectedPlanMonths === 1 ? 'Monthly' : selectedPlanMonths === 3 ? 'Quarterly' : selectedPlanMonths === 6 ? 'Half-Yearly' : 'Annual Plan';
                                                    const collegeNameStr = status?.name || 'Oriental Group of Institutes (OGI)';
                                                    const waLines = [
                                                        `Hello, I have completed the direct transfer payment for *${collegeNameStr}*.`,
                                                        ``,
                                                        `*Subscription Details*:`,
                                                        `- *College*: ${collegeNameStr}`,
                                                        `- *Total Active Students*: ${studentCount} Students`,
                                                        `- *Selected Plan*: ${selectedPlanMonths} Month(s) (${planNameStr})`,
                                                        `- *Billing Formula*: ${studentCount} students × ${selectedPlanMonths} month(s) @ ₹${pricePerStudent}/mo`,
                                                        `- *Subtotal*: ₹${formatINR(baseTotal)}`,
                                                        `- *Discount Applied*: ${planDiscountPercent}% Plan OFF + ${bankBonusPercent}% Bank Bonus (-₹${formatINR(baseTotal - finalTotal)})`,
                                                        `- *Total Amount Paid*: ₹${formatINR(finalTotal)}`,
                                                        `- *Payment UTR / Ref No*: ${utr.trim() || '[Pending]'}`,
                                                        ``,
                                                        `Please verify and activate our subscription plan. Receipt screenshot attached.`
                                                    ];
                                                    const waNumber = status?.paymentSettings?.supportWhatsappNumber || '8269418956';
                                                    const waEncodedUrl = `https://wa.me/91${waNumber.replace(/[^0-9]/g, '')}?text=${waLines.map(l => encodeURIComponent(l)).join('%0A')}`;
                                                    return (
                                                        <a
                                                            href={waEncodedUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-black text-green-700 underline hover:text-green-800 inline-flex items-center gap-0.5 ml-0.5"
                                                        >
                                                            +{waNumber} 💬
                                                        </a>
                                                    );
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Bottom Dark Calculation & Action Card (Screenshot 2 Match) */}
                                <div className="bg-[#050b18] border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white space-y-1.5 sm:space-y-2.5">
                                    <div className="flex justify-between text-gray-300 text-[10px] sm:text-xs font-semibold">
                                        <span>Subtotal ({studentCount} students × {selectedPlanMonths} months)</span>
                                        <span>₹{formatINR(baseTotal)}</span>
                                    </div>

                                    {planDiscountAmount > 0 && (
                                        <div className="flex justify-between text-emerald-400 text-[10px] sm:text-xs font-semibold">
                                            <span>Discount ({planDiscountPercent}% Plan OFF)</span>
                                            <span>-₹{formatINR(planDiscountAmount)}</span>
                                        </div>
                                    )}

                                    {paymentMethod === "bank" && bankBonusAmount > 0 && (
                                        <div className="flex justify-between text-emerald-400 text-[10px] sm:text-xs font-semibold">
                                            <span>Extra Direct Bank / QR Bonus ({bankBonusPercent}% OFF)</span>
                                            <span>-₹{formatINR(bankBonusAmount)}</span>
                                        </div>
                                    )}

                                    <div className="pt-2 sm:pt-2.5 border-t border-slate-800 flex items-center justify-between">
                                        <div>
                                            <p className="text-[8px] sm:text-[9px] font-black uppercase text-gray-400 tracking-wider">
                                                TOTAL AMOUNT PAYABLE
                                            </p>
                                            <p className="text-xl sm:text-3xl font-black text-emerald-400">
                                                ₹{formatINR(finalTotal)}
                                            </p>
                                        </div>

                                        {paymentMethod === "razorpay" ? (
                                            <button
                                                onClick={() => handleRazorpayPayment(selectedPlanMonths)}
                                                disabled={submitting}
                                                className="px-4 sm:px-8 py-2.5 sm:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    "Pay & Renew ⚡"
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (handleDirectPaymentSubmit) {
                                                        handleDirectPaymentSubmit(finalTotal, selectedPlanMonths);
                                                    } else {
                                                        handleRenewalSubmit(e);
                                                    }
                                                }}
                                                disabled={submitting || !utr || utr.trim().length < 6}
                                                className="px-3.5 sm:px-8 py-2.5 sm:py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-lg sm:rounded-xl text-[10px] sm:text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        Submit Payment & Renew 🚀
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Support Links */}
                    <div className="px-6 py-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-center sm:text-left bg-[#0e1629]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-relaxed">
                            <span>Need assistance? <a href="mailto:support@hosteleaze.com" className="text-blue-400 hover:underline">support@hosteleaze.com</a></span>
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
            const res = await fetch("/api/admin/billing-history", { cache: "no-store" });
            if (!res.ok) {
                setBillingHistory([]);
                return;
            }
            const data = await res.json();
            if (data?.success && Array.isArray(data?.logs)) {
                setBillingHistory(data.logs);
            } else {
                setBillingHistory([]);
            }
        } catch (e) {
            // Silently fallback to empty array on network interruption
            setBillingHistory([]);
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

    const handleDirectPaymentSubmit = async (finalTotal: number, months: number = 12) => {
        if (!utr || utr.trim().length < 6 || utr.trim().length > 25) {
            setError("Please enter a valid transaction UTR reference (6 to 25 characters).");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const res = await fetch("/api/admin/submit-direct-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: status.tenantId,
                    utrNumber: utr.trim(),
                    months,
                    amount: finalTotal
                })
            });

            const data = await res.json();
            if (data.success) {
                // Also trigger settings renewal status update
                await fetch("/api/admin/submit-renewal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ utr: utr.trim() })
                }).catch(() => {});

                setSuccessMsg(utr.trim());
                setIsResubmitting(false);
                setStatus((prev: any) => ({
                    ...prev,
                    renewalUtr: utr.trim(),
                    renewalStatus: 'pending',
                    renewalSubmittedAt: new Date().toISOString(),
                    isExpired: false
                }));

                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                setError(data.error || "Failed to submit direct payment verification request.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRazorpayPayment = async (months: number = 12) => {
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
                body: JSON.stringify({ tenantId: status.tenantId, months })
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
                description: `Software Subscription Renewal (${months} Month${months > 1 ? 's' : ''})`,
                order_id: orderData.orderId,
                modal: {
                    ondismiss: function () {
                        setSubmitting(false);
                    }
                },
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
                                tenantId: status.tenantId,
                                months
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
                setSubmitting={setSubmitting}
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
                handleDirectPaymentSubmit={handleDirectPaymentSubmit}
            />
        );
    }

    return children;
}
