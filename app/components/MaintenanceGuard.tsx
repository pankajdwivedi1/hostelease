"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Wrench, RefreshCw, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface MaintenanceState {
    enabled: boolean;
    message: string;
    estimatedTime: string;
}

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [maintenance, setMaintenance] = useState<MaintenanceState>({
        enabled: false,
        message: "",
        estimatedTime: ""
    });
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const isSuperAdminRoute = pathname?.startsWith("/superadmin");

    const checkMaintenance = async () => {
        try {
            const res = await fetch("/api/maintenance-status", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            if (data?.success) {
                setMaintenance({
                    enabled: Boolean(data.enabled),
                    message: data.message || "",
                    estimatedTime: data.estimatedTime || ""
                });
            }
        } catch (e) {
            console.warn("Failed to check maintenance status:", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (isSuperAdminRoute) return;
        checkMaintenance();

        // Background polling every 30 seconds
        const interval = setInterval(checkMaintenance, 30000);
        return () => clearInterval(interval);
    }, [isSuperAdminRoute]);

    // SuperAdmin routes are completely exempt
    if (isSuperAdminRoute) {
        return <>{children}</>;
    }

    // If Maintenance Mode is Active, block regular users and show Maintenance Screen
    if (maintenance.enabled) {
        return (
            <div className="fixed inset-0 z-[99999] bg-[#050510] text-white flex flex-col items-center justify-center p-4 select-none overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
                {/* Glowing Background Orbs */}
                <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none"></div>
                <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>

                <div className="w-full max-w-lg relative z-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    {/* UVW Logo with Maintenance Badge */}
                    <div className="relative inline-block">
                        <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-amber-500/40 mx-auto shadow-2xl shadow-amber-500/20 bg-black flex items-center justify-center">
                            <img src="/uvw_logo.jpg" alt="Hosteleaze" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-amber-500 rounded-2xl flex items-center justify-center border-4 border-[#050510] shadow-lg animate-pulse" title="System Maintenance Active">
                            <Wrench className="w-4 h-4 text-black" />
                        </div>
                    </div>

                    {/* Badge */}
                    <div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                            <span>Scheduled Maintenance In Progress</span>
                        </div>
                    </div>

                    {/* Title & Message */}
                    <div className="space-y-3 px-2">
                        <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
                            Platform Upgrades <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                                In Progress
                            </span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-md mx-auto">
                            {maintenance.message || "We are currently performing scheduled platform maintenance and system updates. All services will resume shortly."}
                        </p>
                    </div>

                    {/* Estimated Time Card (if specified) */}
                    {maintenance.estimatedTime && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold">
                            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Estimated Return: <strong className="text-white">{maintenance.estimatedTime}</strong></span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRefreshing(true);
                                checkMaintenance();
                            }}
                            disabled={isRefreshing}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
                            <span>{isRefreshing ? "Checking Status..." : "Check Status"}</span>
                        </button>

                        <a
                            href="https://wa.me/918269418956?text=Hi%20Hosteleaze%20Support%2C%20inquiring%20about%20scheduled%20maintenance."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <span>Support WhatsApp</span>
                        </a>
                    </div>

                    {/* Discreet SuperAdmin Access */}
                    <div className="pt-6 border-t border-white/5">
                        <Link
                            href="/superadmin"
                            className="text-[10px] text-slate-500 hover:text-slate-300 font-bold tracking-widest uppercase inline-flex items-center gap-1 transition-colors"
                        >
                            <ShieldCheck className="w-3 h-3 text-slate-600" />
                            <span>Boss Control Login</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
