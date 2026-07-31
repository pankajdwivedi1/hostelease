"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const AuthContext = createContext<{
    isMigrating: boolean;
    error: string | null;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isMigrating, setIsMigrating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        // ⚡ SILENT HANDOFF LOGIC (Deprecated: Students use Firebase directly now)
        const performSilentHandoff = async () => {
            console.log("ℹ️ Student Firebase login active. Supabase migration disabled.");
            return;
        };

        performSilentHandoff();
    }, [router]);

    if (isMigrating) {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#050510] flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-black uppercase tracking-tight">Upgrading Your Account</h2>
                <p className="text-gray-400 text-xs mt-2 uppercase tracking-[0.2em]">Moving to Supabase Auth... One moment.</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ isMigrating, error }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuthMigration = () => useContext(AuthContext);
