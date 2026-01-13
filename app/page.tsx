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

      // ⚡ CHANGED: Use sessionStorage instead of localStorage to allow independent tabs
      const storedUserType = sessionStorage.getItem("userType");

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

      if (storedUserType === "student") {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            // ⚡ OPTIMIZED: Use minimal=true to only check if student exists (fastest)
            const response = await fetch(`/api/students?firebaseUID=${user.uid}&minimal=true`);
            const data = await response.json();

            if (data.student) {
              setStudentData(data.student);
              setUserType("student");
              setLoading(false); // ⚡ Set loading false immediately, StudentDashboard will load its own data
            } else {
              router.push("/onboarding");
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
        <AdminDashboard title="Warden Dashboard" />
      ) : userType === "developer" ? (
        <AdminDashboard title="Developer Dashboard" showRemoveButton={true} />
      ) : (
        <AdminDashboard title="Dean Dashboard" />
      )}
    </>
  );
}
