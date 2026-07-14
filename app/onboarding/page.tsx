"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";

import { useRef } from "react";
import * as faceMatching from "@/lib/faceMatching";

// Global flag to track if warmup is done so we don't do it twice
let globalIsAIWarmedUp = false;
let warmupPromise: Promise<void> | null = null;

const loadAIModels = async () => {
    if (globalIsAIWarmedUp) return;
    if (warmupPromise) return warmupPromise;

    warmupPromise = (async () => {
      try {
        console.log("⚡ [AI LOADING] Starting model load...");
        // Download face-api models
        await faceMatching.loadFaceApiModels();
        
        globalIsAIWarmedUp = true;
        console.log("⚡ [AI LOADING] Models loaded successfully!");
      } catch (e) {
        console.error("⚡ [AI LOADING] Failed to load models:", e);
      } finally {
        warmupPromise = null;
      }
    })();
    return warmupPromise;
};

const DEFAULT_UNDERTAKING_TEXT = `I, {name}, S/o / D/o {parent}, student of {college} (Email: {email}, Mobile: {phone}), solemnly affirm and declare that:
1. I will abide by the hostel/institute rules and will maintain proper discipline.
2. I will not indulge in any act of indiscipline and will not damage any hostel/institute property.
3. I will not use any motorized vehicle within the campus during my study.
4. I will not indulge in ragging directly or indirectly.
5. I shall abide by any other guidelines notified by the Institute/hostel authorities.
6. In case of violation of rules by me, I shall abide by the decision taken by the Institute/hostel authorities.`;

