"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import StudentDashboard from "./components/StudentDashboard";
import AdminDashboard from "./components/AdminDashboard";
import LandingPage from "./components/LandingPage";

export default function Dashboard() {
  const [userType, setUserType] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMainDomain, setIsMainDomain] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if we are on the main domain (landing page)
    const hostname = window.location.hostname;
    const mainDomains = ['hostelease.com', 'localhost', 'hostelease.vercel.app'];
    const parts = hostname.split('.');

    // If it's just 'localhost' or 'hostelease.com' with no subdomain (or just 'www')
    const isRoot = parts.length === 1 || (parts.length === 2 && parts[0] === 'www');

    if (isRoot) {
      setIsMainDomain(true);
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      if (typeof window === "undefined") return;

      // ⚡ CHANGED: Use localStorage instead of sessionStorage to stay logged in "always"
      const storedUserType = localStorage.getItem("userType");

      if (storedUserType === "admin") {
        setUserType("admin");
        setLoading(false);
        return;
      }

      if (storedUserType === "warden") {
        setUserType("warden");
        setLoading(false);
        return;
      }

      if (storedUserType === "developer") {
        setUserType("developer");
        setLoading(false);
        return;
      }

      if (storedUserType === "getpass") {
        router.push("/getpass");
        setLoading(false);
        return;
      }

      if (storedUserType === "student") {
        // ⚡ NEW: Try Supabase Auth First
        const fetchSupabaseSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user.email) {
            try {
              const response = await fetch(`/api/students?email=${encodeURIComponent(session.user.email)}&minimal=true`);
              if (response.status === 404) {
                router.push("/onboarding");
                setLoading(false);
                return true;
              }
              if (response.ok) {
                const data = await response.json();
                if (data.student) {
                  setStudentData(data.student);
                  setUserType("student");
                  setLoading(false);
                  return true;
                }
              }
            } catch (e) {
              console.error("Supabase user fetch failed", e);
            }
          }
          return false;
        };

        fetchSupabaseSession().then(success => {
          if (success) return;

          // ⚡ FALLBACK: Check Firebase for backward compatibility
          const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
              try {
                const response = await fetch(`/api/students?email=${encodeURIComponent(user.email || "")}&minimal=true`);
                if (response.status === 404) {
                  router.push("/onboarding");
                  setLoading(false);
                  return;
                }

                if (response.ok) {
                  const data = await response.json();
                  if (data.student) {
                    setStudentData(data.student);
                    setUserType("student");
                    setLoading(false);
                  } else {
                    router.push("/onboarding");
                  }
                }
              } catch (error) {
                console.error("Error fetching student data from Firebase session:", error);
                router.push("/login");
                setLoading(false);
              }
            } else {
              // No session found in either system
              router.push("/login");
              setLoading(false);
            }
          });

          return () => unsubscribe();
        });
      } else {
        router.push("/login");
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isMainDomain) {
    return <LandingPage />;
  }

  if (!userType) {
    return null;
  }

  return (
    <>
      {userType === "student" ? (
        <StudentDashboard initialData={studentData} />
      ) : userType === "warden" ? (
        <AdminDashboard title="Campus Dashboard" />
      ) : userType === "developer" ? (
        <AdminDashboard title="Developer Dashboard" showRemoveButton={true} />
      ) : (
        <AdminDashboard title="Dean Dashboard" />
      )}
    </>
  );
}
