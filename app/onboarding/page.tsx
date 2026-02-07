"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { useRef } from "react";

export default function OnboardingPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string }>>([]);
  const [hostelsLoading, setHostelsLoading] = useState(true);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});
  const [formBuilderConfig, setFormBuilderConfig] = useState<any[]>([]);

  // Fetch hostels from API
  useEffect(() => {
    const fetchHostels = async () => {
      try {
        setHostelsLoading(true);
        const response = await fetch("/api/hostels");
        const data = await response.json();
        if (response.ok && data.hostels) {
          setHostels(data.hostels);
        } else {
          console.error("Failed to fetch hostels:", data.error);
        }
      } catch (error) {
        console.error("Error fetching hostels:", error);
      } finally {
        setHostelsLoading(false);
      }
    };

    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/admin/settings");
        const data = await response.json();
        if (data.success) {
          setFormConfig(data.registrationFieldsConfig || {});
          setFormBuilderConfig(data.formBuilderConfig || []);
        }
      } catch (error) {
        console.error("Error fetching form config:", error);
      }
    };

    fetchHostels();
    fetchConfig();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const response = await fetch(`/api/students?firebaseUID=${currentUser.uid}`);
          const data = await response.json();
          if (data.student) {
            setFormData({
              ...data.student,
              ...(data.student.dynamicFields || {}),
              dob: data.student.dob ? new Date(data.student.dob).toISOString().split("T")[0] : "",
              joiningDate: data.student.joiningDate ? new Date(data.student.joiningDate).toISOString().split("T")[0] : "",
            });
            if (data.student.profilePicture) {
              setCapturedImage(data.student.profilePicture);
            }
            if (data.student.isProfileLocked) {
              setIsProfileLocked(true);
            }
          }
        } catch (error) {
          console.error("Error fetching existing student data:", error);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    formBuilderConfig.forEach(field => {
      if (field.visible && field.required) {
        if (field.type === 'image') {
          if (!capturedImage) {
            newErrors[field.id] = `${field.label} is required`;
          }
        } else {
          const value = (formData as any)[field.id];
          if (!value || (typeof value === "string" && value.trim() === "")) {
            newErrors[field.id] = `${field.label} is required`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBack = async () => {
    try {
      await signOut(auth);
      sessionStorage.clear();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      router.push("/login");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProfileLocked || !validateForm() || !user) return;

    try {
      setLoading(true);
      // Device Registration Logic
      const getStoredDeviceId = () => {
        try {
          const stored = localStorage.getItem("device_id_token");
          if (!stored) return null;
          return atob(stored);
        } catch (e) {
          return null;
        }
      };

      const storeDeviceId = (id: string) => {
        localStorage.setItem("device_id_token", btoa(id));
      };

      let currentDeviceId = getStoredDeviceId();
      let deviceJustRegistered = false;

      if (!currentDeviceId) {
        const generateUUID = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        currentDeviceId = generateUUID();
        storeDeviceId(currentDeviceId);
        deviceJustRegistered = true;
      }

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
          erpInformation: formData.erpInformation,
          hostelName: formData.hostelName,
          joiningDate: formData.joiningDate,
          roomNumber: formData.roomNumber,
          profilePicture: capturedImage || user.photoURL || "",
          fatherName: formData.fatherName,
          fatherNumber: formData.fatherNumber,
          motherName: formData.motherName,
          motherNumber: formData.motherNumber,
          homePinCode: formData.homePinCode,
          homeState: formData.homeState,
          branch: formData.branch,
          collegeName: formData.collegeName,
          year: formData.year,
          semester: formData.semester,
          section: formData.section,
          localGuardianAddress: formData.localGuardianAddress,
          localGuardianPhoneNumber: formData.localGuardianPhoneNumber,
          dob: formData.dob,
          category: formData.category,
          deviceId: currentDeviceId, // Include deviceId in the payload
          dynamicFields: formData, // Save all form data into dynamicFields for flexibility
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save data");
      }

      if (deviceJustRegistered) {
        alert("Device registered successfully! You can now use all features.");
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



  const startCamera = async () => {
    try {
      // Check for secure context (Browsers block camera on HTTP except for localhost)
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        alert("Camera access is blocked by your browser because this connection is not secure (HTTP). \n\nTo fix this: \n1. Access the site via 'localhost' or '127.0.0.1'.\n2. Use a secure HTTPS connection.\n3. Browsers block camera on IP addresses (like your 192.168.x.x) unless they use HTTPS.");
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        alert("Camera API is not available in this browser. Please use a modern browser like Chrome, Firefox, or Safari on a secure connection.");
        return;
      }

      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please allow camera permissions and ensure you're using HTTPS.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Initial quality
        let quality = 0.9;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Compress to under 100KB
        while (dataUrl.length > 137000 && quality > 0.1) { // ~100KB base64 length check
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    // Automatically convert to uppercase except for email and joiningDate
    // Also handle select fields carefully
    let formattedValue = value;
    if (field !== "email" && field !== "joiningDate") {
      formattedValue = value.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <div className="space-y-6">
          <div className="relative flex flex-col items-center">
            <button
              onClick={handleBack}
              className="absolute left-0 top-0 text-secondary hover:text-foreground transition-colors flex items-center gap-1 text-sm font-medium h-6"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
            <div className="text-center pt-8 sm:pt-0">
              <h1 className="text-base font-semibold text-foreground">Welcome to Hostelease</h1>
              <p className="mt-2 text-sm text-secondary">Please fill in your details to get started</p>
              {isProfileLocked && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-800 uppercase tracking-tight">Profile Locked</p>
                    <p className="text-[10px] text-amber-600 font-medium">Your profile has been locked by administration. You can no longer edit your information.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">


            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              {formBuilderConfig.filter(f => f.visible).map((field) => (
                <div key={field.id} className={field.type === 'image' || field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label htmlFor={field.id} className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 px-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.type === "image" ? (
                    <div className="space-y-2">
                      {!isCameraOpen && !capturedImage && (
                        <button
                          type="button"
                          onClick={startCamera}
                          disabled={isProfileLocked}
                          className="w-full py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Capture Profile Photo
                        </button>
                      )}

                      {isCameraOpen && (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] shadow-2xl">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-6 py-2 rounded-full bg-red-600 text-white text-xs font-bold shadow-lg"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={captureImage}
                              className="px-6 py-2 rounded-full bg-white text-black text-xs font-bold shadow-lg"
                            >
                              Capture Photo
                            </button>
                          </div>
                        </div>
                      )}

                      {capturedImage && (
                        <div className="relative w-32 h-40 mx-auto rounded-2xl overflow-hidden border-4 border-white shadow-xl">
                          <img
                            src={capturedImage}
                            alt="Captured profile"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            disabled={isProfileLocked}
                            onClick={() => {
                              setCapturedImage(null);
                              startCamera();
                            }}
                            className="absolute bottom-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>
                      )}
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                  ) : field.type === "select" ? (
                    <select
                      id={field.id}
                      value={(formData as any)[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      disabled={isProfileLocked || (field.id === "hostelName" && hostelsLoading)}
                      className={`w-full h-11 px-4 rounded-xl border-2 transition-all font-bold text-xs uppercase ${errors[field.id] ? "border-red-500 bg-red-50" : "border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:bg-white"} outline-none`}
                    >
                      <option value="">SELECT {field.label.toUpperCase()}</option>
                      {field.id === "hostelName" ? (
                        hostels.map((hostel: any) => (
                          <option key={hostel._id} value={hostel.name.toUpperCase()}>
                            {hostel.name.toUpperCase()}
                          </option>
                        ))
                      ) : (
                        field.options?.map((opt: string) => (
                          <option key={opt} value={opt.toUpperCase()}>{opt.toUpperCase()}</option>
                        ))
                      )}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={field.id}
                      value={(formData as any)[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      disabled={isProfileLocked}
                      className={`w-full p-4 rounded-xl border-2 transition-all font-bold text-xs uppercase min-h-[80px] ${errors[field.id] ? "border-red-500 bg-red-50 font-medium" : "border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:bg-white"} outline-none`}
                    />
                  ) : (
                    <input
                      type={field.type}
                      id={field.id}
                      value={(formData as any)[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      disabled={isProfileLocked}
                      className={`w-full h-11 px-4 rounded-xl border-2 transition-all font-bold text-xs uppercase ${errors[field.id] ? "border-red-500 bg-red-50 font-medium" : "border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:bg-white"} outline-none`}
                    />
                  )}
                  {errors[field.id] && (
                    <p className="mt-1 text-[10px] text-red-600 font-black uppercase tracking-widest">{errors[field.id]}</p>
                  )}
                </div>
              ))}
            </div>

            {/* If formBuilderConfig is empty, show a fallback message */}
            {formBuilderConfig.length === 0 && (
              <div className="py-8 text-center text-secondary">
                <p className="text-sm font-medium">Form configuration is loading...</p>
              </div>
            )}


            {Object.keys(errors).length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-800">⚠️ Please fill all required fields:</p>
              </div>
            )}
            <div className="flex gap-4 mt-6">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 h-12 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground font-medium transition-colors hover:bg-filler"
              >
                Cancel
              </button>
              {!isProfileLocked && (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] h-12 rounded-lg bg-blue-600 text-background font-medium transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Saving..." : "Save your details"}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

