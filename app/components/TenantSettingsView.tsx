"use client";

import { useState, useEffect } from "react";

// Module-level cache to enable instant display on remount
let cachedSettings: any = null;
let cachedBillingHistory: any[] | null = null;

interface TenantSettingsViewProps {
    onRenew?: () => void;
    generateInvoicePDF?: (tx: any, collegeName: string) => void;
    mode?: "all" | "profile" | "subscription";
}

export default function TenantSettingsView({ onRenew, generateInvoicePDF, mode = "all" }: TenantSettingsViewProps = {}) {
    const [settings, setSettings] = useState<any>(cachedSettings);
    const [loading, setLoading] = useState(!cachedSettings);
    const [saving, setSaving] = useState(false);
    const [billingHistory, setBillingHistory] = useState<any[]>(cachedBillingHistory || []);
    const [loadingBilling, setLoadingBilling] = useState(!cachedBillingHistory);
    
    // Editable state
    const [contactName, setContactName] = useState(cachedSettings?.contactName || "");
    const [contactPhone, setContactPhone] = useState(cachedSettings?.contactPhone || "");
    const [totalHostelars, setTotalHostelars] = useState(cachedSettings?.totalHostelars || "");
    const [leaveApprovalMethod, setLeaveApprovalMethod] = useState(cachedSettings?.leaveApprovalMethod || "app");

    // OTP Modal state
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState("");
    const [maskedPhone, setMaskedPhone] = useState("");

    const fetchBillingHistory = async () => {
        try {
            if (!cachedBillingHistory) setLoadingBilling(true);
            const res = await fetch("/api/admin/billing-history");
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.success) {
                const logs = data.logs || [];
                setBillingHistory(logs);
                cachedBillingHistory = logs;
            }
        } catch (err) {
            console.warn("Error fetching billing history:", err);
        } finally {
            setLoadingBilling(false);
        }
    };

    const fetchSettings = async () => {
        if (!cachedSettings) {
            setLoading(true);
        }
        try {
            const res = await fetch("/api/admin/settings/get");
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.success && data.settings) {
                setSettings(data.settings);
                cachedSettings = data.settings;
                setContactName(data.settings.contactName || "");
                setContactPhone(data.settings.contactPhone || "");
                setTotalHostelars(data.settings.totalHostelars || "");
                setLeaveApprovalMethod(data.settings.leaveApprovalMethod || "app");
            }
        } catch (e: any) {
            console.error("Error loading settings:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchBillingHistory();
    }, []);

    const handleSaveClick = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings/update/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactPhone })
            });
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch (err) { data = { error: "Server response error. Please try again." }; }
            
            if (res.ok && data.success) {
                // message contains the masked phone number
                setMaskedPhone(data.message.split("to ")[1] || "your registered number");
                setShowOtpModal(true);
                setOtp("");
            } else {
                alert(data.error || "Failed to send OTP");
            }
        } catch (e: any) {
            alert("Error requesting OTP: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            return alert("Please enter a valid 6-digit OTP.");
        }
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings/update/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    otp,
                    contactName,
                    contactPhone,
                    totalHostelars,
                    leaveApprovalMethod
                })
            });
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch (err) { data = { error: "Failed to verify OTP due to server connection error." }; }

            if (res.ok && data.success) {
                // Update local state & module cache immediately so inputs never clear
                const updatedObj = {
                    ...(settings || {}),
                    contactName,
                    contactPhone,
                    totalHostelars,
                    leaveApprovalMethod
                };
                setSettings(updatedObj);
                cachedSettings = updatedObj;
                setShowOtpModal(false);
                alert("Settings updated successfully!");
                await fetchSettings(); // Refresh from backend
            } else {
                alert(data.error || "Invalid OTP");
            }
        } catch (e: any) {
            alert("Error verifying OTP: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        const loadingText = mode === "subscription" 
            ? "Loading Subscription & Billing..." 
            : mode === "profile" 
            ? "Loading Profile..." 
            : "Loading Settings...";
        return <div className="p-8 text-center text-gray-500 font-bold animate-pulse">{loadingText}</div>;
    }

    if (!settings) return null;

    const daysRemaining = settings.subscriptionEndDate 
        ? Math.max(0, Math.ceil((new Date(settings.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    const showSubscription = mode === "all" || mode === "subscription";
    const showProfile = mode === "all" || mode === "profile";

    return (
        <div className="space-y-4 sm:space-y-6 max-w-4xl px-1 sm:px-0 pt-1">
            <div className="bg-transparent sm:bg-white sm:rounded-3xl p-0 sm:p-6 md:p-8 sm:shadow-sm sm:border sm:border-slate-100">
                <div className="space-y-4 sm:space-y-6">
                    {/* Subscription & Billing Section */}
                    {showSubscription && (
                        <div className="bg-transparent sm:bg-indigo-50 sm:border sm:border-indigo-100 p-0 sm:p-6 sm:rounded-3xl space-y-3 sm:space-y-4">
                          <div className="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-6">
                            <span className="p-1.5 sm:p-3 bg-white text-indigo-600 rounded-lg sm:rounded-xl shadow-sm text-sm sm:text-xl border border-slate-100 sm:border-0">💳</span>
                            <div>
                              <h3 className="text-xs sm:text-lg font-black text-indigo-900 uppercase tracking-tight">Subscription Details</h3>
                              <p className="text-[8px] sm:text-xs font-bold text-indigo-600 uppercase tracking-widest">Campus Activation Status</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-1 sm:gap-3 md:gap-4">
                            <div className="bg-white py-1.5 px-1 sm:py-2.5 sm:px-3 md:p-5 rounded sm:rounded-lg shadow-sm border border-slate-100 sm:border-indigo-100/50 flex flex-col justify-center text-center sm:text-left">
                              <p className="text-[7px] sm:text-[9.5px] md:text-[11px] text-gray-500 font-bold uppercase tracking-tight sm:tracking-widest leading-none mb-1">Status</p>
                              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                                <span className={`w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${settings.subscriptionStatus === 'expired' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                <p className="text-[9.5px] sm:text-xs md:text-sm font-black text-gray-900 uppercase leading-none">
                                  {settings.subscriptionStatus === 'expired' ? "Expired" : "Active"}
                                </p>
                              </div>
                            </div>
                            
                            <div className="bg-white py-1.5 px-1 sm:py-2.5 sm:px-3 md:p-5 rounded sm:rounded-lg shadow-sm border border-slate-100 sm:border-indigo-100/50 flex flex-col justify-center text-center sm:text-left">
                              <p className="text-[7px] sm:text-[9.5px] md:text-[11px] text-gray-500 font-bold uppercase tracking-tight sm:tracking-widest leading-none mb-1">Remaining Time</p>
                              <p className="text-[9.5px] sm:text-xs md:text-sm font-black text-gray-900 leading-none">
                                {daysRemaining !== null 
                                  ? `${daysRemaining} Days` 
                                  : "N/A"}
                              </p>
                            </div>

                            <div className="bg-white py-1.5 px-1 sm:py-2.5 sm:px-3 md:p-5 rounded sm:rounded-lg shadow-sm border border-slate-100 sm:border-indigo-100/50 flex flex-col justify-center text-center sm:text-left">
                              <p className="text-[7px] sm:text-[9.5px] md:text-[11px] text-gray-500 font-bold uppercase tracking-tight sm:tracking-widest leading-none mb-1">Activation Date</p>
                              <p className="text-[8px] sm:text-xs md:text-sm font-bold text-gray-900 leading-none whitespace-nowrap">
                                {settings.subscriptionStartDate ? new Date(settings.subscriptionStartDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                              </p>
                            </div>

                            <div className="bg-white py-1.5 px-1 sm:py-2.5 sm:px-3 md:p-5 rounded sm:rounded-lg shadow-sm border border-slate-100 sm:border-indigo-100/50 flex flex-col justify-center text-center sm:text-left">
                              <p className="text-[7px] sm:text-[9.5px] md:text-[11px] text-gray-500 font-bold uppercase tracking-tight sm:tracking-widest leading-none mb-1">Expiry Date</p>
                              <p className="text-[8px] sm:text-xs md:text-sm font-bold text-gray-900 leading-none whitespace-nowrap">
                                {settings.subscriptionEndDate ? new Date(settings.subscriptionEndDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                              </p>
                            </div>
                          </div>

                          {/* Renew / Extend Subscription Plan Action Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onRenew) {
                                onRenew();
                              } else if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('open-renewal-modal'));
                              }
                            }}
                            className="w-full mt-2.5 sm:mt-4 py-2.5 sm:py-4 px-3 sm:px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-[10px] sm:text-sm uppercase tracking-wider sm:tracking-widest rounded sm:rounded-lg shadow-md sm:shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                          >
                            <span>⚡ Renew / Extend Subscription Plan</span>
                          </button>

                          {/* Ledger Logs Table */}
                          <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                            <h4 className="text-[10px] sm:text-xs font-black text-indigo-950 uppercase tracking-widest px-0.5">Payment History & Invoices</h4>
                            {loadingBilling ? (
                              <div className="flex items-center justify-center p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl border border-slate-100 sm:border-indigo-100 text-slate-400 text-[10px] sm:text-xs">
                                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mr-2" />
                                Fetching payment history...
                              </div>
                            ) : billingHistory.length === 0 ? (
                              <div className="text-center py-4 sm:py-6 bg-white border border-slate-100 sm:border-indigo-100 rounded-xl sm:rounded-2xl text-slate-400 text-[10px] sm:text-xs font-bold uppercase">
                                No past payment transactions found
                              </div>
                            ) : (
                              <div className="bg-white border border-slate-100 sm:border-indigo-100 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[9px] sm:text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider text-[7.5px] sm:text-[10px]">
                                        <th className="py-2 px-1.5 sm:py-3.5 sm:px-5">Date</th>
                                        <th className="py-2 px-1.5 sm:py-3.5 sm:px-5">Period</th>
                                        <th className="py-2 px-1.5 sm:py-3.5 sm:px-5">Ref ID</th>
                                        <th className="py-2 px-1.5 sm:py-3.5 sm:px-5">Amount</th>
                                        <th className="py-2 px-1.5 sm:py-3.5 sm:px-5 text-right">Invoice</th>
                                      </tr>
                                    </thead>
                                    <tbody className="font-bold text-slate-700 text-[8.5px] sm:text-xs">
                                      {billingHistory.map((tx: any) => (
                                        <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                          <td className="py-2 px-1.5 sm:py-3.5 sm:px-5 whitespace-nowrap">{new Date(tx.date).toLocaleDateString("en-IN")}</td>
                                          <td className="py-2 px-1.5 sm:py-3.5 sm:px-5 whitespace-nowrap">{tx.billingPeriod || "1 Year"}</td>
                                          <td className="py-2 px-1.5 sm:py-3.5 sm:px-5 font-mono select-all text-slate-500 text-[7.5px] sm:text-xs break-all sm:break-normal">{tx.utr || "N/A"}</td>
                                          <td className="py-2 px-1.5 sm:py-3.5 sm:px-5 text-emerald-600 whitespace-nowrap">₹{tx.amount?.toLocaleString("en-IN") || 0}</td>
                                          <td className="py-2 px-1.5 sm:py-3.5 sm:px-5 text-right">
                                            <button
                                              type="button"
                                              onClick={() => generateInvoicePDF ? generateInvoicePDF(tx, settings?.name || "Oriental Group of Institutes (OGI)") : alert("Generating invoice...")}
                                              className="px-1.5 py-0.5 sm:px-3.5 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded sm:rounded-lg transition-all text-[7.5px] sm:text-[10px] uppercase tracking-wider active:scale-95 shadow-sm shadow-blue-500/10 whitespace-nowrap cursor-pointer"
                                            >
                                              📥 <span className="hidden sm:inline">Invoice</span><span className="sm:hidden">PDF</span>
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                    )}

                    {showSubscription && showProfile && (
                        <div className="h-px bg-slate-100 w-full my-4 sm:my-6"></div>
                    )}

                    {/* Profile & Contact Information Section */}
                    {showProfile && (
                        <div className="space-y-4 sm:space-y-6">
                            {/* Dedicated Portal Link */}
                            <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 sm:border-indigo-100/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 rounded-full bg-indigo-50 opacity-50 blur-xl"></div>
                                
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                                  <span className="text-xs sm:text-sm">🔗</span>
                                  <h4 className="text-[10px] sm:text-sm font-black text-indigo-900 uppercase tracking-widest">Your Dedicated Portal Link</h4>
                                </div>
                                
                                <p className="text-[8px] sm:text-xs font-semibold text-slate-500 mb-2 sm:mb-3 leading-relaxed max-w-2xl relative z-10">
                                  Share this exact link with your <strong>Deans, Wardens, and Students</strong>. They can bookmark it to instantly access your university's dedicated Hosteleaze portal.
                                </p>
                                
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 p-1.5 sm:p-3 rounded-lg sm:rounded-xl relative z-10">
                                    <code className="flex-1 text-[9px] sm:text-xs font-bold text-slate-700 break-all select-all px-1">
                                      {typeof window !== 'undefined' ? `${window.location.origin}?tenant=${settings?.slug || new URLSearchParams(window.location.search).get('tenant')}` : ''}
                                    </code>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        const url = typeof window !== 'undefined' ? `${window.location.origin}?tenant=${settings?.slug || new URLSearchParams(window.location.search).get('tenant')}` : '';
                                        navigator.clipboard.writeText(url);
                                        const btn = e.currentTarget;
                                        const originalText = btn.innerText;
                                        btn.innerText = "COPIED!";
                                        btn.classList.add("bg-green-100", "text-green-700");
                                        setTimeout(() => {
                                          btn.innerText = originalText;
                                          btn.classList.remove("bg-green-100", "text-green-700");
                                        }, 2000);
                                      }}
                                      className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] sm:text-xs font-bold uppercase tracking-widest rounded-md sm:rounded-lg transition-colors whitespace-nowrap text-center cursor-pointer"
                                    >
                                      Copy Link
                                    </button>
                                </div>
                            </div>

                            {/* Contact Form */}
                            <div className="bg-white sm:bg-transparent p-3.5 sm:p-0 rounded-2xl sm:rounded-none border border-slate-100 sm:border-0 shadow-sm sm:shadow-none">
                                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-3 sm:mb-4">Contact Information</h3>
                                <div className="grid grid-cols-3 gap-2 sm:gap-6">
                                    <div className="space-y-1 sm:space-y-2 col-span-1">
                                        <label className="text-[7.5px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Name</label>
                                        <input
                                            type="text"
                                            value={contactName}
                                            onChange={e => setContactName(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 text-[9px] sm:text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1 sm:space-y-2 col-span-1">
                                        <label className="text-[7.5px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</label>
                                        <input
                                            type="tel"
                                            value={contactPhone}
                                            onChange={e => setContactPhone(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 text-[9px] sm:text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1 sm:space-y-2 col-span-1">
                                        <label className="text-[7.5px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hostelars</label>
                                        <input
                                            type="number"
                                            value={totalHostelars}
                                            onChange={e => setTotalHostelars(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 text-[9px] sm:text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1 sm:space-y-2 col-span-3 mt-2 sm:mt-4">
                                        <label className="text-[7.5px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Leave Approval Method</label>
                                        <select
                                            value={leaveApprovalMethod}
                                            onChange={e => setLeaveApprovalMethod(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 cursor-pointer text-[9px] sm:text-sm"
                                        >
                                            <option value="app">APP (Parent must approve via App)</option>
                                            <option value="ivr">IVR Call (Automated Voice Call)</option>
                                            <option value="none">None (Bypass Parent Approval)</option>
                                        </select>
                                        <p className="text-[7.5px] sm:text-[10px] font-bold text-slate-400 mt-1">
                                            {leaveApprovalMethod === "app" && "If set to APP, wardens cannot approve until the parent gives consent via the parent portal."}
                                            {leaveApprovalMethod === "ivr" && "If set to IVR, the system will trigger an automated IVR voice call to the parent."}
                                            {leaveApprovalMethod === "none" && "If set to None, parent consent is bypassed, and wardens can approve requests immediately."}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 sm:mt-8 flex justify-end">
                                    <button
                                        onClick={handleSaveClick}
                                        disabled={saving}
                                        className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] hover:bg-blue-700 active:scale-95 transition-all shadow-lg sm:shadow-xl shadow-blue-500/20 disabled:opacity-50 cursor-pointer text-center"
                                    >
                                        {saving ? "Processing..." : "Save Changes"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* OTP Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setShowOtpModal(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                        >
                            ✕
                        </button>
                        
                        <div className="text-center space-y-2 mb-8">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-black text-slate-800">Security Verification</h3>
                            <p className="text-xs font-medium text-slate-500">
                                To authorize these changes, please enter the 6-digit OTP sent to <br/>
                                <span className="font-bold text-slate-700">{maskedPhone}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="• • • • • •"
                                className="w-full text-center text-2xl tracking-[0.5em] font-black bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700"
                            />
                            
                            <button
                                onClick={handleVerifyOtp}
                                disabled={saving || otp.length !== 6}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                            >
                                {saving ? "Verifying..." : "Verify & Apply Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
