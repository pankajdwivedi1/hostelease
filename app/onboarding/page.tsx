"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";

import { useRef } from "react";
import * as faceMatching from "@/lib/faceMatching";
import * as objectDetection from "@/lib/objectDetection";

export default function OnboardingPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [isCapturingDescriptor, setIsCapturingDescriptor] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFaceProcessing, setIsFaceProcessing] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [isFaceInFrame, setIsFaceInFrame] = useState(false);
  const [isSpoofingDetected, setIsSpoofingDetected] = useState(false);
  const [blinkInstruction, setBlinkInstruction] = useState<string>('');
  const [blinkCount, setBlinkCount] = useState(0);
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string }>>([]);
  const [hostelsLoading, setHostelsLoading] = useState(true);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const [isExistingStudent, setIsExistingStudent] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});
  const [formBuilderConfig, setFormBuilderConfig] = useState<any[]>([]);
  const [tempConfig, setTempConfig] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // ⚡ Safe LocalStorage Hydration
    const cached = localStorage.getItem('cachedFormBuilderConfig');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setFormBuilderConfig(parsed);
          setLoadingProgress(100);
        }
      } catch (e) {
        console.error("Cache read error", e);
      }
    }
  }, []);

  useEffect(() => {
    // ⚡ Delay preloading AI models so it doesn't freeze the initial page render
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          faceMatching.loadFaceApiModels(false);
          objectDetection.loadPhoneDetector();
        });
      } else {
        faceMatching.loadFaceApiModels(false);
        objectDetection.loadPhoneDetector();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Smooth progress bar animation
  useEffect(() => {
    // If form is already showing, do nothing
    if (formBuilderConfig.length > 0) return;

    if (tempConfig.length > 0) {
      // Data loaded, accelerate to 100%
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          const next = prev + 8;
          if (next >= 100) {
            clearInterval(interval);
            // Wait for CSS transition to finish before showing the form
            setTimeout(() => {
              setFormBuilderConfig(tempConfig);
            }, 400);
            return 100;
          }
          return next;
        });
      }, 30);
      return () => clearInterval(interval);
    } else {
      // Data not loaded yet, simulate loading up to 95%
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 95) return prev; // Hold at 95%
          return prev + Math.floor(Math.random() * 8) + 1;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [tempConfig, formBuilderConfig.length]);

  // Fetch hostels from API
  useEffect(() => {
    const fetchHostels = async () => {
      try {
        setHostelsLoading(true);
        const url = new URL("/api/hostels", window.location.origin);
        const response = await fetch(url.href);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

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
        const url = new URL("/api/admin/settings", window.location.origin);
        const response = await fetch(url.href);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setFormConfig(data.registrationFieldsConfig || {});
          if (data.formBuilderConfig && data.formBuilderConfig.length > 0) {
            setTempConfig(data.formBuilderConfig);
            if (typeof window !== 'undefined') {
              localStorage.setItem('cachedFormBuilderConfig', JSON.stringify(data.formBuilderConfig));
            }
          }
        }
      } catch (error) {
        console.error("Error fetching form config:", error);
      }
    };

    fetchHostels();
    fetchConfig();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      // 1. Check Supabase First
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const currentUser = session.user;
        setUser({ uid: currentUser.id, email: currentUser.email, source: 'supabase' });

        try {
          // Identify by email for silent handoff compatibility
          const response = await fetch(`/api/students?email=${encodeURIComponent(currentUser.email || "")}`);
          const data = await response.json();
          if (data.student) {
            setIsExistingStudent(true);
            setFormData({
              ...data.student,
              ...(data.student.dynamicFields || {}),
              dob: data.student.dob ? new Date(data.student.dob).toISOString().split("T")[0] : "",
              joiningDate: data.student.joiningDate ? new Date(data.student.joiningDate).toISOString().split("T")[0] : "",
            });
            if (data.student.profilePicture) setCapturedImage(data.student.profilePicture);
            if (data.student.isProfileLocked) setIsProfileLocked(true);
          }
        } catch (error) {
          console.error("Error fetching Supabase student data:", error);
        }
        return;
      }

      // 2. Fallback to Firebase for legacy sessions
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
        if (currentUser) {
          setUser({ uid: currentUser.uid, email: currentUser.email, source: 'firebase' });
          try {
            const response = await fetch(`/api/students?email=${encodeURIComponent(currentUser.email || "")}`);
            const data = await response.json();
            if (data.student) {
              setIsExistingStudent(true);
              // ... set form data ...
              setFormData({
                ...data.student,
                ...(data.student.dynamicFields || {}),
                dob: data.student.dob ? new Date(data.student.dob).toISOString().split("T")[0] : "",
                joiningDate: data.student.joiningDate ? new Date(data.student.joiningDate).toISOString().split("T")[0] : "",
              });
              if (data.student.profilePicture) setCapturedImage(data.student.profilePicture);
              if (data.student.isProfileLocked) setIsProfileLocked(true);
            }
          } catch (error) {
            console.error("Error fetching Firebase student data:", error);
          }
        } else {
          router.push("/login");
        }
      });

      return () => unsubscribe();
    };

    initAuth();
  }, [router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    formBuilderConfig.forEach(field => {
      // ⚡ PIN CODE: Made optional globally as per user request
      if (field.visible && field.required && field.id !== 'homePinCode') {
        if (field.type === 'image') {
          if (!capturedImage) {
            newErrors[field.id] = `${field.label} is required`;
          }
        } else {
          const value = (formData as any)[field.id];

          // Basic Empty Check
          if (!value || (typeof value === "string" && value.trim() === "")) {
            newErrors[field.id] = `${field.label} is required`;
          }

          // STRICT: Validate Select Options (Force user to pick valid option if current data is invalid/legacy)
          else if (field.type === 'select') {
            if (field.id === 'hostelName') {
              const isValidHostel = hostels.some(h => h.name.toUpperCase() === value.toUpperCase());
              if (!isValidHostel) {
                newErrors[field.id] = `Please select a valid ${field.label}`;
              }
            } else if (field.options && field.options.length > 0) {
              const isValidOption = field.options.some((opt: string) => opt.toUpperCase() === value.toUpperCase());
              if (!isValidOption) {
                newErrors[field.id] = `Please select a valid ${field.label}`;
              }
            }
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBack = async () => {
    if (isExistingStudent) {
      router.push("/");
      return;
    }

    try {
      await supabase.auth.signOut();
      await firebaseSignOut(firebaseAuth);
      localStorage.clear();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      router.push("/login");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProfileLocked || isFaceProcessing || faceError || !validateForm() || !user) {
      if (faceError) alert("Please recapture your photo: " + faceError);
      return;
    }

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

      // ⚡ DISABLED: Device binding is no longer required
      /*
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
      */
      const currentDeviceId = "no-binding"; // Dummy value for legacy field

      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firebaseUID: user.uid,
          supabase_id: user.source === 'supabase' ? user.uid : undefined,
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
          floorNumber: formData.floorNumber, // NEW
          localGuardianAddress: formData.localGuardianAddress,
          localGuardianPhoneNumber: formData.localGuardianPhoneNumber,
          dob: formData.dob,
          category: formData.category,
          deviceId: currentDeviceId, // Include deviceId in the payload
          faceDescriptor: faceDescriptor || undefined, // NEW: Include face bio
          dynamicFields: formData, // Save all form data into dynamicFields for flexibility
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error: any = new Error(data.error || "Failed to save data");
        error.details = data.details; // Attach server-side validation errors
        throw error;
      }

      /*
      if (deviceJustRegistered) {
        alert("Device registered successfully! You can now use all features.");
      }
      */

      localStorage.setItem("userType", "student");
      router.push("/");
    } catch (error: any) {
      console.error("Error saving student data:", error);

      // If the server returned validation details, use them
      if (error.details && Array.isArray(error.details)) {
        const newErrors: Record<string, string> = {};
        error.details.forEach((detail: string, index: number) => {
          newErrors[`server_${index}`] = detail;
        });
        setErrors(newErrors);
      } else {
        setErrors({ submit: error.message || "Failed to save data. Please try again." });
      }
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
        alert("Camera API is completely missing. This usually happens if you are using a mobile phone to access a local IP address (like 192.168.x.x) without HTTPS. Please test via the live Vercel link (https://...) instead.");
        return;
      }

      // 1. Get camera permission and stream FIRST (while showing loading state on button)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      
      // 2. Now that camera is ready, open the UI
      setIsCameraOpen(true);
      
      // 3. Attach stream to the newly rendered video tag
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // ⚡ PRE-LOAD: Start loading AI models
          faceMatching.loadFaceApiModels();
        }
      }, 50);
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
    setIsFaceInFrame(false);
  };

  // ⚡ LIVE FACE GUARD: Check for face continuously when camera is open
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let hasDetectedLiveness = false;
    let currentInstruction = 'CLOSE_EYES';
    let currentActionStartTime = 0;
    let currentBlinkCount = 0;

    if (isCameraOpen && videoRef.current) {
      objectDetection.loadPhoneDetector(); // Silently load AI model in background
      setBlinkInstruction('OPEN_MOUTH');
      currentInstruction = 'OPEN_MOUTH';
      setBlinkCount(0);

      let isDetecting = false; // Prevent overlapping heavy AI inferences

      interval = setInterval(async () => {
        if (isDetecting) return; // Wait for current AI detection to finish before starting a new one
        if (videoRef.current && videoRef.current.readyState === 4) {
          isDetecting = true;
          try {
            // ⚡ LEVEL 3 ANTI-SPOOFING: Mobile Phone Detection
            const isPhoneDetected = await objectDetection.detectMobilePhone(videoRef.current);
            if (isPhoneDetected) {
              setIsSpoofingDetected(true);
              setIsFaceInFrame(false);
              hasDetectedLiveness = false;
              if (overlayCanvasRef.current) {
                  const ctx = overlayCanvasRef.current.getContext('2d');
                  if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
              }
              return; // Block processing
            } else {
              setIsSpoofingDetected(false);
            }

            const res = await faceMatching.detectFace(videoRef.current, false, false);

            if (!res) {
              setIsFaceInFrame(false);
              hasDetectedLiveness = false;
              currentInstruction = 'OPEN_MOUTH';
              setBlinkInstruction('OPEN_MOUTH');
              currentActionStartTime = 0;
              currentBlinkCount = 0;
              setBlinkCount(0);
              // Clear canvas
              if (overlayCanvasRef.current) {
                  const ctx = overlayCanvasRef.current.getContext('2d');
                  if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
              }
              return;
            }

            // ⚡ DRAW DYNAMIC GREEN FACE FRAME
            if (overlayCanvasRef.current && videoRef.current) {
                const video = videoRef.current;
                const canvas = overlayCanvasRef.current;
                if (video.videoWidth > 0) {
                    const displaySize = { width: video.videoWidth, height: video.videoHeight };
                    const fa = await faceMatching.getFaceApi();
                    fa.matchDimensions(canvas, displaySize);
                    const resizedDetection = fa.resizeResults(res.detection, displaySize);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        const drawBox = new fa.draw.DrawBox(resizedDetection.box, { 
                            lineWidth: 1, 
                            boxColor: '#00FF00' 
                        });
                        drawBox.draw(canvas);
                    }
                }
            }

            const liveness = faceMatching.analyzeLiveness(res.landmarks);
            if (liveness) {
              // 🛡️ ACTION SEQUENCE: MOUTH OPEN DETECTION (100% Defeats 2D printed photos)
              if (currentInstruction === 'OPEN_MOUTH') {
                  if (liveness.isMouthOpen) { 
                      currentInstruction = 'CLOSE_MOUTH';
                      setBlinkInstruction('CLOSE_MOUTH');
                  }
              } else if (currentInstruction === 'CLOSE_MOUTH') {
                  if (!liveness.isMouthOpen) {
                      currentInstruction = 'DONE';
                      setBlinkInstruction('DONE');
                      hasDetectedLiveness = true;
                  }
              }
            }

            setIsFaceInFrame(hasDetectedLiveness);
          } finally {
            isDetecting = false; // Release lock
          }
        }
      }, 400); 
    }

    return () => clearInterval(interval);
  }, [isCameraOpen]);

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 1. INSTANT FEEDBACK: Generate dataUrl and close camera immediately
        // Removed the slow while loop. We just use a lower quality (0.6) for instant speed
        // 0.6 is still perfectly clear for face recognition but reduces file size instantly.
        let dataUrl = canvas.toDataURL("image/jpeg", 0.6);

        setCapturedImage(dataUrl);
        setFaceError(null);
        stopCamera();

        // 2. BACKGROUND THINKING: Process descriptor without blocking the UI
        processFaceInBackground(canvas);
      }
    }
  };

  const processFaceInBackground = async (canvas: HTMLCanvasElement) => {
    try {
      setIsFaceProcessing(true);
      setFaceDescriptor(null); // Clear previous

      // Ensure models are loaded
      await faceMatching.loadFaceApiModels();

      // ⚡ SECURITY: Reject if multiple faces are in the frame
      const fa = await faceMatching.getFaceApi();
      const allFaces = await fa.detectAllFaces(canvas, new fa.TinyFaceDetectorOptions());
      if (allFaces.length > 1) {
        setFaceError("Multiple faces detected! Please ensure ONLY YOU are in the frame.");
        setCapturedImage(null); // Force retake
        return;
      }

      const descriptor = await faceMatching.detectFace(canvas);

      if (!descriptor) {
        setFaceError("No face detected! Please capture again.");
        setCapturedImage(null); // Force retake
        return;
      }

      setFaceDescriptor(Array.from(descriptor.descriptor));
      console.log("✅ Background Face Scan Complete");
    } catch (err) {
      console.error("Error generating face descriptor:", err);
      setFaceError("Face processing failed. Try again with better lighting.");
      setCapturedImage(null);
    } finally {
      setIsFaceProcessing(false);
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


            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {formBuilderConfig.filter(f => f.visible).map((field) => (
                <div key={field.id} className={field.type === 'image' || field.type === 'textarea' ? 'col-span-2' : ''}>
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
                        <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden">
                          {/* Live Status HUD */}
                          <div className="absolute top-8 left-0 right-0 flex flex-col items-center gap-2 z-10">
                            <div className={`px-4 py-2 rounded-full text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl transition-all border-2 ${isFaceInFrame ? 'bg-green-500 border-green-400 text-white' : isSpoofingDetected ? 'bg-red-700 border-red-500 text-white animate-pulse' : 'bg-red-600 border-red-400 text-white animate-pulse'}`}>
                              <span className={`w-2.5 h-2.5 rounded-full ${isFaceInFrame ? 'bg-white' : 'bg-white/80 animate-ping'}`}></span>
                              {isSpoofingDetected ? 'SPOOF DETECTED: PHONE' : isFaceInFrame ? 'Live Human Verified' : 'Action Required'}
                            </div>
                            
                            {!isFaceInFrame && (
                              <div className="bg-black/70 backdrop-blur-md text-white px-3 py-1.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-center shadow-xl border border-white/20 mt-1 md:mt-2 mx-4 animate-bounce">
                                <p className={`text-[10px] md:text-base font-black uppercase tracking-wide ${isSpoofingDetected ? 'text-red-500' : 'text-blue-400'}`}>
                                  {isSpoofingDetected ? 'REMOVE SCREEN/OBJECT 📵' : blinkInstruction === 'OPEN_MOUTH' ? 'Open Your Mouth 👄' : blinkInstruction === 'CLOSE_MOUTH' ? 'Close Mouth & Hold Still 📸' : 'Looking Good!'}
                                </p>
                                <p className="text-[8px] md:text-xs font-medium text-gray-300 mt-0.5">Anti-Spoofing Check</p>
                              </div>
                            )}
                          </div>

                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <canvas 
                            ref={overlayCanvasRef} 
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[15]" 
                          />

                          {/* Full Screen Controls */}
                          <div className="absolute bottom-10 left-0 right-0 flex flex-row items-center justify-center gap-4 md:gap-8 z-10 px-4">
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-6 py-4 md:px-10 md:py-5 rounded-full bg-red-600 text-white text-xs md:text-sm font-black uppercase tracking-widest shadow-2xl transition-all hover:bg-red-700 hover:scale-105 active:scale-95"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={captureImage}
                              disabled={!isFaceInFrame}
                              className={`px-8 py-4 md:px-12 md:py-5 rounded-full text-xs md:text-sm font-black uppercase tracking-widest shadow-2xl transition-all ${isFaceInFrame ? 'bg-white text-black scale-105 md:scale-110 shadow-white/30 hover:scale-[1.15] active:scale-95' : 'bg-gray-800 text-gray-400 opacity-60 cursor-not-allowed'}`}
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
                            className={`w-full h-full object-cover ${isFaceProcessing ? 'opacity-50 grayscale' : ''}`}
                          />
                          {isFaceProcessing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-[8px] text-white font-bold mt-2 uppercase tracking-tight">Scanning...</span>
                            </div>
                          )}
                          {!isFaceProcessing && faceDescriptor && (
                            <div className="absolute top-2 left-2 bg-green-500 rounded-full p-1 shadow-lg border border-white">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={isProfileLocked || isFaceProcessing}
                            onClick={() => {
                              setCapturedImage(null);
                              setFaceDescriptor(null);
                              setFaceError(null);
                              startCamera();
                            }}
                            className="absolute bottom-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors disabled:opacity-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {!isFaceProcessing && faceDescriptor && (
                        <p className="text-center text-[9px] text-green-600 font-black uppercase mt-2 tracking-widest flex items-center justify-center gap-1">
                          <span className="w-1 h-1 bg-green-600 rounded-full"></span>
                          Image Successfully captured
                          <span className="w-1 h-1 bg-green-600 rounded-full"></span>
                        </p>
                      )}
                      {faceError && (
                        <p className="text-center text-[10px] text-red-600 font-bold uppercase mt-2">{faceError}</p>
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

            {/* If formBuilderConfig is empty, show a dynamic progress bar */}
            {formBuilderConfig.length === 0 && (
              <div className="py-12 w-full max-w-md mx-auto px-4 flex flex-col items-center justify-center animate-in fade-in duration-500">
                <div className="w-full flex justify-between items-end mb-2">
                  <p className="text-xs font-black text-indigo-900 uppercase tracking-widest animate-pulse">Form configuration is loading...</p>
                  <span className="text-sm font-black text-blue-600 tabular-nums">{loadingProgress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)] relative overflow-hidden"
                    style={{ width: `${loadingProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] -skew-x-12 translate-x-[-100%]"></div>
                  </div>
                </div>
              </div>
            )}


            {Object.keys(errors).length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                {errors.submit ? (
                  <p className="text-sm text-red-800 font-bold text-center">⚠️ {errors.submit}</p>
                ) : Object.keys(errors).some(k => k.startsWith('server_')) ? (
                  <div className="flex flex-col gap-1 items-center text-center">
                    <p className="text-sm text-red-800 font-bold">⚠️ Server Validation Errors:</p>
                    {Object.entries(errors).filter(([k]) => k.startsWith('server_')).map(([id, msg]) => (
                      <p key={id} className="text-xs text-red-700 font-medium">{msg}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-red-800 font-bold text-center">⚠️ Please fill all required fields, mentioned in red color.</p>
                )}
              </div>
            )}
            {formBuilderConfig.length > 0 && (
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
                    disabled={loading || isFaceProcessing}
                    className="flex-[2] h-12 rounded-lg bg-blue-600 text-background font-medium transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Saving..." : isFaceProcessing ? "Scanning Face..." : "Save your details"}
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

