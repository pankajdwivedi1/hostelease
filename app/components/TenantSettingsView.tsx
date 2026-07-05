"use client";

import { useState, useEffect } from "react";

// Module-level cache to enable instant display on remount
let cachedSettings: any = null;

export default function TenantSettingsView() {
    const [settings, setSettings] = useState<any>(cachedSettings);
    const [loading, setLoading] = useState(!cachedSettings);
    const [saving, setSaving] = useState(false);
    
    // Editable state
    const [contactName, setContactName] = useState(cachedSettings?.contactName || "");
    const [contactPhone, setContactPhone] = useState(cachedSettings?.contactPhone || "");
    const [totalHostelars, setTotalHostelars] = useState(cachedSettings?.totalHostelars || "");
    const [leaveApprovalMethod, setLeaveApprovalMethod] = useState(cachedSettings?.leaveApprovalMethod || "app");
    const [enableParentGatepassNotifications, setEnableParentGatepassNotifications] = useState(cachedSettings?.enableParentGatepassNotifications ?? true);
    const [enableWardenLeaveNotifications, setEnableWardenLeaveNotifications] = useState(cachedSettings?.enableWardenLeaveNotifications ?? true);

    // OTP Modal state
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState("");
    const [maskedPhone, setMaskedPhone] = useState("");

    const fetchSettings = async () => {
        if (!cachedSettings) {
            setLoading(true);
        }
        try {
            const res = await fetch("/api/admin/settings/get");
            const data = await res.json();
            if (data.success && data.settings) {
                setSettings(data.settings);
                cachedSettings = data.settings;
                setContactName(data.settings.contactName || "");
                setContactPhone(data.settings.contactPhone || "");
                setTotalHostelars(data.settings.totalHostelars || "");
                setLeaveApprovalMethod(data.settings.leaveApprovalMethod || "app");
                setEnableParentGatepassNotifications(data.settings.enableParentGatepassNotifications ?? true);
                setEnableWardenLeaveNotifications(data.settings.enableWardenLeaveNotifications ?? true);
            }
        } catch (e: any) {
            console.error("Error loading settings:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSaveClick = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings/update/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactPhone })
            });
            const data = await res.json();
            if (data.success) {
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
                    leaveApprovalMethod,
                    enableParentGatepassNotifications,
                    enableWardenLeaveNotifications
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Settings updated successfully!");
                setShowOtpModal(false);
                fetchSettings(); // Refresh data
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
        return <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Loading Profile Settings...</div>;
    }

    if (!settings) return null;

    const daysRemaining = settings.subscriptionEndDate 
        ? Math.max(0, Math.ceil((new Date(settings.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : null;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="mb-6 sm:mb-8">
                <h2 className="text-lg sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2 tracking-tight">Profile Settings</h2>
                <p className="text-[10px] sm:text-sm text-slate-600">Manage your university registration and contact details.</p>
            </div>

            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
                <div className="space-y-6">
                    {/* View Only Section */}
                    {/* View Only Section */}
                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="p-2 sm:p-3 bg-white text-indigo-600 rounded-xl shadow-sm text-lg sm:text-xl">💳</span>
                        <div>
                          <h3 className="text-sm sm:text-lg font-black text-indigo-900 uppercase tracking-tight">Subscription Details</h3>
                          <p className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-widest">Campus Activation Status</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div className="bg-white py-1 px-2 sm:p-5 rounded-lg sm:rounded-2xl shadow-sm border border-indigo-100/50 flex flex-col justify-center">
                          <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Status</p>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className={`w-1.5 h-1.5 sm:w-3 sm:h-3 rounded-full ${settings.subscriptionStatus === 'expired' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                            <p className="text-[10px] sm:text-sm font-black text-gray-900 uppercase leading-none">
                              {settings.subscriptionStatus === 'expired' ? "Expired" : "Active"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-white py-1 px-2 sm:p-5 rounded-lg sm:rounded-2xl shadow-sm border border-indigo-100/50 flex flex-col justify-center">
                          <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Time Remaining</p>
                          <p className="text-[10px] sm:text-sm font-black text-gray-900 leading-none">
                            {daysRemaining !== null 
                              ? `${daysRemaining} Days` 
                              : "N/A"}
                          </p>
                        </div>

                        <div className="bg-white py-1 px-2 sm:p-5 rounded-lg sm:rounded-2xl shadow-sm border border-indigo-100/50 flex flex-col justify-center">
                          <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Activation Date</p>
                          <p className="text-[10px] sm:text-sm font-bold text-gray-900 leading-none">
                            {settings.subscriptionStartDate ? new Date(settings.subscriptionStartDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                          </p>
                        </div>

                        <div className="bg-white py-1 px-2 sm:p-5 rounded-lg sm:rounded-2xl shadow-sm border border-indigo-100/50 flex flex-col justify-center">
                          <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Expiry Date</p>
                          <p className="text-[10px] sm:text-sm font-bold text-gray-900 leading-none">
                            {settings.subscriptionEndDate ? new Date(settings.subscriptionEndDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-6 bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-indigo-100/50 relative overflow-hidden">
                          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 rounded-full bg-indigo-50 opacity-50 blur-xl"></div>
                          
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">🔗</span>
                            <h4 className="text-[11px] sm:text-sm font-black text-indigo-900 uppercase tracking-widest">Your Dedicated Portal Link</h4>
                          </div>
                          
                          <p className="text-[9px] sm:text-xs font-semibold text-slate-500 mb-3 leading-relaxed max-w-2xl relative z-10">
                            Share this exact link with your <strong>Deans, Wardens, and Students</strong>. They can bookmark it to instantly access your university's dedicated Hosteleaze portal and start working smoothly without any extra setup.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 border border-slate-200 p-2 sm:p-3 rounded-lg sm:rounded-xl relative z-10">
                              <code className="flex-1 text-[10px] sm:text-xs font-bold text-slate-700 break-all select-all px-1">
                                {typeof window !== 'undefined' ? `${window.location.origin}?tenant=${settings?.slug || new URLSearchParams(window.location.search).get('tenant')}` : ''}
                              </code>
                              <button 
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
                                className="px-3 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-md sm:rounded-lg transition-colors whitespace-nowrap text-center"
                              >
                                Copy Link
                              </button>
                          </div>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100 w-full my-6"></div>

                    {/* Editable Section */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Contact Information</h3>
                        <div className="grid grid-cols-3 gap-2 sm:gap-6">
                            <div className="space-y-1 sm:space-y-2 col-span-1">
                                <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Name</label>
                                <input
                                    type="text"
                                    value={contactName}
                                    onChange={e => setContactName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 text-[9px] sm:text-sm"
                                />
                            </div>
                            <div className="space-y-1 sm:space-y-2 col-span-1">
                                <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</label>
                                <input
                                    type="tel"
                                    value={contactPhone}
                                    onChange={e => setContactPhone(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 text-[9px] sm:text-sm"
                                />
                            </div>
                            <div className="space-y-1 sm:space-y-2 col-span-1">
                                <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hostelars</label>
                                <input
                                    type="number"
                                    value={totalHostelars}
                                    onChange={e => setTotalHostelars(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 text-[9px] sm:text-sm"
                                />
                            </div>
                            <div className="space-y-1 sm:space-y-2 col-span-3 mt-2 sm:mt-4">
                                <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Leave Approval Method</label>
                                <select
                                    value={leaveApprovalMethod}
                                    onChange={e => setLeaveApprovalMethod(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 sm:p-4 rounded-lg sm:rounded-xl font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 cursor-pointer text-[9px] sm:text-sm"
                                >
                                    <option value="app">APP (Parent must approve via App)</option>
                                    <option value="ivr">IVR Call (Automated Voice Call)</option>
                                    <option value="none">None (Bypass Parent Approval)</option>
                                </select>
                                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-1">
                                    {leaveApprovalMethod === "app" && "If set to APP, wardens cannot approve until the parent gives consent via the parent portal."}
                                    {leaveApprovalMethod === "ivr" && "If set to IVR, the system will trigger an automated IVR voice call to the parent."}
                                    {leaveApprovalMethod === "none" && "If set to None, parent consent is bypassed, and wardens can approve requests immediately."}
                                </p>
                            </div>
                            
                            <div className="h-px bg-slate-100 col-span-3 w-full my-6"></div>

                            <div className="space-y-4 col-span-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Notification Preferences</h3>
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={enableParentGatepassNotifications}
                                            onChange={e => setEnableParentGatepassNotifications(e.target.checked)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition-all cursor-pointer"
                                        />
                                        <div>
                                            <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Parent Gatepass Notifications</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Send instant background push notifications to parents when their student scans checkout/checkin QR codes.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3.5 cursor-pointer select-none mt-2">
                                        <input
                                            type="checkbox"
                                            checked={enableWardenLeaveNotifications}
                                            onChange={e => setEnableWardenLeaveNotifications(e.target.checked)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition-all cursor-pointer"
                                        />
                                        <div>
                                            <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Warden & Dean Leave Notifications</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Send instant background push notifications to Wardens and Deans whenever a student submits a leave request.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleSaveClick}
                                disabled={saving}
                                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                            >
                                {saving ? "Processing..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
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
