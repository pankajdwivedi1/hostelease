"use client";

import { useState } from "react";
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <main className="w-full max-w-md px-6">
        <div className="flex flex-col items-center space-y-6">
          <img
            src="/logo.jpeg"
            alt="Hostelease Logo"
            className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover"
          />
          <h1 className="text-base font-semibold text-foreground">Hostelease</h1>
          
          <div className="w-full space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">
                {error}
              </div>
            )}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-12 rounded-lg bg-foreground text-background font-medium transition-colors hover:bg-[#383838] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? "Signing in..." : "Login with Google"}
            </button>

            {showAdminPassword ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor="adminPassword" className="block text-sm font-medium text-foreground mb-2">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    id="adminPassword"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAdminLogin();
                      }
                    }}
                    placeholder="Enter admin password"
                    className="w-full h-12 px-4 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAdminPassword(false);
                      setAdminPassword("");
                      setError("");
                    }}
                    className="flex-1 h-12 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground font-medium transition-colors hover:bg-filler"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdminLogin}
                    disabled={adminLoading}
                    className="flex-1 h-12 rounded-lg bg-foreground text-background font-medium transition-colors hover:bg-[#383838] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adminLoading ? "Verifying..." : "Login"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleAdminLogin}
                className="w-full h-12 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground font-medium transition-colors hover:bg-filler"
              >
                Login as Admin
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

