"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase handles the session exchange automatically on the client
      // when it sees the auth code in the URL fragments/params.
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Auth callback error:", error);
      }

      // Redirect to the dashboard while preserving tenant
      // We read from localStorage because Supabase strict redirect matching drops query params
      const tenant = typeof window !== 'undefined' ? localStorage.getItem('lastTenantSlug') : null;
      
      if (tenant) {
          router.push(`/?tenant=${tenant}`);
      } else {
          router.push("/");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
      <h2 className="text-xl font-black uppercase tracking-tight">Authenticating</h2>
      <p className="text-gray-400 text-xs mt-2 uppercase tracking-[0.2em]">Finalizing your secure session...</p>
    </div>
  );
}
