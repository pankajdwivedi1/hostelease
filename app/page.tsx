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
    const urlParams = new URLSearchParams(window.location.search);
    const tenantParam = urlParams.get('tenant');
    
    // Check for cookie on client side
    const cookies = typeof document !== 'undefined' ? document.cookie : '';
    const tenantCookie = cookies.split('; ').find(row => row.startsWith('tenant-slug='))?.split('=')[1];
    
    const activeTenant = tenantParam || tenantCookie;

    const mainDomains = ['hostelease.com', 'localhost', 'hostelease.vercel.app', 'hostelease-silk.vercel.app'];
    const parts = hostname.split('.');

    // If it's the root domain AND no tenant (param or cookie) is provided
    const isRoot = (parts.length === 1 || (parts.length === 2 && (parts[0] === 'www' || parts[1] === 'localhost'))) && !activeTenant;
    
    // Explicitly check if we are on one of the main domains without a subdomain OR tenant cookie
    const isMainBase = mainDomains.includes(hostname) && !activeTenant;

    if (isMainBase || isRoot) {
      setIsMainDomain(true);
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      if (typeof window === "undefined") return;

      // 1. ⚡ REGARDLESS of localStorage, Check Supabase Session First
      // If a Supabase session exists, this user IS a student
      const { data: { session: sbSession } } = await supabase.auth.getSession();
      
      if (sbSession && sbSession.user.email) {
        try {
          const response = await fetch(`/api/students?email=${encodeURIComponent(sbSession.user.email)}&minimal=true`);
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
              localStorage.setItem("userType", "student"); // Keep in sync
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error("Supabase user fetch failed", e);
        }
      }

      // 2. ⚡ Check Staff Roles in localStorage
      const storedUserType = localStorage.getItem("userType");

      if (storedUserType === "student") {
        // Handle Firebase Fallback for existing users during migration
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
            router.push("/login");
            setLoading(false);
          }
        });
        return () => unsubscribe();
      }

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

      if (storedUserType === "superadmin") {
        setUserType("superadmin");
        setLoading(false);
        return;
      }

      if (storedUserType === "getpass") {
        router.push("/getpass");
        setLoading(false);
        return;
      }

      // 3. Fallback to login
      router.push("/login");
      setLoading(false);
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
      ) : userType === "superadmin" ? (
        <AdminDashboard title="Super Admin Dashboard" showRemoveButton={true} />
      ) : (
        <AdminDashboard title="Dean Dashboard" />
      )}
    </>
  );
}
