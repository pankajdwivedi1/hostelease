"use client";

import { Building, Globe, ShieldCheck, Mail, Phone, CheckCircle, Users } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ALL_COUNTRIES, getCountryLabel } from "@/lib/countries";

declare global {
  interface Window {
    initSendOTP: (config: any) => void;
  }
}

export default function RegisterPage() {
    const router = useRouter();
    const [regStep, setRegStep] = useState<1 | 1.5 | 2 | 3>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [otp, setOtp] = useState("");
    const [contactCountryCode, setContactCountryCode] = useState("+91");
    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        adminEmail: "",
        contactName: "",
        contactPhone: "",
        totalHostelars: "",
    });
    const [successData, setSuccessData] = useState<any>(null);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanedPhone = formData.contactPhone.replace(/\D/g, "");
        if (!cleanedPhone || cleanedPhone.length < 7 || cleanedPhone.length > 15) {
            setError("Please enter a valid mobile number (7 to 15 digits).");
            return;
        }

        setLoading(true);
        try {
            const fullPhoneNumber = `${contactCountryCode}${cleanedPhone}`;
            const res = await fetch("/api/public/register/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactPhone: fullPhoneNumber })
            });
            const data = await res.json();
            
            if (data.success) {
                setRegStep(1.5 as any); // Show OTP input state
            } else {
                setError(data.error || "Failed to send OTP");
            }
        } catch (err: any) {
            setError("Network error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndDeploy = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!otp || otp.length !== 6) {
            setError("Please enter the 6-digit OTP code");
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const cleanedPhone = formData.contactPhone.replace(/\D/g, "");
            const fullPhoneNumber = `${contactCountryCode}${cleanedPhone}`;
            const res = await fetch("/api/public/register/verify-and-deploy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    contactPhone: fullPhoneNumber,
                    accessToken: otp // Use the entered OTP as the token
                })
            });
            const data = await res.json();

            if (data.success) {
                setSuccessData(data.tenant);
                setRegStep(3);
            } else {
                setError(data.error || "Verification failed");
            }
        } catch (err: any) {
            setError("Network error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050510] text-white flex items-center justify-center p-4 sm:p-6 overflow-y-auto relative">
            <Script src="https://verify.msg91.com/otp-provider.js" strategy="lazyOnload" />
            
            {/* Background glowing effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="bg-[#050510] border border-white/10 w-full max-w-xl rounded-[24px] sm:rounded-[40px] overflow-hidden animate-in zoom-in duration-300 my-auto shadow-[0_0_50px_rgba(37,99,235,0.15)] relative z-10">
                
                {/* Close Button to return to home */}
                <button 
                    onClick={() => router.push("/")}
                    className="absolute top-6 right-6 z-20 text-gray-500 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6 sm:p-12 space-y-6 sm:space-y-8">
                    
                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {regStep === 1 && (
                        <>
                            <div className="text-center space-y-2">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center border border-blue-500/30 mx-auto mb-4 overflow-hidden shadow-lg shadow-blue-500/20">
                                    <img src="/uvw_logo.jpg" alt="UVW Logo" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mt-2">HOSTELEAZE</div>
                                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white">Launch Your Campus</h3>
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Provision your university's digital infrastructure in seconds.</p>
                            </div>
                            <form onSubmit={handleSendOTP} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2"><Building className="w-3 h-3" /> University Name/ College Name/ Hostel Name</label>
                                        <input
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Oxford University"
                                            className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2"><Globe className="w-3 h-3" /> Campus Tenant Slug</label>
                                        <div className="relative">
                                            <input
                                                required
                                                value={formData.slug}
                                                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                                                placeholder="oxford"
                                                className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 pr-32 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700 lowercase"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-black text-gray-600 uppercase pointer-events-none">?tenant=...</div>
                                        </div>
                                    </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2"><Mail className="w-3 h-3" /> Global Admin Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.adminEmail}
                                            onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                                            placeholder="admin@university.edu"
                                            className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2"><Users className="w-3 h-3" /> Total Hostelars</label>
                                        <input
                                            type="number"
                                            min="0"
                                            required
                                            value={formData.totalHostelars}
                                            onChange={(e) => setFormData({ ...formData, totalHostelars: e.target.value })}
                                            placeholder="e.g. 500"
                                            className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Contact Name</label>
                                        <input
                                            required
                                            value={formData.contactName}
                                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                            placeholder="John Doe"
                                            className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2"><Phone className="w-3 h-3" /> Mobile Number</label>
                                        <div className="flex items-center gap-2 w-full">
                                            <select
                                                value={contactCountryCode}
                                                onChange={(e) => setContactCountryCode(e.target.value)}
                                                className="w-[100px] sm:w-[115px] shrink-0 bg-white/5 border border-white/10 px-2 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold text-white focus:ring-2 focus:ring-blue-500/40 outline-none cursor-pointer truncate"
                                            >
                                                {ALL_COUNTRIES.map((c) => (
                                                    <option value={c.dialCode} key={`${c.code}-${c.dialCode}`} className="bg-[#050510] text-white">
                                                        {getCountryLabel(c)}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="tel"
                                                required
                                                maxLength={15}
                                                value={formData.contactPhone}
                                                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value.replace(/\D/g, "") })}
                                                placeholder="Mobile number"
                                                className="flex-1 w-full min-w-0 bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-blue-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? "Verifying Details..." : <><ShieldCheck className="w-4 h-4" /> Continue to Verification</>}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {regStep === 1.5 && (
                        <div className="text-center space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                             <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                                <ShieldCheck className="w-8 h-8 text-blue-400" />
                             </div>
                             <h3 className="text-xl font-bold">Verify Mobile Number</h3>
                             <p className="text-sm text-gray-400">
                                 Please enter the 6-digit OTP sent to {formData.contactPhone}
                             </p>
                             
                             <form onSubmit={handleVerifyAndDeploy} className="space-y-4">
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Enter 6-digit OTP"
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-2xl tracking-[0.5em] font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || otp.length !== 6}
                                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {loading ? "Verifying..." : "Verify & Deploy"}
                                </button>
                             </form>
                        </div>
                    )}

                    {regStep === 2 && (
                        <div className="text-center space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                             <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                             </div>
                             <h3 className="text-xl font-bold">Deploying Your Campus</h3>
                             <p className="text-sm text-gray-400">
                                 Please wait while we provision your infrastructure...
                             </p>
                        </div>
                    )}

                    {regStep === 3 && successData && (
                        <div className="text-center space-y-8 animate-in zoom-in-95 duration-700 pb-4">
                            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/50 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
                                <CheckCircle className="w-12 h-12 text-green-400" />
                            </div>
                            
                            <div>
                                <h2 className="text-3xl font-black font-serif text-white mb-2 uppercase">Node Deployed</h2>
                                <p className="text-gray-400 text-sm">Your isolated campus infrastructure is ready.</p>
                            </div>

                            <div className="bg-black/50 border border-white/5 p-6 rounded-2xl space-y-4 text-left">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Your Login Portal</label>
                                    <a href={`/login?tenant=${successData.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-bold break-all hover:underline block">
                                        {typeof window !== 'undefined' ? window.location.origin : ''}/login?tenant={successData.slug}
                                    </a>
                                    <p className="text-[10px] text-gray-500 mt-1">Note: In production this will be www.hosteleaze.com?tenant={successData.slug}</p>
                                </div>
                                <div className="pt-4 border-t border-white/5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Global Admin Login</label>
                                    <div className="text-white font-bold">{successData.adminEmail}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Default Password</label>
                                    <div className="text-white font-mono bg-white/10 px-3 py-1 rounded inline-block">
                                        {successData.defaultAdminPass}
                                    </div>
                                    <p className="text-[10px] text-amber-500 mt-2 font-bold uppercase tracking-wide">⚠️ Please change this immediately upon first login.</p>
                                </div>
                            </div>

                            <a href={`/login?tenant=${successData.slug}`} className="block">
                                <button className="w-full p-5 rounded-2xl bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                    Go to Login Portal
                                </button>
                            </a>
                        </div>
                    )}

                    {regStep === 1 && (
                        <p className="text-[8px] sm:text-[9px] text-gray-600 text-center leading-relaxed font-medium">
                            By launching your campus, you agree to our <span onClick={() => setShowTermsModal(true)} className="text-gray-400 underline cursor-pointer hover:text-white transition-colors">Terms of Infrastructure Service</span>. <br />
                            Automated provisioning may take up to 30 seconds for DNS propagation.
                        </p>
                    )}
                </div>
            </div>

            {/* Terms of Infrastructure Service Modal */}
            {showTermsModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#0b0c16] border border-white/10 rounded-[24px] sm:rounded-[32px] w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 relative text-left" onClick={(e) => e.stopPropagation()}>
                        <button 
                            type="button"
                            onClick={() => setShowTermsModal(false)}
                            className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors z-10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="p-6 sm:p-10 space-y-6">
                            <div className="border-b border-white/5 pb-4">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-500">Institutional SLA & Policy</span>
                                <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight mt-1">Terms of Infrastructure Service</h2>
                                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Hosteleaze Secure Node Deployment Agreement</p>
                            </div>

                            <div className="space-y-6 text-xs sm:text-sm text-gray-400 leading-relaxed font-medium">
                                
                                <div className="space-y-1">
                                    <h4 className="font-black text-white uppercase tracking-wide text-[10px] sm:text-xs text-blue-400">1. Node Provisioning & Dedicated Data Partitioning</h4>
                                    <p className="text-[11px] sm:text-xs text-gray-400">
                                        By launching this node, a secure, isolated database schema (tenant partition) is deployed exclusively for your institution. Hosteleaze guarantees complete data isolation. Under no circumstances will database records, student logs, or system audits be shared, pooled, or leaked between tenants.
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-black text-white uppercase tracking-wide text-[10px] sm:text-xs text-blue-400">2. Biometric Consent & Compliance Responsibility</h4>
                                    <p className="text-[11px] sm:text-xs text-gray-400">
                                        As the institution administrator (Warden/Dean/Super Admin), you acknowledge that Hosteleaze processes mathematical vector hashes (descriptors) of student faces for identity verification. The institution assumes sole responsibility for obtaining explicit consent from students (or parents, if minor) in compliance with local privacy frameworks (such as the Digital Personal Data Protection Act - DPDP).
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-black text-white uppercase tracking-wide text-[10px] sm:text-xs text-blue-400">3. Device Lock & Anti-Spoofing Protocols</h4>
                                    <p className="text-[11px] sm:text-xs text-gray-400">
                                        To maintain hostel security, a strict one-account-to-one-device mapping is enforced. The platform audits and locks unique hardware fingerprints and WebAuthn credentials. Attempts to bypass, spoof, or clone device configurations will result in automatic lockout and require administrative approval to unlock.
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-black text-white uppercase tracking-wide text-[10px] sm:text-xs text-blue-400">4. Live Audit Logs & Real-Time Monitoring Availability</h4>
                                    <p className="text-[11px] sm:text-xs text-gray-400">
                                        All Gatepass requests, night attendance logs, leave records, and manual warden overrides are permanently audited. Hosteleaze guarantees a 99.9% uptime for core security APIs (QR code validation, Wi-Fi BSSID validation, and location checks) to ensure student safety records remain active and uncompromised.
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-black text-white uppercase tracking-wide text-[10px] sm:text-xs text-blue-400">5. Seat Allocation & Fair-Use Limitations</h4>
                                    <p className="text-[11px] sm:text-xs text-gray-400">
                                        The provisioned node is restricted to the student seating count declared during registration. Scaling up active hostelars beyond the initial plan requires license upgrades. Node activity is continually monitored to ensure resource stability and prevent network abuse.
                                    </p>
                                </div>

                            </div>

                            <div className="pt-6 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setShowTermsModal(false)}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all active:scale-95 shadow-xl shadow-blue-500/20"
                                >
                                    I Understand & Accept
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
