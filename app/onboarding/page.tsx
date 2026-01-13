"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import { useRef } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";

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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState("");

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

    fetchHostels();
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
            });
            if (data.student.profilePicture) {
              setCapturedImage(data.student.profilePicture);
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

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    }

    if (!formData.erpInformation.trim()) {
      newErrors.erpInformation = "ERP ID is required";
    }

    if (!formData.hostelName.trim()) {
      newErrors.hostelName = "Hostel name is required";
    }

    if (!formData.joiningDate.trim()) {
      newErrors.joiningDate = "Hostel joining date is required";
    }

    if (!formData.roomNumber.trim()) {
      newErrors.roomNumber = "Room number is required";
    }

    if (!formData.fatherName.trim()) {
      newErrors.fatherName = "Father's name is required";
    }

    if (!formData.fatherNumber.trim()) {
      newErrors.fatherNumber = "Father's number is required";
    }

    if (!formData.motherName.trim()) {
      newErrors.motherName = "Mother's name is required";
    }

    if (!formData.motherNumber.trim()) {
      newErrors.motherNumber = "Mother's number is required";
    }

    if (!formData.homePinCode.trim()) {
      newErrors.homePinCode = "Permanent address with pincode is required";
    }

    if (!formData.homeState) {
      newErrors.homeState = "State is required";
    }

    if (!formData.branch) {
      newErrors.branch = "Branch is required";
    }

    if (!formData.collegeName) {
      newErrors.collegeName = "College Name is required";
    }

    if (!formData.year) {
      newErrors.year = "Year is required";
    }

    if (!formData.semester) {
      newErrors.semester = "Semester is required";
    }

    if (!formData.section) {
      newErrors.section = "Section is required";
    }

    if (!formData.localGuardianAddress.trim()) {
      newErrors.localGuardianAddress = "Local guardian address is required";
    }

    if (!formData.localGuardianPhoneNumber.trim()) {
      newErrors.localGuardianPhoneNumber = "Local guardian phone number is required";
    }

    if (!capturedImage) {
      newErrors.profilePicture = "Profile picture is required. Please capture your photo.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBack = async () => {
    try {
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      router.push("/login");
    }
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save data");
      }

      // Instead of redirecting immediately, show biometric setup prompt
      setShowBiometricPrompt(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      console.error("Error saving student data:", error);
      setErrors({ submit: error.message || "Failed to save data. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSetup = async () => {
    if (!user) return;

    // Check if browser supports WebAuthn
    if (!browserSupportsWebAuthn()) {
      setBiometricError("WebAuthn is not supported in this browser. Please ensure you are using a modern browser and accessing the site via HTTPS (unless on localhost).");
      return;
    }

    try {
      setBiometricLoading(true);
      setBiometricError("");

      // 1. Get options from server
      const optionsResponse = await fetch("/api/auth/webauthn/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firebaseUID: user.uid }),
      });
      const options = await optionsResponse.json();

      if (!optionsResponse.ok) throw new Error(options.error || "Failed to get options");

      // 2. Start registration (browser prompt)
      let attestationResponse;
      try {
        attestationResponse = await startRegistration(options);
      } catch (err: any) {
        console.error("Browser registration error:", err);
        if (err.name === "NotAllowedError") {
          const isNotSecure = typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost';
          if (isNotSecure) {
            throw new Error("Biometric setup failed. Browsers block this feature on IP addresses (like " + window.location.hostname + ") for security. Please test on 'localhost' or use an HTTPS tunnel.");
          }
          throw new Error("Biometric setup was cancelled or timed out. Please try again or skip.");
        }
        if (err.name === "SecurityError") {
          throw new Error("Security Error: WebAuthn requires a secure context (HTTPS) or localhost. If you are testing on mobile, please use a tunnel (like ngrok) or access via localhost if possible.");
        }
        throw new Error(err.message || "Device registration failed. Please ensure biometrics are enabled on your device.");
      }

      // 3. Verify on server
      const verifyResponse = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUID: user.uid,
          attestationResponse,
        }),
      });
      const verification = await verifyResponse.json();

      if (!verifyResponse.ok) throw new Error(verification.error || "Verification failed");

      if (verification.verified) {
        // Success! Finalize onboarding
        localStorage.setItem("userType", "student");
        router.push("/");
      }
    } catch (error: any) {
      console.error("Biometric setup error:", error);
      setBiometricError(error.message || "Something went wrong during biometric setup.");
    } finally {
      setBiometricLoading(false);
    }
  };

  const skipBiometric = () => {
    localStorage.setItem("userType", "student");
    router.push("/");
  };

  const startCamera = async () => {
    try {
      // Check if navigator and mediaDevices are available
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera access is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.");
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
    // Automatically convert to uppercase except for email
    const formattedValue = field === "email" ? value : value.toUpperCase();
    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        {showBiometricPrompt ? (
          <div className="space-y-8 py-12 text-center">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">Enhanced Security Setup</h2>
              <p className="text-secondary text-sm leading-relaxed max-w-xs mx-auto">
                Secure your profile with your device&apos;s biometric scan (Fingerprint, Face ID, or PIN).
              </p>
              {typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && (
                <p className="text-amber-600 text-[10px] bg-amber-50 p-2 rounded border border-amber-100 mt-2">
                  ⚠️ Note: Biometrics require <b>HTTPS</b>. If you are testing over a local network IP, this feature will be disabled by your browser.
                </p>
              )}
            </div>

            {biometricError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                {biometricError}
              </div>
            )}

            <div className="space-y-3 pt-4">
              <button
                onClick={handleBiometricSetup}
                disabled={biometricLoading}
                className="w-full h-12 bg-black text-white rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {biometricLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Setup Biometric Security"
                )}
              </button>
              <button
                onClick={skipBiometric}
                disabled={biometricLoading}
                className="w-full py-3 text-sm text-secondary hover:text-foreground font-medium transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : (
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
                    className="w-full py-3 rounded-lg border-2 border-dashed border-[#9CA3AF] text-secondary hover:border-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
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
                      onClick={() => {
                        setCapturedImage(null);
                        startCamera();
                      }}
                      className="absolute bottom-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
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
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.name ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
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
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.phoneNumber ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                />
                {errors.phoneNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
                )}
              </div>

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
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.erpInformation ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                />
                {errors.erpInformation && (
                  <p className="mt-1 text-sm text-red-600">{errors.erpInformation}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="collegeName" className="block text-sm font-medium text-foreground mb-2">
                    College Name
                  </label>
                  <select
                    id="collegeName"
                    value={formData.collegeName}
                    onChange={(e) => handleChange("collegeName", e.target.value)}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.collegeName ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase focus:outline-none focus:border-foreground`}
                  >
                    <option value="">Select College</option>
                    {["OIST", "OCT", "OCP", "OPM", "OIPR"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.collegeName && (
                    <p className="mt-1 text-sm text-red-600">{errors.collegeName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="hostelName" className="block text-sm font-medium text-foreground mb-2">
                    Hostel Name
                  </label>
                  <select
                    id="hostelName"
                    value={formData.hostelName}
                    onChange={(e) => handleChange("hostelName", e.target.value)}
                    disabled={hostelsLoading}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.hostelName ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase focus:outline-none focus:border-foreground disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <option value="">{hostelsLoading ? "Loading hostels..." : "Select hostel"}</option>
                    {hostels.map((hostel) => (
                      <option key={hostel._id} value={hostel.name}>
                        {hostel.name}
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
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.joiningDate ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                  />
                  {errors.joiningDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.joiningDate}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-foreground mb-2">
                    Year
                  </label>
                  <select
                    id="year"
                    value={formData.year}
                    onChange={(e) => handleChange("year", e.target.value)}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.year ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase focus:outline-none focus:border-foreground`}
                  >
                    <option value="">Select Year</option>
                    {["1st year", "2nd year", "3rd year", "4th year"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.year && (
                    <p className="mt-1 text-sm text-red-600">{errors.year}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="semester" className="block text-sm font-medium text-foreground mb-2">
                    Semester
                  </label>
                  <select
                    id="semester"
                    value={formData.semester}
                    onChange={(e) => handleChange("semester", e.target.value)}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.semester ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase focus:outline-none focus:border-foreground`}
                  >
                    <option value="">Select Semester</option>
                    {["1st Sem", "2nd Sem", "3rd Sem", "4th Sem", "5th Sem", "6th Sem", "7th Sem", "8th Sem"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.semester && (
                    <p className="mt-1 text-sm text-red-600">{errors.semester}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="branch" className="block text-sm font-medium text-foreground mb-2">
                    Branch
                  </label>
                  <select
                    id="branch"
                    value={formData.branch}
                    onChange={(e) => handleChange("branch", e.target.value)}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.branch ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase focus:outline-none focus:border-foreground`}
                  >
                    <option value="">Select Branch</option>
                    {["CS", "AIML", "DS", "ME", "CE", "EC", "IT", "EX", "MCA", "B PHARMA", "MBA", "CSBS"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.branch && (
                    <p className="mt-1 text-sm text-red-600">{errors.branch}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="section" className="block text-sm font-medium text-foreground mb-2">
                    Select section
                  </label>
                  <select
                    id="section"
                    value={formData.section}
                    onChange={(e) => handleChange("section", e.target.value)}
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.section ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase focus:outline-none focus:border-foreground`}
                  >
                    <option value="">Select Section</option>
                    {["NIL", "A", "B", "C", "D", "E", "F"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {errors.section && (
                    <p className="mt-1 text-sm text-red-600">{errors.section}</p>
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
                    className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.roomNumber ? "border-red-500" : "border-[#9CA3AF]"
                      } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                  />
                  {errors.roomNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.roomNumber}</p>
                  )}
                </div>
              </div>

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
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.fatherName ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                />
                {errors.fatherName && (
                  <p className="mt-1 text-sm text-red-600">{errors.fatherName}</p>
                )}
              </div>

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
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.fatherNumber ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                />
                {errors.fatherNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.fatherNumber}</p>
                )}
              </div>

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
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.motherName ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                />
                {errors.motherName && (
                  <p className="mt-1 text-sm text-red-600">{errors.motherName}</p>
                )}
              </div>

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
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.motherNumber ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                />
                {errors.motherNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.motherNumber}</p>
                )}
              </div>

              <div>
                <label htmlFor="homePinCode" className="block text-sm font-medium text-foreground mb-2">
                  Parmanent address with pincode
                </label>
                <input
                  type="text"
                  id="homePinCode"
                  value={formData.homePinCode}
                  onChange={(e) => handleChange("homePinCode", e.target.value)}
                  placeholder="Enter permanent address with pincode"
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.homePinCode ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                />
                {errors.homePinCode && (
                  <p className="mt-1 text-sm text-red-600">{errors.homePinCode}</p>
                )}
              </div>

              <div>
                <label htmlFor="homeState" className="block text-sm font-medium text-foreground mb-2">
                  State
                </label>
                <select
                  id="homeState"
                  value={formData.homeState}
                  onChange={(e) => handleChange("homeState", e.target.value)}
                  className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.homeState ? "border-red-500" : "border-[#9CA3AF]"
                    } bg-white text-foreground uppercase focus:outline-none focus:border-foreground`}
                >
                  <option value="">Select State</option>
                  {[
                    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
                    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep", "Delhi", "Puducherry", "Ladakh", "Jammu and Kashmir"
                  ].sort().map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                {errors.homeState && (
                  <p className="mt-1 text-sm text-red-600">{errors.homeState}</p>
                )}
              </div>

              <div>
                <div className="space-y-4 pt-2">
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
                      className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.localGuardianAddress ? "border-red-500" : "border-[#9CA3AF]"
                        } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                    />
                    {errors.localGuardianAddress && (
                      <p className="mt-1 text-sm text-red-600">{errors.localGuardianAddress}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="localGuardianPhoneNumber" className="block text-sm font-medium text-foreground mb-2">
                      Local guardian Mobile Number
                    </label>
                    <input
                      type="tel"
                      id="localGuardianPhoneNumber"
                      value={formData.localGuardianPhoneNumber}
                      onChange={(e) => handleChange("localGuardianPhoneNumber", e.target.value)}
                      placeholder="Enter local guardian mobile number"
                      className={`w-full h-12 px-4 rounded-lg border border-solid ${errors.localGuardianPhoneNumber ? "border-red-500" : "border-[#9CA3AF]"
                        } bg-white text-foreground uppercase placeholder:text-secondary focus:outline-none focus:border-foreground`}
                    />
                    {errors.localGuardianPhoneNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.localGuardianPhoneNumber}</p>
                    )}
                  </div>
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
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] h-12 rounded-lg bg-blue-600 text-background font-medium transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Saving..." : "Save your details"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

