"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertCircle, Lock, ShieldAlert } from "lucide-react";

export default function TenantGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        // Don't guard the superadmin or login pages
        if (pathname.startsWith("/superadmin") || pathname.startsWith("/login")) {
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

    // If expired or deactivated, show the LOCK SCREEN
    if (status?.isExpired) {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#050510] flex items-center justify-center p-6 text-white overflow-hidden">
                {/* Animated Background Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>

                <div className="w-full max-w-lg text-center space-y-8 relative z-10 animate-in fade-in zoom-in duration-700">
                    <div className="relative inline-block">
                        <div className="w-24 h-24 bg-red-600/10 rounded-3xl flex items-center justify-center border border-red-500/20 shadow-2xl shadow-red-500/10">
                            <Lock className="w-12 h-12 text-red-500" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                            <ShieldAlert className="w-8 h-8 text-white fill-red-600 animate-bounce" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-4xl font-black tracking-tighter uppercase sm:text-5xl">Access Suspended</h1>
                        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs">University Node Offline</p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 backdrop-blur-md">
                        <div className="flex items-start gap-4 text-left">
                            <div className="mt-1 p-2 bg-red-500/20 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-tight text-red-400">Subscription Required</h4>
                                <p className="text-gray-400 text-xs mt-1 leading-relaxed font-medium">
                                    The subscription for this college has either expired or been manually deactivated by the system administrator. All operations, including QR scanning and Gatepass generation, are currently frozen.
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-loose">
                                Please contact the Hostelease Finance Department or your University Administrator to reactivate your services.
                            </p>
                        </div>

                        <a
                            href="mailto:support@hostelease.com"
                            className="block w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-red-900/20 uppercase tracking-widest text-xs"
                        >
                            Contact Support
                        </a>
                    </div>

                    <div className="flex items-center justify-center gap-2 opacity-30">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">System ID: {status.tenantId || "PROX-001"}</p>
                    </div>
                </div>
            </div>
        );
    }

    return children;
}
