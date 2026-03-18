"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ImpersonateHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const type = searchParams.get("type");
        const token = searchParams.get("token");

        // Simple security check: Only allow if we came from superadmin domain or have a specific bypass
        // In a real production app, we would verify the 'token' against a server-side boss key.
        if (type === "admin") {
            console.log("Boss Mode: Impersonating Dean...");
            localStorage.setItem("userType", "admin");
            router.push("/");
        } else {
            router.push("/login");
        }
    }, [searchParams, router]);

    return (
        <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center text-white p-6">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-8"></div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Synchronizing Credentials</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Establishing Secure Proxy Connection...</p>
        </div>
    );
}

export default function ImpersonatePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ImpersonateHandler />
        </Suspense>
    );
}