export default function OnboardingPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
  const [isCapturingDescriptor, setIsCapturingDescriptor] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isFaceProcessing, setIsFaceProcessing] = useState(false);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSavingDB, setIsSavingDB] = useState(false);

  const [faceError, setFaceError] = useState<string | null>(null);
  const [isFaceInFrame, setIsFaceInFrame] = useState(false);
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string }>>([]);
  const [hostelsLoading, setHostelsLoading] = useState(true);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const [isExistingStudent, setIsExistingStudent] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});
  const [formBuilderConfig, setFormBuilderConfig] = useState<any[]>([]);
  const [tempConfig, setTempConfig] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [agreeUndertaking, setAgreeUndertaking] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // Multi-step wizard step index
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});



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



  // Smooth progress bar animation
  useEffect(() => {
    // If form is already showing, do nothing
    if (formBuilderConfig.length > 0) return;

    if (tempConfig.length > 0) {
      // Data loaded, accelerate to 100% ONLY if AI is warmed up
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          let next = prev + 8;
          
          if (next >= 100) {
            // Wait for CSS transition to finish before showing the form
            setTimeout(() => {
              setFormBuilderConfig(tempConfig);
            }, 400);
            clearInterval(interval);
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
          const response = await fetch(`/api/students?email=${encodeURIComponent(currentUser.email || "")}&supabaseId=${currentUser.id}`);
          const data = await response.json();
          if (data.student) {
            setIsExistingStudent(true);
            setFormData({
              ...(data.student.dynamicFields || {}),
              ...data.student,
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
                ...(data.student.dynamicFields || {}),
                ...data.student,
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

    if (formConfig.requireUndertaking && !agreeUndertaking) {
      newErrors["undertaking"] = "You must accept the undertaking to proceed";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBack = async () => {
    if (isExistingStudent) {
      router.push("/");
      return;
    }

    try {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("Supabase sign out error:", e);
      }
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (e) {
        console.warn("Firebase sign out error:", e);
      }
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
      setErrors({});

      // 1. Send OTP
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phoneNumber: formData.phoneNumber,
          firebaseUID: user?.uid,
          email: user?.email
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ submit: data.error || "Failed to send OTP. Please check your number." });
        setLoading(false);
        return;
      }

      // Show OTP Modal
      setShowOtpModal(true);
      setLoading(false);
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      setErrors({ submit: "Failed to connect to server. Please try again." });
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setOtpError("Please enter the OTP");
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError("");

      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formData.phoneNumber, otp }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setOtpError(verifyData.error || "Invalid OTP");
        setOtpLoading(false);
        return;
      }

      // OTP Verified! Now save to DB.
      setShowOtpModal(false);
      await saveToDatabase();

    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      setOtpError("Failed to verify OTP. Please try again.");
      setOtpLoading(false);
    }
  };

  const saveToDatabase = async () => {
    try {
      setIsSavingDB(true);
      const currentDeviceId = "no-binding";

      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firebaseUID: user?.uid,
          supabase_id: user?.source === 'supabase' ? user.uid : undefined,
          name: formData.name,
          email: user?.email || "",
          phoneNumber: formData.phoneNumber,
          erpInformation: formData.erpInformation,
          hostelName: formData.hostelName,
          joiningDate: formData.joiningDate,
          roomNumber: formData.roomNumber,
          profilePicture: capturedImage || user?.photoURL || "",
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
          floorNumber: formData.floorNumber,
          localGuardianAddress: formData.localGuardianAddress,
          localGuardianPhoneNumber: formData.localGuardianPhoneNumber,
          dob: formData.dob,
          category: formData.category,
          deviceId: currentDeviceId,
          faceDescriptor: faceDescriptor ? Array.from(faceDescriptor) : undefined,
          dynamicFields: Object.keys(formData).reduce((acc: any, key) => {
            const coreKeys = [
              'firebaseUID', 'supabase_id', 'name', 'email', 'phoneNumber',
              'erpInformation', 'hostelName', 'joiningDate', 'roomNumber',
              'profilePicture', 'fatherName', 'fatherNumber', 'motherName',
              'motherNumber', 'homePinCode', 'homeState', 'branch',
              'collegeName', 'year', 'semester', 'section', 'floorNumber',
              'localGuardianAddress', 'localGuardianPhoneNumber', 'dob',
              'category', 'deviceId', 'faceDescriptor', 'id', '_id',
              'createdAt', 'updatedAt', 'studentStatus', 'registrationId'
            ];
            if (!coreKeys.includes(key)) {
              acc[key] = (formData as any)[key];
            }
            return acc;
          }, {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error: any = new Error(data.error || "Failed to save data");
        error.details = data.details;
        throw error;
      }

      // Premium Success Transition
      setIsSuccess(true);
      if (data.student) {
        localStorage.setItem("cachedStudentData", JSON.stringify(data.student));
      }
      setTimeout(() => {
        localStorage.setItem("userType", "student");
        window.location.href = "/"; // Force hard redirect
      }, 1500);

    } catch (error: any) {
      console.error("Error saving student data:", error);

      if (error.details && Array.isArray(error.details)) {
        const newErrors: Record<string, string> = {};
        error.details.forEach((detail: string, index: number) => {
          newErrors[`server_${index}`] = detail;
        });
        setErrors(newErrors);
      } else {
        setErrors({ submit: error.message || "Failed to save data. Please try again." });
      }
      setIsSavingDB(false);
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

      setIsCameraStarting(true);

      // Yield to let React render the "Starting AI Camera..." spinner
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. Get camera permission and stream FIRST
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
      });

      // 2. Open camera UI instantly
      setIsCameraOpen(true);
      setIsCameraStarting(false);
      
      // 3. Attach stream to the newly rendered video tag
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);

      // ⚡ PRE-LOAD: Load AI models in the background without blocking the UI/camera stream
      loadAIModels().catch(console.error);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please allow camera permissions and ensure you're using HTTPS.");
      setIsCameraOpen(false);
      setIsCameraStarting(false);
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

    if (isCameraOpen && videoRef.current) {
      let isDetecting = false; // Prevent overlapping heavy AI inferences

      interval = setInterval(async () => {
        if (isDetecting) return; // Wait for current AI detection to finish before starting a new one
        if (videoRef.current && videoRef.current.readyState === 4) {
          isDetecting = true;
          try {
            const res = await faceMatching.detectFace(videoRef.current, false, false);

            if (!res) {
              setIsFaceInFrame(false);
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

            setIsFaceInFrame(true);

          } finally {
            isDetecting = false; // Release lock
          }
        }
      }, 150); 
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
        // We pass the static dataUrl string to avoid mobile Safari/Chrome resetting the DOM canvas
        processFaceInBackground(dataUrl);
      }
    }
  };

  const processFaceInBackground = async (dataUrl: string) => {
    try {
      setIsFaceProcessing(true);
      setFaceDescriptor(null); // Clear previous

      // 1. Yield to let React render the "Scanning..." state
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. Load the static image into memory to bypass DOM canvas lifecycle limitations on mobile
      const img = await faceMatching.loadImage(dataUrl);

      // 3. Downscale the image while preserving the exact aspect ratio
      const maxDim = 320;
      let aiWidth = img.width;
      let aiHeight = img.height;
      if (aiWidth > maxDim || aiHeight > maxDim) {
        if (aiWidth > aiHeight) {
          aiHeight = Math.round((aiHeight / aiWidth) * maxDim);
          aiWidth = maxDim;
        } else {
          aiWidth = Math.round((aiWidth / aiHeight) * maxDim);
          aiHeight = maxDim;
        }
      }

      const aiCanvas = document.createElement("canvas");
      aiCanvas.width = aiWidth;
      aiCanvas.height = aiHeight;
      const ctx = aiCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, aiWidth, aiHeight);
      } else {
        throw new Error("Could not downscale photo for verification");
      }

      // Ensure models are loaded
      await loadAIModels();
      await new Promise(resolve => setTimeout(resolve, 100)); // Yield to event loop

      // 4. Run face descriptor generation on downscaled canvas
      const descriptor = await faceMatching.detectFace(aiCanvas);
      await new Promise(resolve => setTimeout(resolve, 100)); // Yield to event loop

      if (!descriptor) {
        setFaceError("No face detected! Please capture again.");
        setCapturedImage(null); // Force retake
        return;
      }

      if (descriptor.multipleFacesDetected) {
        setFaceError("Multiple faces detected! Please ensure ONLY YOU are in the frame.");
        setCapturedImage(null); // Force retake
        return;
      }

      setFaceDescriptor(descriptor.descriptor);
      console.log("✅ Background Face Scan Complete");
    } catch (err) {
      console.error("Error generating face descriptor:", err);
      setFaceError("Face processing failed. Try again with better lighting.");
      setCapturedImage(null);
    } finally {
      setIsFaceProcessing(false);
    }
  };

  const formatUndertakingText = (text: string) => {
    if (!text) return null;

    // Infer S/o or D/o relation
    let parentRelation = "S/o / D/o";
    
    // 1. Check by field label in formBuilderConfig
    const genderField = formBuilderConfig.find(f => {
      const label = String(f.label || "").toLowerCase().trim();
      return label === 'gender' || label === 'sex';
    });
    
    let genderValue = "";
    if (genderField) {
      genderValue = String(formData[genderField.id] || "").toLowerCase().trim();
    } else {
      // Fallback: Check if there's a literal key like "gender" or "sex" in formData
      const literalKey = Object.keys(formData).find(k => k.toLowerCase() === 'gender' || k.toLowerCase() === 'sex');
      if (literalKey) {
        genderValue = String(formData[literalKey] || "").toLowerCase().trim();
      }
    }
    
    if (genderValue) {
      if (genderValue.startsWith('f') || genderValue.includes('girl') || genderValue.includes('woman') || genderValue === 'female') {
        parentRelation = "D/o";
      } else if (genderValue.startsWith('m') || genderValue.includes('boy') || genderValue.includes('man') || genderValue === 'male') {
        parentRelation = "S/o";
      }
    } else {
      // 2. Check hostel name if gender field doesn't exist
      const hostel = String(formData.hostelName || "").toLowerCase();
      if (
        hostel.includes('girls') || 
        hostel.includes('girl') || 
        hostel.includes('female') || 
        hostel.includes('women') || 
        hostel.includes('ghb') ||
        hostel.startsWith('gh')
      ) {
        parentRelation = "D/o";
      } else if (
        hostel.includes('boys') || 
        hostel.includes('boy') || 
        hostel.includes('male') ||
        hostel.startsWith('bh')
      ) {
        parentRelation = "S/o";
      }
    }

    const placeholderRegex = /({name}|{parent}|{college}|{email}|{phone})/g;
    const parts = text.split(placeholderRegex);
    return parts.map((part, index) => {
      if (part === "{name}") {
        return <span key={index} className="text-blue-700 font-extrabold underline decoration-blue-300 decoration-2 underline-offset-2">{formData.name || "____________________"}</span>;
      }
      if (part === "{parent}") {
        return <span key={index} className="text-blue-700 font-extrabold underline decoration-blue-300 decoration-2 underline-offset-2">{formData.fatherName || "____________________"}</span>;
      }
      if (part === "{college}") {
        return <span key={index} className="text-blue-700 font-extrabold underline decoration-blue-300 decoration-2 underline-offset-2">{formData.collegeName || "____________________"}</span>;
      }
      if (part === "{email}") {
        return <span key={index} className="text-blue-700 font-extrabold">{formData.email || user?.email || "____________________"}</span>;
      }
      if (part === "{phone}") {
        return <span key={index} className="text-blue-700 font-extrabold">{formData.phoneNumber || "____________________"}</span>;
      }
      
      // For regular text parts, dynamically replace S/o / D/o based on gender inference
      let formattedPart = part;
      formattedPart = formattedPart.replace(/S\/o\s*\/\s*D\/o/gi, parentRelation);
      formattedPart = formattedPart.replace(/S\/O\s*or\s*D\/O/gi, parentRelation);
      formattedPart = formattedPart.replace(/S\/o\s*or\s*D\/o/gi, parentRelation);
      return formattedPart;
    });
  };

  const checkFieldUniqueness = async (fieldId: string, value: string) => {
    const val = value.trim();
    if (!val) {
      setDuplicateWarnings(prev => {
        const updated = { ...prev };
        delete updated[fieldId];
        return updated;
      });
      return;
    }

    let checkField = "";
    if (fieldId === "phoneNumber") checkField = "phoneNumber";
    if (fieldId === "email") checkField = "email";
    if (fieldId === "erpInformation") checkField = "erpInformation";

    if (!checkField) return;

    // Length pre-validations
    if (fieldId === "phoneNumber" && val.length < 10) return;
    if (fieldId === "email" && !val.includes("@")) return;
    if (fieldId === "erpInformation" && val.length < 3) return;

    try {
      const res = await fetch(`/api/students?checkValue=${encodeURIComponent(val)}&checkField=${checkField}`);
      const data = await res.json();
      if (res.ok && data.exists) {
        setDuplicateWarnings(prev => ({
          ...prev,
          [fieldId]: `⚠️ Already registered to student "${data.studentName || 'unnamed'}"`
        }));
      } else {
        setDuplicateWarnings(prev => {
          const updated = { ...prev };
          delete updated[fieldId];
          return updated;
        });
      }
    } catch (err) {
      console.warn("Failed to check duplicate:", err);
    }
  };

  const handleChange = (field: string, value: string) => {
    let formattedValue = value;
    const lowerId = String(field || "").toLowerCase();
    
    // ⚡ REAL-TIME TYPING RESTRICTIONS
    const fieldConfig = formBuilderConfig.find(f => f.id === field);
    if (fieldConfig) {
      const isPhone = 
        fieldConfig.type === "tel" || 
        lowerId.includes("phone") || 
        lowerId.includes("mobile") ||
        ["phonenumber", "fathernumber", "mothernumber", "localguardianphonenumber"].includes(lowerId);

      if (isPhone) {
        // Allow only digits in phone number fields
        formattedValue = value.replace(/\D/g, "");
      } else if (fieldConfig.type === "text" && lowerId.includes("name")) {
        // Prevent numbers inside name fields
        formattedValue = value.replace(/[0-9]/g, "");
      }
    }

    // Automatically convert to uppercase except for email and joiningDate
    if (field !== "email" && field !== "joiningDate") {
      formattedValue = formattedValue.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    if (field === "phoneNumber" || field === "email" || field === "erpInformation") {
      checkFieldUniqueness(field, formattedValue);
    }
    
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (stepErrors[field]) {
      setStepErrors((prev) => ({ ...prev, [field]: "" }));
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
              <h1 className="text-base font-semibold text-foreground">Welcome to Hosteleaze</h1>
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

            {/* ===== MULTI-STEP WIZARD ===== */}
            {formBuilderConfig.length > 0 && (() => {
              // Group visible fields by section
              const visibleFields = formBuilderConfig.filter((f: any) => f.visible);
              const sectionNames = Array.from(new Set(visibleFields.map((f: any) => f.section || 'General'))) as string[];
              // Add final "Review & Submit" step
              const allSteps = [...sectionNames, '__submit__'];
              const totalSteps = allSteps.length;
              const currentSection = allSteps[currentStep];
              const isLastStep = currentStep === totalSteps - 1;
              const progressPercent = Math.round((currentStep / (totalSteps - 1)) * 100);

              const validateStep = () => {
                const stepFields = visibleFields.filter((f: any) => (f.section || 'General') === currentSection);
                const newErrors: Record<string, string> = {};
                stepFields.forEach((field: any) => {
                  const val = field.type === 'image' ? (capturedImage || '') : (formData[field.id] || '');
                  // 1. Required check
                  if (field.required && !val) {
                    newErrors[field.id] = `${field.label} is required`;
                    return;
                  }
                  // 2. Validation rules (only if there's a value)
                  if (val) {
                    if (duplicateWarnings[field.id]) {
                      newErrors[field.id] = duplicateWarnings[field.id];
                      return;
                    }

                    const lowerId = String(field.id || "").toLowerCase();
                    
                    // Name fields check: Names should not contain numbers
                    if (field.type === "text" && lowerId.includes("name") && /[0-9]/.test(val)) {
                      newErrors[field.id] = "Name should not contain numbers";
                      return;
                    }

                    const v = { ...field.validation };
                    // Auto fallbacks for older configurations without validation settings
                    if (!field.validation) {
                      const lowerId = String(field.id || "").toLowerCase();
                      const isPhoneField = 
                        field.type === "tel" || 
                        lowerId.includes("phone") || 
                        lowerId.includes("mobile") ||
                        lowerId.includes("contact") ||
                        ["phonenumber", "fathernumber", "mothernumber", "localguardianphonenumber"].includes(lowerId);

                      if (isPhoneField) {
                        v.pattern = "^[6-9][0-9]{9}$";
                        v.patternMessage = "Please enter a valid 10-digit mobile number";
                      } else if (field.type === "email" || lowerId === "email") {
                        v.pattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
                        v.patternMessage = "Please enter a valid email address";
                      } else if (field.type === "text" && lowerId.includes("name")) {
                        v.minLength = 3;
                        v.patternMessage = "Minimum 3 characters required";
                      }
                    }

                    if (v.minLength && val.length < v.minLength) {
                      newErrors[field.id] = v.patternMessage || `Minimum ${v.minLength} characters required`;
                      return;
                    }
                    if (v.maxLength && val.length > v.maxLength) {
                      newErrors[field.id] = `Maximum ${v.maxLength} characters allowed`;
                      return;
                    }
                    if (v.pattern) {
                      try {
                        const re = new RegExp(v.pattern);
                        // For phone/tel fields, strip spaces before testing
                        const testVal = (field.type === "tel" || (v.patternMessage && v.patternMessage.includes("10-digit")))
                          ? val.replace(/\s/g, "")
                          : val;
                        console.log("VALIDATION DEBUG:", { id: field.id, label: field.label, type: field.type, val, testVal, pattern: v.pattern, regex: re.toString(), matches: re.test(testVal) });
                        if (!re.test(testVal)) {
                          newErrors[field.id] = v.patternMessage || `Invalid format`;
                          return;
                        }
                      } catch (err) { console.error("Regex build error:", err); }
                    }
                  }
                });
                // Special: photo step
                if (stepFields.some((f: any) => f.type === 'image') && !capturedImage) {
                  const imgField = stepFields.find((f: any) => f.type === 'image');
                  if (imgField?.required) newErrors[imgField.id] = 'Profile photo is required';
                }
                setStepErrors(newErrors);
                return Object.keys(newErrors).length === 0;
              };


              const goNext = () => {
                if (validateStep()) {
                  setCurrentStep(s => Math.min(s + 1, totalSteps - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              };
              const goBack = () => {
                setCurrentStep(s => Math.max(s - 1, 0));
                setStepErrors({});
                window.scrollTo({ top: 0, behavior: 'smooth' });
              };

              const renderField = (field: any) => (
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
                          disabled={isProfileLocked || isCameraStarting}
                          className="w-full py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isCameraStarting ? (
                            <>
                              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="font-bold">Opening Camera...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Capture Profile Photo
                            </>
                          )}
                        </button>
                      )}

                      {isCameraOpen && (
                        <div className="relative w-full max-w-sm mx-auto aspect-[4/5] rounded-[32px] overflow-hidden shadow-2xl bg-black border border-gray-200">
                          {/* Live Status HUD */}
                          <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-2 z-20">
                            <div className={`px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl transition-all border-2 ${isFaceInFrame ? 'bg-green-500 border-green-400 text-white' : 'bg-red-600 border-red-400 text-white animate-pulse'}`}>
                              <span className={`w-2 h-2 rounded-full ${isFaceInFrame ? 'bg-white' : 'bg-white/80 animate-ping'}`}></span>
                              {isFaceInFrame ? 'Face Detected' : 'Action Required'}
                            </div>
                            
                            {!isFaceInFrame && (
                              <div className="bg-black/70 backdrop-blur-md text-white px-3 py-1.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-center shadow-xl border border-white/20 mt-1 md:mt-2 mx-4 animate-bounce">
                                <p className="text-[10px] md:text-base font-black uppercase tracking-wide text-blue-400">
                                  Position Face in Frame 👤
                                </p>
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
                          <div className="absolute bottom-6 left-0 right-0 flex flex-row items-center justify-center gap-3 z-20 px-4">
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-6 py-3 rounded-2xl bg-white/10 backdrop-blur-md text-white border border-white/20 text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all hover:bg-white/20 active:scale-95"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={captureImage}
                              disabled={!isFaceInFrame}
                              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all ${isFaceInFrame ? 'bg-white text-blue-600 shadow-white/30 hover:scale-105 active:scale-95' : 'bg-gray-800 text-gray-500 opacity-80 cursor-not-allowed'}`}
                            >
                              Capture
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
                    <div className="w-full space-y-1 text-left">
                      <textarea
                        id={field.id}
                        value={(formData as any)[field.id] || ""}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.label.toLowerCase().includes("address") ? "e.g. village xyz, post khdure, thana hghjds, mp pin 485001" : `Enter ${field.label.toLowerCase()}`}
                        disabled={isProfileLocked}
                        className={`w-full p-4 rounded-xl border-2 transition-all font-bold text-xs uppercase min-h-[80px] ${errors[field.id] ? "border-red-500 bg-red-50 font-medium" : "border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:bg-white"} outline-none`}
                      />
                      {field.label.toLowerCase().includes("address") && (() => {
                        const addressVal = (formData as any)[field.id] || "";
                        const pinMatch = addressVal.match(/\b\d{6}\b/);
                        return pinMatch ? (
                          <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider pl-1 flex items-center gap-1 mt-0.5">
                            <span>✅ PIN Code Detected:</span>
                            <span className="font-mono bg-green-50 px-1.5 py-0.5 rounded border border-green-200">{pinMatch[0]}</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider pl-1 flex items-center gap-1 mt-0.5 animate-pulse">
                            <span>⚠️ Missing 6-digit PIN Code in address (e.g. 485001)</span>
                          </p>
                        );
                      })()}
                      {field.label.toLowerCase().includes("address") && (
                        <div className="mt-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                          <p className="text-slate-400 text-[8px] font-black">💡 Click template to populate format:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            <div 
                              onClick={() => handleChange(field.id, "Rahul Sharma\nFlat 402, Alpine Apartments\n12th Main Road, Indiranagar\nBengaluru, Karnataka\nPIN: 560038")}
                              className="p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all text-left"
                            >
                              <span className="text-blue-600 block text-[7.5px] font-black mb-1">🏙️ City Format</span>
                              <span className="normal-case text-[9.5px] font-bold text-slate-600 whitespace-pre-line leading-relaxed block">
                                Rahul Sharma{"\n"}Flat 402, Alpine Apartments{"\n"}12th Main Road, Indiranagar{"\n"}Bengaluru, Karnataka{"\n"}PIN: 560038
                              </span>
                            </div>
                            <div 
                              onClick={() => handleChange(field.id, "Devendra Singh\nVillage Rampur, Post Office Kolar\nNear Government Primary School\nTehsil Huzur, Bhopal\nMadhya Pradesh, PIN: 462042")}
                              className="p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/20 transition-all text-left"
                            >
                              <span className="text-emerald-600 block text-[7.5px] font-black mb-1">🏡 Village Format</span>
                              <span className="normal-case text-[9.5px] font-bold text-slate-600 whitespace-pre-line leading-relaxed block">
                                Devendra Singh{"\n"}Village Rampur, Post Office Kolar{"\n"}Near Government Primary School{"\n"}Tehsil Huzur, Bhopal{"\n"}Madhya Pradesh, PIN: 462042
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type={field.type}
                      id={field.id}
                      value={(formData as any)[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      onBlur={(e) => {
                        if (field.id === "phoneNumber" || field.id === "email" || field.id === "erpInformation") {
                          checkFieldUniqueness(field.id, e.target.value);
                        }
                      }}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      disabled={isProfileLocked}
                      className={`w-full h-11 px-4 rounded-xl border-2 transition-all font-bold text-xs uppercase ${
                        duplicateWarnings[field.id] 
                          ? "border-red-500 bg-red-50 focus:border-red-600 focus:bg-red-50/10 text-red-900" 
                          : errors[field.id]
                            ? "border-red-500 bg-red-50 font-medium"
                            : "border-gray-100 bg-gray-50/50 focus:border-blue-500 focus:bg-white"
                      } outline-none`}
                    />
                  )}
                  {(stepErrors[field.id] || errors[field.id] || duplicateWarnings[field.id]) && (
                    <p className="mt-1 text-[10px] text-red-600 font-black uppercase tracking-widest">
                      {duplicateWarnings[field.id] || stepErrors[field.id] || errors[field.id]}
                    </p>
                  )}
                </div>
              );

              return (
                <div className="space-y-5">
                  {/* ── PROGRESS BAR ── */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Step {currentStep + 1} of {totalSteps}</span>
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{isLastStep ? '📋 Review & Submit' : currentSection}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="flex items-center gap-1 justify-center flex-wrap">
                      {allSteps.map((_s: any, i: number) => (
                        <div key={i} className={`transition-all duration-300 rounded-full ${i === currentStep ? 'w-5 h-2 bg-blue-600' : i < currentStep ? 'w-2 h-2 bg-blue-300' : 'w-2 h-2 bg-gray-200'}`}></div>
                      ))}
                    </div>
                  </div>

                  {/* ── STEP HEADER ── */}
                  {!isLastStep && (
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                      <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-black text-blue-600">{currentStep + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{currentSection}</p>
                        <p className="text-[9px] text-gray-400 font-medium">
                          {visibleFields.filter((f: any) => (f.section || 'General') === currentSection).length} fields
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── STEP FIELDS ── */}
                  {!isLastStep ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {visibleFields.filter((f: any) => (f.section || 'General') === currentSection).map((field: any) => renderField(field))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                        <p className="text-xs font-black text-green-800 uppercase tracking-widest mb-3">✅ Review Summary</p>
                        <div className="grid grid-cols-2 gap-2">
                          {visibleFields.filter((f: any) => f.type !== 'image').slice(0, 8).map((f: any) => (
                            <div key={f.id} className="min-w-0">
                              <p className="text-[8px] text-gray-400 uppercase tracking-widest truncate">{f.label}</p>
                              <p className="text-[10px] font-black text-gray-800 truncate">{formData[f.id] || '—'}</p>
                            </div>
                          ))}
                        </div>
                        {capturedImage && (
                          <div className="mt-3 flex items-center gap-2">
                            <img src={capturedImage} className="w-10 h-12 rounded-lg object-cover border-2 border-white shadow" alt="profile" />
                            <div>
                              <p className="text-[8px] text-gray-400 uppercase tracking-widest">Profile Photo</p>
                              <p className="text-[10px] font-black text-green-700">✅ Captured</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {formConfig.requireUndertaking && (
                        <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 border-2 border-indigo-100/80 space-y-3.5">
                          <div className="flex items-center gap-2"><span className="text-lg">📜</span><h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Undertaking by Student</h3></div>
                          <div className="text-[11px] text-indigo-950 font-bold leading-relaxed max-h-[220px] overflow-y-auto pr-1 select-none">
                            <p className="whitespace-pre-line text-left">{formatUndertakingText(formConfig.undertakingText || DEFAULT_UNDERTAKING_TEXT)}</p>
                          </div>
                          <div className="pt-2.5 border-t border-indigo-100 flex items-start gap-2.5">
                            <input type="checkbox" id="undertaking-agreement" checked={agreeUndertaking}
                              onChange={(e) => { setAgreeUndertaking(e.target.checked); if (errors["undertaking"]) setErrors(prev => ({ ...prev, undertaking: "" })); }}
                              className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 cursor-pointer" />
                            <label htmlFor="undertaking-agreement" className="text-[10px] font-black text-indigo-900 uppercase tracking-wide cursor-pointer select-none leading-tight">
                              I solemnly agree to all the undertaking points mentioned above <span className="text-red-500">*</span>
                            </label>
                          </div>
                          {errors["undertaking"] && (<p className="text-[9px] text-red-600 font-black uppercase tracking-widest animate-pulse">⚠️ {errors["undertaking"]}</p>)}
                        </div>
                      )}

                      {Object.keys(errors).length > 0 && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                          {errors.submit ? (<p className="text-sm text-red-800 font-bold text-center">⚠️ {errors.submit}</p>) : (<p className="text-sm text-red-800 font-bold text-center">⚠️ Please fill all required fields.</p>)}
                        </div>
                      )}

                      {isSuccess && (
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 animate-in fade-in duration-300">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <div>
                            <p className="text-xs font-black text-green-800 uppercase tracking-tight">Success</p>
                            <p className="text-[11px] text-green-600 font-medium">{isExistingStudent ? "Your profile updated successfully" : "Congratulations! Your profile has been generated successfully."}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── NAVIGATION ── */}
                  <div className="flex gap-3 mt-4">
                    {currentStep > 0 ? (
                      <button type="button" onClick={goBack}
                        className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all">← Back</button>
                    ) : (
                      <button type="button" onClick={handleBack}
                        className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-all">Cancel</button>
                    )}
                    {!isLastStep ? (
                      <button type="button" onClick={goNext}
                        className="flex-[2] h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-500/20">Next →</button>
                    ) : !isProfileLocked && (
                      <button type="submit" disabled={loading || isSavingDB || isFaceProcessing || isSuccess}
                        className={`flex-[2] h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${isSuccess ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        {isSuccess ? (isExistingStudent ? '✅ Updated!' : '✅ Registered!') : isSavingDB ? 'Verifying...' : loading ? 'Sending OTP...' : isFaceProcessing ? 'Scanning Face...' : '🚀 Submit Registration'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── LOADING STATE ── */}
            {formBuilderConfig.length === 0 && (
              <div className="py-12 w-full max-w-md mx-auto px-4 flex flex-col items-center justify-center animate-in fade-in duration-500">
                <div className="w-full flex justify-between items-end mb-2">
                  <p className="text-xs font-black text-indigo-900 uppercase tracking-widest animate-pulse">Form configuration is loading...</p>
                  <span className="text-sm font-black text-blue-600 tabular-nums">{Math.min(100, loadingProgress)}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.min(100, loadingProgress)}%` }}></div>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-blue-600 p-6 text-center">
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">Verify Mobile</h2>
              <p className="text-blue-100 text-sm mt-2 font-medium">OTP sent to {formData.phoneNumber}</p>
            </div>
            
            <form onSubmit={handleVerifyOtp} className="p-6 md:p-8 space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 text-center">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  className="w-full text-center text-3xl font-bold tracking-[0.5em] py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:tracking-normal text-gray-800"
                  autoFocus
                />
                {otpError && (
                  <p className="text-sm text-red-500 font-bold mt-3 text-center animate-pulse">{otpError}</p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={otpLoading || otp.length < 4}
                  className="flex-[2] py-3 px-4 rounded-xl font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-600/20"
                >
                  {otpLoading ? "VERIFYING..." : "VERIFY OTP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

