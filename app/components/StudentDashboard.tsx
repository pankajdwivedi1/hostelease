"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Barcode from "react-barcode";
import * as faceMatching from "@/lib/faceMatching";

interface Permission {
  _id: string;
  fromDateTime: string | Date;
  toDateTime: string | Date;
  reason: string;
  status: "pending" | "allowed" | "rejected";
  wardenStatus: "pending" | "allowed" | "rejected";
  deanStatus: "pending" | "allowed" | "rejected";
}

interface StudentProfile {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  hostelName: string;
  roomNumber: string;
  profilePicture?: string;
  studentStatus?: "in" | "out";
  fatherName?: string;
  fatherNumber?: string;
  motherName?: string;
  motherNumber?: string;
  homePinCode?: string;
  erpInformation?: string;
  joiningDate?: string;
  branch?: string;
  collegeName?: string;
  year?: string;
  semester?: string;
  localGuardianPhoneNumber?: string;
  localGuardianAddress?: string;
  section?: string;
  homeState?: string;
  deviceId?: string;
  registrationId?: string;
  dob?: string;
  category?: string;
  faceDescriptor?: number[]; // ⚡ NEW: Stores face embedding
  firebaseUID?: string;
  dynamicFields?: Record<string, any>;
}

interface DBNotification {
  _id: string;
  message: string;
  image?: string;
  priority: "normal" | "urgent" | "critical";
  expiresAt?: string;
  createdAt: string;
}

