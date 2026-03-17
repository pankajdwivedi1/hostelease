"use client";

import { Building2, ShieldCheck, Zap, Users, Globe, ArrowRight, CheckCircle2, Layout, Lock } from "lucide-react";
import { useState, useEffect } from "react";

export default function LandingPage() {
    const [requestMode, setRequestMode] = useState(false);
    const [showDemo, setShowDemo] = useState(false);
    const [demoStep, setDemoStep] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [email, setEmail] = useState("");

    const demoSlides = [
        {
            title: "Student Dashboard",
            role: "Daily Campus Navigation",
            description: "Students access their dynamic QR key, request leave, and view live attendance status.",
            features: ["Dynamic QR Keybase", "AI-Face Verification", "Hostel Leave Requests", "Student Profile & Fees"],
            icon: <Users className="w-8 h-8 text-blue-500" />,
            color: "from-blue-600/30 to-indigo-600/30",
            mockup: "student"
        },
        {
            title: "Warden Portal",
            role: "Real-time Operations",
            description: "Wardens manage student movement, approve gatepasses, and perform night audits with zero paperwork.",
            features: ["Live Gatepass Approvals", "Night Attendance System", "In/Out Movement Log", "Emergency Alerts"],
            icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
            color: "from-emerald-600/30 to-teal-600/30",
            mockup: "warden"
        },
        {
            title: "Dean Dashboard",
            role: "Institution Analytics",
            description: "Complete oversight for university leadership with hostel trends, staff performance, and security auditing.",
            features: ["Multi-Campus Intelligence", "Staff Permission Mgmt", "Global Attendance Stats", "Infrastructure Settings"],
            icon: <Layout className="w-8 h-8 text-purple-500" />,
            color: "from-purple-600/30 to-pink-600/30",
            mockup: "dean"
        },
        {
            title: "Super Admin Control",
            role: "Ecosystem Backbone",
            description: "The global command center to provision new campuses, monitor system health, and secure the network.",
            features: ["Ultra-Private Data Isolation", "New Campus Provisioning", "AES-256 Cloud Security", "System-wide Monitoring"],
            icon: <Globe className="w-8 h-8 text-blue-400" />,
            color: "from-blue-600/40 to-cyan-600/40",
            mockup: "superadmin"
        }
    ];

    // Automatic Demo Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showDemo && isAutoPlaying) {
            interval = setInterval(() => {
                setDemoStep(prev => {
                    if (prev < demoSlides.length - 1) {
                        return prev + 1;
                    } else {
                        // Completion - close automatically after a small delay
                        setTimeout(() => {
                            setShowDemo(false);
                            setIsAutoPlaying(false);
                        }, 3000);
                        return prev;
                    }
                });
            }, 4500); // 4.5 seconds per slide
        }
        return () => clearInterval(interval);
    }, [showDemo, isAutoPlaying]);

    return (
        <div className="min-h-screen bg-[#050510] text-white selection:bg-blue-500/30 overflow-x-hidden">
            {/* Navigation */}
            <nav className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden shrink-0">
                        <img src="/uvw_logo.jpg" alt="UVW Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-lg sm:text-xl font-black tracking-tighter uppercase block">Hostelease</span>
                </div>
                <div className="hidden lg:flex items-center gap-8">
                    <a href="#features" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Features</a>
                    <a href="#security" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Security</a>
                    <a href="/superadmin" className="text-xs font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">SuperAdmin Port</a>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <a 
                        href="/login" 
                        className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors border border-white/10 px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl"
                    >
                        Login
                    </a>
                    <button
                        onClick={() => setRequestMode(true)}
                        className="bg-white text-black px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 whitespace-nowrap"
                    >
                        Get Access
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-20 sm:pt-24 pb-24 sm:pb-32 px-4 sm:px-8 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[150px]"></div>

                <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-blue-400">V2.0 Multi-Tenant Alpha Now Live</span>
                    </div>

                    <h1 className="text-4xl xs:text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.9]">
                        The OS for <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500">Modern Campuses</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-gray-400 font-medium text-base sm:text-lg md:text-xl leading-relaxed">
                        Hostelease is a decentralized, multi-tenant hostel management system built for high-security environments. Link thousands of colleges under one global infrastructure.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                        <button
                            onClick={() => setRequestMode(true)}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            Request Access <ArrowRight className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => {
                                setDemoStep(0);
                                setShowDemo(true);
                                setIsAutoPlaying(true);
                            }}
                            className="w-full sm:w-auto bg-white/5 border border-white/10 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-white/10 transition-all active:scale-95 group flex items-center justify-center gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            Watch Auto-Demo
                        </button>
                    </div>
                </div>
            </section>

            {/* Stats Grid */}
            <section className="px-4 sm:px-8 pb-32 max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {[
                        { label: "Active Nodes", val: "100+", icon: Globe },
                        { label: "Total Students", val: "50k+", icon: Users },
                        { label: "Gatepasses Sync", val: "< 10ms", icon: Zap },
                        { label: "Security Tier", val: "Enterprise", icon: ShieldCheck },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-sm hover:bg-white/[0.07] transition-all group overflow-hidden">
                            <s.icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mb-3 sm:mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="text-lg xs:text-xl sm:text-3xl font-black uppercase leading-tight mb-1 truncate sm:whitespace-normal">{s.val}</h3>
                            <p className="text-[8px] xs:text-[10px] font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Preview */}
            <section id="features" className="px-4 sm:px-8 pb-32 max-w-7xl mx-auto space-y-24">
                <div className="grid md:grid-cols-2 gap-12 sm:gap-16 items-center">
                    <div className="space-y-6">
                        <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <Layout className="w-7 h-7 text-blue-500" />
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-tight">
                            One Software. <br />Infinite Universities.
                        </h2>
                        <p className="text-gray-400 font-medium text-sm sm:text-base">
                            Hostelease uses advanced multi-tenant subdomains. Each university gets their own isolated digital campus with custom branding, settings, and student databases.
                        </p>
                        <ul className="space-y-4">
                            {["Custom Subdomains", "University Branding", "Isolated Data Walls", "Independent Settings"].map((t, i) => (
                                <li key={i} className="flex items-center gap-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-300">
                                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" /> {t}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-3xl sm:rounded-[40px] aspect-video border border-white/10 flex items-center justify-center relative group">
                        <div className="absolute inset-3 sm:inset-4 bg-[#050510] rounded-2xl sm:rounded-[32px] border border-white/5 overflow-hidden">
                            <div className="p-4 sm:p-8 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-500 rounded-full"></div>
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                                    </div>
                                    <div className="bg-white/10 px-2 sm:px-3 py-1 rounded text-[8px] sm:text-[10px] text-gray-500">oist.hostelease.com</div>
                                </div>
                                <div className="h-4 w-[60%] bg-white/10 rounded"></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-16 sm:h-24 bg-blue-500/10 rounded-xl border border-blue-500/20"></div>
                                    <div className="h-16 sm:h-24 bg-white/5 rounded-xl border border-white/5"></div>
                                </div>
                                <div className="h-8 sm:h-12 bg-white/5 rounded-xl border border-white/5"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12 sm:gap-16 items-center">
                    <div className="bg-gradient-to-br from-indigo-600/20 to-blue-600/20 rounded-3xl sm:rounded-[40px] aspect-video border border-white/10 order-2 md:order-1 flex items-center justify-center p-8 sm:p-12 text-center">
                        <Lock className="w-16 h-16 sm:w-20 sm:h-20 text-blue-500/50" />
                    </div>
                    <div className="space-y-6 order-1 md:order-2">
                        <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                            <ShieldCheck className="w-7 h-7 text-indigo-500" />
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-tight">
                            Identity & <br />Security First.
                        </h2>
                        <p className="text-gray-400 font-medium text-sm sm:text-base">
                            Real-time student verification with facial recognition, device binding, and automated attendance logging. 100% data integrity for every campus.
                        </p>
                        <div className="pt-4 flex gap-6 sm:gap-8">
                            <div>
                                <h4 className="text-xl sm:text-2xl font-black uppercase">AES-256</h4>
                                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500">Encryption</p>
                            </div>
                            <div>
                                <h4 className="text-xl sm:text-2xl font-black uppercase">Device</h4>
                                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500">Registration</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 px-4 sm:px-8 py-24 text-center">
                <div className="max-w-xl mx-auto space-y-8">
                    <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">Ready to digitize your campus?</h3>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium">Join forward-thinking universities around the globe. Get started with Hostelease today.</p>
                    <button
                        onClick={() => setRequestMode(true)}
                        className="bg-blue-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all"
                    >
                        Schedule a Demo
                    </button>
                    <div className="pt-12 flex flex-col sm:flex-row items-center justify-center gap-2 opacity-20">
                        <div className="w-1.5 h-1.5 bg-white rounded-full hidden sm:block"></div>
                        <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.5em]">Powered by Hostelease Global Infrastructure</p>
                    </div>

                    <div className="pt-8 space-y-4 border-t border-white/5 mt-8">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">© 2026 HOSTELEASE. All Rights Reserved.</p>
                            <p className="text-[8px] font-medium text-gray-600 uppercase tracking-tight">Unauthorized copying, modification, or distribution is strictly prohibited</p>
                        </div>
                        
                        <div className="py-2">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mb-1">Developed meticulously by</p>
                            <p className="text-xs font-black text-white uppercase tracking-tighter">Dr. Pankaj Prasad Dwivedi</p>
                        </div>

                        <div className="flex items-center justify-center gap-6 pt-2">
                            {["Security", "Privacy", "API"].map((link) => (
                                <a key={link} href="#" className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
                                    {link}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>

            {/* Registration Modal */}
            {requestMode && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    <div className="bg-[#050510] border border-white/10 w-full max-w-xl rounded-[24px] sm:rounded-[40px] overflow-hidden animate-in zoom-in duration-300 my-auto">
                        <div className="p-6 sm:p-12 space-y-6 sm:space-y-8">
                            <div className="text-center space-y-2">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center border border-blue-500/30 mx-auto mb-4 overflow-hidden shadow-lg shadow-blue-500/20">
                                    <img src="/uvw_logo.jpg" alt="UVW Logo" className="w-full h-full object-cover" />
                                </div>
                                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white">Register Institution</h3>
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
                                        window.location.href = `http://localhost:3000/login?tenant=${formData.slug}`;
                                    } else {
                                        alert(data.error || "Registration failed");
                                    }
                                } catch (err: any) {
                                    console.error("Registration UI Error:", err);
                                    alert("Registration Error: " + (err.message || "Network connection failed"));
                                }
                            }} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">University Name</label>
                                        <input
                                            name="name"
                                            required
                                            placeholder="Oxford University"
                                            className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Subdomain Slug</label>
                                        <div className="relative">
                                            <input
                                                name="slug"
                                                required
                                                placeholder="oxford"
                                                className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 pr-32 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-black text-gray-600 uppercase">.hostelease.com</div>
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
                                        className="w-full bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/40 outline-none placeholder:text-gray-700"
                                    />
                                </div>

                                <div className="pt-2 sm:pt-4 space-y-4">
                                    <button
                                        type="submit"
                                        className="w-full bg-blue-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
                                    >
                                        Launch My Campus
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRequestMode(false)}
                                        className="w-full text-gray-500 py-1 sm:py-2 font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:text-white"
                                    >
                                        Back to Overview
                                    </button>
                                </div>
                            </form>

                            <p className="text-[8px] sm:text-[9px] text-gray-600 text-center leading-relaxed font-medium">
                                By launching your campus, you agree to our <span className="text-gray-400 underline">Terms of Infrastructure Service</span>. <br />
                                Automated provisioning may take up to 30 seconds for DNS propagation.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* Demo Walkthrough Modal */}
            {showDemo && (
                <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
                    <div className="bg-[#050510] border border-white/10 w-full max-w-4xl rounded-[32px] sm:rounded-[48px] overflow-hidden animate-in zoom-in duration-300 relative shadow-2xl shadow-blue-500/10">
                        <button 
                            onClick={() => setShowDemo(false)}
                            className="absolute top-6 right-6 sm:top-8 sm:right-8 z-20 text-gray-500 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="grid md:grid-cols-2">
                            {/* Content Side */}
                            <div className="p-8 sm:p-14 space-y-8 flex flex-col justify-center">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-600/20 p-2 rounded-xl">
                                            {demoSlides[demoStep].icon}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Live Simulation</span>
                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Step {demoStep + 1} of 4</p>
                                        </div>
                                    </div>
                                    <h3 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">{demoSlides[demoStep].title}</h3>
                                    <p className="text-blue-400 text-xs font-black uppercase tracking-widest border-l-2 border-blue-600 pl-3">{demoSlides[demoStep].role}</p>
                                    <p className="text-gray-400 text-sm sm:text-base font-medium leading-relaxed">{demoSlides[demoStep].description}</p>
                                </div>

                                <ul className="space-y-4">
                                    {demoSlides[demoStep].features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-300">
                                            <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                <CheckCircle2 className="w-3 h-3 text-blue-500" />
                                            </div>
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <div className="flex items-center gap-4 pt-6">
                                    <button 
                                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                                        className={`px-6 py-3 rounded-xl border flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${isAutoPlaying ? 'border-amber-500/50 text-amber-500 hover:bg-amber-500/5' : 'border-blue-500/50 text-blue-500 hover:bg-blue-500/5'}`}
                                    >
                                        {isAutoPlaying ? (
                                            <><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Pause Tour</>
                                        ) : (
                                            <><span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span> Resume Auto</>
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => setShowDemo(false)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all border border-white/10"
                                    >
                                        Exit Demo
                                    </button>
                                </div>
                            </div>

                            {/* Visual Preview Side - High Tech Mockup */}
                            <div className={`hidden md:flex bg-gradient-to-br ${demoSlides[demoStep].color} items-center justify-center p-12 relative overflow-hidden`}>
                                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#fff 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }}></div>
                                <div className="absolute inset-0 animate-pulse opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                                
                                <div className="relative w-full aspect-[4/3] bg-[#020208] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(59,130,246,0.3)] flex flex-col p-6 overflow-hidden scale-110 rotate-2">
                                     {/* Fake Browser Chrome */}
                                     <div className="flex items-center justify-between mb-6 px-2">
                                        <div className="flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                        </div>
                                        <div className="h-5 w-32 bg-white/5 rounded-full border border-white/10 flex items-center justify-center px-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
                                            <span className="text-[7px] font-black uppercase text-gray-500 tracking-tighter">campus-node-secure</span>
                                        </div>
                                     </div>

                                     {/* Mock Dashboard Layout */}
                                     <div className="flex-1 flex flex-col gap-4">
                                        <div className="flex gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5">
                                                    <div className="w-full h-full rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px] font-black">UVW</div>
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2 py-1">
                                                <div className="h-5 w-40 bg-white/10 rounded-lg"></div>
                                                <div className="h-3 w-24 bg-white/5 rounded"></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="h-16 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-1">
                                                <div className="h-4 w-8 bg-blue-500/20 rounded"></div>
                                                <div className="h-1.5 w-10 bg-white/5 rounded"></div>
                                            </div>
                                            <div className="h-16 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-1">
                                                <div className="h-4 w-8 bg-emerald-500/20 rounded"></div>
                                                <div className="h-1.5 w-10 bg-white/5 rounded"></div>
                                            </div>
                                            <div className="h-16 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-1">
                                                <div className="h-4 w-8 bg-purple-500/20 rounded"></div>
                                                <div className="h-1.5 w-10 bg-white/5 rounded"></div>
                                            </div>
                                        </div>

                                        <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3 relative overflow-hidden group">
                                            <div className="h-4 w-32 bg-white/10 rounded-lg mb-2"></div>
                                            <div className="space-y-2">
                                                <div className="h-2 w-full bg-white/5 rounded"></div>
                                                <div className="h-2 w-full bg-white/5 rounded"></div>
                                                <div className="h-2 w-[80%] bg-white/5 rounded"></div>
                                            </div>
                                            
                                            {/* Dynamic Center Element based on Step */}
                                            <div className="absolute inset-x-4 bottom-4 h-24 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center">
                                                {demoStep === 0 && <div className="w-16 h-16 rounded-lg border-2 border-dashed border-blue-500/40 flex items-center justify-center"><div className="w-10 h-10 border-2 border-white/10 rounded-sm italic text-[8px] flex items-center justify-center text-blue-500/50">QR_ID</div></div>}
                                                {demoStep === 1 && <div className="flex gap-2"><div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div></div>}
                                                {demoStep === 2 && <div className="grid grid-cols-2 gap-2 w-full px-2"><div className="h-8 bg-blue-600/20 rounded-lg"></div><div className="h-8 bg-white/5 rounded-lg"></div><div className="h-8 bg-white/5 rounded-lg"></div><div className="h-8 bg-white/5 rounded-lg"></div></div>}
                                                {demoStep === 3 && <div className="text-[20px] font-black text-blue-500/20 uppercase tracking-[0.5em] animate-pulse">PROTECTED</div>}
                                            </div>
                                        </div>
                                     </div>

                                     {/* Overlay HUD Overlay */}
                                     <div className="absolute top-0 right-0 p-8 h-full flex flex-col justify-between pointer-events-none">
                                        <div className="text-[7px] text-white/20 font-mono text-right">
                                            SYS_DASHBOARD_LIVE<br/>
                                            BUILD_ID: UVW_9980<br/>
                                            ENCRYPT: AES_256
                                        </div>
                                        <div className="text-[10px] text-blue-500/40 font-black animate-pulse text-right tracking-widest">
                                            SCANNING_ACTIVE...
                                        </div>
                                     </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Automatic Countdown Bar */}
                        <div className="absolute top-0 left-0 h-1 bg-white/[0.03] w-full z-10">
                            <div 
                                key={demoStep}
                                className={`h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] ${isAutoPlaying ? 'animate-demo-progress' : 'w-full'}`} 
                                style={{ animationDuration: '4.5s' }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                @keyframes demo-progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-demo-progress {
                    animation-name: demo-progress;
                    animation-timing-function: linear;
                    animation-fill-mode: forwards;
                }
            `}</style>
        </div>
    );
}
