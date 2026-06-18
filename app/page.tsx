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
    const checkAuth = async () => {
      if (typeof window === "undefined") return;

      const hostname = window.location.hostname;
      const urlParams = new URLSearchParams(window.location.search);
      const tenantParam = urlParams.get('tenant');
      const cookies = typeof document !== 'undefined' ? document.cookie : '';
      const tenantCookie = cookies.split('; ').find(row => row.startsWith('tenant-slug='))?.split('=')[1];
      const activeTenant = tenantParam || tenantCookie;

      const mainDomains = [
        'hosteleaze.com',
        'www.hosteleaze.com',
        'localhost',
        'hosteleaze.vercel.app',
        'hosteleaze-silk.vercel.app',
        'hostelease-silk.vercel.app'
      ];
      const parts = hostname.split('.');
      const isRoot = (parts.length === 1 || (parts.length === 2 && (parts[0] === 'www' || parts[1] === 'localhost'))) && !activeTenant;
      const isMainBase = mainDomains.includes(hostname) && !activeTenant;

      // ⚡ FAST PATH FOR ADMINS/STAFF: Skip Supabase network call completely
      const storedUserType = localStorage.getItem("userType");
      if (storedUserType === "admin") { setUserType("admin"); setLoading(false); return; }
      if (storedUserType === "warden") { setUserType("warden"); setLoading(false); return; }
      if (storedUserType === "superadmin") { setUserType("superadmin"); setLoading(false); return; }
      if (storedUserType === "getpass") { router.push("/getpass"); setLoading(false); return; }

      // ⚡ FAST PATH FOR STUDENTS: Instant load from cache
      if (storedUserType === "student") {
        const cachedStudent = localStorage.getItem("cachedStudentData");
        if (cachedStudent) {
          try {
            setStudentData(JSON.parse(cachedStudent));
            setUserType("student");
            setLoading(false);
            // We intentionally DO NOT return here! We let the rest of the function run in the background
            // to silently verify the session with the server. If it fails, it will redirect them out.
          } catch (e) {
            console.error("Cache parsing error", e);
          }
        }
      }

      // 1. ⚡ REGARDLESS of domain, Check Supabase Session First
      const { data: { session: sbSession } } = await supabase.auth.getSession();
      
      if (sbSession && sbSession.user.email) {
        try {
          const response = await fetch(`/api/students?email=${encodeURIComponent(sbSession.user.email)}&minimal=true`);
          if (response.status === 404) {
             // Not found locally or globally - might be a new user or admin
             router.push("/onboarding");
             setLoading(false);
             return;
          } else if (response.ok) {
            const data = await response.json();
            if (data.student) {
              // ⚡ REDIRECT if tenant mismatch (found globally but on wrong slug domain)
              if (data.tenantSlug && activeTenant !== data.tenantSlug) {
                console.log(`[Switching Tenant] Detected ${data.tenantSlug} for user ${sbSession.user.email}`);
                document.cookie = `tenant-slug=${data.tenantSlug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
                window.location.href = `/?tenant=${data.tenantSlug}`;
                return;
              }
              if (data.tenantSubscription) {
                data.student.tenantSubscription = data.tenantSubscription;
              }
              // ⚡ Cache student data for instant load next time
              localStorage.setItem("cachedStudentData", JSON.stringify(data.student));
              setStudentData(data.student);
              setUserType("student");
              localStorage.setItem("userType", "student");
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error("Supabase user fetch failed", e);
        }
      }

      // 2. ⚡ If No Session, AND on Main Domain -> Show Landing Page
      if (isMainBase || isRoot) {
        setIsMainDomain(true);
        setLoading(false);
        return;
      }

      // 3. ⚡ Fallback to checking other roles in localStorage (Admins/Wardens)

      if (storedUserType === "student") {
        // Handle Firebase Fallback for existing users
        const { onAuthStateChanged } = await import("firebase/auth");
        const { auth } = await import("@/lib/firebase");
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
                  // Redirect if found on wrong tenant
                  if (data.tenantSlug && activeTenant !== data.tenantSlug) {
                    document.cookie = `tenant-slug=${data.tenantSlug}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
                    window.location.href = `/?tenant=${data.tenantSlug}`;
                    return;
                  }
                  if (data.tenantSubscription) {
                    data.student.tenantSubscription = data.tenantSubscription;
                  }
                  localStorage.setItem("cachedStudentData", JSON.stringify(data.student));
                  setStudentData(data.student);
                  setUserType("student");
                  setLoading(false);
                } else {
                  router.push("/onboarding");
                }
              }
            } catch (error) {
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

      if (storedUserType === "parent") {
        const storedParentPhone = localStorage.getItem("parentPhone");
        if (storedParentPhone) {
          try {
            const response = await fetch(`/api/students?parentPhone=${encodeURIComponent(storedParentPhone)}&minimal=true${activeTenant ? `&tenant=${activeTenant}` : ''}`);
            if (response.ok) {
              const data = await response.json();
              if (data.student) {
                if (data.tenantSubscription) {
                  data.student.tenantSubscription = data.tenantSubscription;
                }
                setStudentData(data.student);
                setUserType("parent");
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.error("Parent student fetch failed", e);
          }
        }
        router.push("/login");
        setLoading(false);
        return;
      }


      // Final Fallback
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
      ) : userType === "parent" ? (
        <StudentDashboard initialData={studentData} isParentView={true} />
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