export default function StudentDashboard({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPermissionsHistory, setShowPermissionsHistory] = useState(false);
  const [showDeviceRegistration, setShowDeviceRegistration] = useState(false);
  const [fromDateTime, setFromDateTime] = useState("");
  const [toDateTime, setToDateTime] = useState("");
  const [reason, setReason] = useState("");
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(initialData || null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(!initialData);
  const [submitting, setSubmitting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isAtHostel, setIsAtHostel] = useState(false);
  const [isLocationChecking, setIsLocationChecking] = useState(false);
  const [isRegisteringDevice, setIsRegisteringDevice] = useState(false);
  const [isAttendanceMarked, setIsAttendanceMarked] = useState(false);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [attendanceWindow, setAttendanceWindow] = useState({ start: "21:00", end: "23:00" });
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<DBNotification | null>(null);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [sessionDismissedIds, setSessionDismissedIds] = useState<string[]>([]);
  const [locationVerificationResults, setLocationVerificationResults] = useState<{
    name: string;
    distance: number;
    isVerified: boolean;
    radius: number;
    lat: number;
    lng: number;
  }[]>([]);
  const [lastCheckAccuracy, setLastCheckAccuracy] = useState<number | null>(null);
  const [showMandatoryUpdate, setShowMandatoryUpdate] = useState(false);
  const [mandatoryFormData, setMandatoryFormData] = useState({ dob: "", category: "", homeState: "", section: "" });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [formBuilderConfig, setFormBuilderConfig] = useState<any[]>([]);
  const [attendanceStep, setAttendanceStep] = useState<'idle' | 'gps' | 'accuracy' | 'saving' | 'done' | 'error' | 'face-match'>('idle');
  const [attendanceRetryCount, setAttendanceRetryCount] = useState(0);

  // Face Matching State
  const [faceMatchProgress, setFaceMatchProgress] = useState(0);
  const [faceMatchResult, setFaceMatchResult] = useState<{
    percentage: number;
    status: 'auto-approved' | 'flagged' | 'manual-override';
    photoBlob?: Blob;
  } | null>(null);
  const [isFaceMatching, setIsFaceMatching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceMatchStep, setFaceMatchStep] = useState<'idle' | 'loading-models' | 'detecting' | 'matching' | 'success' | 'flagged' | 'error'>('idle');
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const consecutiveFailuresRef = useRef<number>(0);

  const [livenessFeedback, setLivenessFeedback] = useState<string>("");
  const [yawRange, setYawRange] = useState(0);
  const [depthRange, setDepthRange] = useState(0); // ⚡ NEW: Tracking Near/Far

  const livenessHistoryRef = useRef<{ boxSizes: number[], yawPoints: number[] }>({
    boxSizes: [],
    yawPoints: []
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (studentProfile) {
      // Preload face-api models when student dashboard is ready
      faceMatching.loadFaceApiModels().then(success => {
        if (success) console.log('Face matching models ready');
      });
    }
  }, [studentProfile]);

  // Automatic Face Detection Loop (Industrial Strength)
  useEffect(() => {
    let active = true;

    if (cameraActive && faceMatchStep === 'detecting' && videoRef.current) {
      console.log("🚀 Starting industrial auto-detection loop...");

      const runDetection = async () => {
        if (!livenessHistoryRef.current) {
          livenessHistoryRef.current = { boxSizes: [], yawPoints: [] };
        }

        if (!active || !videoRef.current || isProcessingRef.current || faceMatchStep !== 'detecting') return;

        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);

            // ⚡ FAIL-SAFE LOGIC: Try Lite first
            const useProForDetection = consecutiveFailuresRef.current > 10;
            if (useProForDetection && consecutiveFailuresRef.current === 11) {
              await faceMatching.loadFaceApiModels(true);
            }

            // ⚡ ANALYZE FRAME
            const res = await faceMatching.detectFace(canvas, false);

            if (res) {
              setFaceDetected(true);
              consecutiveFailuresRef.current = 0;

              // 📐 Update Face Tracking Box
              const { x, y, width, height } = res.detection.box;
              setFaceBox({ x, y, width, height });

              // 🛡️ LIVENESS TRACKING (Anti-Spoofing)
              if (res.landmarks) {
                const live = faceMatching.analyzeLiveness(res.landmarks);
                if (live) {
                  // 1. DEPTH TRACKING (Near/Far)
                  const boxArea = width * height;
                  livenessHistoryRef.current.boxSizes.push(boxArea);
                  if (livenessHistoryRef.current.boxSizes.length > 30) livenessHistoryRef.current.boxSizes.shift();

                  const minBox = Math.min(...livenessHistoryRef.current.boxSizes);
                  const maxBox = Math.max(...livenessHistoryRef.current.boxSizes);
                  const currentDepthRange = minBox > 0 ? (maxBox / minBox) : 1;
                  setDepthRange(currentDepthRange);

                  // 2. MOVEMENT TRACKING (Yaw Rotate)
                  livenessHistoryRef.current.yawPoints.push(live.yaw);
                  if (livenessHistoryRef.current.yawPoints.length > 30) livenessHistoryRef.current.yawPoints.shift();

                  const currentYawRange = Math.max(...livenessHistoryRef.current.yawPoints) - Math.min(...livenessHistoryRef.current.yawPoints);
                  setYawRange(currentYawRange);
                }
              }

              // 🚀 REAL-TIME TRIGGER: 3D Depth + Yaw Required
              // Depth change > 1.25 (25% change) and Yaw Range > 0.18
              if (yawRange > 0.18 && depthRange > 1.25) {
                const boxSize = width * height;
                if (boxSize > (canvas.width * canvas.height * 0.08)) {
                  active = false;
                  isProcessingRef.current = true;
                  setFaceMatchStep('matching');

                  // ⚡ TURBO: Pass the detection result we already have from the loop!
                  const result = await performFaceVerification(res);
                  if (result) {
                    setTimeout(() => {
                      stopCamera();
                      proceedWithAttendance(result);
                    }, 200); // Snappy transition (200ms)
                  } else {
                    setTimeout(() => {
                      active = true;
                      isProcessingRef.current = false;
                      setFaceMatchStep('detecting');
                      livenessHistoryRef.current = { boxSizes: [], yawPoints: [] };
                      setYawRange(0);
                      setDepthRange(1);
                      runDetection();
                    }, 1500); // Quick reset on fail
                  }
                  return;
                }
              }
            } else {
              setFaceDetected(false);
              setFaceBox(null);
              consecutiveFailuresRef.current += 1;
            }
          }
        } catch (err) {
          console.error("Detection error:", err);
        }

        if (active) {
          detectionIntervalRef.current = setTimeout(runDetection, 150) as any; // Fast 150ms loop
        }
      };

      runDetection();
    }

    return () => {
      active = false;
      if (detectionIntervalRef.current) clearTimeout(detectionIntervalRef.current);
    };
  }, [cameraActive, faceMatchStep]);

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) {
        setFormBuilderConfig(data.formBuilderConfig || []);
      }
    } catch (e) {
      console.error("Error fetching system settings:", e);
    }
  };

  const latestPermission = useMemo(() => {
    if (permissions.length === 0) return null;
    // Sort by date (assuming _id also correlates or fromDateTime)
    return [...permissions].sort((a, b) =>
      new Date(b.fromDateTime).getTime() - new Date(a.fromDateTime).getTime()
    )[0];
  }, [permissions]);

  // Payment System State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [bankSettings, setBankSettings] = useState<any>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "qr">("upi");
  const [paymentForm, setPaymentForm] = useState({
    utrNumber: "",
    amount: "",
    paymentSource: "GPay",
    screenshot: ""
  });

  const fetchPaymentData = async () => {
    if (!studentProfile?._id) return;
    try {
      // Fetch History
      const historyRes = await fetch(`/api/students/payments?studentId=${studentProfile._id}`);
      const historyData = await historyRes.json();
      if (historyData.success) setPaymentHistory(historyData.payments);

      // Fetch Bank Details
      const settingsRes = await fetch("/api/admin/settings");
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setBankSettings({
          bank: settingsData.universityBankDetails,
          fee: settingsData.hostelFeeAmount,
          instructions: settingsData.paymentInstructions
        });
        if (!paymentForm.amount && settingsData.hostelFeeAmount) {
          setPaymentForm(prev => ({ ...prev, amount: settingsData.hostelFeeAmount.toString() }));
        }
      }
    } catch (e) {
      console.error("Error fetching payment data:", e);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!paymentForm.utrNumber || !paymentForm.amount || !studentProfile) {
      alert("Please fill all fields");
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const res = await fetch("/api/students/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentProfile._id,
          registrationId: studentProfile.registrationId,
          utrNumber: paymentForm.utrNumber,
          amount: parseFloat(paymentForm.amount),
          paymentSource: paymentForm.paymentSource,
          screenshot: paymentForm.screenshot
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setShowPaymentModal(false);
        setPaymentForm({ utrNumber: "", amount: bankSettings?.fee?.toString() || "", paymentSource: "GPay", screenshot: "" });
        await fetchPaymentData();
      } else {
        alert(data.error || "Failed to submit payment");
      }
    } catch (e) {
      alert("Error submitting payment");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const [hostelLocations, setHostelLocations] = useState<any[]>([]);
  const [isLocationsLoading, setIsLocationsLoading] = useState(false);

  const fetchHostelLocations = async () => {
    try {
      setIsLocationsLoading(true);
      const response = await fetch("/api/admin/locations");
      if (!response.ok) throw new Error(`Failed to fetch locations: ${response.status}`);
      const data = await response.json();
      if (data.success && data.locations) {
        setHostelLocations(data.locations);
      } else {
        // Fallback to defaults if database is empty
        setHostelLocations([
          { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
          { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
          { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
        ]);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      // Set fallback on error to ensure app doesn't break
      setHostelLocations([
        { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
        { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
        { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
      ]);
    } finally {
      setIsLocationsLoading(false);
    }
  };
  const [gpsLockStatus, setGpsLockStatus] = useState<'idle' | 'locking' | 'locked' | 'error'>('idle');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lockProgress, setLockProgress] = useState(0);


  // Simple obfuscation for local storage
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

  const handleRegisterDevice = async () => {
    if (!studentProfile) return;

    try {
      setIsRegisteringDevice(true);

      // Check if this browser already has a device ID token from ANY previous user
      let currentDeviceId = getStoredDeviceId();

      if (!currentDeviceId) {
        // Fallback UUID generator if crypto.randomUUID is not available
        const generateUUID = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
          }
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        currentDeviceId = generateUUID();
      }

      const response = await fetch("/api/students/register-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: studentProfile._id,
          deviceId: currentDeviceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to register device: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      storeDeviceId(currentDeviceId);
      setStudentProfile({ ...studentProfile, deviceId: currentDeviceId });
      setShowDeviceRegistration(false);
      alert("Device registered successfully! You can now use all features.");
    } catch (error: any) {
      console.error("Error registering device:", error);
      alert(error.message || "Failed to register device. Please try again.");
    } finally {
      setIsRegisteringDevice(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("view") === "profile") {
      setShowProfile(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (studentProfile && !loading) {
      const storedId = getStoredDeviceId();
      // FIX: Force registration if NO deviceId in DB OR if DB ID doesn't match browser
      if (!studentProfile.deviceId || (storedId && studentProfile.deviceId !== storedId)) {
        setShowDeviceRegistration(true);
      }

      // Hard Redirect Check: Critical fields must be filled
      const isSectionInvalid = !studentProfile.section || studentProfile.section === "NIL" || studentProfile.section === "NILL";
      if (!studentProfile.dob || !studentProfile.category || !studentProfile.homeState || isSectionInvalid) {
        setShowMandatoryUpdate(true);
        setMandatoryFormData({
          dob: studentProfile.dob || "",
          category: studentProfile.category || "",
          homeState: studentProfile.homeState || "",
          section: isSectionInvalid ? "" : (studentProfile.section || "")
        });
      } else {
        setShowMandatoryUpdate(false);
      }

      // Check attendance status
      const checkAttendance = async () => {
        try {
          const res = await fetch(`/api/students/attendance?studentId=${studentProfile._id}`);
          if (!res.ok) throw new Error(`Failed to check attendance: ${res.status}`);
          const data = await res.json();
          if (data.marked) setIsAttendanceMarked(true);
          if (data.startTime && data.endTime) {
            setAttendanceWindow({ start: data.startTime, end: data.endTime });
          }
        } catch (e) {
          console.error("Error checking attendance status:", e);
        }
      };
      // Initialize session dismissed notifications
      const dismissed = JSON.parse(sessionStorage.getItem("dismissed_notifs") || "[]");
      setSessionDismissedIds(dismissed);

      // Fetch Notifications
      const fetchStudentNotifications = async () => {
        try {
          const res = await fetch(`/api/student/notifications?studentId=${encodeURIComponent(studentProfile._id)}&hostelName=${encodeURIComponent(studentProfile.hostelName)}`);
          if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
          const data = await res.json();
          if (data.success && data.notifications.length > 0) {
            // Filter out ones dismissed in current session
            const currentDismissed = JSON.parse(sessionStorage.getItem("dismissed_notifs") || "[]");
            const active = data.notifications.filter((n: any) => !currentDismissed.includes(n._id));

            setNotifications(active);
            if (active.length > 0) {
              setCurrentNotification(active[0]);
              setShowNotifPopup(true);
            } else {
              setShowNotifPopup(false);
            }
          }
        } catch (e) {
          console.error("Error fetching notifications:", e);
        }
      };

      checkAttendance();
      fetchHostelLocations(); // Fetch latest locations from database
      fetchPaymentData(); // Load payments and bank info
      fetchSystemSettings(); // Load dynamic form config

      // Delay initial notification fetch by 3 seconds as requested
      const initialNotifTimer = setTimeout(fetchStudentNotifications, 3000);

      const notifInterval = setInterval(fetchStudentNotifications, 30000); // Check every 30 seconds

      return () => {
        clearInterval(notifInterval);
        clearTimeout(initialNotifTimer);
      };
    }
  }, [studentProfile, loading]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180; // Convert latitude 1 to radians
    const φ2 = lat2 * Math.PI / 180; // Convert latitude 2 to radians
    const Δφ = (lat2 - lat1) * Math.PI / 180; // Difference in latitude
    const Δλ = (lon2 - lon1) * Math.PI / 180; // Difference in longitude

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.clear();
      router.push("/login?logout=success");
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  useEffect(() => {
    let permissionInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const loadData = async (user: any) => {
      // If we have initialData, we skip the minimal fetch!
      let currentStudent = initialData;

      if (!currentStudent) {
        try {
          // ⚡ STEP 1: Load MINIMAL data first if not provided
          const minimalResponse = await fetch(`/api/students?firebaseUID=${user.uid}&minimal=true`, { cache: 'no-store' });
          if (!minimalResponse.ok) throw new Error(`Failed to fetch minimal data: ${minimalResponse.status}`);
          const minimalData = await minimalResponse.json();
          if (minimalData.student) {
            currentStudent = {
              ...minimalData.student,
              studentStatus: minimalData.student.studentStatus || "in"
            };
            if (isMounted) {
              setStudentProfile(currentStudent);
              setLoading(false);
            }
          }
        } catch (error) {
          console.error("Error fetching minimal student data:", error);
        }
      } else {
        // If initialData was provided, we're already loading=false (state init)
        // But we might want to ensure we fetch permissions/full profile
      }

      if (currentStudent && isMounted) {
        setLoading(false);
        const studentId = currentStudent._id;

        // ⚡ STEP 2: Load FULL profile data asynchronously in background
        const loadFullProfile = async () => {
          try {
            const fullResponse = await fetch(`/api/students?firebaseUID=${user.uid}`, { cache: 'no-store' });
            if (!fullResponse.ok) throw new Error(`Failed to fetch full profile: ${fullResponse.status}`);
            const fullData = await fullResponse.json();
            if (fullData.student && isMounted) {
              const fullStudentData = {
                ...fullData.student,
                studentStatus: fullData.student.studentStatus || "in"
              };
              setStudentProfile(fullStudentData);
            }
          } catch (error) {
            console.error("Error loading full profile:", error);
          }
        };

        // ⚡ STEP 3: Load permissions asynchronously in background
        const fetchPermissions = async () => {
          try {
            const permResponse = await fetch(`/api/permissions?studentId=${studentId}&light=true`);
            if (!permResponse.ok) throw new Error(`Failed to fetch permissions: ${permResponse.status}`);
            const permData = await permResponse.json();

            if (permData.permissions && isMounted) {
              setPermissions(permData.permissions);
            }
          } catch (error) {
            console.error("Error fetching permissions:", error);
          }
        };

        // Start loading full data in background (non-blocking)
        loadFullProfile();
        fetchPermissions();

        // Refresh permissions periodically (Optimized: 30s instead of 8s to reduce server load)
        permissionInterval = setInterval(() => {
          fetchPermissions();
        }, 30000);
      } else if (!currentStudent && isMounted) {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadData(user);
      } else {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (permissionInterval) {
        clearInterval(permissionInterval);
      }
    };
  }, [initialData]);

  const handleRequestPermission = async () => {
    if (!fromDateTime || !toDateTime || !reason || !studentProfile) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: studentProfile._id,
          fromDateTime: new Date(fromDateTime).toISOString(),
          toDateTime: new Date(toDateTime).toISOString(),
          reason,
          deviceId: getStoredDeviceId(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create permission: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      if (data.permission) {
        setPermissions([data.permission, ...permissions]);
      }

      setFromDateTime("");
      setToDateTime("");
      setReason("");
      setShowRequestForm(false);
    } catch (error: any) {
      console.error("Error creating permission:", error);
      alert(error.message || "Failed to create permission request");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  };

  const handleMandatoryUpdateSubmit = async () => {
    if (!studentProfile || !mandatoryFormData.dob || !mandatoryFormData.category || !mandatoryFormData.homeState || !mandatoryFormData.section) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      setUpdatingProfile(true);

      // Prepare update payload
      const updateData: any = {
        dob: mandatoryFormData.dob,
        category: mandatoryFormData.category,
        homeState: mandatoryFormData.homeState,
        section: mandatoryFormData.section
      };

      // Parallel check: Save device ID if missing in DB
      let deviceRegisteredSuccessfully = false;
      if (!studentProfile.deviceId) {
        const generateUUID = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        const newDeviceId = generateUUID();
        updateData.deviceId = newDeviceId;
        storeDeviceId(newDeviceId);
        deviceRegisteredSuccessfully = true;
      }

      const response = await fetch(`/api/students/${studentProfile._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) throw new Error(`Failed to update profile: ${response.status}`);
      const data = await response.json();

      if (data.success) {
        setStudentProfile(data.student);
        setShowMandatoryUpdate(false);
        if (deviceRegisteredSuccessfully) {
          alert("Your device is registered successfully!");
        } else {
          alert("Profile updated successfully!");
        }
      } else {
        throw new Error(data.error || "Failed to update profile");
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      alert(error.message || "Failed to save details. Please try again.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCheckIn = async () => {
    if (!studentProfile) return;

    try {
      setCheckingIn(true);
      const deviceId = getStoredDeviceId();

      const response = await fetch("/api/students/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: studentProfile._id,
          status: "in",
          deviceId: deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check in: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.student) {
        const studentData = {
          ...data.student,
          studentStatus: "in"
        };
        setStudentProfile(studentData);
        alert("Successfully checked in!");
      }
    } catch (error: any) {
      console.error("Error checking in:", error);
      alert(error.message || "Failed to check in. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "allowed":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAccurateLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocationChecking(true);
    setGpsLockStatus('locking');
    setLockProgress(10);
    setGpsAccuracy(null);

    let watchId: number | null = null;
    let isCompleted = false;
    let bestPosition: GeolocationPosition | null = null;
    let optimizationTimer: NodeJS.Timeout | null = null;

    // Helper to finish verification
    const performVerification = (position: GeolocationPosition) => {
      const { accuracy, latitude, longitude } = position.coords;

      // Check if student is within any of the allowed circles
      let isInsideAny = false;
      let matchedLocation: any = null;
      let closestInfo = { distance: Infinity, radius: 0, name: "" };

      const locationsToTest = hostelLocations.length > 0 ? hostelLocations : [
        { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
        { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
        { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
      ];

      const results = locationsToTest.map((loc: any) => {
        const dist = calculateDistance(latitude, longitude, loc.lat, loc.lng);
        const isVerified = dist <= loc.radius;
        if (isVerified) {
          isInsideAny = true;
          matchedLocation = { ...loc, distance: dist };
        }
        if (dist < closestInfo.distance) {
          closestInfo = { distance: dist, radius: loc.radius, name: loc.name };
        }
        return { ...loc, distance: dist, isVerified };
      });

      setLocationVerificationResults(results);
      setLastCheckAccuracy(Math.round(accuracy));

      if (isInsideAny && matchedLocation) {
        setIsAtHostel(true);
        alert(`Verification Success✔️, You are ${Math.round(matchedLocation.distance)} meters away from ${matchedLocation.name}. (Accuracy: ${Math.round(accuracy)}m). Permission button is now active.`);
      } else {
        setIsAtHostel(false);
        alert(`Verification failed❌, You are ${Math.round(closestInfo.distance)} meters away from ${closestInfo.name}. (Accuracy: ${Math.round(accuracy)}m). You must be within the hostel radius.`);
      }
    };

    const finish = (pos: GeolocationPosition) => {
      if (isCompleted) return;
      isCompleted = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (optimizationTimer !== null) clearTimeout(optimizationTimer);

      setGpsLockStatus('locked');
      setLockProgress(100);

      // Instant UI transition
      setTimeout(() => {
        setIsLocationChecking(false);
        performVerification(pos);
      }, 100);
    };

    // 2. Fallback: WiFi/Cell (Low Accuracy) - Only if GPS completely fails
    const tryWifiFallback = () => {
      if (isCompleted) return;
      console.log("📶 GPS timed out, trying WiFi/Cell fallback...");

      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos),
        (err) => {
          if (isCompleted) return;
          console.error("WiFi Fallback failed:", err);

          // CRITICAL: Even if everything fails, if we had a "bestPosition" from GPS earlier, USE IT.
          if (bestPosition) {
            console.log("Using cached best position despite final error");
            finish(bestPosition);
          } else {
            isCompleted = true;
            setIsLocationChecking(false);
            setGpsLockStatus('error');
            alert("Could not detect location. Please enable Location Services & WiFi.");
          }
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
      );
    };

    // 1. Primary: High Accuracy GPS
    console.log("🚀 Starting GPS Lock (High Accuracy)...");

    // SAFETY TIMEOUT: Force a decision after 6 seconds (User wants < 8s)
    const masterTimeout = setTimeout(() => {
      if (!isCompleted) {
        if (bestPosition) {
          console.log("⏱️ Time limit reached. Using best available GPS signal.");
          finish(bestPosition);
        } else {
          tryWifiFallback();
        }
      }
    }, 6000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (isCompleted) return;

        const acc = position.coords.accuracy;
        setGpsAccuracy(Math.round(acc));

        // Always update best available
        if (!bestPosition || acc < bestPosition.coords.accuracy) {
          bestPosition = position;
          setLockProgress((p) => Math.min(90, p + 15));
        }

        // ⚡ INSTANT ACCEPT: < 50m
        if (acc <= 50) {
          finish(position);
          return;
        }

        // ⚡ QUICK ACCEPT: < 150m (Solves the 104m sticking issue)
        // Wait just 1.5s to see if it gets better, then take it.
        if (acc <= 200 && !optimizationTimer) {
          setLockProgress(75);
          optimizationTimer = setTimeout(() => {
            if (!isCompleted) finish(bestPosition || position);
          }, 1500);
        }
      },
      (err) => {
        console.warn("GPS Watch Error:", err);
        // Don't fail immediately on minor errors, wait for masterTimeout
        // unless it's a PERMISSION_DENIED
        if (err.code === 1) { // Permission Denied
          if (masterTimeout) clearTimeout(masterTimeout);
          isCompleted = true;
          setIsLocationChecking(false);
          alert("Location permission denied. Please enable location permissions.");
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleAcknowledge = async (notificationId: string) => {
    if (!studentProfile) return;
    try {
      setIsAcknowledging(true);
      const response = await fetch("/api/student/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentProfile._id,
          notificationId
        }),
      });
      if (!response.ok) throw new Error(`Failed to acknowledge: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        // Save to session storage to hide for THIS session
        const currentDismissed = JSON.parse(sessionStorage.getItem("dismissed_notifs") || "[]");
        if (!currentDismissed.includes(notificationId)) {
          currentDismissed.push(notificationId);
          sessionStorage.setItem("dismissed_notifs", JSON.stringify(currentDismissed));
          setSessionDismissedIds(currentDismissed);
        }

        setShowNotifPopup(false);
        // Check for next notification
        const remaining = notifications.filter((n: any) => n._id !== notificationId);
        setNotifications(remaining);
        if (remaining.length > 0) {
          setCurrentNotification(remaining[0]);
          setTimeout(() => setShowNotifPopup(true), 500);
        }
      }
    } catch (error) {
      console.error("Error acknowledging notification:", error);
    } finally {
      setIsAcknowledging(false);
    }
  };

  // ⚡ AUTO-VERIFY: Trigger face match as soon as liveness passes
  useEffect(() => {
    if (faceMatchStep === 'detecting' && depthRange >= 1.25 && yawRange >= 0.18) {
      console.log('⚡ Liveness confirmed! Auto-triggering face verification...');

      const autoVerify = async (attempts = 0) => {
        const result = await performFaceVerification();
        if (result) {
          // Success! Proceed immediately
          setTimeout(() => {
            stopCamera();
            proceedWithAttendance(result);
          }, 1000);
        } else if (attempts < 3) {
          // Retry if video stream was not ready
          console.log(`Verif failed, retrying (${attempts + 1}/3)...`);
          setTimeout(() => autoVerify(attempts + 1), 500);
        }
      };

      // Small delay to let user see "IDENTITY CONFIRMED"
      const timer = setTimeout(autoVerify, 800);
      return () => clearTimeout(timer);
    }
  }, [faceMatchStep, depthRange, yawRange]);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      setFaceMatchStep('loading-models');

      // ⚡ CRITICAL: Load models before starting stream to prevent detection lag/errors
      await faceMatching.loadFaceApiModels();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          aspectRatio: { ideal: 1 },
          width: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Check if models are loaded, if not wait a bit
      setFaceMatchStep('detecting');
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please ensure permissions are granted.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const performFaceVerification = async (existingRes?: any): Promise<{
    percentage: number;
    status: 'auto-approved' | 'flagged' | 'manual-override';
    photoBlob?: Blob;
  } | null> => {
    if (!videoRef.current) return null;
    const fa = await faceMatching.getFaceApi();
    if (!fa) return null;

    // ⚡ CHECK: Does student actually have a profile picture in the database?
    if (!studentProfile?.profilePicture) {
      setFaceMatchStep('error');
      alert("Verification Error: No profile picture found. Please update your profile first.");
      stopCamera();
      setIsMarkingAttendance(false);
      return null;
    }

    try {
      setFaceMatchStep('matching');
      setFaceMatchProgress(10);

      // ⚡ PRE-CHECK: If we already have a locked descriptor, use it (Fast Path)
      let referenceDescriptor = studentProfile.faceDescriptor;

      // ⚡ ROBUST CHECK: Handle null, undefined, OR empty array (which causes the 128 vs 0 error)
      if (!referenceDescriptor || referenceDescriptor.length === 0) {
        console.log("🔒 Biometric lock missing or invalid (length 0). Regenerating high-precision reference from profile picture...");
        setFaceMatchProgress(35);

        try {
          // ensure models are loaded for this extraction
          await faceMatching.loadFaceApiModels(true);

          if (!studentProfile.profilePicture) {
            throw new Error("No profile picture available to generate descriptor.");
          }

          console.log("Re-processing profile image:", studentProfile.profilePicture);
          const profileImg = await faceMatching.loadImage(studentProfile.profilePicture);

          // Use High Accuracy for reference generation
          const res = await faceMatching.detectFace(profileImg, true);

          if (!res) {
            console.error("Could not find a face in the profile picture.");
            throw new Error("Could not detect a face in your profile picture. Please update your profile photo.");
          }

          referenceDescriptor = Array.from(res.descriptor);

          // Save this new descriptor so we don't have to do this again
          console.log("Saving new biometric descriptor to database...");
          await fetch('/api/students/face-descriptor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebaseUID: (auth.currentUser?.uid || studentProfile.firebaseUID),
              faceDescriptor: referenceDescriptor
            })
          });

          // Update local state to avoid re-fetch
          const updatedProfile = { ...studentProfile, faceDescriptor: referenceDescriptor };
          setStudentProfile(updatedProfile);

        } catch (genError: any) {
          console.error("Error generating reference descriptor:", genError);
          setFaceMatchStep('error');
          alert(genError.message || "Failed to process your profile photo for verification.");
          stopCamera();
          setIsMarkingAttendance(false);
          return null;
        }
      }

      setFaceMatchProgress(60);

      // ⚡ CAPTURE: Always capture a frame for proof & fallback
      if (!videoRef.current || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        console.error("❌ Video stream not ready (0x0 dimensions). skipping frame capture.");
        return null;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);

      // ⚡ TURBO: Use EXISTING result if provided, else detect
      let liveRes = existingRes || await faceMatching.detectFace(canvas, false);

      if (!liveRes) {
        console.warn("⚠️ Lite detection failed. Retrying with Pro...");
        setFaceMatchStep('matching'); // Keep matching state
        setFaceMatchProgress(70);
        await faceMatching.loadFaceApiModels(true); // Ensure Pro is loaded
        liveRes = await faceMatching.detectFace(canvas, true); // Retry with Pro
      }

      let liveDescriptor: Float32Array | null = liveRes ? liveRes.descriptor : null;

      if (!liveDescriptor) {
        console.warn("⚠️ Client-side detection failed. Initiating Super-Fallback (Backend Matching)...");
        setFaceMatchStep('matching');
        setFaceMatchProgress(85);

        try {
          const backendRes = await fetch('/api/attendance/face-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: canvas.toDataURL('image/jpeg', 0.8),
              firebaseUID: studentProfile.firebaseUID
            })
          });

          const backendData = await backendRes.json();
          if (backendData.success) {
            const result = {
              percentage: backendData.score,
              status: (backendData.isMatch ? 'auto-approved' : 'flagged') as any,
              photoBlob: backendData.isMatch ? undefined : await (await fetch(canvas.toDataURL('image/webp'))).blob()
            };
            setFaceMatchStep(result.status === 'flagged' ? 'flagged' : 'success');
            setFaceMatchResult(result);
            setFaceMatchProgress(100);
            return result;
          }
        } catch (be) {
          console.error("❌ Backend fallback failed:", be);
        }

        setFaceMatchStep('error');
        alert("Face verification failed. Please ensure your face is clearly visible and well-lit.");
        return null;
      }

      setFaceMatchProgress(90);
      let distance = await faceMatching.getDistance(liveDescriptor, referenceDescriptor);

      if (distance === null) {
        setFaceMatchStep('error');
        return null;
      }

      let matchPercentage = faceMatching.calculateScore(distance);

      console.log(`🔍 Raw Match Score: ${matchPercentage}%`);

      // ⚡ SPOOF PREVENTION: Penalize static/perfectly aligned images
      // Real faces usually have slight angles. If yaw/pitch is exactly 0, it's suspicious.
      if (liveRes && Math.abs(liveRes.yaw || 0) < 0.01 && Math.abs(liveRes.pitch || 0) < 0.01) {
        console.warn("⚠️ Suspiciously perfect alignment detected. Possible photo spoof.");
        matchPercentage -= 15; // Penalty
      }

      // ⚡ AUTO-ESCALATION: Faster Path for High Confidence
      // If Lite match is > 82%, skip Pro escalation (save ~1s)
      // If match is borderline (50-82%), we MUST verify with Pro
      if (matchPercentage > 60 && matchPercentage < 85 && (!liveRes || !liveRes.accurate)) {
        console.log("💎 Borderline result. Escalating to Pro model for high-stakes verification...");
        setFaceMatchProgress(95);

        // Re-use canvas if available
        const proRes = await faceMatching.detectFace(canvas || document.createElement('canvas'), true);
        if (proRes) {
          const proDistance = await faceMatching.getDistance(proRes.descriptor, referenceDescriptor);
          if (proDistance !== null) {
            matchPercentage = faceMatching.calculateScore(proDistance);
            console.log(`🛡️ Pro Verification complete: ${matchPercentage}%`);
          }
        }
      }

      setFaceMatchProgress(100);

      // ⚡ INDUSTRIAL TRIPLE-TIER VALIDATION (STRICTER ANTI-SPOOF)
      // 1. SAFE PASS (Auto-approved) - Increased threshold
      if (matchPercentage >= 85) {
        setFaceMatchStep('success');
        return {
          percentage: matchPercentage,
          status: 'auto-approved',
        };
      }

      // ⚡ SECURITY UPGRADE: "Flagged" zone removed to prevent photo spoofing.
      // Anything below 85% is now a HARD REJECT.
      // This forces students to provide a clear, live face scan.

      console.warn(`⚠️ Rejected borderline match (${matchPercentage}%). Enforcing strict liveness.`);

      // 3. HARD REJECT (Blocked - Reduced False Attendance)
      console.error(`❌ Identity Reject: Match too low (${matchPercentage}%).`);
      setFaceMatchStep('error');

      let errorMsg = `Identity Mismatch (${matchPercentage}%).`;
      if (matchPercentage >= 60) {
        errorMsg = "Verification Failed. We detected a possible photo/screen. Please use your REAL FACE.";
      }

      alert(`${errorMsg}\n\nSecurity Alert: Strict liveness is enforced. Photos or screens are NOT accepted.`);
      return null;

    } catch (error) {
      console.error("Verification error:", error);
      setFaceMatchStep('error');
      return null;
    }
  };

  const [hostelAttendanceMode, setHostelAttendanceMode] = useState<'strict' | 'gps-only' | 'biometric'>('strict');

  useEffect(() => {
    if (studentProfile?.hostelName) {
      // Fetch public hostel list and find my hostel's settings
      fetch('/api/hostels').then(res => res.json()).then(data => {
        if (data.hostels) {
          const myHostel = data.hostels.find((h: any) => h.name.toLowerCase() === studentProfile.hostelName.toLowerCase());
          if (myHostel && myHostel.attendanceMode) {
            console.log(`🏢 Hostel Mode for ${studentProfile.hostelName}: ${myHostel.attendanceMode}`);
            setHostelAttendanceMode(myHostel.attendanceMode);
          }
        }
      }).catch(err => console.error("Failed to fetch hostel settings", err));
    }
  }, [studentProfile?.hostelName]);

  // ⚡ BIOMETRIC HELPER (WebAuthn)
  const performBiometricCheck = async (): Promise<boolean> => {
    try {
      if (!window.PublicKeyCredential) {
        alert("Your device does not support Biometric/Face ID verification.");
        return false;
      }

      // 🔒 SECURE CONTEXT CHECK
      if (!window.isSecureContext) {
        alert("SECURITY ERROR: Biometrics only apply on HTTPS connections.\n\nYou are currently on HTTP(" + window.location.hostname + ").\n\nFor testing: Use 'ngrok' or 'localhost'.\nFor production: Use a secure domain.");
        return false;
      }

      // 🚫 IP ADDRESS BLOCK (WebAuthn specific)
      // WebAuthn spec forbids IP addresses as RP IDs. It MUST be a domain name or localhost.
      const isIpAddress = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(window.location.hostname);
      if (isIpAddress) {
        alert("CONFIGURATION ERROR: Biometric security forbids using IP Addresses (" + window.location.hostname + ").\n\nYou MUST use a domain name.\n\n✅ WORKING EXAMPLES:\n- localhost\n- my-app.vercel.app\n- 85a3-203.ngrok-free.app\n\n❌ WILL FAIL:\n- 192.168.x.x");
        return false;
      }

      // 1. Get Challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // 2. Check for existing credential to avoid creating duplicates
      const storedCredId = localStorage.getItem(`bio_cred_${studentProfile?._id}`);

      if (storedCredId) {
        try {
          // Try Authentication first
          const result = await navigator.credentials.get({
            publicKey: {
              challenge,
              rpId: window.location.hostname,
              userVerification: "required",
              allowCredentials: [{
                id: Uint8Array.from(atob(storedCredId), c => c.charCodeAt(0)),
                type: "public-key"
              }]
            }
          });
          if (result) return true;
        } catch (e) {
          console.log("Biometric Auth failed, trying registration fallback...", e);
          // Fall through to registration
        }
      }

      // 3. Registration (First time or recovery)

      // ⚡ USER INSTRUCTION: Encourage Face/Finger over PIN
      const userAgreed = confirm("⚠️ SETUP BIOMETRICS\n\nFor the fastest attendance, please use your Face ID or Fingerprint.\n\nAvoiding PIN/Pattern will prevent delays.\n\nClick OK to scan now.");
      if (!userAgreed) return false;

      const result: any = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Hostelease Attendance", id: window.location.hostname },
          user: {
            id: new Uint8Array(16),
            name: studentProfile?.email || "Student",
            displayName: studentProfile?.name || "Student User"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            requireResidentKey: false
          },
          timeout: 60000,
          attestation: "direct"
        }
      });

      if (result) {
        // Save ID for next time (Simple Base64 storage)
        const idStr = btoa(String.fromCharCode(...new Uint8Array(result.rawId)));
        localStorage.setItem(`bio_cred_${studentProfile?._id}`, idStr);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("Biometric Error:", error);
      // Don't alert if user just cancelled (NotAllowedError)
      if (error.name !== "NotAllowedError") {
        alert("Biometric verification failed. Please try again or check your device settings.");
      }
      return false;
    }
  };

  const handleMarkAttendance = async (retryAttempt = 0) => {
    if (!studentProfile) return;

    // Clear previous error
    setAttendanceError(null);
    setAttendanceStep('idle');

    // 1. Time Verification (Client-side check for immediate feedback)
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });
    const istTime = istTimeStr.split(":").slice(0, 2).join(":"); // "HH:mm"

    if (istTime < attendanceWindow.start || istTime > attendanceWindow.end) {
      setToastMessage(`Daily attendance will be allowed between ${attendanceWindow.start} to ${attendanceWindow.end}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
      return;
    }

    if (!isAtHostel) {
      alert("Please verify your location first.");
      return;
    }

    try {
      setIsMarkingAttendance(true);
      setAttendanceRetryCount(retryAttempt);
      let deviceId = getStoredDeviceId();

      // Auto-generate device ID if missing
      if (!deviceId) {
        const generateUUID = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
          }
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        deviceId = generateUUID();
        storeDeviceId(deviceId);
        console.log('📱 Auto-generated device ID:', deviceId);
      }

      // ⚡ CHECK HOSTEL MODE
      if (hostelAttendanceMode === 'gps-only') {
        console.log("📍 GPS Only mode detected. Skipping face verification.");
        await proceedWithAttendance({ percentage: 100, status: 'auto-approved' });
        return;
      }

      // ⚡ BIOMETRIC MODE
      if (hostelAttendanceMode === 'biometric') {
        console.log("👆 Biometric mode detected. Triggering WebAuthn...");
        setAttendanceStep('face-match'); // Reuse UI state for "Verifying..."

        const isVerified = await performBiometricCheck();

        if (isVerified) {
          await proceedWithAttendance({ percentage: 100, status: 'biometric-verified' });
        } else {
          setIsMarkingAttendance(false);
          setAttendanceStep('idle');
        }
        return;
      }

      // Step 1: Face Verification (Strict Mode)
      setAttendanceStep('face-match');
      await startCamera();
      // Flow continues via the UI capture button which calls proceedWithAttendance

    } catch (error: any) {
      console.error("Error in attendance flow:", error);
      setAttendanceStep('error');
      alert("An error occurred. Please try again.");
      setIsMarkingAttendance(false);
    }
  };

  /**
   * Called after face verification is completed
   */
  const proceedWithAttendance = async (faceResult: any) => {
    try {
      setAttendanceStep('gps');
      const deviceId = getStoredDeviceId();
      if (!studentProfile) return;

      // ⚡ FAST LOCATION STRATEGY (User Requested):
      // 1. Try High Accuracy (GPS) for 5s
      // 2. Fallback to Low Accuracy (WiFi/Cell) immediately on error/timeout
      const getLocationFast = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
          // Attempt 1: GPS (Strict)
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => {
              console.warn("GPS mark failed/timeout, switching to WiFi...", err);
              // Attempt 2: WiFi/Cell (Fast Fallback)
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve(pos),
                (err2) => reject(err2),
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
              );
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        });
      };

      try {
        const position = await getLocationFast();
        const { latitude, longitude } = position.coords;

        // Step 2: Checking Accuracy
        setAttendanceStep('accuracy');

        // Step 3: Handle Flagged Photo Upload
        let flaggedPhotoUrl = "";
        if (faceResult.status === 'flagged' && faceResult.photoBlob) {
          setAttendanceStep('saving'); // Show progress
          const uploadedUrl = await faceMatching.uploadToCloudinary(faceResult.photoBlob);
          if (uploadedUrl) flaggedPhotoUrl = uploadedUrl;
        }

        // Step 4: Saving to Database
        setAttendanceStep('saving');

        const response = await fetch("/api/students/attendance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentId: studentProfile._id,
            lat: latitude,
            lng: longitude,
            accuracy: position.coords.accuracy,
            deviceId: deviceId,
            // Face matching results
            faceMatchPercentage: faceResult.percentage,
            faceMatchStatus: faceResult.status,
            flaggedPhotoUrl: flaggedPhotoUrl
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setAttendanceStep('done');
          setIsAttendanceMarked(true);
          setTimeout(() => {
            alert(data.message || "Attendance marked successfully!");
            setAttendanceStep('idle');
            setIsMarkingAttendance(false);
          }, 400);
        } else {
          setAttendanceStep('error');
          alert(data.error || "Failed to mark attendance.");
          setIsMarkingAttendance(false);
        }

      } catch (error) {
        console.error("Location/Attendance Error:", error);
        setAttendanceStep('error');
        alert("Location failed. Please enable WiFi/Location services and try again.");
        setIsMarkingAttendance(false);
      }

    } catch (error) {
      setAttendanceStep('error');
      setIsMarkingAttendance(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-secondary">Loading...</p>
      </div>
    );
  }

  if (!studentProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-secondary">Student profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="w-full max-w-4xl mx-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {!showProfile ? (
            <>
              {/* Header section: Profile @ Top-Right, Logout next to Name */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-3 mb-1">
                    <h1 className="text-xl md:text-3xl font-bold text-gray-900 leading-tight">
                      Hello, <span className="text-blue-600">{studentProfile.name.split(' ')[0]}!</span>
                    </h1>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 rounded-xl border border-solid border-gray-100 bg-white text-foreground text-[9px] font-black uppercase tracking-tight shadow-sm active:scale-95 transition-all flex items-center gap-1.5 hover:bg-gray-50 mt-1 md:mt-0"
                    >
                      LOGOUT
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[11px] md:text-sm text-gray-500 font-medium">Welcome back to Hostelease Dashboard</p>
                </div>

                <button
                  onClick={() => setShowProfile(true)}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full ring-2 ring-blue-100 ring-offset-2 overflow-hidden hover:opacity-90 transition-opacity flex-shrink-0 shadow-lg"
                >
                  {studentProfile?.profilePicture ? (
                    <img
                      src={studentProfile.profilePicture}
                      alt={studentProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                      {getInitials(studentProfile.name)}
                    </div>
                  )}
                </button>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-2" style={{ fontFamily: 'Cambria, Cochin, Georgia, Times, "Times New Roman", serif' }}>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-2 md:p-2.5 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Current Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${studentProfile.studentStatus === 'out' ? 'bg-red-500' : 'bg-green-500'}`} />
                    <p className="text-[12px] font-bold text-gray-900 capitalize">Currently {studentProfile.studentStatus || 'IN'}</p>
                  </div>
                </div>
                <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hostel & Room</p>
                  <p className="text-[12px] font-bold text-gray-900">{studentProfile.hostelName}<span className="text-blue-600 ml-1">#{studentProfile.roomNumber}</span></p>
                </div>
                <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-1">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Location Lock</p>
                    <p className="text-[12px] font-bold text-gray-700">{isAtHostel ? '📍 Verified' : '❌ Not Verified'}</p>
                  </div>
                  <button
                    onClick={getAccurateLocation}
                    disabled={isLocationChecking}
                    className={`p-2 rounded-lg transition-all ${isAtHostel ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                    title="Refresh Location"
                  >
                    {isLocationChecking ? (
                      <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-1">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Daily Attendance</p>
                    <p className="text-[12px] font-bold text-gray-700">
                      {isAttendanceMarked ? '✅ Saved' : `🕒 ${attendanceWindow.start} - ${attendanceWindow.end}`}
                    </p>
                  </div>
                  {!isAttendanceMarked ? (
                    <button
                      onClick={() => handleMarkAttendance()}
                      disabled={isMarkingAttendance}
                      className={`p-2 rounded-lg transition-all ${isMarkingAttendance ? 'bg-gray-100 text-gray-400' : isAtHostel ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 shadow-sm shadow-orange-100' : 'bg-orange-50/50 text-orange-400 hover:bg-orange-100'}`}
                      title={`Mark Attendance (${attendanceWindow.start} - ${attendanceWindow.end})`}
                    >
                      {isMarkingAttendance ? (
                        <div className="w-5 h-5 border-2 border-orange-600/30 border-t-orange-600 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* ⭐ PROGRESS INDICATORS - Shows only when marking attendance */}
                {isMarkingAttendance && attendanceStep !== 'idle' && (
                  <div className="col-span-2 lg:col-span-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 rounded-2xl border-2 border-blue-200 shadow-lg">
                    <div className="flex items-center gap-3">
                      {/* Progress Steps */}
                      <div className="flex-1 space-y-2">
                        {/* GPS Step */}
                        <div className={`flex items-center gap-2 text-xs font-bold transition-all ${attendanceStep === 'gps' ? 'text-blue-700 animate-pulse' : attendanceStep === 'accuracy' || attendanceStep === 'saving' || attendanceStep === 'done' ? 'text-green-600' : 'text-gray-400'}`}>
                          {attendanceStep === 'gps' ? (
                            <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                          ) : (
                            <span className="text-base">{(['accuracy', 'saving', 'done'].includes(attendanceStep)) ? '✅' : '🛰️'}</span>
                          )}
                          <span>{(['accuracy', 'saving', 'done'].includes(attendanceStep)) ? 'GPS Verified' : 'Verifying GPS location...'}</span>
                        </div>

                        {/* Accuracy Step */}
                        {(['accuracy', 'saving', 'done'].includes(attendanceStep)) && (
                          <div className={`flex items-center gap-2 text-xs font-bold transition-all ${attendanceStep === 'accuracy' ? 'text-blue-700 anim ate-pulse' : attendanceStep === 'saving' || attendanceStep === 'done' ? 'text-green-600' : 'text-gray-400'}`}>
                            {attendanceStep === 'accuracy' ? (
                              <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                            ) : (
                              <span className="text-base">{(['saving', 'done'].includes(attendanceStep)) ? '✅' : '📍'}</span>
                            )}
                            <span>{(['saving', 'done'].includes(attendanceStep)) ? 'Accuracy Confirmed' : 'Checking location accuracy...'}</span>
                          </div>
                        )}

                        {/* Saving Step */}
                        {(['saving', 'done'].includes(attendanceStep)) && (
                          <div className={`flex items-center gap-2 text-xs font-bold transition-all ${attendanceStep === 'saving' ? 'text-blue-700 animate-pulse' : attendanceStep === 'done' ? 'text-green-600' : 'text-gray-400'}`}>
                            {attendanceStep === 'saving' ? (
                              <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                            ) : (
                              <span className="text-base">{attendanceStep === 'done' ? '✅' : '💾'}</span>
                            )}
                            <span>{attendanceStep === 'done' ? 'Attendance marked successfully!' : 'Marking attendance...'}</span>
                          </div>
                        )}

                        {/* Error State */}
                        {attendanceStep === 'error' && (
                          <div className="flex items-center gap-2 text-xs font-bold text-red-600">
                            <span className="text-base">❌</span>
                            <span>Retrying... (Attempt {attendanceRetryCount + 1}/3)</span>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-20 h-20 relative">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                          <circle
                            cx="40"
                            cy="40"
                            r="35"
                            stroke={attendanceStep === 'error' ? '#ef4444' : attendanceStep === 'done' ? '#10b981' : '#3b82f6'}
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray="220"
                            strokeDashoffset={220 - (220 * (attendanceStep === 'gps' ? 0.33 : attendanceStep === 'accuracy' ? 0.66 : attendanceStep === 'saving' || attendanceStep === 'done' ? 1 : 0))}
                            className="transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-black text-gray-700">
                            {attendanceStep === 'gps' ? '33%' : attendanceStep === 'accuracy' ? '66%' : attendanceStep === 'saving' || attendanceStep === 'done' ? '100%' : '0%'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {false && (
                  <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-1 transition-all hover:border-blue-200 group col-span-2 lg:col-span-1">

                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Fee Payment</p>
                      <p className={`text-[12px] font-bold ${paymentHistory.some(p => p.status === 'verified') ? 'text-green-600' : 'text-orange-500'}`}>
                        {paymentHistory.some(p => p.status === 'verified') ? '✅ Paid' :
                          paymentHistory.some(p => p.status === 'pending') ? '⏳ Verifying' : '🔴 Unpaid'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className={`p-2 rounded-lg transition-all active:scale-95 flex items-center gap-2 ${paymentHistory.some(p => p.status === 'verified') ? 'bg-green-50 text-green-600' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`}
                      title="Payment Details"
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight px-1">{paymentHistory.some(p => p.status === 'verified') ? 'View' : 'Pay'}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {paymentHistory.some(p => p.status === 'verified') ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        )}
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Latest Permission Status Card */}
              {latestPermission && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Active Request Status</h3>
                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${latestPermission.status === 'allowed' ? 'bg-green-100 text-green-700' : latestPermission.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {latestPermission.status}
                    </div>
                  </div>

                  <div className="flex items-center justify-around py-2">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Warden approval</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${latestPermission.wardenStatus === "allowed" ? "border-green-500 bg-green-50 text-green-600 shadow-sm ring-4 ring-green-50" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${latestPermission.wardenStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm ring-4 ring-red-50" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${latestPermission.wardenStatus === 'allowed' ? 'text-green-600 bg-green-50' : latestPermission.wardenStatus === 'rejected' ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-100'}`}>
                        {latestPermission.wardenStatus === 'allowed' ? 'Accepted' : latestPermission.wardenStatus === 'rejected' ? 'Rejected' : 'Pending'}
                      </span>
                    </div>

                    <div className="h-10 w-px bg-slate-100" />

                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Dean approval</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${latestPermission.deanStatus === "allowed" ? "border-green-600 bg-green-500 text-white shadow-lg shadow-green-100 scale-110" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${latestPermission.deanStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm ring-4 ring-red-50" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${latestPermission.deanStatus === 'allowed' ? 'text-green-600 bg-green-50' : latestPermission.deanStatus === 'rejected' ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-100'}`}>
                        {latestPermission.deanStatus === 'allowed' ? 'Accepted' : latestPermission.deanStatus === 'rejected' ? 'Rejected' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setShowPermissionsHistory(true)}
                  className="flex-1 h-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-bold text-[12px] hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                >
                  🕙 Outing History
                </button>
                {studentProfile?.studentStatus === "out" ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="flex-[2] h-12 rounded-xl bg-green-600 text-white font-bold text-[12px] shadow-lg shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {checkingIn ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : "✅ I'm Back In"}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRequestForm(!showRequestForm)}
                    disabled={!isAtHostel}
                    className={`flex-[2] h-12 rounded-xl font-bold text-[12px] shadow-lg transition-all flex items-center justify-center gap-2 ${isAtHostel
                      ? "bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                      }`}
                  >
                    {isAtHostel ? "🚀 Request Permission" : "🔒 Verify Location First"}
                  </button>
                )}
              </div>

              {showRequestForm && (
                <div className="p-6 rounded-lg border border-solid border-[#9CA3AF] bg-filler space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      From Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={fromDateTime}
                      onChange={(e) => setFromDateTime(e.target.value)}
                      className="w-full h-12 px-4 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground focus:outline-none focus:border-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      To Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={toDateTime}
                      onChange={(e) => setToDateTime(e.target.value)}
                      className="w-full h-12 px-4 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground focus:outline-none focus:border-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Reason
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value.slice(0, 100))}
                      placeholder="Please specify why you need to go out........ (only 100 characters)"
                      maxLength={100}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRequestPermission}
                      disabled={submitting}
                      className="flex-1 h-12 rounded-lg bg-blue-600 text-background font-medium transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? "Submitting..." : "Submit Request"}
                    </button>
                    <button
                      onClick={() => {
                        setShowRequestForm(false);
                        setFromDateTime("");
                        setToDateTime("");
                        setReason("");
                      }}
                      className="flex-1 h-12 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground font-medium transition-colors hover:bg-filler"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Detailed Student Information Section */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">Student Profile Details</h2>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Official Record</span>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
                    {formBuilderConfig.filter(f => f.visible && f.type !== 'image').map((field) => {
                      const value = (studentProfile as any)[field.id] || studentProfile.dynamicFields?.[field.id] || "N/A";
                      const displayValue = (field.type === 'date' || field.id === 'joiningDate') ? formatDate(value) : value;

                      return (
                        <div key={field.id} className={['homePinCode', 'localGuardianAddress', 'permanentAddress'].includes(field.id) ? "md:col-span-2" : ""}>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{field.label}</p>
                          {field.type === 'tel' || field.id.toLowerCase().includes('number') || field.id.toLowerCase().includes('phone') ? (
                            <a href={`tel:${value}`} title="Click to call" className="text-[12px] font-bold text-blue-600 hover:underline">
                              {value}
                            </a>
                          ) : (
                            <p className={`text-[12px] font-bold ${field.id === 'roomNumber' ? 'text-blue-600' : 'text-gray-900'}`}>
                              {field.id === 'roomNumber' && value !== 'N/A' ? '#' : ''}{displayValue}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>


              {showPermissionsHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                      <h2 className="text-lg font-bold text-gray-900">Permission History</h2>
                      <button
                        onClick={() => setShowPermissionsHistory(false)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="overflow-y-auto p-4 space-y-3">
                      {permissions.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                          <p>No permission requests found.</p>
                        </div>
                      ) : (
                        permissions.map((permission) => (
                          <div
                            key={permission._id}
                            className="rounded-2xl border-0 bg-slate-50 p-5 shadow-sm hover:shadow-md transition-all duration-300"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="space-y-1.5">
                                <p className="text-[13px] font-black text-[#2D5A9E]">
                                  {new Date(permission.fromDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                                </p>
                                <p className="text-[13px] font-black text-[#2D5A9E]">
                                  To {new Date(permission.toDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                                </p>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${permission.status === 'allowed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                permission.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                                  'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                }`}>
                                {permission.status === 'allowed' ? 'Accepted' : permission.status === 'rejected' ? 'Rejected' : 'Pending'}
                              </div>
                            </div>
                            <div className="h-px w-full bg-slate-200/50 mb-3" />
                            <p className="text-[11px] text-slate-800 leading-relaxed font-medium">
                              {permission.reason}
                            </p>

                            {/* Staff Approval Indicators */}
                            <div className="flex items-center justify-around pt-4 border-t border-slate-200/50 mt-4">
                              <div className="flex flex-col items-center gap-2">
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Warden approval</span>
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${permission.wardenStatus === "allowed" ? "border-green-500 bg-green-50 text-green-600 shadow-sm" : "border-gray-200 text-gray-300"}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                  <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${permission.wardenStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-300"}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${permission.wardenStatus === 'allowed' ? 'text-green-600 bg-green-50' : permission.wardenStatus === 'rejected' ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-100'}`}>
                                  {permission.wardenStatus === 'allowed' ? 'Accepted' : permission.wardenStatus === 'rejected' ? 'Rejected' : 'Pending'}
                                </span>
                              </div>

                              <div className="flex flex-col items-center gap-2">
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Dean approval</span>
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${permission.deanStatus === "allowed" ? "border-green-600 bg-green-500 text-white shadow-md scale-105" : "border-gray-200 text-gray-300"}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                  <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${permission.deanStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-300"}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${permission.deanStatus === 'allowed' ? 'text-green-600 bg-green-50' : permission.deanStatus === 'rejected' ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-100'}`}>
                                  {permission.deanStatus === 'allowed' ? 'Accepted' : permission.deanStatus === 'rejected' ? 'Rejected' : 'Pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mandatory Profile Update Overlay */}
              {showMandatoryUpdate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
                  <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-white/20">
                    <div className="p-8 pb-6 text-center">
                      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-black text-gray-900 mb-2">Complete Your Profile</h2>
                      <p className="text-gray-500 text-sm">Please provide the following mandatory details to continue accessing your dashboard.</p>
                    </div>

                    <div className="px-8 pb-8 space-y-5">
                      <div>
                        <label className="block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2 px-1">Social Category</label>
                        <select
                          value={mandatoryFormData.category}
                          onChange={(e) => setMandatoryFormData(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                        >
                          <option value="">Select Category</option>
                          <option value="GENERAL">GENERAL</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="OBC">OBC</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2 px-1">Date of Birth</label>
                        <input
                          type="date"
                          value={mandatoryFormData.dob}
                          onChange={(e) => setMandatoryFormData(prev => ({ ...prev, dob: e.target.value }))}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2 px-1">Home State</label>
                        <select
                          value={mandatoryFormData.homeState}
                          onChange={(e) => setMandatoryFormData(prev => ({ ...prev, homeState: e.target.value }))}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                        >
                          <option value="">SELECT STATE</option>
                          {["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2 px-1">Section</label>
                        <select
                          value={mandatoryFormData.section}
                          onChange={(e) => setMandatoryFormData(prev => ({ ...prev, section: e.target.value.toUpperCase() }))}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                        >
                          <option value="">SELECT SECTION</option>
                          {["A", "B", "C", "D", "E", "F"].map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={handleMandatoryUpdateSubmit}
                        disabled={updatingProfile || !mandatoryFormData.dob || !mandatoryFormData.category || !mandatoryFormData.homeState || !mandatoryFormData.section}
                        className="w-full h-14 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                      >
                        {updatingProfile ? (
                          <>
                            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Save & Continue"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Face Verification Overlay */}
              {cameraActive && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-300">
                  <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-white/20">
                    <div className="p-6 pb-2 text-center">
                      <h2 className="text-xl font-black text-gray-900 mb-1">Face Verification</h2>
                      <p className="text-gray-500 text-xs">Position your face clearly within the camera view.</p>
                    </div>

                    <div className="p-5 relative">
                      <div className="relative aspect-square bg-black rounded-2xl overflow-hidden shadow-inner border-2 border-slate-100">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />

                        {/* ⚡ ENHANCED: Large Oval Face Frame */}
                        <div className="absolute inset-0 pointer-events-none">
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                              <mask id="faceMask">
                                <rect width="100" height="100" fill="white" />
                                <ellipse cx="50" cy="50" rx="35" ry="42" fill="black" />
                              </mask>
                            </defs>
                            {/* Darkened background with oval hole */}
                            <rect width="100" height="100" fill="rgba(0,0,0,0.6)" mask="url(#faceMask)" />
                            {/* Glowing Border */}
                            <ellipse
                              cx="50" cy="50" rx="35" ry="42"
                              fill="none"
                              stroke={faceDetected ? "#22c55e" : "#3b82f6"}
                              strokeWidth="0.5"
                              strokeDasharray={faceDetected ? "none" : "2,1"}
                              className="transition-all duration-500"
                            />
                            {/* Scanning Line Animation */}
                            {cameraActive && faceMatchStep === 'detecting' && (
                              <line x1="15" x2="85" y1="0" y2="0" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="0.5" className="animate-scan-line">
                                <animate attributeName="y1" values="20;80;20" dur="3s" repeatCount="indefinite" />
                                <animate attributeName="y2" values="20;80;20" dur="3s" repeatCount="indefinite" />
                              </line>
                            )}
                          </svg>
                        </div>

                        {/* ⚡ INDUSTRIAL: Face Tracking Box */}
                        {faceBox && (
                          <div
                            className="absolute border-2 border-green-500 rounded-lg pointer-events-none transition-all duration-150 shadow-[0_0_15px_rgba(34,197,94,0.5)] z-20"
                            style={{
                              // Mirrored calculation since video is scale-x-[-1]
                              left: `${100 - ((faceBox.x + faceBox.width) / (videoRef.current?.videoWidth || 1)) * 100}%`,
                              top: `${(faceBox.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                              width: `${(faceBox.width / (videoRef.current?.videoWidth || 1)) * 100}%`,
                              height: `${(faceBox.height / (videoRef.current?.videoHeight || 1)) * 100}%`,
                            }}
                          >
                            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-green-500 -ml-[2px] -mt-[2px]" />
                            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-green-500 -mr-[2px] -mt-[2px]" />
                            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-green-500 -ml-[2px] -mb-[2px]" />
                            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-green-500 -mr-[2px] -mb-[2px]" />
                          </div>
                        )}

                        {faceMatchStep === 'matching' && (
                          <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] flex items-center justify-center z-30">
                            <div className="text-center">
                              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                              <p className="text-white font-black text-sm uppercase tracking-widest leading-none">Verifying...</p>
                              <p className="text-white/70 text-[10px] mt-2">
                                {faceMatchProgress > 70 ? "Switching to Accurate Mode..." : `${faceMatchProgress}% Done`}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 space-y-3">
                        {faceMatchStep === 'detecting' && (
                          <div className="w-full py-4 text-center space-y-4">
                            <div className={`transition-all duration-300 font-black flex items-center justify-center gap-3 ${(depthRange >= 1.25 && yawRange >= 0.18) ? 'text-green-500 scale-110' : 'text-blue-600'}`}>
                              {(depthRange >= 1.25 && yawRange >= 0.18) ? (
                                <>
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                                  IDENTITY CONFIRMED
                                </>
                              ) : faceDetected ? (
                                <>
                                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                                  LIVENESS CHECK
                                </>
                              ) : (
                                <>
                                  <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                                  {consecutiveFailuresRef.current > 10 ? "ENHANCED RECOGNITION..." : "SEARCHING FOR FACE..."}
                                </>
                              )}
                            </div>

                            {faceDetected && (
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-tighter">
                                  <div className={`flex items-center gap-1 transition-colors ${depthRange >= 1.25 ? 'text-green-500' : 'text-blue-600'}`}>
                                    <span>{depthRange >= 1.25 ? '✅' : '📏'}</span> NEAR / FAR
                                  </div>
                                  <div className="w-px h-3 bg-gray-200" />
                                  <div className={`flex items-center gap-1 transition-colors ${yawRange >= 0.18 ? 'text-green-500' : 'text-blue-600'}`}>
                                    <span>{yawRange >= 0.18 ? '✅' : '🔄'}</span> TURN HEAD
                                  </div>
                                </div>

                                <div className="w-32 h-1 bg-gray-100 rounded-full overflow-hidden flex">
                                  <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${Math.min(50, ((depthRange - 1) / 0.25) * 50)}%` }}
                                  />
                                  <div
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{ width: `${Math.min(50, (yawRange / 0.18) * 50)}%` }}
                                  />
                                </div>

                                <p className={`text-[10px] font-bold uppercase text-center transition-colors ${depthRange >= 1.25 && yawRange >= 0.18 ? 'text-green-600 scale-105' : 'text-gray-400'}`}>
                                  {depthRange >= 1.25 && yawRange >= 0.18
                                    ? "✨ PERFECT! HOLD STILL FOR VERIFICATION..."
                                    : (depthRange < 1.25 ? "Move head closer/further" : "Now turn your head slowly")}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {faceMatchStep === 'success' && (
                          <div className="w-full h-14 bg-green-500 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 animate-in zoom-in duration-300">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            Verified Successfully
                          </div>
                        )}

                        {faceMatchStep === 'flagged' && (
                          <div className="w-full h-14 bg-orange-500 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 animate-in zoom-in duration-300">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Flagged for Review
                          </div>
                        )}

                        <button
                          onClick={() => {
                            stopCamera();
                            setIsMarkingAttendance(false);
                            setAttendanceStep('idle');
                          }}
                          className="w-full h-12 bg-gray-50 text-gray-400 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GPS Locking Overlay */}
              {isLocationChecking && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300">
                  <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 p-8 text-center">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <div className="absolute inset-0 border-4 border-blue-50 rounded-full"></div>
                      <div
                        className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
                        style={{ borderRightColor: 'transparent' }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-gray-900 mb-2">Locking GPS...</h3>
                    <p className="text-gray-500 text-sm mb-6 font-medium">Connecting to satellites for high accuracy attendance</p>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Accuracy</span>
                        <span className={`text-xs font-bold ${gpsAccuracy && gpsAccuracy <= 100 ? 'text-green-600' : 'text-orange-500'}`}>
                          {gpsAccuracy ? `${gpsAccuracy}m` : 'Calculating...'}
                        </span>
                      </div>

                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                          style={{ width: `${lockProgress}%` }}
                        ></div>
                      </div>

                      <p className="text-[11px] text-gray-400 font-bold italic animate-bounce">
                        {gpsAccuracy && gpsAccuracy > 300
                          ? "📍 Move closer to a window for faster lock"
                          : "Please wait, filtering network signal..."}
                      </p>
                    </div>

                    <button
                      onClick={() => setIsLocationChecking(false)}
                      className="mt-8 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Cancel Verification
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setShowProfile(false)}
                  className="w-10 h-10 rounded-full border border-solid border-[#9CA3AF] bg-white text-foreground flex items-center justify-center transition-colors hover:bg-filler flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-base font-semibold text-foreground">Profile</h1>
                </div>
              </div>

              <div className="rounded-lg border border-solid border-[#9CA3AF] bg-filler p-4 md:p-6">
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 md:gap-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {studentProfile.profilePicture ? (
                        <img
                          src={studentProfile.profilePicture}
                          alt={studentProfile.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(studentProfile.name)
                      )}
                    </div>
                    <div className="text-center space-y-2">
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-base font-semibold text-foreground">{studentProfile.name}</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${studentProfile.studentStatus === 'out' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                          {studentProfile.studentStatus || 'in'}
                        </span>
                      </div>
                      <p className="text-sm text-secondary">{studentProfile.email}</p>

                      {studentProfile.registrationId && (
                        <div className="mt-4 flex flex-col items-center gap-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                          <p className="text-xs font-black text-blue-600 tracking-widest uppercase">Registration ID</p>
                          <p className="text-lg font-black text-gray-900 leading-none">{studentProfile.registrationId}</p>
                          <div className="scale-[0.85] py-2">
                            <Barcode
                              value={studentProfile.registrationId}
                              width={1.5}
                              height={50}
                              fontSize={12}
                              background="#ffffff"
                              lineColor="#000000"
                              displayValue={false}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                    {formBuilderConfig.filter(f => f.visible).map((field) => {
                      const value = (studentProfile as any)[field.id] || studentProfile.dynamicFields?.[field.id] || "N/A";
                      const displayValue = (field.type === 'date' || field.id === 'joiningDate') ? formatDate(value) : value;

                      return (
                        <div key={field.id} className="flex flex-col">
                          <p className="text-secondary mb-1">{field.label}</p>
                          <p className="text-foreground font-medium">{displayValue}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => router.push("/onboarding")}
                  className="w-full px-4 py-3 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[#383838] transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Mandatory Device Registration Modal */}
      {
        showDeviceRegistration && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-8 text-center space-y-6">
              <div className={`w-20 h-20 ${studentProfile?.deviceId ? 'bg-amber-100' : 'bg-blue-100'} rounded-full flex items-center justify-center mx-auto text-3xl`}>
                {studentProfile?.deviceId ? '⚠️' : '📱'}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {studentProfile?.deviceId ? 'Multiple Device Detected' : 'Device Verification Required'}
                </h2>
                <p className="text-gray-600">
                  {studentProfile?.deviceId
                    ? "Your account is already registered with another device. For security reasons, you can only use one device at a time."
                    : "To ensure security and prevent unauthorized check-ins, you must register this device with your account. This is a one-time mandatory step."}
                </p>
              </div>

              {studentProfile?.deviceId ? (
                <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-700 font-bold border border-amber-100">
                  Please contact the Administrator to reset your device link if you have a new phone or have lost your previous device.
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 font-medium font-outfit">
                  Note: Once registered, your check-ins and permissions will be locked to this specific device.
                </div>
              )}

              {!studentProfile?.deviceId && (
                <button
                  onClick={handleRegisterDevice}
                  disabled={isRegisteringDevice}
                  className={`w-full h-14 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-200 transition-all active:scale-95 ${isRegisteringDevice ? "opacity-75 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow-xl"
                    }`}
                >
                  {isRegisteringDevice ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registering...
                    </div>
                  ) : (
                    "Register This Device Now"
                  )}
                </button>
              )}

              {studentProfile?.deviceId && (
                <button
                  onClick={handleLogout}
                  className="w-full h-14 rounded-2xl bg-gray-100 text-gray-900 font-bold text-lg hover:bg-gray-200 transition-all active:scale-95"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )
      }

      {/* Notification Popup */}
      {
        showNotifPopup && currentNotification && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className={`bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 border-b-4 ${currentNotification.priority === 'critical' ? 'border-red-600' : currentNotification.priority === 'urgent' ? 'border-orange-500' : 'border-blue-600'}`}>
              <div className="flex items-center justify-between">
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${currentNotification.priority === 'critical' ? 'bg-red-100 text-red-600' : currentNotification.priority === 'urgent' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                  Message from Dean
                </div>
                <span className="text-[10px] text-gray-400">{new Date(currentNotification.createdAt).toLocaleDateString()}</span>
              </div>
              {currentNotification.image && (
                <div className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                  <img src={currentNotification.image} alt="Notification" className="w-full h-auto object-contain max-h-[300px]" />
                </div>
              )}
              <p className="text-gray-800 font-medium leading-relaxed">
                {currentNotification.message}
              </p>
              <button
                onClick={() => handleAcknowledge(currentNotification._id)}
                disabled={isAcknowledging}
                className={`w-full h-12 rounded-xl text-white font-bold transition-all active:scale-95 ${currentNotification.priority === 'critical' ? 'bg-red-600 hover:bg-red-700' : currentNotification.priority === 'urgent' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
              >
                {isAcknowledging ? 'Acknowledging...' : 'I have Read & Acknowledged'}
              </button>
            </div>
          </div>
        )
      }
      {/* Payment Modal */}
      {
        false && showPaymentModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b flex items-center justify-between bg-gray-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Hostel Fee Payment</h2>
                  <p className="text-xs font-medium text-gray-500">Secure Direct Transfer Portal</p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-6">
                {/* Payment Method Selector */}
                <div className="flex p-1 bg-gray-100 rounded-2xl">
                  <button
                    onClick={() => setPaymentMethod("upi")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${paymentMethod === "upi" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    Pay via App (UPI)
                  </button>
                  <button
                    onClick={() => setPaymentMethod("qr")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${paymentMethod === "qr" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    Show QR Code
                  </button>
                </div>

                {paymentMethod === "qr" ? (
                  /* QR Code Display */
                  <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-white rounded-[40px] border-2 border-dashed border-gray-100 animate-in zoom-in-95 duration-300">
                    {bankSettings?.bank?.qrImage ? (
                      <div className="relative group perspective-1000">
                        <div className="absolute -inset-10 bg-blue-100/40 rounded-full blur-3xl group-hover:bg-blue-200/40 transition-all duration-700 animate-pulse"></div>
                        <img
                          src={bankSettings.bank.qrImage}
                          alt="Payment QR"
                          className="relative w-72 h-72 md:w-[400px] md:h-[400px] object-contain bg-white p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      </div>
                    ) : (
                      <div className="w-72 h-72 md:w-[400px] md:h-[400px] bg-gray-50 rounded-3xl flex flex-col items-center justify-center text-center p-10 text-gray-400">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v1m6 11h.01M9 20h6a2 2 0 002-2V6a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2zM9 16h6" /></svg>
                        <p className="text-sm font-black uppercase tracking-widest leading-tight opacity-40">No QR image provided</p>
                      </div>
                    )}
                    <div className="mt-10 text-center">
                      <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Selected Amount to Pay</p>
                      <p className="text-4xl md:text-5xl font-black text-gray-900 leading-none tracking-tighter">₹{paymentForm.amount || "0"}</p>
                    </div>
                  </div>
                ) : (
                  /* Bank Details Card + UPI Button */
                  <>
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden animate-in slide-in-from-left-4 duration-300">
                      <div className="relative z-10 space-y-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-black opacity-80 mb-1">Official Bank Account</p>
                            <h3 className="text-lg font-black leading-tight">{bankSettings?.bank?.accountName || "UNIVERSITY HOSTEL ACCOUNT"}</h3>
                            <p className="text-[11px] font-bold opacity-70 mt-0.5">{bankSettings?.bank?.bankName || "National Bank of University"}</p>
                          </div>
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.5 12c0 2.485-2.015 4.5-4.5 4.5S2.5 14.485 2.5 12 4.515 7.5 7 7.5s4.5 2.015 4.5 4.5zM12.5 12c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5-2.015 4.5-4.5 4.5-4.5-2.015-4.5-4.5z" opacity=".5" /></svg>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">
                          <div>
                            <p className="text-[10px] uppercase opacity-70 font-black tracking-widest">Account Number</p>
                            <p className="text-sm font-mono font-black tracking-widest pt-0.5">{bankSettings?.bank?.accountNumber || "XXXXXXXXXXXX"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase opacity-70 font-black tracking-widest">IFSC Code</p>
                            <p className="text-sm font-mono font-black tracking-widest pt-0.5">{bankSettings?.bank?.ifscCode || "XXXX000XXXX"}</p>
                          </div>
                          <div className="col-span-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] uppercase opacity-70 font-black tracking-widest">UPI ID</p>
                              <span className="text-[10px] font-black text-blue-300 uppercase">One-tap Copy Available</span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(bankSettings?.bank?.upiId || "");
                                alert("UPI ID Copied!");
                              }}
                              className="w-full mt-1.5 p-3 rounded-2xl bg-white/10 border border-white/10 text-left flex items-center justify-between group hover:bg-white/20 transition-all"
                            >
                              <span className="font-black text-xs">{bankSettings?.bank?.upiId || "university@upi"}</span>
                              <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7m-4 4h8m-4-4v8" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Decorative Card Design Elements */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full -ml-16 -mb-16 blur-2xl"></div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Fastest Mobile Option</p>
                      <a
                        href={`upi://pay?pa=${bankSettings?.bank?.upiId || ""}&pn=${encodeURIComponent(bankSettings?.bank?.accountName || "University")}&cu=INR`}
                        className="w-full h-16 bg-[#0070E0] text-white rounded-3xl flex items-center justify-center gap-4 shadow-xl shadow-blue-200 hover:bg-[#005bb5] transition-all active:scale-[0.98] group"
                      >
                        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-[#0070E0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                          <span className="text-lg font-black tracking-tight">PAY NOW VIA UPI</span>
                          <span className="text-[9px] font-bold opacity-80 uppercase tracking-widest">Auto-opens GPay, PhonePe, etc.</span>
                        </div>
                        <svg className="w-5 h-5 ml-1 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </a>
                    </div>
                  </>
                )}

                {/* Instructions Section */}
                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 flex gap-4">
                  <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[11px] text-orange-900 leading-relaxed font-medium">
                    <strong className="block text-xs font-black uppercase tracking-tight mb-0.5">Payment Instruction:</strong>
                    {bankSettings?.instructions || "Pay the fee exactly using any UPI app and submit your 12-digit UTR number here."}
                  </p>
                </div>

                {/* Submission Form */}
                <div className="space-y-4 pt-2 border-t border-dashed border-gray-100">
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] text-center">Enter Amount to Pay (Editable)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">₹</span>
                      <input
                        type="number"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full h-16 pl-10 pr-4 rounded-2xl border-2 border-blue-200 bg-white text-3xl font-black text-gray-900 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-center"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[9px] text-blue-500 font-bold text-center uppercase tracking-widest leading-tight">Installments Allowed: You can change this amount</p>
                  </div>

                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider pt-2">Complete Verification</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Transaction (UTR) Number</label>
                      <input
                        type="text"
                        placeholder="12 digit number from GPay/PhonePe"
                        value={paymentForm.utrNumber}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, utrNumber: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Payment App Used</label>
                      <select
                        value={paymentForm.paymentSource}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentSource: e.target.value }))}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                      >
                        <option value="GPay">Google Pay</option>
                        <option value="PhonePe">PhonePe</option>
                        <option value="Paytm">Paytm</option>
                        <option value="NetBanking">Net Banking</option>
                        <option value="Other">Other UPI</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handlePaymentSubmit}
                    disabled={isSubmittingPayment || paymentForm.utrNumber.length < 8}
                    className="w-full h-14 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingPayment ? (
                      <>
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Confirm & Submit Claim"
                    )}
                  </button>
                </div>

                {/* History List */}
                {paymentHistory.length > 0 && (
                  <div className="space-y-3 pt-6 border-t">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Previous Submissions</h3>
                    <div className="space-y-2">
                      {paymentHistory.map((p) => (
                        <div key={p._id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-gray-900">UTR: {p.utrNumber}</p>
                            <p className="text-[10px] text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-900">₹{p.amount}</p>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${p.status === 'verified' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {p.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {isMarkingAttendance && attendanceStep !== 'face-match' && attendanceStep !== 'idle' && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                {attendanceStep === 'gps' || attendanceStep === 'accuracy' ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : attendanceStep === 'saving' ? (
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : attendanceStep === 'done' ? (
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-1 capitalize">
                {(attendanceStep as string).replace('-', ' ')}...
              </h3>
              <p className="text-gray-500 text-xs font-medium">
                {attendanceStep === 'gps' ? "Acquiring satellite signal" :
                  attendanceStep === 'accuracy' ? "Filtering for high accuracy" :
                    attendanceStep === 'saving' ? "Encrypting and syncing records" :
                      attendanceStep === 'done' ? "Identity verified & record saved" :
                        "Finalizing your attendance"}
              </p>
            </div>

            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-700 rounded-full ${attendanceStep === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}
                style={{
                  width: attendanceStep === 'gps' ? '25%' :
                    attendanceStep === 'accuracy' ? '50%' :
                      attendanceStep === 'saving' ? '85%' :
                        attendanceStep === 'done' ? '100%' : '10%'
                }}
              ></div>
            </div>

            {attendanceStep === 'error' && (
              <button
                onClick={() => setIsMarkingAttendance(false)}
                className="mt-4 text-[10px] font-black uppercase text-red-500 tracking-[0.2em] hover:text-red-600 transition-colors"
              >
                Close & Try Again
              </button>
            )}
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 px-4 w-full max-w-sm">
          <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-500/20 backdrop-blur-md">
            <svg className="w-6 h-6 text-white/90 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-bold tracking-tight" style={{ fontFamily: 'Cambria, serif' }}>{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}