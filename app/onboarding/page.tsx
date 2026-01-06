"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function OnboardingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    hostelName: "",
    roomNumber: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    }

    if (!formData.hostelName.trim()) {
      newErrors.hostelName = "Hostel name is required";
    }

    if (!formData.roomNumber.trim()) {
      newErrors.roomNumber = "Room number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !user) return;

    try {
      setLoading(true);
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firebaseUID: user.uid,
          name: formData.name,
          email: user.email || "",
          phoneNumber: formData.phoneNumber,
          hostelName: formData.hostelName,
          roomNumber: formData.roomNumber,
          profilePicture: user.photoURL || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save data");
      }

      localStorage.setItem("userType", "student");
      router.push("/");
    } catch (error: any) {
      console.error("Error saving student data:", error);
      setErrors({ submit: error.message || "Failed to save data. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-base font-semibold text-foreground">Welcome to Hostelease</h1>
            <p className="mt-2 text-sm text-secondary">Please fill in your details to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter your full name"
                className={`w-full h-12 px-4 rounded-lg border border-solid ${
                  errors.name ? "border-red-500" : "border-[#9CA3AF]"
                } bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleChange("phoneNumber", e.target.value)}
                placeholder="Enter your phone number"
                className={`w-full h-12 px-4 rounded-lg border border-solid ${
                  errors.phoneNumber ? "border-red-500" : "border-[#9CA3AF]"
                } bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground`}
              />
              {errors.phoneNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="hostelName" className="block text-sm font-medium text-foreground mb-2">
                Hostel Name
              </label>
              <input
                type="text"
                id="hostelName"
                value={formData.hostelName}
                onChange={(e) => handleChange("hostelName", e.target.value)}
                placeholder="e.g., Boys Hostel A, Girls Hostel B"
                className={`w-full h-12 px-4 rounded-lg border border-solid ${
                  errors.hostelName ? "border-red-500" : "border-[#9CA3AF]"
                } bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground`}
              />
              {errors.hostelName && (
                <p className="mt-1 text-sm text-red-600">{errors.hostelName}</p>
              )}
            </div>

            <div>
              <label htmlFor="roomNumber" className="block text-sm font-medium text-foreground mb-2">
                Room Number
              </label>
              <input
                type="text"
                id="roomNumber"
                value={formData.roomNumber}
                onChange={(e) => handleChange("roomNumber", e.target.value)}
                placeholder="Enter your room number"
                className={`w-full h-12 px-4 rounded-lg border border-solid ${
                  errors.roomNumber ? "border-red-500" : "border-[#9CA3AF]"
                } bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground`}
              />
              {errors.roomNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.roomNumber}</p>
              )}
            </div>

            {errors.submit && (
              <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">
                {errors.submit}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-foreground text-background font-medium transition-colors hover:bg-[#383838] mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Complete Onboarding"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

