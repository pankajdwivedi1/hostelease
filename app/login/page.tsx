"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
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

  // For background animation mounting
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user) {
        const response = await fetch(`/api/students?firebaseUID=${user.uid}`);
        const data = await response.json();

        if (data.student) {
          localStorage.setItem("userType", "student");
          localStorage.setItem("firebaseUID", user.uid);
          router.push("/");
        } else {
          localStorage.setItem("userType", "student");
          localStorage.setItem("firebaseUID", user.uid);
          router.push("/onboarding");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
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
        localStorage.setItem("userType", "admin");
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

    if (!wardenPassword.trim()) {
      setError("Please enter the warden password");
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
        body: JSON.stringify({ password: wardenPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid password");
      }

      if (data.success) {
        localStorage.setItem("userType", "warden");
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
        localStorage.setItem("userType", "developer");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white font-sans selection:bg-black/10">
      {/* Subtle Grid Overlay */}
      <div
        className="absolute inset-0 z-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(#000000 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }}
      />

      <main className="relative z-10 w-full max-w-lg px-6">
        <div className={`transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <div className="flex flex-col items-center space-y-6">

            {/* Logo and Title */}
            <div className="flex flex-col items-center space-y-4 text-center">
              <div
                className="group relative cursor-pointer"
                onClick={() => {
                  setShowDeveloperPassword(!showDeveloperPassword);
                  setShowAdminPassword(false);
                  setShowWardenPassword(false);
                }}
              >
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-gray-200 to-gray-100 opacity-40 blur transition duration-1000 group-hover:opacity-100 group-hover:duration-200" />
                <img
                  src="/logo.jpeg"
                  alt="Hostelease Logo"
                  className="relative h-20 w-20 rounded-full object-cover transition-all duration-500 group-hover:scale-110 active:scale-95 shadow-xl border border-gray-100"
                  title="Click for developer login"
                />
              </div>
              <div className="space-y-1">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                  Hostel<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">ease</span>
                </h1>
                <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">
                  Management Reimagined
                </p>
              </div>
            </div>

            {/* Login Container */}
            <div className="w-full overflow-hidden rounded-3xl border border-gray-200 bg-white p-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]">
              <div className="rounded-[22px] bg-slate-50/50 p-8 shadow-inner">

                {error && (
                  <div className="mb-6 flex animate-in fade-in slide-in-from-top-4 items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {error}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Student Login */}
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm font-bold text-black transition-all hover:bg-gray-50 hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {loading ? "Establishing connection..." : "Continue as Student"}
                  </button>

                  <div className="relative flex items-center py-2">
                    <div className="grow border-t border-gray-100"></div>
                    <span className="mx-4 text-[10px] font-bold uppercase tracking-tighter text-slate-400">Access Portal</span>
                    <div className="grow border-t border-gray-100"></div>
                  </div>

                  {/* Staff Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleAdminLogin}
                      className={`group flex flex-col items-center justify-center gap-3 rounded-2xl border p-5 transition-all duration-300 active:scale-95 ${showAdminPassword
                        ? "border-blue-200 bg-blue-50 shadow-inner"
                        : "border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 shadow-sm"
                        }`}
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${showAdminPassword ? "bg-blue-600 text-white scale-110 shadow-lg" : "bg-blue-50 text-blue-600 group-hover:scale-110"
                        }`}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <span className={`text-xs font-bold tracking-wide transition-colors ${showAdminPassword ? "text-blue-900" : "text-slate-500 group-hover:text-slate-900"}`}>
                        Dean
                      </span>
                    </button>

                    <button
                      onClick={handleWardenLogin}
                      className={`group flex flex-col items-center justify-center gap-3 rounded-2xl border p-5 transition-all duration-300 active:scale-95 ${showWardenPassword
                        ? "border-indigo-200 bg-indigo-50 shadow-inner"
                        : "border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 shadow-sm"
                        }`}
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${showWardenPassword ? "bg-indigo-600 text-white scale-110 shadow-lg" : "bg-indigo-50 text-indigo-600 group-hover:scale-110"
                        }`}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className={`text-xs font-bold tracking-wide transition-colors ${showWardenPassword ? "text-indigo-900" : "text-slate-500 group-hover:text-slate-900"}`}>
                        Warden
                      </span>
                    </button>
                  </div>

                  {/* Password Verification Section */}
                  {(showAdminPassword || showWardenPassword || showDeveloperPassword) && (
                    <div className="mt-8 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
                        <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {showAdminPassword ? "Dean Authentication Key" : showWardenPassword ? "Warden Authentication Key" : "Developer Override"}
                        </label>
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
                            className="w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-4 text-slate-900 placeholder-slate-300 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
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
                            className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-xs font-bold text-slate-500 transition-all hover:bg-gray-50 hover:text-slate-900"
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
                            className={`flex-1 rounded-xl py-3 text-xs font-bold text-white transition-all shadow-lg active:scale-95 ${showAdminPassword ? "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20" :
                              showWardenPassword ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20" :
                                "bg-slate-700 hover:bg-slate-600 shadow-slate-700/20"
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

            {/* Footer */}
            <div className="flex flex-col items-center space-y-4 pt-4" style={{ fontFamily: 'Cambria, Georgia, serif' }}>
              <div className="flex flex-col items-center space-y-1">
                <p className="text-[12px] font-bold tracking-wider text-slate-900 uppercase">
                  &copy; 2026 Hostelease Cloud Infostructure
                </p>
                <p className="text-[11px] font-medium tracking-wide text-slate-600 uppercase">
                  Developed by Dr. Pankaj Prasad Dwivedi
                </p>
              </div>
              <div className="flex gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span className="cursor-pointer hover:text-blue-600 transition-colors">Security</span>
                <span className="text-slate-200">&bull;</span>
                <span className="cursor-pointer hover:text-indigo-600 transition-colors">Privacy</span>
                <span className="text-slate-200">&bull;</span>
                <span className="cursor-pointer hover:text-slate-900 transition-colors">API</span>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

