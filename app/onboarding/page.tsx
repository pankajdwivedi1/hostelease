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

  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    erpInformation: "",
    hostelName: "",
    joiningDate: "",
    roomNumber: "",
    fatherName: "",
    fatherNumber: "",
    motherName: "",
    motherNumber: "",
    homePinCode: "",
    homeState: "",
    branch: "",
    collegeName: "",
    year: "",
    semester: "",
    section: "",
    localGuardianAddress: "",
    localGuardianPhoneNumber: "",
    dob: "",
    category: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});

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
              name: data.student.name || "",
              phoneNumber: data.student.phoneNumber || "",
              erpInformation: data.student.erpInformation || "",
              hostelName: data.student.hostelName || "",
              joiningDate: data.student.joiningDate ? new Date(data.student.joiningDate).toISOString().split("T")[0] : "",
              roomNumber: data.student.roomNumber || "",
              fatherName: data.student.fatherName || "",
              fatherNumber: data.student.fatherNumber || "",
              motherName: data.student.motherName || "",
              motherNumber: data.student.motherNumber || "",
              homePinCode: data.student.homePinCode || "",
              homeState: data.student.homeState || "",
              branch: data.student.branch || "",
              collegeName: data.student.collegeName || "",
              year: data.student.year || "",
              semester: data.student.semester || "",
              section: data.student.section || "",
              localGuardianAddress: data.student.localGuardianAddress || "",
              localGuardianPhoneNumber: data.student.localGuardianPhoneNumber || "",
              dob: data.student.dob ? new Date(data.student.dob).toISOString().split("T")[0] : "",
              category: data.student.category || "",
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

    const isRequired = (field: string) => {
      // Basic essential fields are always required
      if (["name", "phoneNumber", "hostelName", "roomNumber", "joiningDate"].includes(field)) return true;
      // If a field is visible, it is now considered required to ensure complete data collection
      return formConfig[field]?.visible !== false;
    };

    const isVisible = (field: string) => {
      if (["name", "phoneNumber", "hostelName", "roomNumber", "joiningDate"].includes(field)) return true;
      return formConfig[field]?.visible !== false; // Default to visible if not in config
    };

    if (isVisible("name") && !formData.name.trim()) newErrors.name = "Name is required";
    if (isVisible("phoneNumber") && !formData.phoneNumber.trim()) newErrors.phoneNumber = "Phone number is required";
    if (isVisible("erpInformation") && isRequired("erpInformation") && !formData.erpInformation.trim()) newErrors.erpInformation = "ERP ID is required";
    if (isVisible("hostelName") && !formData.hostelName.trim()) newErrors.hostelName = "Hostel name is required";
    if (isVisible("joiningDate") && !formData.joiningDate.trim()) newErrors.joiningDate = "Hostel joining date is required";
    if (isVisible("roomNumber") && !formData.roomNumber.trim()) newErrors.roomNumber = "Room number is required";

    if (isVisible("fatherName") && isRequired("fatherName") && !formData.fatherName.trim()) newErrors.fatherName = "Father's name is required";
    if (isVisible("fatherNumber") && isRequired("fatherNumber") && !formData.fatherNumber.trim()) newErrors.fatherNumber = "Father's number is required";
    if (isVisible("motherName") && isRequired("motherName") && !formData.motherName.trim()) newErrors.motherName = "Mother's name is required";
    if (isVisible("motherNumber") && isRequired("motherNumber") && !formData.motherNumber.trim()) newErrors.motherNumber = "Mother's number is required";
    if (isVisible("homePinCode") && isRequired("homePinCode") && !formData.homePinCode.trim()) newErrors.homePinCode = "Address with pincode is required";
    if (isVisible("homeState") && isRequired("homeState") && !formData.homeState) newErrors.homeState = "State is required";
    if (isVisible("branch") && isRequired("branch") && !formData.branch) newErrors.branch = "Branch is required";
    if (isVisible("collegeName") && isRequired("collegeName") && !formData.collegeName) newErrors.collegeName = "College Name is required";
    if (isVisible("year") && isRequired("year") && !formData.year) newErrors.year = "Year is required";
    if (isVisible("semester") && isRequired("semester") && !formData.semester) newErrors.semester = "Semester is required";
    if (isVisible("section") && isRequired("section") && !formData.section) newErrors.section = "Section is required";
    if (isVisible("localGuardianAddress") && isRequired("localGuardianAddress") && !formData.localGuardianAddress.trim()) newErrors.localGuardianAddress = "Local guardian address is required";
    if (isVisible("localGuardianPhoneNumber") && isRequired("localGuardianPhoneNumber") && !formData.localGuardianPhoneNumber.trim()) newErrors.localGuardianPhoneNumber = "Local guardian phone number is required";
    if (isVisible("dob") && isRequired("dob") && !formData.dob.trim()) newErrors.dob = "Date of birth is required";
    if (isVisible("category") && isRequired("category") && !formData.category) newErrors.category = "Category is required";

    if (!capturedImage) {
      newErrors.profilePicture = "Profile picture is required. Please capture your photo.";
    }

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
            {/* Camera Section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Edit Profile Photo (Passport Size)
              </label>

              {!isCameraOpen && !capturedImage && (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isProfileLocked}
                  className="w-full py-3 rounded-lg border-2 border-dashed border-[#9CA3AF] text-secondary hover:border-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Take Photo
                </button>
              )}

              {isCameraOpen && (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
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
                      className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={captureImage}
                      className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium"
                    >
                      Capture
                    </button>
                  </div>
                </div>
              )}

              {capturedImage && (
                <div className="relative w-32 h-40 mx-auto rounded-lg overflow-hidden border border-[#9CA3AF]">
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
                    className="absolute bottom-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
              {errors.profilePicture && (
                <p className="mt-1 text-sm text-red-600">{errors.profilePicture}</p>
              )}
            </div>

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
                disabled={isProfileLocked}
                className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.name ? "border-red-500" : "border-[#9CA3AF]"
                  } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  disabled={isProfileLocked}
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.phoneNumber ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                />
                {errors.phoneNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
                )}
              </div>

              {formConfig.dob?.visible !== false && (
                <div>
                  <label htmlFor="dob" className="block text-sm font-medium text-foreground mb-2">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    id="dob"
                    value={formData.dob}
                    onChange={(e) => handleChange("dob", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.dob ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                  {errors.dob && (
                    <p className="mt-1 text-sm text-red-600">{errors.dob}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formConfig.category?.visible !== false && (
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-foreground mb-2">
                    Category
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.category ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">SELECT CATEGORY</option>
                    {["GENERAL", "SC", "ST", "OBC"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-600">{errors.category}</p>
                  )}
                </div>
              )}

              {formConfig.erpInformation?.visible !== false && (
                <div>
                  <label htmlFor="erpInformation" className="block text-sm font-medium text-foreground mb-2">
                    Enter your ERP ID
                  </label>
                  <input
                    type="text"
                    id="erpInformation"
                    value={formData.erpInformation}
                    onChange={(e) => handleChange("erpInformation", e.target.value)}
                    placeholder="Enter your ERP information"
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.erpInformation ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                  {errors.erpInformation && (
                    <p className="mt-1 text-sm text-red-600">{errors.erpInformation}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formConfig.collegeName?.visible !== false && (
                <div>
                  <label htmlFor="collegeName" className="block text-sm font-medium text-foreground mb-2">
                    College Name
                  </label>
                  <select
                    id="collegeName"
                    value={formData.collegeName}
                    onChange={(e) => handleChange("collegeName", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.collegeName ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">SELECT COLLEGE</option>
                    {["OIST", "OCT", "OCP", "OPM", "OIPR"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.collegeName && (
                    <p className="mt-1 text-sm text-red-600">{errors.collegeName}</p>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="hostelName" className="block text-sm font-medium text-foreground mb-2">
                  Hostel Name
                </label>
                <select
                  id="hostelName"
                  value={formData.hostelName}
                  onChange={(e) => handleChange("hostelName", e.target.value)}
                  disabled={hostelsLoading || isProfileLocked}
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.hostelName ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">{hostelsLoading ? "LOADING HOSTELS..." : "SELECT HOSTEL"}</option>
                  {hostels.map((hostel) => (
                    <option key={hostel._id} value={hostel.name.toUpperCase()}>
                      {hostel.name.toUpperCase()}
                    </option>
                  ))}
                </select>
                {errors.hostelName && (
                  <p className="mt-1 text-sm text-red-600">{errors.hostelName}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="joiningDate" className="block text-sm font-medium text-foreground mb-2">
                  Hostel joining date
                </label>
                <input
                  type="date"
                  id="joiningDate"
                  value={formData.joiningDate}
                  onChange={(e) => handleChange("joiningDate", e.target.value)}
                  placeholder="e.g. 01-01-2000"
                  disabled={isProfileLocked}
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.joiningDate ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                />
                {errors.joiningDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.joiningDate}</p>
                )}
              </div>
              {formConfig.year?.visible !== false && (
                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-foreground mb-2">
                    Year
                  </label>
                  <select
                    id="year"
                    value={formData.year}
                    onChange={(e) => handleChange("year", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.year ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">SELECT YEAR</option>
                    {["1st year", "2nd year", "3rd year", "4th year"].map((opt) => (
                      <option key={opt} value={opt.toUpperCase()}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                  {errors.year && (
                    <p className="mt-1 text-sm text-red-600">{errors.year}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formConfig.semester?.visible !== false && (
                <div>
                  <label htmlFor="semester" className="block text-sm font-medium text-foreground mb-2">
                    Semester
                  </label>
                  <select
                    id="semester"
                    value={formData.semester}
                    onChange={(e) => handleChange("semester", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.semester ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">SELECT SEMESTER</option>
                    {["1st Sem", "2nd Sem", "3rd Sem", "4th Sem", "5th Sem", "6th Sem", "7th Sem", "8th Sem"].map((opt) => (
                      <option key={opt} value={opt.toUpperCase()}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                  {errors.semester && (
                    <p className="mt-1 text-sm text-red-600">{errors.semester}</p>
                  )}
                </div>
              )}
              {formConfig.branch?.visible !== false && (
                <div>
                  <label htmlFor="branch" className="block text-sm font-medium text-foreground mb-2">
                    Branch
                  </label>
                  <select
                    id="branch"
                    value={formData.branch}
                    onChange={(e) => handleChange("branch", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.branch ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">SELECT BRANCH</option>
                    {["CS", "AIML", "DS", "ME", "CE", "EC", "IT", "EX", "MCA", "B PHARMA", "D PHARMA", "MBA", "MTECH", "M PHARMA", "CSBS", "CYBER SECURITY"].map((opt) => (
                      <option key={opt} value={opt.toUpperCase()}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                  {errors.branch && (
                    <p className="mt-1 text-sm text-red-600">{errors.branch}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formConfig.section?.visible !== false && (
                <div>
                  <label htmlFor="section" className="block text-sm font-medium text-foreground mb-2">
                    Select section
                  </label>
                  <select
                    id="section"
                    value={formData.section}
                    onChange={(e) => handleChange("section", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.section ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">SELECT SECTION</option>
                    {["A", "B", "C", "D", "E", "F"].map((opt) => (
                      <option key={opt} value={opt.toUpperCase()}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                  {errors.section && (
                    <p className="mt-1 text-sm text-red-600">{errors.section}</p>
                  )}
                </div>
              )}
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
                  disabled={isProfileLocked}
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.roomNumber ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                />
                {errors.roomNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.roomNumber}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formConfig.fatherName?.visible !== false && (
                <div>
                  <label htmlFor="fatherName" className="block text-sm font-medium text-foreground mb-2">
                    Father&apos;s Name
                  </label>
                  <input
                    type="text"
                    id="fatherName"
                    value={formData.fatherName}
                    onChange={(e) => handleChange("fatherName", e.target.value)}
                    placeholder="Enter father&apos;s name"
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.fatherName ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                  {errors.fatherName && (
                    <p className="mt-1 text-sm text-red-600">{errors.fatherName}</p>
                  )}
                </div>
              )}

              {formConfig.fatherNumber?.visible !== false && (
                <div>
                  <label htmlFor="fatherNumber" className="block text-sm font-medium text-foreground mb-2">
                    Father&apos;s Phone Number
                  </label>
                  <input
                    type="tel"
                    id="fatherNumber"
                    value={formData.fatherNumber}
                    onChange={(e) => handleChange("fatherNumber", e.target.value)}
                    placeholder="Enter father&apos;s phone number"
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.fatherNumber ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                  {errors.fatherNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.fatherNumber}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formConfig.motherName?.visible !== false && (
                <div>
                  <label htmlFor="motherName" className="block text-sm font-medium text-foreground mb-2">
                    Mother&apos;s Name
                  </label>
                  <input
                    type="text"
                    id="motherName"
                    value={formData.motherName}
                    onChange={(e) => handleChange("motherName", e.target.value)}
                    placeholder="Enter mother&apos;s name"
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.motherName ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                  {errors.motherName && (
                    <p className="mt-1 text-sm text-red-600">{errors.motherName}</p>
                  )}
                </div>
              )}

              {formConfig.motherNumber?.visible !== false && (
                <div>
                  <label htmlFor="motherNumber" className="block text-sm font-medium text-foreground mb-2">
                    Mother&apos;s Phone Number
                  </label>
                  <input
                    type="tel"
                    id="motherNumber"
                    value={formData.motherNumber}
                    onChange={(e) => handleChange("motherNumber", e.target.value)}
                    placeholder="Enter mother&apos;s phone number"
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.motherNumber ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                  {errors.motherNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.motherNumber}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formConfig.homePinCode?.visible !== false && (
                <div>
                  <label htmlFor="homePinCode" className="block text-sm font-medium text-foreground mb-2">
                    Permanent address with pincode
                  </label>
                  <input
                    type="text"
                    id="homePinCode"
                    value={formData.homePinCode}
                    onChange={(e) => handleChange("homePinCode", e.target.value)}
                    placeholder="Enter permanent address with pincode"
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.homePinCode ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  />
                  {errors.homePinCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.homePinCode}</p>
                  )}
                </div>
              )}

              {formConfig.homeState?.visible !== false && (
                <div>
                  <label htmlFor="homeState" className="block text-sm font-medium text-foreground mb-2">
                    State
                  </label>
                  <select
                    id="homeState"
                    value={formData.homeState}
                    onChange={(e) => handleChange("homeState", e.target.value)}
                    disabled={isProfileLocked}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.homeState ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground text-xs uppercase focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                  >
                    <option value="">SELECT STATE</option>
                    {[
                      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
                      "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep", "Delhi", "Puducherry", "Ladakh", "Jammu and Kashmir"
                    ].sort().map((state) => (
                      <option key={state} value={state.toUpperCase()}>{state.toUpperCase()}</option>
                    ))}
                  </select>
                  {errors.homeState && (
                    <p className="mt-1 text-sm text-red-600">{errors.homeState}</p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2">
              <div className="grid grid-cols-2 gap-4">
                {formConfig.localGuardianAddress?.visible !== false && (
                  <div>
                    <label htmlFor="localGuardianAddress" className="block text-sm font-medium text-foreground mb-2">
                      Local guardian address
                    </label>
                    <input
                      type="text"
                      id="localGuardianAddress"
                      value={formData.localGuardianAddress}
                      onChange={(e) => handleChange("localGuardianAddress", e.target.value)}
                      placeholder="Enter local guardian address"
                      disabled={isProfileLocked}
                      className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.localGuardianAddress ? "border-red-500" : "border-[#9CA3AF]"
                        } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                    />
                    {errors.localGuardianAddress && (
                      <p className="mt-1 text-sm text-red-600">{errors.localGuardianAddress}</p>
                    )}
                  </div>
                )}
                {formConfig.localGuardianPhoneNumber?.visible !== false && (
                  <div>
                    <label htmlFor="localGuardianPhoneNumber" className="block text-sm font-medium text-foreground mb-2">
                      Local guardian Mobile
                    </label>
                    <input
                      type="tel"
                      id="localGuardianPhoneNumber"
                      value={formData.localGuardianPhoneNumber}
                      onChange={(e) => handleChange("localGuardianPhoneNumber", e.target.value)}
                      placeholder="Enter local guardian mobile number"
                      disabled={isProfileLocked}
                      className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.localGuardianPhoneNumber ? "border-red-500" : "border-[#9CA3AF]"
                        } bg-white text-foreground text-xs uppercase placeholder:text-secondary placeholder:text-xs focus:outline-none focus:border-foreground disabled:bg-gray-50 disabled:text-gray-400`}
                    />
                    {errors.localGuardianPhoneNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.localGuardianPhoneNumber}</p>
                    )}
                  </div>
                )}
              </div>
            </div>


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

