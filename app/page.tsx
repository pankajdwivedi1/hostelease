"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import StudentDashboard from "./components/StudentDashboard";
import AdminDashboard from "./components/AdminDashboard";

export default function Dashboard() {
  const [userType, setUserType] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            try {
              // ⚡ NEW: Check by EMAIL as requested (to identify existing records)
              const response = await fetch(`/api/students?email=${encodeURIComponent(user.email || "")}&minimal=true`);

              // ⚡ FIX: Handle 404 (Not Found) as a valid state for new users -> Redirect to Onboarding
              if (response.status === 404) {
                router.push("/onboarding");
                setLoading(false);
                return;
              }

              if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
              }

              const contentType = response.headers.get("content-type");
              if (!contentType?.includes("application/json")) {
                throw new Error("API returned non-JSON response");
              }

              const data = await response.json();

              if (data.student) {
                setStudentData(data.student);
                setUserType("student");
                setLoading(false); // ⚡ Set loading false immediately, StudentDashboard will load its own data
              } else {
                router.push("/onboarding");
              }
            } catch (error) {
              console.error("Error fetching student data:", error);
              router.push("/login");
              setLoading(false);
            }
          } else {
            router.push("/login");
            setLoading(false);
          }
        });

        return () => unsubscribe();
      } else {
        router.push("/login");
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-secondary">Loading...</p>
      </div>
    );
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
