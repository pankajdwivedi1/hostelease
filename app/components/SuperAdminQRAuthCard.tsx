"use client";

import React, { useState } from "react";
import { QrCode, Camera, ShieldCheck, CheckCircle2, Laptop } from "lucide-react";
import SuperAdminQRScannerModal from "./SuperAdminQRScannerModal";

interface SuperAdminQRAuthCardProps {
    tenantName?: string;
}

export default function SuperAdminQRAuthCard({ tenantName }: SuperAdminQRAuthCardProps) {
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    return (
        <>
            <div className="p-3 sm:p-4 bg-gradient-to-br from-[#0c1322] to-[#070b12] border border-blue-500/30 rounded-xl sm:rounded-2xl shadow-lg relative overflow-hidden">
                {/* Subtle Glow Background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-start justify-between gap-2 mb-2 relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 shrink-0 shadow-sm">
                            <Laptop className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-tight leading-tight">
                                {tenantName ? `${tenantName} Super Admin Desktop Login` : "Super Admin Desktop QR Login"}
                            </h4>
                            <p className="text-[8.5px] sm:text-[9.5px] text-blue-300/80 font-semibold leading-tight mt-0.5">
                                WhatsApp Web-Style Instant Authorization
                            </p>
                        </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-md text-emerald-400 text-[8.5px] font-black uppercase tracking-wider shrink-0 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready</span>
                    </span>
                </div>

                <p className="text-[9px] sm:text-[10px] text-gray-300/90 leading-relaxed mb-3 relative z-10">
                    When you or your staff open the Super Admin login on a computer, tap the button below to scan the QR code displayed on the desktop screen. It approves login instantly without SMS or phone number prompts.
                </p>

                {/* Primary Scan Button */}
                <button
                    onClick={() => setIsScannerOpen(true)}
                    className="w-full py-2.5 px-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 border border-blue-400/30"
                >
                    <Camera className="w-4 h-4 text-cyan-300" />
                    <span>Scan Desktop QR Code to Login</span>
                </button>
            </div>

            {/* Mobile Camera Scanner Modal */}
            <SuperAdminQRScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
            />
        </>
    );
}
