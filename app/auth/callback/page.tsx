"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Supabase removed — student auth now uses Firebase Google Auth directly.
// This callback page is kept only for backward compatibility (old deep links).
// Firebase handles auth instantly in the login page via signInWithPopup,
// so no redirect to /auth/callback is needed anymore.
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // If any old Supabase link or deep link lands here, just redirect home.
    // Firebase auth state is managed by onAuthStateChanged in page.tsx.
    const tenant = typeof window !== "undefined" ? localStorage.getItem("lastTenantSlug") : null;
    if (tenant) {
      router.replace(`/?tenant=${tenant}`);
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-xs font-black tracking-widest text-indigo-900 uppercase">Redirecting...</p>
    </div>
  );
}
