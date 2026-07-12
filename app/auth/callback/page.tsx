"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    // Check if redirecting back to native app
    const url = new URL(window.location.href);
    const isNative = url.searchParams.get('native') === 'true';
    if (isNative) {
      const hash = window.location.hash;
      const search = window.location.search;
      window.location.replace(`com.hosteleaze.app://auth/callback${search}${hash}`);
      return;
    }

    const doRedirect = () => {
      const tenant = typeof window !== 'undefined' ? localStorage.getItem('lastTenantSlug') : null;
      if (tenant) {
          window.location.replace(`/?tenant=${tenant}`);
      } else {
          window.location.replace("/");
      }
    };

    // 1. If session is instantly available, redirect immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) doRedirect();
    });

    // 2. Otherwise, listen for the exact moment Supabase finishes parsing the URL hash.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        if (session) doRedirect();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-xs font-black tracking-widest text-indigo-900 uppercase">Verifying</p>
    </div>
  );
}
