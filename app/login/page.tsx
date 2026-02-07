"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [showWardenPassword, setShowWardenPassword] = useState(false);
  const [wardenPassword, setWardenPassword] = useState("");
  const [wardenLoading, setWardenLoading] = useState(false);
  const [showDeveloperPassword, setShowDeveloperPassword] = useState(false);
  const [developerPassword, setDeveloperPassword] = useState("");
  const [developerLoading, setDeveloperLoading] = useState(false);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedHostelId, setSelectedHostelId] = useState("");

  // For background animation mounting
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    fetchHostels();
    if (searchParams.get("logout") === "success") {
      setShowLogoutToast(true);
      setTimeout(() => setShowLogoutToast(false), 5000);
      // Clean up the URL
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const fetchHostels = async () => {
    try {
      const response = await fetch("/api/hostels");
      const data = await response.json();
      if (data.hostels) {
        setHostels(data.hostels);
      }
    } catch (error) {
      console.error("Error fetching hostels:", error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user) {
        // ⚡ OPTIMIZED: Only check if student exists, don't load full profile
        // Profile data will be loaded asynchronously after redirect
        const response = await fetch(`/api/students?firebaseUID=${user.uid}&minimal=true`);
        const data = await response.json();

        // Store session data and redirect immediately
        sessionStorage.setItem("userType", "student");
        sessionStorage.setItem("firebaseUID", user.uid);

        if (data.student) {
          // User exists - go to dashboard (profile loads there)
          router.push("/");
        } else {
          // New user - go to onboarding
          router.push("/onboarding");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);

      let friendlyMessage = "Failed to sign in with Google. Please try again.";

      if (error.code === 'auth/popup-closed-by-user') {
        friendlyMessage = "The login popup was closed before completion. Please try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        friendlyMessage = "Login request cancelled. Please try again.";
      } else if (error.code === 'auth/popup-blocked') {
        friendlyMessage = "Login popup was blocked by your browser. Please allow popups for this site.";
      } else if (error.code === 'auth/unauthorized-domain') {
        friendlyMessage = "This domain is not authorized for authentication. Please contact the administrator.";
      }

      setError(friendlyMessage);
      setLoading(false);
    }
    // Note: Don't setLoading(false) on success - let the redirect handle it
  };

  const handleAdminLogin = async () => {
    if (!showAdminPassword) {
      setShowAdminPassword(true);
      setShowWardenPassword(false);
      setShowDeveloperPassword(false);
      setError("");
      return;
    }

    if (!adminPassword.trim()) {
      setError("Please enter the admin password");
      return;
    }

    try {
      setAdminLoading(true);
      setError("");

      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: adminPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid password");
      }

      if (data.success) {
        sessionStorage.setItem("userType", "admin");
        router.push("/");
      }
    } catch (error: any) {
      console.error("Admin login error:", error);
      setError(error.message || "Invalid password. Please try again.");
      setAdminPassword("");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleWardenLogin = async () => {
    if (!showWardenPassword) {
      setShowWardenPassword(true);
      setShowAdminPassword(false);
      setShowDeveloperPassword(false);
      setError("");
      return;
    }

    if (!selectedHostelId) {
      setError("Please select a hostel first");
      return;
    }

    if (!wardenPassword.trim()) {
      setError("Please enter the warden authentication key");
      return;
    }

    try {
      setWardenLoading(true);
      setError("");

      const response = await fetch("/api/warden/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: wardenPassword,
          hostelId: selectedHostelId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid password");
      }

      if (data.success) {
        sessionStorage.setItem("userType", "warden");
        sessionStorage.setItem("wardenHostelName", data.hostelName);
        sessionStorage.setItem("authorizedHostels", JSON.stringify(data.authorizedHostels));
        router.push("/");
      }
    } catch (error: any) {
      console.error("Warden login error:", error);
      setError(error.message || "Invalid password. Please try again.");
      setWardenPassword("");
    } finally {
      setWardenLoading(false);
    }
  };

  const handleDeveloperLogin = async () => {
    if (!showDeveloperPassword) {
      setShowDeveloperPassword(true);
      setShowAdminPassword(false);
      setShowWardenPassword(false);
      setError("");
      return;
    }

    try {
      setDeveloperLoading(true);
      setError("");

      const response = await fetch("/api/developer/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: developerPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid password");
      }

      if (data.success) {
        sessionStorage.setItem("userType", "developer");
        router.push("/");
      }
    } catch (error: any) {
      console.error("Developer login error:", error);
      setError(error.message || "Invalid password. Please try again.");
      setDeveloperPassword("");
    } finally {
      setDeveloperLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden overflow-y-auto no-scrollbar bg-[#fafafa] font-sans selection:bg-blue-100 p-4 sm:p-6 lg:p-8">
      <style jsx global>{`
        html, body {
          height: 100%;
          overflow: hidden !important;
          margin: 0;
          padding: 0;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }}
        />
      </div>

      <main className="relative z-10 w-full max-w-lg flex flex-col justify-center min-h-full py-2 sm:py-6">
        <div className={`transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} flex flex-col justify-center`}>
          <div className="flex flex-col items-center space-y-2.5 sm:space-y-6">

            {/* Logo and Title */}
            <div className="flex flex-col items-center space-y-2 text-center">
              <div
                className="group relative cursor-pointer"
                onClick={() => {
                  setShowDeveloperPassword(!showDeveloperPassword);
                  setShowAdminPassword(false);
                  setShowWardenPassword(false);
                }}
              >
                <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 opacity-0 blur-xl transition duration-700 group-hover:opacity-100" />
                <img
                  src="/logo.jpeg"
                  alt="Hostelease Logo"
                  className={`relative rounded-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:rotate-3 shadow-2xl border-4 border-white ${(showAdminPassword || showWardenPassword || showDeveloperPassword)
                    ? "h-10 w-10 sm:h-14 sm:w-14"
                    : "h-16 w-16 sm:h-20 sm:w-20"
                    }`}
                  title="Click for developer login"
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <h1 className={`${(showAdminPassword || showWardenPassword || showDeveloperPassword) ? "text-2xl sm:text-4xl" : "text-3xl sm:text-5xl"} font-black tracking-tight text-slate-900 transition-all duration-500`}>
                  Hostel<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">ease</span>
                </h1>
                <div className="flex flex-col items-center space-y-2 sm:space-y-3">
                  <p className={`${(showAdminPassword || showWardenPassword || showDeveloperPassword) ? "hidden sm:block text-[8px] sm:text-[10px]" : "text-[9px] sm:text-[10px]"} font-black text-blue-600/60 tracking-[0.3em] uppercase transition-all duration-500`}>
                    Management Reimagined
                  </p>

                  {/* Logout success popup positioned exactly above the description */}
                  {showLogoutToast && (
                    <div className="w-full max-w-[280px] sm:max-w-[320px] animate-in fade-in slide-in-from-top-2 duration-500 my-0.5 sm:my-1">
                      <div className="flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border border-emerald-100 bg-[#e6fcf5] pr-3 sm:pr-4 shadow-sm overflow-hidden min-h-[40px] sm:min-h-[48px]">
                        <div className="w-1 self-stretch bg-[#059669]" />
                        <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-[#059669] text-white flex-shrink-0">
                          <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-[11px] sm:text-[13px] font-bold text-[#064e3b] tracking-tight text-left">
                          You have successfully logged out.
                        </p>
                      </div>
                    </div>
                  )}

                  <p className={`${(showAdminPassword || showWardenPassword || showDeveloperPassword) ? "hidden sm:block opacity-0 sm:opacity-100 max-h-0 sm:max-h-20" : "max-h-20 opacity-100"} max-w-[260px] sm:max-w-[280px] text-[11px] sm:text-sm font-medium text-slate-500 leading-tight sm:leading-relaxed transition-all duration-500 overflow-hidden`}>
                    The smart, all-in-one ecosystem for modern hostel administration and student living.
                  </p>
                </div>
              </div>
            </div>

            {/* Login Container */}
            <div className="w-full relative group">
              {/* Decorative background glow for the container */}
              <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-b from-gray-200/50 to-transparent opacity-50 blur-sm transition duration-500 group-hover:opacity-100" />

              <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] border border-white bg-white/80 backdrop-blur-xl p-1 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] transition-all duration-500">
                <div className="rounded-[20px] sm:rounded-[26px] bg-slate-50/40 p-4 sm:p-7">

                  {error && (
                    <div className="mb-6 flex animate-in fade-in slide-in-from-top-4 items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm text-red-600 backdrop-blur-md">
                      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <div className="space-y-4 sm:space-y-6">
                    {/* Student Login */}
                    <button
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="group relative flex w-full items-center justify-center gap-3 sm:gap-4 overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 py-3.5 sm:py-4.5 text-xs sm:text-sm font-bold text-slate-900 transition-all hover:border-blue-200 hover:bg-slate-50 disabled:opacity-50 active:scale-[0.98]"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-600" />
                          Connecting...
                        </span>
                      ) : "Continue as Student"}
                    </button>

                    <div className={`${(showAdminPassword || showWardenPassword || showDeveloperPassword) ? "py-1 sm:py-2" : "py-2"} relative flex items-center transition-all`}>
                      <div className="grow border-t border-slate-100"></div>
                      <span className="mx-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Staff Portal</span>
                      <div className="grow border-t border-slate-100"></div>
                    </div>

                    {/* Staff Selection */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={handleAdminLogin}
                        className={`group flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-2xl border-2 p-3 sm:p-5 transition-all duration-500 active:scale-95 ${showAdminPassword
                          ? "border-blue-500 bg-blue-50/50 shadow-inner"
                          : "border-transparent bg-white hover:bg-slate-50 hover:border-slate-100 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                          }`}
                      >
                        <div className={`flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-2xl transition-all duration-500 ${showAdminPassword ? "bg-blue-600 text-white rotate-6 shadow-blue-200 shadow-xl" : "bg-blue-50 text-blue-600 group-hover:scale-110 group-hover:-rotate-3"
                          }`}>
                          <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <span className={`block text-sm font-bold tracking-tight transition-colors ${showAdminPassword ? "text-blue-900" : "text-slate-800"}`}>
                            Dean
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">Institutional Access</span>
                        </div>
                      </button>

                      <button
                        onClick={handleWardenLogin}
                        className={`group flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-2xl border-2 p-3 sm:p-5 transition-all duration-500 active:scale-95 ${showWardenPassword
                          ? "border-indigo-500 bg-indigo-50/50 shadow-inner"
                          : "border-transparent bg-white hover:bg-slate-50 hover:border-slate-100 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                          }`}
                      >
                        <div className={`flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-2xl transition-all duration-500 ${showWardenPassword ? "bg-indigo-600 text-white -rotate-6 shadow-indigo-200 shadow-xl" : "bg-indigo-50 text-indigo-600 group-hover:scale-110 group-hover:rotate-3"
                          }`}>
                          <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <span className={`block text-sm font-bold tracking-tight transition-colors ${showWardenPassword ? "text-indigo-900" : "text-slate-800"}`}>
                            Warden
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">Hostel Management</span>
                        </div>
                      </button>
                    </div>

                    {/* Password Verification Section */}
                    {(showAdminPassword || showWardenPassword || showDeveloperPassword) && (
                      <div className="mt-4 sm:mt-8 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                        <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_12px_24px_-8px_rgba(0,0,0,0.08)]">
                          <label className="mb-2 sm:mb-3 block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {showAdminPassword ? "Dean Authentication Key" : showWardenPassword ? "Warden Authentication Key" : "Developer Override"}
                          </label>

                          {showWardenPassword && (
                            <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              <select
                                value={selectedHostelId}
                                onChange={(e) => {
                                  setSelectedHostelId(e.target.value);
                                  setError("");
                                }}
                                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 sm:py-4 text-sm sm:text-base text-slate-900 appearance-none focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                              >
                                <option value="" disabled>Select Your Hostel</option>
                                {hostels.map(hostel => (
                                  <option key={hostel._id} value={hostel._id}>
                                    {hostel.name}
                                  </option>
                                ))}
                              </select>
                              <div className="mt-1.5 px-1 flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-wider">Select hostel to proceed</span>
                              </div>
                            </div>
                          )}

                          <div className="relative group">
                            <input
                              type="password"
                              autoFocus
                              value={showAdminPassword ? adminPassword : showWardenPassword ? wardenPassword : developerPassword}
                              onChange={(e) => {
                                if (showAdminPassword) setAdminPassword(e.target.value);
                                else if (showWardenPassword) setWardenPassword(e.target.value);
                                else setDeveloperPassword(e.target.value);
                                setError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (showAdminPassword) handleAdminLogin();
                                  else if (showWardenPassword) handleWardenLogin();
                                  else handleDeveloperLogin();
                                }
                              }}
                              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 sm:py-4 text-sm sm:text-base text-slate-900 placeholder-slate-300 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                              placeholder="••••••••••••"
                            />
                          </div>
                          <div className="mt-6 flex gap-3">
                            <button
                              onClick={() => {
                                setShowAdminPassword(false);
                                setShowWardenPassword(false);
                                setShowDeveloperPassword(false);
                                setAdminPassword("");
                                setWardenPassword("");
                                setDeveloperPassword("");
                                setError("");
                              }}
                              className="flex-1 rounded-xl border border-slate-100 bg-white py-3 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (showAdminPassword) handleAdminLogin();
                                else if (showWardenPassword) handleWardenLogin();
                                else handleDeveloperLogin();
                              }}
                              disabled={adminLoading || wardenLoading || developerLoading}
                              className={`flex-1 rounded-xl py-3 text-xs font-bold text-white transition-all shadow-lg active:scale-95 ${showAdminPassword ? "bg-blue-600 hover:bg-blue-500 shadow-blue-500/25" :
                                showWardenPassword ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25" :
                                  "bg-slate-800 hover:bg-slate-700 shadow-slate-800/25"
                                }`}
                            >
                              {adminLoading || wardenLoading || developerLoading ? (
                                <div className="flex items-center justify-center gap-2">
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                  <span>Verifying</span>
                                </div>
                              ) : "Confirm Identity"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Refined Footer */}
            <footer className="w-full max-w-sm mt-2 sm:mt-4 pb-4 sm:pb-8">
              <div className="flex flex-col items-center space-y-2 sm:space-y-4 text-center">
                <div className="space-y-1.5 sm:space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-px w-4 sm:w-6 bg-slate-200" />
                    <p className="text-[8px] sm:text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                      &copy; 2026 Hostelease Cloud
                    </p>
                    <div className="h-px w-4 sm:w-6 bg-slate-200" />
                  </div>

                  <div className="group cursor-default">
                    <p className="text-[8px] sm:text-[10px] font-medium text-slate-400 tracking-wider" style={{ fontFamily: 'Cambria, Georgia, serif' }}>
                      Developed meticulously by
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5 transition-colors group-hover:text-blue-600" style={{ fontFamily: 'Cambria, Georgia, serif' }}>
                      Dr. Pankaj Prasad Dwivedi
                    </p>
                  </div>
                </div>

                <nav className="flex items-center gap-4 sm:gap-6 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                  <a href="#" className="hover:text-blue-600 transition-colors">Security</a>
                  <div className="h-1 w-1 rounded-full bg-slate-200" />
                  <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
                  <div className="h-1 w-1 rounded-full bg-slate-200" />
                  <a href="#" className="hover:text-blue-600 transition-colors">API</a>
                </nav>
              </div>
            </footer>

          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

