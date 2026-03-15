"use client";

import { Building2, ShieldCheck, Zap, Users, Globe, ArrowRight, CheckCircle2, Layout, Lock } from "lucide-react";
import { useState } from "react";

export default function LandingPage() {
    const [requestMode, setRequestMode] = useState(false);
    const [email, setEmail] = useState("");

    return (
        <div className="min-h-screen bg-[#050510] text-white selection:bg-blue-500/30">
            {/* Navigation */}
            <nav className="flex items-center justify-between px-8 py-6 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-black tracking-tighter uppercase">Hostelease</span>
                </div>
                <div className="hidden md:flex items-center gap-8">
                    <a href="#features" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Features</a>
                    <a href="#security" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Security</a>
                    <a href="/superadmin" className="text-xs font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">SuperAdmin Port</a>
                </div>
                <button
                    onClick={() => setRequestMode(true)}
                    className="bg-white text-black px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                    Get Hostelease
                </button>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-24 pb-32 px-8 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[150px]"></div>

                <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">V2.0 Multi-Tenant Alpha Now Live</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.9]">
                        The OS for <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500">Modern Campuses</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-gray-400 font-medium text-lg md:text-xl leading-relaxed">
                        Hostelease is a decentralized, multi-tenant hostel management system built for high-security environments. Link thousands of colleges under one global infrastructure.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                        <button
                            onClick={() => setRequestMode(true)}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            Request Access <ArrowRight className="w-5 h-5" />
                        </button>
                        <button className="w-full sm:w-auto bg-white/5 border border-white/10 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-white/10 transition-all active:scale-95">
                            Watch Demo
                        </button>
                    </div>
                </div>
            </section>

            {/* Stats Grid */}
            <section className="px-8 pb-32 max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Active Nodes", val: "100+", icon: Globe },
                        { label: "Total Students", val: "50k+", icon: Users },
                        { label: "Gatepasses Sync", val: "< 10ms", icon: Zap },
                        { label: "Security Tier", val: "Enterprise", icon: ShieldCheck },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm hover:bg-white/[0.07] transition-all group">
                            <s.icon className="w-6 h-6 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="text-3xl font-black uppercase leading-none mb-1">{s.val}</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Preview */}
            <section id="features" className="px-8 pb-32 max-w-7xl mx-auto space-y-24">
                <div className="grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-6">
                        <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <Layout className="w-7 h-7 text-blue-500" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tight leading-tight">
                            One Software. <br />Infinite Universities.
                        </h2>
                        <p className="text-gray-400 font-medium">
                            Hostelease uses advanced multi-tenant subdomains. Each university gets their own isolated digital campus with custom branding, settings, and student databases.
                        </p>
                        <ul className="space-y-4">
                            {["Custom Subdomains", "University Branding", "Isolated Data Walls", "Independent Settings"].map((t, i) => (
                                <li key={i} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                                    <CheckCircle2 className="w-5 h-5 text-blue-500" /> {t}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-[40px] aspect-video border border-white/10 flex items-center justify-center relative group">
                        <div className="absolute inset-4 bg-[#050510] rounded-[32px] border border-white/5 overflow-hidden">
                            <div className="p-8 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    </div>
                                    <div className="bg-white/10 px-3 py-1 rounded text-[10px] text-gray-500">oist.hostelease.com</div>
                                </div>
                                <div className="h-4 w-[60%] bg-white/10 rounded"></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-24 bg-blue-500/10 rounded-xl border border-blue-500/20"></div>
                                    <div className="h-24 bg-white/5 rounded-xl border border-white/5"></div>
                                </div>
                                <div className="h-12 bg-white/5 rounded-xl border border-white/5"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-16 items-center">
                    <div className="bg-gradient-to-br from-indigo-600/20 to-blue-600/20 rounded-[40px] aspect-video border border-white/10 order-2 md:order-1 flex items-center justify-center p-12 text-center">
                        <Lock className="w-20 h-20 text-blue-500/50" />
                    </div>
                    <div className="space-y-6 order-1 md:order-2">
                        <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                            <ShieldCheck className="w-7 h-7 text-indigo-500" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tight leading-tight">
                            Identity & <br />Security First.
                        </h2>
                        <p className="text-gray-400 font-medium">
                            Real-time student verification with facial recognition, device binding, and automated attendance logging. 100% data integrity for every campus.
                        </p>
                        <div className="pt-4 flex gap-8">
                            <div>
                                <h4 className="text-2xl font-black uppercase">AES-256</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Encryption</p>
                            </div>
                            <div>
                                <h4 className="text-2xl font-black uppercase">Device</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Registration</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 px-8 py-24 text-center">
                <div className="max-w-xl mx-auto space-y-8">
                    <h3 className="text-3xl font-black uppercase tracking-tighter">Ready to digitize your campus?</h3>
                    <p className="text-gray-500 text-sm font-medium">Join forward-thinking universities around the globe. Get started with Hostelease today.</p>
                    <button
                        onClick={() => setRequestMode(true)}
                        className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all"
                    >
                        Schedule a Demo
                    </button>
                    <div className="pt-12 flex items-center justify-center gap-2 opacity-20">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.5em]">Powered by Hostelease Global Infrastructure</p>
                    </div>
                </div>
            </footer>

            {/* Registration Modal */}
            {requestMode && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 overflow-y-auto">
                    <div className="bg-[#050510] border border-white/10 w-full max-w-xl rounded-[40px] overflow-hidden animate-in zoom-in duration-300 my-auto">
                        <div className="p-8 md:p-12 space-y-8">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30 mx-auto mb-4">
                                    <Building2 className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="text-3xl font-black uppercase tracking-tighter text-white">Register Institution</h3>
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Provision your own digital campus in seconds</p>
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const target = e.target as any;
                                const formData = {
                                    name: target.name.value,
                                    slug: target.slug.value.toLowerCase().replace(/\s+/g, '-'),
                                    adminEmail: target.adminEmail.value,
                                    subscriptionStatus: 'trial',
                                    primaryColor: '#3b82f6'
                                };

                                try {
                                    const res = await fetch('/api/super-admin/tenants', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(formData)
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                        alert(`🚀 SUCCESS! ${formData.name} has been provisioned.\n\nYour portal is ready at: ${formData.slug}.hostelease.com`);
                                        setRequestMode(false);
                                        window.location.href = `http://${formData.slug}.localhost:3000`;
                                    } else {
                                        alert(data.error || "Registration failed");
                                    }
                                } catch (err) {
                                    alert("Network error during registration");
                                }
                            }} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">University Name</label>
                                        <input
                                            name="name"
                                            required
                                            placeholder="Oxford University"
                                            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Subdomain Slug</label>
                                        <div className="relative">
                                            <input
                                                name="slug"
                                                required
                                                placeholder="oxford"
                                                className="w-full bg-white/5 border border-white/10 p-4 pr-32 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">.hostelease.com</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Administrator Email</label>
                                    <input
                                        name="adminEmail"
                                        type="email"
                                        required
                                        placeholder="admin@university.edu"
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                    />
                                </div>

                                <div className="pt-4 space-y-4">
                                    <button
                                        type="submit"
                                        className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
                                    >
                                        Launch My Campus
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRequestMode(false)}
                                        className="w-full text-gray-500 py-2 font-black uppercase tracking-widest text-[10px] hover:text-white"
                                    >
                                        Back to Overview
                                    </button>
                                </div>
                            </form>

                            <p className="text-[9px] text-gray-600 text-center leading-relaxed font-medium">
                                By launching your campus, you agree to our <span className="text-gray-400 underline">Terms of Infrastructure Service</span>. <br />
                                Automated provisioning may take up to 30 seconds for DNS propagation.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
