"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";

const StudentDashboard = dynamic(() => import("./components/StudentDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  )
});

const AdminDashboard = dynamic(() => import("./components/AdminDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  )
});

const LandingPage = dynamic(() => import("./components/LandingPage"), {
  ssr: false
});

export default function Dashboard() {
  const [userType, setUserType] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMainDomain, setIsMainDomain] = useState(false);
  const router = useRouter();
  const [siblingStudents, setSiblingStudents] = useState<any[]>([]);

  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSelectStudent = (student: any) => {
    localStorage.setItem("parentSelectedStudentId", student._id);
    setStudentData(student);
    setUserType("parent");
  };

  const handleParentLogout = () => {
    localStorage.removeItem("userType");
    localStorage.removeItem("parentPhone");
    localStorage.removeItem("parentSelectedStudentId");
    router.push("/login");
  };

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
          const response = await fetch(`/api/students?email=${encodeURIComponent(sbSession.user.email)}&supabaseId=${sbSession.user.id}&minimal=true`);
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
            const selectedStudentId = localStorage.getItem("parentSelectedStudentId");
            const response = await fetch(`/api/students?parentPhone=${encodeURIComponent(storedParentPhone)}&minimal=true${selectedStudentId ? `&selectedStudentId=${selectedStudentId}` : ''}${activeTenant ? `&tenant=${activeTenant}` : ''}`);
            if (response.ok) {
              const data = await response.json();
              if (data.students && data.students.length > 1) {
                setSiblingStudents(data.students);
                const hasSelected = selectedStudentId && data.students.some((s: any) => s._id === selectedStudentId);
                if (hasSelected && data.student) {
                  const studentWithSubscription = { ...data.student, tenantSubscription: data.tenantSubscription };
                  setStudentData(studentWithSubscription);
                  setUserType("parent");
                  setLoading(false);
                  return;
                } else {
                  setUserType("parent-select");
                  setLoading(false);
                  return;
                }
              } else if (data.student) {
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
        <StudentDashboard initialData={studentData} isParentView={true} hasMultipleSiblings={siblingStudents.length > 1} />
      ) : userType === "parent-select" ? (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col justify-center items-center p-4">
          {/* Dynamic Background Elements */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-[120px]" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '32px 32px' }}
            />
          </div>

          <div className="relative z-10 w-full max-w-2xl bg-white/80 backdrop-blur-md rounded-3xl border border-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-6 md:p-10 text-center">
            {/* Header Icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <span className="text-3xl animate-bounce">👨‍👩‍👧‍👦</span>
            </div>

            {/* Titles */}
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              Select Student Profile
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-bold mt-2 max-w-md mx-auto leading-relaxed">
              Multiple students are registered under your mobile number. Please choose a profile to monitor their campus activities.
            </p>

            {/* Sibling Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
              {siblingStudents.map((student: any) => {
                return (
                  <button
                    key={student._id}
                    onClick={() => handleSelectStudent(student)}
                    className="group relative flex flex-col text-left p-5 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-blue-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-indigo-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />
                    
                    <div className="relative z-10 flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md group-hover:scale-110 transition-transform duration-300 shrink-0">
                        {getInitials(student.name)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-base group-hover:text-blue-600 transition-colors truncate">
                          {student.name}
                        </h3>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                          {student.branch || "Student"} • Sem {student.semester || "N/A"}
                        </p>
                        
                        <div className="mt-3.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <span className="text-slate-400">🏢</span>
                            <span className="truncate">{student.hostelName || "Assigned Hostel"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <span className="text-slate-400">🔑</span>
                            <span>Room {student.roomNumber || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Logout Option */}
            <button
              onClick={handleParentLogout}
              className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors flex items-center gap-1.5 mx-auto border-t border-slate-100 pt-6 w-full justify-center"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Log out of Parent Portal
            </button>
          </div>
        </div>
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
