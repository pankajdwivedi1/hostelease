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
        // ⚡ SILENT HANDOFF LOGIC
        const performSilentHandoff = async () => {
            const storedUserType = localStorage.getItem("userType");
            if (storedUserType !== "student") return;

            // 1. Check if we already have a Supabase session
            const { data: { session: supabaseSession } } = await supabase.auth.getSession();
            if (supabaseSession) {
                console.log("✅ Supabase session active. Skipping migration check.");
                return;
            }

            console.log("🔍 No Supabase session. Checking for legacy Firebase session...");

            // 2. Monitor Firebase Auth
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
                if (fbUser) {
                    console.log("📦 Found Firebase user! Initiating silent migration...");
                    setIsMigrating(true);

                    try {
                        const idToken = await fbUser.getIdToken();
                        
                        // 3. Call Migration API
                        const response = await fetch("/api/auth/migrate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ idToken })
                        });

                        if (!response.ok) {
                            throw new Error("Migration API failed");
                        }

                        const { email, password } = await response.json();

                        // 4. Log into Supabase with the generated credentials
                        const { error: signInError } = await supabase.auth.signInWithPassword({
                            email,
                            password
                        });

                        if (signInError) throw signInError;

                        console.log("🚀 Silent Migration Success! Switched to Supabase.");
                        
                        // 5. Clean up Firebase (optional but recommended)
                        // Note: We don't sign out immediately to avoid race conditions, 
                        // but Supabase is now the primary.
                        localStorage.setItem("auth_provider", "supabase");
                        
                        // Refresh to apply new session state
                        window.location.reload();

                    } catch (err: any) {
                        console.error("❌ Migration failed:", err);
                        setError("Migration failed. Please try logging in again.");
                        setIsMigrating(false);
                    }
                } else {
                    console.log("ℹ️ No Firebase session found either.");
                }
            });

            return () => unsubscribe();
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
