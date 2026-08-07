"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
// Supabase removed — using Firebase Auth for all logins
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { showToast, showPrompt } from "@/lib/toast";



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
  const [isDeveloperSetup, setIsDeveloperSetup] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showParentLogin, setShowParentLogin] = useState(false);
  const [parentPhone, setParentPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [parentLoading, setParentLoading] = useState(false);
  const [parentReqId, setParentReqId] = useState("");
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [superAdminResetStep, setSuperAdminResetStep] = useState<"none" | "phone" | "otp" | "reset">("none");
  const [superAdminResetPhone, setSuperAdminResetPhone] = useState("");
  const [superAdminResetOtp, setSuperAdminResetOtp] = useState("");
  const [superAdminNewPassword, setSuperAdminNewPassword] = useState("");
  const [superAdminConfirmPassword, setSuperAdminConfirmPassword] = useState("");
  const [superAdminResetLoading, setSuperAdminResetLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // ⚡ INSTANT BRANDING SYNC: Initialize from URL or Local Storage to prevent flickering
  const [tenantName, setTenantName] = useState("Hosteleaze");
  const [tenantLogo, setTenantLogo] = useState("");

  useEffect(() => {
    // ⚡ FIRST PASS: Check URL and Storage instantly (Zero Flicker)
    if (typeof window !== 'undefined') {
      const tenantParam = searchParams.get('tenant');
      if (tenantParam) {
        setTenantName(tenantParam.toUpperCase());
        // If we have logo in storage for this specific slug, use it
        if (localStorage.getItem("lastTenantSlug") === tenantParam.toLowerCase()) {
            setTenantLogo(localStorage.getItem("lastTenantLogo") || "");
            setTenantName(localStorage.getItem("lastTenantName") || tenantParam.toUpperCase());
        }
      } else {
        setTenantName(localStorage.getItem("lastTenantName") || "Hosteleaze");
        setTenantLogo(localStorage.getItem("lastTenantLogo") || "");
      }
    }

    setMounted(true);
    fetchHostels();
    fetchTenantConfig();
    checkDeveloperSetup();
    
    if (searchParams.get("logout") === "success") {
      document.cookie = "userType=; path=/; max-age=0; SameSite=Lax";
      setShowLogoutToast(true);
      showToast("You have successfully logged out.", "success");
      setTimeout(() => setShowLogoutToast(false), 5000);
      // Clean up the URL
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const fetchTenantConfig = async () => {
    try {
      const tenant = searchParams.get('tenant');
      const res = await fetch(`/api/tenant/config${tenant ? `?tenant=${tenant}` : ''}`);
      const data = await res.json();
      if (data.success) {
        setTenantName(data.name);
        setTenantLogo(data.logo);
        // ⚡ Persist for instant load next time
        localStorage.setItem("lastTenantName", data.name);
        localStorage.setItem("lastTenantLogo", data.logo || "");
        localStorage.setItem("lastTenantSlug", data.slug || "");
      }
    } catch (err) {
      console.error("Config fetch failed", err);
    }
  };

  const fetchHostels = async () => {
    try {
      const tenant = searchParams.get('tenant');
      const response = await fetch(`/api/hostels${tenant ? `?tenant=${tenant}` : ''}`);

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          if (data.hostels && Array.isArray(data.hostels)) {
            setHostels(data.hostels);
          }
        }
      }
    } catch (error) {
      console.warn("Hostels fetch notice:", error);
    }
  };

  const checkDeveloperSetup = async () => {
    try {
      const tenant = searchParams.get('tenant');
      const res = await fetch(`/api/developer/setup-status${tenant ? `?tenant=${tenant}` : ''}`);
      const data = await res.json();
      if (data.success) {
        setIsDeveloperSetup(data.isSetup);
      }
    } catch (e) {
      console.error("Setup check failed");
    }
  };
  
  // ⚡ Web OTP API: Automatically read SMS on Android Chrome
  useEffect(() => {
    if (!otpSent) return;

    if ('OTPCredential' in window) {
      const ac = new AbortController();
      (navigator.credentials as any).get({
        otp: { transport: ['sms'] },
        signal: ac.signal
      }).then((otp: any) => {
        if (otp && otp.code) {
          setOtp(otp.code);
          handleVerifyOtp(otp.code); // Instantly verify when received!
        }
      }).catch((err: any) => {
        console.warn('Web OTP API Error (or aborted):', err);
      });

      return () => {
        ac.abort(); // Cancel listener if user types manually or leaves page
      };
    }
  }, [otpSent]);


  const handleSendOtp = async () => {
    if (!parentPhone || parentPhone.length !== 10) {
      const errMsg = "Please enter a valid 10-digit mobile number";
      setError(errMsg);
      showToast(errMsg, "warning");
      return;
    }

    try {
      setParentLoading(true);
      setError("");

      const response = await fetch("/api/parent/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: parentPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      if (data.reqId) {
        setParentReqId(data.reqId);
      }
      setOtpSent(true);
      
      if (data.developmentOtp) {
        console.log(`[Dev Auto-Fill] OTP received: ${data.developmentOtp}`);
      }
    } catch (err: any) {
      console.error("Send OTP error:", err);
      const errMsg = err.message || "Something went wrong. Please try again.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setParentLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const numbers = text.replace(/\D/g, "");
      if (numbers.length === 6) {
        setOtp(numbers);
        setError("");
        handleVerifyOtp(numbers);
      } else if (numbers.length > 0) {
        setOtp(numbers.slice(0, 6));
      }
    } catch (err) {
      console.warn("Clipboard access denied", err);
      setError("Please allow clipboard permission to paste.");
    }
  };

  const handleVerifyOtp = async (codeOverride?: any) => {
    const activeOtp = (typeof codeOverride === 'string') ? codeOverride : otp;
    if (!activeOtp || activeOtp.length !== 6) {
      const errMsg = "Please enter the 6-digit OTP code";
      setError(errMsg);
      showToast(errMsg, "warning");
      return;
    }

    try {
      setParentLoading(true);
      setError("");

      const response = await fetch("/api/parent/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: parentPhone, otp: activeOtp, reqId: parentReqId }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data.error || "Verification failed";
        if (errorMessage.toLowerCase() === "invalid otp" || errorMessage.toLowerCase().includes("invalid otp")) {
          const maskedPhone = parentPhone.length === 10 ? `${parentPhone.substring(0, 4)}XXXX${parentPhone.substring(8, 10)}` : parentPhone;
          errorMessage = `Invalid OTP, please enter correct OTP received on your linked mobile number '${maskedPhone}'`;
        }
        throw new Error(errorMessage);
      }

      localStorage.setItem("userType", "parent");
      localStorage.setItem("parentPhone", parentPhone);
      router.push("/");
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      const errMsg = err.message || "Invalid OTP code. Please try again.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setParentLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setLoadingText("");
      setError("");

      console.log("Initiating Firebase Google Login for Student...");

      // Use Firebase Google sign-in (same provider as Dean/Warden)
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user?.email) throw new Error("No email returned from Google login");

      // Mark as student in localStorage
      localStorage.setItem("userType", "student");

      setLoadingText("Verifying Account...");

      // ⚡ FAST DB CHECK: Look up student by firebaseUID or email
      let studentDataObj: any = null;
      let tenantSlugRes: string | null = null;

      try {
        const response = await fetch(
          `/api/students?firebaseUID=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email)}&minimal=true`
        );
        if (response.ok) {
          const resJson = await response.json();
          studentDataObj = resJson.student;
          tenantSlugRes = resJson.tenantSlug;
        }
      } catch (err) {
        console.warn("Primary student verification error:", err);
      }

      // Fallback query by email alone if primary check returned nothing
      if (!studentDataObj && user.email) {
        try {
          const fallbackRes = await fetch(`/api/students?email=${encodeURIComponent(user.email)}`);
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            studentDataObj = fallbackJson.student;
            tenantSlugRes = fallbackJson.tenantSlug;
          }
        } catch (fallbackErr) {
          console.warn("Fallback email student verification error:", fallbackErr);
        }
      }

      if (studentDataObj) {
        // Existing student found — cache and open dashboard
        const cached = localStorage.getItem("cachedStudentData");
        const existing = cached ? JSON.parse(cached) : {};
        const merged = { ...existing, ...studentDataObj };
        localStorage.setItem("cachedStudentData", JSON.stringify(merged));

        if (tenantSlugRes) {
          document.cookie = `tenant-slug=${tenantSlugRes}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        }

        setLoadingText("Opening your dashboard...");
        router.push("/");
        return;
      } else {
        // Truly new student — route to onboarding
        router.push("/onboarding");
        return;
      }

    } catch (error: any) {
      console.error("Google Login error:", error);
      const errMsg = error.code === 'auth/popup-closed-by-user'
        ? "Login cancelled. Please try again."
        : (error.message || "Failed to sign in with Google");
      setError(errMsg);
      showToast(errMsg, "error");
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
      const errMsg = "Please enter the admin password";
      setError(errMsg);
      showToast(errMsg, "warning");
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
        document.cookie = "userType=admin; path=/; max-age=86400; SameSite=Lax";
        localStorage.setItem("userType", "admin");
        router.push("/");
      }
    } catch (error: any) {
      console.error("Admin login error:", error);
      const errMsg = error.message || "Invalid password. Please try again.";
      setError(errMsg);
      showToast(errMsg, "error");
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
      const errMsg = "Please select a hostel first";
      setError(errMsg);
      showToast(errMsg, "warning");
      return;
    }

    if (!wardenPassword.trim()) {
      const errMsg = "Please enter the warden authentication key";
      setError(errMsg);
      showToast(errMsg, "warning");
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
          password: wardenPassword.trim(),
          hostelId: selectedHostelId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid password");
      }

      if (data.success) {
        if (data.type === 'getpass') {
          document.cookie = "userType=getpass; path=/; max-age=86400; SameSite=Lax";
          localStorage.setItem("userType", "getpass");
          router.push("/getpass");
          return;
        }
        document.cookie = "userType=warden; path=/; max-age=86400; SameSite=Lax";
        localStorage.setItem("userType", "warden");
        localStorage.setItem("wardenHostelName", data.hostelName);
        localStorage.setItem("authorizedHostels", JSON.stringify(data.authorizedHostels));
        router.push("/");
      }
    } catch (error: any) {
      console.error("Warden login error:", error);
      const errMsg = error.message || "Invalid password. Please try again.";
      setError(errMsg);
      showToast(errMsg, "error");
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

      if (!isDeveloperSetup) {
        // Initial setup flow
        const response = await fetch("/api/developer/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: developerPassword }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        
        // After successful init, login automatically
        document.cookie = "userType=superadmin; path=/; max-age=86400; SameSite=Lax";
        localStorage.setItem("userType", "superadmin");
        router.push("/");
        return;
      }

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
        document.cookie = "userType=superadmin; path=/; max-age=86400; SameSite=Lax";
        localStorage.setItem("userType", "superadmin");
        router.push("/");
      }
    } catch (error: any) {
      console.error("Developer login error:", error);
      const errMsg = error.message || "Invalid password. Please try again.";
      setError(errMsg);
      showToast(errMsg, "error");
      setDeveloperPassword("");
    } finally {
      setDeveloperLoading(false);
    }
  };

  const handleSuperAdminRequestOtp = async () => {
    if (!superAdminResetPhone || superAdminResetPhone.length !== 10) {
      const errMsg = "Please enter a valid 10-digit mobile number";
      setError(errMsg);
      showToast(errMsg, "warning");
      return;
    }

    try {
      setSuperAdminResetLoading(true);
      setError("");

      const response = await fetch("/api/developer/reset-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: superAdminResetPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to request OTP");
      }

      setSuperAdminResetStep("otp");
    } catch (err: any) {
      console.error("Super Admin Reset OTP Request error:", err);
      const errMsg = err.message || "Something went wrong. Please try again.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setSuperAdminResetLoading(false);
    }
  };

  const handleSuperAdminVerifyOtp = async () => {
    if (!superAdminResetOtp || superAdminResetOtp.length !== 6) {
      const errMsg = "Please enter a 6-digit OTP code";
      setError(errMsg);
      showToast(errMsg, "warning");
      return;
    }

    if (!superAdminNewPassword || superAdminNewPassword.length < 6) {
      const errMsg = "Password must be at least 6 characters long";
      setError(errMsg);
      showToast(errMsg, "warning");
      return;
    }

    if (superAdminNewPassword !== superAdminConfirmPassword) {
      const errMsg = "New password and confirm password do not match";
      setError(errMsg);
      showToast(errMsg, "warning");
      return;
    }

    try {
      setSuperAdminResetLoading(true);
      setError("");

      const response = await fetch("/api/developer/reset-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: superAdminResetOtp,
          newPassword: superAdminNewPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      // Reset successful!
      showToast("Super Admin password has been reset successfully. You can now login with your new password.", "success");
      setSuperAdminResetStep("none");
      setSuperAdminResetPhone("");
      setSuperAdminResetOtp("");
      setSuperAdminNewPassword("");
      setSuperAdminConfirmPassword("");
      setDeveloperPassword(""); // Clear entered password
    } catch (err: any) {
      console.error("Super Admin Reset Verify error:", err);
      const errMsg = err.message || "Invalid OTP code. Please try again.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setSuperAdminResetLoading(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#fafafa] font-sans selection:bg-blue-100 p-2 sm:p-4 lg:p-6">
      {loading && (
        <div className="fixed inset-0 z-[9999] bg-[#050510]/80 backdrop-blur-md flex items-center justify-center p-4 text-white">
          <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/5">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest animate-pulse">
              {loadingText || "Connecting to Google..."}
            </p>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">
              {loadingText ? "Checking database for student records" : "Please select your account in the popup"}
            </p>
          </div>
        </div>
      )}
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

      <main className="relative z-10 w-full max-w-lg lg:max-w-5xl flex flex-col justify-center max-h-full py-1 sm:py-2">
        <div className={`transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} flex flex-col justify-center w-full`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center lg:items-start w-full">
            {/* Left Column: Logo, Title, and Features (Desktop only showcase) */}
            <div className="flex flex-col items-center space-y-3 sm:space-y-4 text-center lg:col-span-5 w-full lg:pt-4">
              
              {/* Logo and Title */}
              <div className="flex flex-col items-center space-y-2.5">
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
                    src={tenantLogo || "/uvw_logo.jpg"}
                    alt="University Logo"
                    className="relative rounded-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:rotate-3 shadow-2xl border-4 border-white h-14 w-14 sm:h-16 sm:w-16"
                    title="Click for Super Admin login"
                    onError={(e) => {
                      (e.target as any).src = "/uvw_logo.jpg";
                    }}
                  />
                  {!isDeveloperSetup && !showDeveloperPassword && (
                    <div className="absolute -bottom-1 -right-1 animate-bounce pointer-events-none">
                      <div className="relative">
                        <div className="absolute -inset-1 rounded-full bg-blue-400 opacity-75 blur animate-ping" />
                        <div className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg whitespace-nowrap border border-white/50">
                          CLICK ME
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1 sm:space-y-2 text-center flex flex-col items-center w-full">
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 transition-all duration-500 text-center w-full">
                    {tenantName}
                    {tenantName !== "Hosteleaze" && <span className="block text-[8px] sm:text-[10px] text-slate-400 font-bold tracking-widest mt-1 text-center w-full">POWERED BY HOSTELEAZE</span>}
                  </h1>
                  <div className="flex flex-col items-center space-y-2 sm:space-y-2.5 w-full">
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

                    <p className="max-h-20 opacity-100 max-w-[260px] sm:max-w-[280px] lg:max-w-md text-[10px] sm:text-xs font-medium text-slate-500 leading-tight sm:leading-relaxed transition-all duration-500 overflow-hidden text-center mx-auto">
                      The smart, all-in-one ecosystem for modern hostel administration and student living.
                    </p>

                    {/* Premium Statistics Chips Row (Desktop only) */}
                    <div className="hidden lg:flex items-center gap-2.5 justify-center py-1 select-none">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200/80 bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-md hover:scale-105 hover:-translate-y-0.5 hover:border-emerald-250 hover:bg-emerald-50/20 hover:shadow-md transition-all duration-300 cursor-default">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-700">10k+ Scans/Day</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200/80 bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-md hover:scale-105 hover:-translate-y-0.5 hover:border-blue-250 hover:bg-blue-50/20 hover:shadow-md transition-all duration-300 cursor-default">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-700">99.9% Uptime</span>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200/80 bg-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-md hover:scale-105 hover:-translate-y-0.5 hover:border-amber-250 hover:bg-amber-50/20 hover:shadow-md transition-all duration-300 cursor-default">
                        <span className="text-amber-500 text-[11px] leading-none">★</span>
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-700">5.0 Rating</span>
                      </div>
                    </div>

                    {tenantName === "Hosteleaze" && !showAdminPassword && !showWardenPassword && (
                      <button 
                        onClick={async () => {
                          const slug = await showPrompt("Enter your Campus Slug (e.g. oist):");
                          if (slug) window.location.href = `/login?tenant=${slug.toLowerCase()}`;
                        }}
                        className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                      >
                        ✨ Switch to your Campus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Feature Showcase (Visible only on Desktop lg: screens) */}
              <div className="hidden lg:flex flex-col gap-2.5 w-full max-w-md mt-1.5 animate-in fade-in slide-in-from-left-4 duration-1000 relative">
                
                {/* Micro Card 1 */}
                <div className="group flex items-center justify-between py-2 px-4 rounded-2xl border border-white/65 bg-white/50 shadow-[0_8px_22px_-6px_rgba(0,0,0,0.03)] backdrop-blur-md hover:bg-white/85 hover:shadow-md hover:border-blue-100 transition-all duration-500 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Wifi & Geolocation Verification</h4>
                      <p className="text-[10px] text-slate-500 font-semibold leading-none mt-0.5">Secure local network and coordinate geofencing.</p>
                    </div>
                  </div>
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100/50 select-none opacity-90">
                    REAL-TIME
                  </span>
                </div>

                {/* Micro Card 2 */}
                <div className="group flex items-center justify-between py-2 px-4 rounded-2xl border border-white/65 bg-white/50 shadow-[0_8px_22px_-6px_rgba(0,0,0,0.03)] backdrop-blur-md hover:bg-white/85 hover:shadow-md hover:border-indigo-100 transition-all duration-500 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Digital Gatepass System</h4>
                      <p className="text-[10px] text-slate-500 font-semibold leading-none mt-0.5">Online outing requests with automated QR scans.</p>
                    </div>
                  </div>
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/50 select-none opacity-90">
                    SECURE QR
                  </span>
                </div>

                {/* Micro Card 3 */}
                <div className="group flex items-center justify-between py-2 px-4 rounded-2xl border border-white/65 bg-white/50 shadow-[0_8px_22px_-6px_rgba(0,0,0,0.03)] backdrop-blur-md hover:bg-white/85 hover:shadow-md hover:border-emerald-100 transition-all duration-500 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Advanced Analytics Dashboard</h4>
                      <p className="text-[10px] text-slate-500 font-semibold leading-none mt-0.5">Live attendance insights and security reports.</p>
                    </div>
                  </div>
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100/50 select-none opacity-90">
                    ANALYTICS
                  </span>
                </div>
              </div>

              {/* Security & Trust Badges (Desktop only) */}
              <div className="hidden lg:flex items-center gap-3 justify-center w-full max-w-md pt-2 select-none opacity-85 animate-in fade-in slide-in-from-bottom-2 duration-1000 relative z-10">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🛡️</span>
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500">Role-Based Access</span>
                </div>
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500">Instant OTP SMS</span>
                </div>
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🔒</span>
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500">SSL Secured Data</span>
                </div>
              </div>

              {/* Bottom Gradient Aura for Left Column */}
              <div className="absolute bottom-[-40px] left-[-30px] w-[200px] h-[200px] rounded-full bg-gradient-to-br from-indigo-300/10 to-purple-300/10 blur-2xl pointer-events-none" />
            </div>

            {/* Right Column: Login Card & Footer */}
            <div className="flex flex-col items-center lg:col-span-7 w-full space-y-3 sm:space-y-4">
              <div className="w-full max-w-[420px] relative group">
                <div className="absolute -inset-1 rounded-[24px] bg-gradient-to-b from-gray-200/50 to-transparent opacity-50 blur-sm transition duration-500 group-hover:opacity-100" />

                <div className="relative overflow-hidden rounded-[20px] sm:rounded-[24px] border border-white bg-white/80 backdrop-blur-xl p-1 shadow-[0_16px_32px_-10px_rgba(0,0,0,0.06)] transition-all duration-500">
                  <div className="rounded-[16px] sm:rounded-[20px] bg-slate-50/40 p-3 sm:p-5">

                    {error && (
                      <div className="mb-6 flex animate-in fade-in slide-in-from-top-4 items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm text-red-600 backdrop-blur-md">
                        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {error}
                      </div>
                    )}

                    <div className="space-y-4 sm:space-y-6">
                      {showParentLogin ? (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                              👨‍👩‍👧 Parent Login Portal
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setShowParentLogin(false);
                                setError("");
                              }}
                              className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors"
                            >
                              &larr; Back to Student
                            </button>
                          </div>

                          {!otpSent ? (
                            <div className="space-y-3">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-blue-600 text-center">
                                Enter your Registered Mobile Number
                              </label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm font-semibold pointer-events-none">
                                  +91
                                </span>
                                <input
                                  type="tel"
                                  maxLength={10}
                                  value={parentPhone}
                                  onChange={(e) => {
                                    setParentPhone(e.target.value.replace(/\D/g, ""));
                                    setError("");
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSendOtp();
                                  }}
                                  className="w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 py-3 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                  placeholder="9876543210"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={parentLoading}
                                className="w-full py-3.5 sm:py-4 rounded-xl bg-blue-600 font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
                              >
                                {parentLoading ? "Sending OTP..." : "Get OTP"}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-green-600">
                                  OTP SENT TO YOUR REGISTERED MOBILE NUMBER {parentPhone.slice(0, 4)}XXXX{parentPhone.slice(8)}
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOtpSent(false);
                                    setOtp("");
                                    setError("");
                                  }}
                                  className="text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
                                >
                                  Change Phone
                                </button>
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  id="otp"
                                  name="otp"
                                  autoFocus
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  autoComplete="one-time-code"
                                  maxLength={6}
                                  value={otp}
                                  onChange={(e) => {
                                    setOtp(e.target.value.replace(/\D/g, ""));
                                    setError("");
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleVerifyOtp();
                                  }}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-16 py-3 text-center text-lg font-black tracking-[0.5em] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-200 placeholder:tracking-normal placeholder:font-medium"
                                  placeholder="······"
                                />
                                <button
                                  type="button"
                                  onClick={handlePasteClipboard}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 border border-blue-100"
                                  title="Paste code from clipboard"
                                >
                                  Paste
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={handleVerifyOtp}
                                disabled={parentLoading}
                                className="w-full py-3.5 sm:py-4 rounded-xl bg-slate-900 font-bold text-xs uppercase tracking-widest text-white shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
                              >
                                {parentLoading ? "Verifying..." : "Verify & Login"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                              className="flex w-full items-center justify-between gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-900 hover:border-blue-200 transition-all active:scale-[0.98]"
                            >
                              <span className="flex items-center gap-3">
                                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue as Student
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Role select</span>
                                <svg className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isRoleDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {isRoleDropdownOpen && (
                              <div className="absolute right-0 left-0 mt-2 z-50 rounded-xl border border-slate-150 bg-white/95 backdrop-blur-md p-1.5 shadow-[0_12px_24px_-8px_rgba(0,0,0,0.15)] transition-all">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsRoleDropdownOpen(false);
                                    handleGoogleLogin();
                                  }}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors text-left"
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                  </svg>
                                  Continue as Student
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsRoleDropdownOpen(false);
                                    setShowParentLogin(true);
                                    setOtpSent(false);
                                    setOtp("");
                                    setParentPhone("");
                                  }}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors text-left border-t border-slate-50"
                                >
                                  <span className="text-base">👨‍👩‍👧</span>
                                  Continue as Parent
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="py-1.5 relative flex items-center transition-all">
                        <div className="grow border-t border-slate-100"></div>
                        <span className="mx-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Staff Portal</span>
                        <div className="grow border-t border-slate-100"></div>
                      </div>

                      {/* Staff Selection */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={handleAdminLogin}
                          className={`group flex flex-col items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl border-2 p-2 sm:p-3.5 transition-all duration-500 active:scale-95 ${showAdminPassword
                            ? "border-blue-500 bg-blue-50/50 shadow-inner"
                            : "border-transparent bg-white hover:bg-slate-50 hover:border-slate-100 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                            }`}
                        >
                          <div className={`flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all duration-500 ${showAdminPassword ? "bg-blue-600 text-white rotate-6 shadow-blue-200 shadow-xl" : "bg-blue-50 text-blue-600 group-hover:scale-110 group-hover:-rotate-3"
                            }`}>
                            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="text-center">
                            <span className={`block text-xs sm:text-sm font-bold tracking-tight transition-colors ${showAdminPassword ? "text-blue-900" : "text-slate-800"}`}>
                              Dean
                            </span>
                            <span className="text-[9px] font-medium text-slate-400">Institutional Access</span>
                          </div>
                        </button>

                        <button
                          onClick={handleWardenLogin}
                          className={`group flex flex-col items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl border-2 p-2 sm:p-3.5 transition-all duration-500 active:scale-95 ${showWardenPassword
                            ? "border-indigo-500 bg-indigo-50/50 shadow-inner"
                            : "border-transparent bg-white hover:bg-slate-50 hover:border-slate-100 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                            }`}
                        >
                          <div className={`flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-all duration-500 ${showWardenPassword ? "bg-indigo-600 text-white -rotate-6 shadow-indigo-200 shadow-xl" : "bg-indigo-50 text-indigo-600 group-hover:scale-110 group-hover:rotate-3"
                            }`}>
                            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="text-center">
                            <span className={`block text-xs sm:text-sm font-bold tracking-tight transition-colors ${showWardenPassword ? "text-indigo-900" : "text-slate-800"}`}>
                              Campus
                            </span>
                            <span className="text-[9px] font-medium text-slate-400">Campus Management</span>
                          </div>
                        </button>
                      </div>

                      {/* Password Verification Section */}
                      {(showAdminPassword || showWardenPassword || showDeveloperPassword) && (
                        <div className="mt-3 sm:mt-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                          <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.06)]">
                            {showDeveloperPassword && superAdminResetStep !== "none" ? (
                              <div className="space-y-4 animate-in fade-in duration-300">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest text-center">
                                  🔑 Super Admin Password Recovery
                                </h3>

                                {superAdminResetStep === "phone" ? (
                                  <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-blue-600 text-center">
                                      Enter Registered Mobile Number
                                    </label>
                                    <div className="relative">
                                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm font-semibold pointer-events-none">
                                        +91
                                      </span>
                                      <input
                                        type="tel"
                                        maxLength={10}
                                        value={superAdminResetPhone}
                                        onChange={(e) => {
                                          setSuperAdminResetPhone(e.target.value.replace(/\D/g, ""));
                                          setError("");
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleSuperAdminRequestOtp();
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 py-3 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="9876543210"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSuperAdminResetStep("none");
                                          setError("");
                                        }}
                                        className="w-1/3 py-3 rounded-xl border border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSuperAdminRequestOtp}
                                        disabled={superAdminResetLoading}
                                        className="w-2/3 py-3 rounded-xl bg-blue-600 font-bold text-xs uppercase tracking-widest text-white shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
                                      >
                                        {superAdminResetLoading ? "Sending..." : "Get OTP"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-green-600 text-center">
                                        Enter 6-Digit OTP
                                      </label>
                                      <input
                                        type="text"
                                        maxLength={6}
                                        value={superAdminResetOtp}
                                        onChange={(e) => {
                                          setSuperAdminResetOtp(e.target.value.replace(/\D/g, ""));
                                          setError("");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-lg font-black tracking-[0.5em] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-200 placeholder:tracking-normal placeholder:font-medium"
                                        placeholder="······"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        New Master Password
                                      </label>
                                      <input
                                        type="password"
                                        value={superAdminNewPassword}
                                        onChange={(e) => {
                                          setSuperAdminNewPassword(e.target.value);
                                          setError("");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="At least 6 characters"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Confirm New Password
                                      </label>
                                      <input
                                        type="password"
                                        value={superAdminConfirmPassword}
                                        onChange={(e) => {
                                          setSuperAdminConfirmPassword(e.target.value);
                                          setError("");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="Repeat new password"
                                      />
                                    </div>

                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSuperAdminResetStep("none");
                                          setError("");
                                        }}
                                        className="w-1/3 py-3.5 rounded-xl border border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSuperAdminVerifyOtp}
                                        disabled={superAdminResetLoading}
                                        className="w-2/3 py-3.5 rounded-xl bg-slate-900 font-bold text-xs uppercase tracking-widest text-white shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
                                      >
                                        {superAdminResetLoading ? "Verifying..." : "Reset & Save"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                {!isDeveloperSetup && showDeveloperPassword && (
                                  <p className="mb-4 text-[10px] text-blue-600 font-bold bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center gap-2">
                                    <span className="text-sm">🔑</span>
                                    Please create a secure developer password for your university.
                                  </p>
                                )}

                                {showWardenPassword ? (
                                  <div className="grid grid-cols-2 gap-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Left Column: Select Campus Role */}
                                    <div className="flex flex-col">
                                      <div className="flex items-center justify-between mb-2 sm:mb-3 min-h-[14px]">
                                        <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                                          Campus Role
                                        </label>
                                      </div>
                                      <select
                                        value={selectedHostelId}
                                        onChange={(e) => {
                                          setSelectedHostelId(e.target.value);
                                          setError("");
                                        }}
                                        className="w-full rounded-xl border border-slate-100 bg-slate-50 pl-3 pr-8 py-2.5 sm:py-3.5 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold"
                                      >
                                        <option value="" disabled>Select role</option>
                                        <option value="getpass" className="font-bold text-blue-600">🎟️ GATEPASS MONITOR</option>
                                        {hostels.map(hostel => (
                                          <option key={hostel._id} value={hostel._id}>
                                            {hostel.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Right Column: Enter Password */}
                                    <div className="flex flex-col">
                                      <div className="flex items-center justify-between mb-2 sm:mb-3 min-h-[14px]">
                                        <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                                          Enter Password
                                        </label>
                                      </div>
                                      <div className="relative group">
                                        <input
                                          type="password"
                                          autoFocus
                                          value={wardenPassword}
                                          onChange={(e) => {
                                            setWardenPassword(e.target.value);
                                            setError("");
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              handleWardenLogin();
                                            }
                                          }}
                                          className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 sm:py-3.5 text-center text-xs sm:text-sm font-black tracking-[0.2em] text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300 placeholder:font-medium placeholder:tracking-normal"
                                          placeholder="••••••••••••"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mb-4 animate-in fade-in duration-300">
                                    <label className="mb-2 sm:mb-3 block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                                      {showAdminPassword ? "Dean Authentication Key" : 
                                       !isDeveloperSetup ? "CREATE YOUR PASSWORD" : "Super Admin Authentication"}
                                    </label>
                                    <div className="relative group">
                                      <input
                                        type="password"
                                        autoFocus
                                        value={showAdminPassword ? adminPassword : developerPassword}
                                        onChange={(e) => {
                                          if (showAdminPassword) setAdminPassword(e.target.value);
                                          else setDeveloperPassword(e.target.value);
                                          setError("");
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            if (showAdminPassword) handleAdminLogin();
                                            else handleDeveloperLogin();
                                          }
                                        }}
                                        className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 sm:py-3 text-center text-sm sm:text-base font-black tracking-[0.4em] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300 placeholder:font-medium placeholder:tracking-normal"
                                        placeholder={showAdminPassword ? "············" : !isDeveloperSetup ? "Create password" : "Enter Super Admin key"}
                                      />
                                    </div>
                                  </div>
                                )}
                                <div className="flex justify-between items-center mt-2 px-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (showAdminPassword) setShowAdminPassword(false);
                                      if (showWardenPassword) setShowWardenPassword(false);
                                      if (showDeveloperPassword) setShowDeveloperPassword(false);
                                      setError("");
                                    }}
                                    className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  {showDeveloperPassword && isDeveloperSetup && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSuperAdminResetStep("phone");
                                        setSuperAdminResetPhone("");
                                        setError("");
                                      }}
                                      className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 hover:underline transition-colors"
                                    >
                                      Forgot Password?
                                    </button>
                                  )}
                                </div>
                                <div className="mt-4 flex gap-3">
                                  <button
                                    onClick={showAdminPassword ? handleAdminLogin : showWardenPassword ? handleWardenLogin : handleDeveloperLogin}
                                    disabled={adminLoading || wardenLoading || developerLoading}
                                    className={`w-full py-2.5 sm:py-3.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${showAdminPassword ? 'bg-blue-600 shadow-blue-200' : showWardenPassword ? 'bg-indigo-600 shadow-indigo-200' : 'bg-slate-900 shadow-slate-200'}`}
                                  >
                                    {adminLoading || wardenLoading || developerLoading ? "Processing..." : 
                                     showAdminPassword || showWardenPassword ? "Confirm Identity" : 
                                     !isDeveloperSetup ? "REGISTER PASSWORD" : "Unlock Portal"}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Premium Refined Footer */}
              <footer className="w-full max-w-sm mt-1 sm:mt-2 pb-1 sm:pb-2">
                <div className="flex flex-col items-center space-y-1.5 sm:space-y-2 text-center">
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="flex flex-col items-center gap-0.5">
                      <p className="text-[7px] sm:text-[9px] font-bold tracking-[0.1em] text-slate-400 uppercase">
                        &copy; 2026 HOSTELEAZE. All Rights Reserved.
                      </p>
                      <p className="text-[6px] sm:text-[8px] font-medium text-slate-300 uppercase tracking-wider">
                        Unauthorized copying, modification, or distribution is strictly prohibited
                      </p>
                    </div>

                    <div className="group cursor-default">
                      <p className="text-[7px] sm:text-[9px] font-medium text-slate-400 tracking-wider" style={{ fontFamily: 'var(--font-lora), Cambria' }}>
                        Developed meticulously by
                      </p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5 transition-colors group-hover:text-blue-600" style={{ fontFamily: 'var(--font-lora), Cambria' }}>
                        Dr. Pankaj Dwivedi
                      </p>
                    </div>
                  </div>

                  <nav className="flex items-center gap-3 sm:gap-4 text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">
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

