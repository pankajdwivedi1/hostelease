"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import StudentDashboard from "./components/StudentDashboard";
import AdminDashboard from "./components/AdminDashboard";

export default function Dashboard() {
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window === "undefined") return;

      const storedUserType = localStorage.getItem("userType");

      if (storedUserType === "admin") {
        setUserType("admin");
        setLoading(false);
        return;
      }

      if (storedUserType === "student") {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const response = await fetch(`/api/students?firebaseUID=${user.uid}`);
            const data = await response.json();
            
            if (data.student) {
              setUserType("student");
            } else {
              router.push("/onboarding");
            }
          } else {
            router.push("/login");
          }
          setLoading(false);
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
        <StudentDashboard />
      ) : (
        <AdminDashboard />
      )}
    </>
  );
}
