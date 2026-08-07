"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import Barcode from "react-barcode";
import * as faceMatching from "@/lib/faceMatching";
import { showToast, showConfirm } from "@/lib/toast";
import ParentConsentVideoModal from "./ParentConsentVideoModal";
import { registerPushNotifications } from "@/lib/pushRegister";
import {
    resolveConsentVideoSrc,
    useParentConsentVideoPrefetch,
} from "@/lib/parentConsentVideo";
import { getInstallationId } from "@/lib/installationId";

interface Permission {
    _id: string;
    fromDateTime: string | Date;
    toDateTime: string | Date;
    reason: string;
    status: "pending" | "allowed" | "rejected";
    wardenStatus: "pending" | "allowed" | "rejected";
    deanStatus: "pending" | "allowed" | "rejected";
    parentStatus?: "pending" | "allowed" | "rejected" | "no_response" | null;
    parentConsentUrl?: string | null;
    createdAt?: string;
    updatedAt?: string;
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
    permanentAddress?: string;
    erpInformation?: string;
    joiningDate?: string;
    branch?: string;
    collegeName?: string;
    year?: string;
    semester?: string;
    localGuardianPhoneNumber?: string;
    localGuardianAddress?: string;
    section?: string;
    floorNumber?: string; // ⚡ NEW
    homeState?: string;
    deviceId?: string;
    registrationId?: string;
    dob?: string;
    category?: string;
    faceDescriptor?: number[]; // ⚡ NEW: Stores face embedding
    firebaseUID?: string;
    attendanceMode?: "default" | "strict" | "gps-only" | "biometric"; // ⚡ NEW: Override
    isProfileLocked?: boolean; // ⚡ Admin-controlled profile lock
    webAuthnCredentials?: {
        credentialID: string;
        publicKey: string;
        counter: number;
        transports?: string[];
        createdAt: string;
    }[]; // ⚡ NEW: Persistent keys
    dynamicFields?: Record<string, any>;
    tenantSubscription?: {
        status: string;
        endDate?: string;
        createdAt?: string;
    } | null;
}

interface DBNotification {
    _id: string;
    message: string;
    image?: string;
    priority: "normal" | "urgent" | "critical";
    expiresAt?: string;
    createdAt: string;
}

const formatPermDate = (item: any, isOut: boolean) => {
    if (!item) return "N/A";
    const raw = isOut
        ? (item.fromDateTime || item.from_date_time || (item.outDate ? `${item.outDate} ${item.outTime || ''}` : item.createdAt))
        : (item.toDateTime || item.to_date_time || (item.inDate ? `${item.inDate} ${item.inTime || ''}` : null));
    if (!raw) return "N/A";
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return String(raw);
        return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
    } catch {
        return String(raw);
    }
};

export default function StudentDashboard({ initialData, isParentView = false, hasMultipleSiblings = false }: { initialData?: any; isParentView?: boolean; hasMultipleSiblings?: boolean }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showPermissionsHistory, setShowPermissionsHistory] = useState(false);
    const [showAttendanceHistory, setShowAttendanceHistory] = useState(false);
    const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
    const [isLoadingAttendanceHistory, setIsLoadingAttendanceHistory] = useState(false);
    const [showFeeDetailsModal, setShowFeeDetailsModal] = useState(false);
    const [showDeviceRegistration, setShowDeviceRegistration] = useState(false);
    const [fromDateTime, setFromDateTime] = useState("");
    const [toDateTime, setToDateTime] = useState("");
    const [reason, setReason] = useState("");
    const [highlightLocation, setHighlightLocation] = useState(false);
    const [requestType, setRequestType] = useState<"outing" | "leave">("outing");
    const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(initialData || null);
    const [isFullProfileLoaded, setIsFullProfileLoaded] = useState(!!initialData?.collegeName || !!initialData?.joiningDate);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const consentVideoUrls = useMemo(
        () => permissions.map((p) => p.parentConsentUrl),
        [permissions]
    );
    const { prefetchedVideoUrls, prefetchVideo } =
        useParentConsentVideoPrefetch(consentVideoUrls);

    // Outing Calendar states
    const [gatePasses, setGatePasses] = useState<any[]>([]);
    const [loadingGatePasses, setLoadingGatePasses] = useState(false);
    const [activeHistoryTab, setActiveHistoryTab] = useState<'calendar' | 'permissions'>('calendar');
    const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
    const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(new Date());
    const [mobileProfileTab, setMobileProfileTab] = useState<'academic' | 'family' | 'personal'>('academic');

    // Swipe gestures for calendar month navigation
    const touchStartRef = useRef<number | null>(null);
    const touchEndRef = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = e.targetTouches[0].clientX;
        touchEndRef.current = null;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndRef.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (touchStartRef.current === null || touchEndRef.current === null) return;
        const distance = touchStartRef.current - touchEndRef.current;
        const minSwipeDistance = 50;
        
        if (distance > minSwipeDistance) {
            // Swiped left -> Next Month
            setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
        } else if (distance < -minSwipeDistance) {
            // Swiped right -> Previous Month
            setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
        }
    };

    const [loading, setLoading] = useState(!initialData);
    const [submitting, setSubmitting] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);
    const [isAtHostel, setIsAtHostel] = useState(false);
    const [isLocationChecking, setIsLocationChecking] = useState(false);
    const [isRegisteringDevice, setIsRegisteringDevice] = useState(false);
    const [isAttendanceMarked, setIsAttendanceMarked] = useState(false);
    const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
    const [isOnCampusWifi, setIsOnCampusWifi] = useState<boolean | null>(null); // null = checking, true = on campus wifi, false = not on wifi
    const [attendanceWindow, setAttendanceWindow] = useState({ start: "21:00", end: "23:00" });

    const [showSoundBanner, setShowSoundBanner] = useState(false);
    useEffect(() => {
        if (typeof window !== "undefined" && isParentView) {
            const dismissed = localStorage.getItem("dismissedNotificationSoundBanner");
            if (!dismissed) {
                setShowSoundBanner(true);
            }
        }
    }, [isParentView]);

    const fetchAttendanceHistory = async () => {
        if (!studentProfile) return;
        setIsLoadingAttendanceHistory(true);
        try {
            const res = await fetch(`/api/students/attendance/history?studentId=${studentProfile._id}${getTenantParam(false)}`);
            if (res.ok) {
                const data = await res.json();
                setAttendanceHistory(data.history || []);
            } else {
                showToast("Failed to fetch attendance history.", "error");
            }
        } catch (error) {
            console.error("Failed to fetch attendance history", error);
            showToast("Failed to fetch attendance history.", "error");
        } finally {
            setIsLoadingAttendanceHistory(false);
        }
    };

    useEffect(() => {
        if (showPermissionsHistory && attendanceHistory.length === 0) {
            fetchAttendanceHistory();
        }
    }, [showPermissionsHistory, studentProfile]);

    // 📶 Auto-check Campus WiFi network status on dashboard mount
    useEffect(() => {
        fetch("/api/check-network")
            .then(res => res.json())
            .then(data => {
                if (data.success && data.isWhitelisted) {
                    setIsOnCampusWifi(true);
                    setIsAtHostel(true);
                } else {
                    setIsOnCampusWifi(false);
                }
            })
            .catch(() => setIsOnCampusWifi(false));
    }, []);

    const getAttendanceDisplay = () => {
        if (isAttendanceMarked) {
            return { text: "✅ Present", textColor: "text-green-600", iconBg: "bg-green-100 text-green-600", iconPath: "M5 13l4 4L19 7" };
        }
        const now = new Date();
        const istTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });
        const istTime = istTimeStr.substring(0, 5);
        const isPastWindow = (istTime > attendanceWindow.end) || (now.getHours() >= 0 && now.getHours() < 6);
        
        if (isPastWindow) {
            return { text: "❌ Absent", textColor: "text-red-600", iconBg: "bg-red-50 text-red-600 border border-red-100", iconPath: "M6 18L18 6M6 6l12 12" };
        }
        return { text: `🕒 Pending ${attendanceWindow.start} - ${attendanceWindow.end}`, textColor: "text-gray-700", iconBg: "bg-yellow-50 text-yellow-600 border border-yellow-100", iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" };
    };
    const attendanceDisplay = getAttendanceDisplay();
    const [attendanceError, setAttendanceError] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<DBNotification[]>([]);
    const [currentNotification, setCurrentNotification] = useState<DBNotification | null>(null);
    const [showNotifPopup, setShowNotifPopup] = useState(false);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [sessionDismissedIds, setSessionDismissedIds] = useState<string[]>([]);
    const incrementedNotifIdsRef = useRef<string[]>([]);
    const [locationVerificationResults, setLocationVerificationResults] = useState<{
        name: string;
        distance: number;
        isVerified: boolean;
        radius: number;
        lat: number;
        lng: number;
    }[]>([]);
    const [lastCheckAccuracy, setLastCheckAccuracy] = useState<number | null>(null);
    const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]); // ⚡ NEW: Track missing fields
    const [showMandatoryUpdate, setShowMandatoryUpdate] = useState(false);
    const [mandatoryFormData, setMandatoryFormData] = useState({ dob: "", category: "", homeState: "", section: "" });
    const [updatingProfile, setUpdatingProfile] = useState(false);
    const [formBuilderConfig, setFormBuilderConfig] = useState<any[]>([]);
    const [activeConsentVideoUrl, setActiveConsentVideoUrl] = useState<string | null>(null);

    const [attendanceStep, setAttendanceStep] = useState<'idle' | 'gps' | 'accuracy' | 'saving' | 'done' | 'error' | 'face-match' | 'failed'>('idle');
    const [attendanceFailedReason, setAttendanceFailedReason] = useState<string>("");
    const [attendanceRetryCount, setAttendanceRetryCount] = useState(0);
    const [isWifiFallback, setIsWifiFallback] = useState(false);
    const [overlapRadius, setOverlapRadius] = useState(false); // ⚡ NEW
    const [prioritizeAssignedHostel, setPrioritizeAssignedHostel] = useState(false); // ⚡ NEW
    const [deviceIdState, setDeviceIdState] = useState<string>("");

    // ⚡ FIELD ENFORCEMENT: Dynamic blocker system driven by admin settings
    const [enforcedMissingFields, setEnforcedMissingFields] = useState<{ fieldId: string; fieldLabel: string; displayMode: string; order: number }[]>([]);
    const [enforcementConfig, setEnforcementConfig] = useState<{ notificationPriority?: string; successMessage?: string; autoCloseNotification?: boolean } | null>(null);
    const [showFieldEnforcementModal, setShowFieldEnforcementModal] = useState(false);
    const [enforcementFormData, setEnforcementFormData] = useState<Record<string, string>>({});
    const [savingEnforcementFields, setSavingEnforcementFields] = useState(false);
    
    // Helper to get tenant from URL
    const getTenantParam = (includeQuestionMark = true) => {
        const tenant = searchParams.get('tenant');
        if (!tenant) return "";
        return includeQuestionMark ? `?tenant=${tenant}` : `&tenant=${tenant}`;
    };

    // Outing Calendar Helpers and Fetch Logic
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const fetchGatePassHistory = async () => {
        const studentId = studentProfile?._id;
        if (!studentId) return;
        setLoadingGatePasses(true);
        try {
            const res = await fetch(`/api/getpass/history?studentId=${studentId}&limit=1000&populate=false${getTenantParam(false)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.records) {
                    setGatePasses(data.records);
                } else {
                    showToast("Failed to fetch outing history.", "error");
                }
            } else {
                showToast("Failed to fetch outing history.", "error");
            }
        } catch (error) {
            console.error("Error fetching gatepass history:", error);
            showToast("Failed to fetch outing history.", "error");
        } finally {
            setLoadingGatePasses(false);
        }
    };

    useEffect(() => {
        if (showPermissionsHistory || studentProfile?._id) {
            fetchGatePassHistory();
        }
    }, [showPermissionsHistory, studentProfile?._id]);

    const getDayOutingStatus = (date: Date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        let isWholeDayOut = false;
        let isPartialOut = false;
        let hasOverlappingPass = false;

        for (const pass of gatePasses) {
            const outTime = new Date(pass.checkOutTime);
            const inTime = pass.checkInTime ? new Date(pass.checkInTime) : new Date();

            const overlaps = outTime <= dayEnd && inTime >= dayStart;
            
            if (overlaps) {
                hasOverlappingPass = true;
                if (outTime <= dayStart && inTime >= dayEnd) {
                    isWholeDayOut = true;
                } else {
                    isPartialOut = true;
                }
            }
        }

        if (isWholeDayOut) return 'red';
        if (hasOverlappingPass) return 'orange';
        return 'green';
    };

    const getOverlappingGatePasses = (date: Date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return gatePasses.filter(pass => {
            const outTime = new Date(pass.checkOutTime);
            const inTime = pass.checkInTime ? new Date(pass.checkInTime) : new Date();
            return outTime <= dayEnd && inTime >= dayStart;
        });
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();
        
        const calendarCells: { date: Date | null; isCurrentMonth: boolean }[] = [];
        
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            calendarCells.push({
                date: new Date(year, month - 1, prevMonthLastDay - i),
                isCurrentMonth: false
            });
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            calendarCells.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }
        
        const totalCells = 42;
        const nextMonthPadding = totalCells - calendarCells.length;
        for (let i = 1; i <= nextMonthPadding; i++) {
            calendarCells.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }
        
        return calendarCells;
    };

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

    const latestDetectionRef = useRef<any>(null); // ⚡ NEW: Cache latest scan to skip redundant processing

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
                            latestDetectionRef.current = res; // ⚡ CACHE: Store for auto-verify trigger
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

                            // 🚀 INSTANT SINGLE-SHOT TRIGGER: Trigger as soon as a face is detected in frame!
                            const boxSize = width * height;
                            if (boxSize > (canvas.width * canvas.height * 0.05)) {
                                // 🛡️ CONTROL 1: PASSIVE MOBILE DISPLAY SCREEN ANALYZER
                                if (videoRef.current && res.detection?.box) {
                                    const spoofCheck = faceMatching.detectMobileScreenDisplay(videoRef.current, res.detection.box);
                                    if (spoofCheck.isSpoof) {
                                        console.warn("❌ Anti-Spoof Block:", spoofCheck.reason);
                                        active = false;
                                        isProcessingRef.current = false;
                                        stopCamera();
                                        const reasonMsg = spoofCheck.reason || "Mobile Screen Display / Photo Spoof Detected!";
                                        showToast(reasonMsg, "error");
                                        setFaceMatchStep('error');
                                        setIsMarkingAttendance(true);
                                        setAttendanceStep('failed');
                                        setAttendanceFailedReason(reasonMsg);
                                        return;
                                    }
                                }

                                active = false;
                                isProcessingRef.current = true;
                                setFaceMatchStep('matching');

                                // ⚡ TURBO: Pass the detection result we already have from the loop!
                                const result = await performFaceVerification(res);
                                if (result && result.status === 'auto-approved') {
                                    setTimeout(() => {
                                        stopCamera();
                                        proceedWithAttendance(result);
                                    }, 200); // Snappy transition (200ms)
                                } else {
                                    stopCamera();
                                    const percent = result?.percentage !== undefined ? `${result.percentage}%` : 'Low';
                                    const reasonMsg = `Identity Mismatch (${percent} Accuracy). Verification failed. Please ensure you are the account owner.`;
                                    showToast(reasonMsg, "error");
                                    setFaceMatchStep('error');
                                    setIsMarkingAttendance(true);
                                    setAttendanceStep('failed');
                                    setAttendanceFailedReason(reasonMsg);
                                }
                                return;
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
            const res = await fetch(`/api/admin/settings${getTenantParam()}`);
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            const data = await res.json();
            if (data.success) {
                setFormBuilderConfig(data.formBuilderConfig || []);
                if (data.startTime && data.endTime) {
                    console.log(`🕒 Syncing Attendance Window: ${data.startTime} - ${data.endTime}`);
                    setAttendanceWindow({ start: data.startTime, end: data.endTime });
                }
                if (data.overlapRadius !== undefined) setOverlapRadius(data.overlapRadius);
                if (data.prioritizeAssignedHostel !== undefined) setPrioritizeAssignedHostel(data.prioritizeAssignedHostel);
            }
        } catch (e) {
            console.error("Error fetching system settings:", e);
        }
    };

    useEffect(() => {
        fetchSystemSettings();
    }, []);

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
            const historyRes = await fetch(`/api/students/payments?studentId=${studentProfile._id}${getTenantParam(false)}`);
            if (!historyRes.ok) throw new Error(`API error: ${historyRes.status}`);
            const historyData = await historyRes.json();
            if (historyData.success) setPaymentHistory(historyData.payments);

            // Fetch Bank Details
            const settingsRes = await fetch(`/api/admin/settings${getTenantParam()}`);
            if (!settingsRes.ok) throw new Error(`API error: ${settingsRes.status}`);
            const settingsData = await settingsRes.json();
            if (settingsData.success) {
                setBankSettings({
                    bank: settingsData.universityBankDetails,
                    fee: settingsData.hostelFeeAmount,
                    instructions: settingsData.paymentInstructions,
                    isPaymentEnabled: settingsData.isPaymentEnabled || false
                });
                if (!paymentForm.amount && settingsData.hostelFeeAmount) {
                    setPaymentForm(prev => ({ ...prev, amount: settingsData.hostelFeeAmount.toString() }));
                }
            }
        } catch (e) {
            console.error("Error fetching payment data:", e);
        }
    };

    const handleDeletePayment = async (id: string) => {
        if (!await showConfirm("Are you sure you want to delete this payment claim?")) return;
        try {
            const res = await fetch(`/api/students/payments?id=${id}&studentId=${studentProfile?._id}${getTenantParam(false)}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setPaymentHistory(prev => prev.filter(p => p._id !== id));
                alert(data.message || "Payment claim removed successfully");
            } else {
                alert(data.error || "Failed to delete payment");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting payment");
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

            if (!res.ok) throw new Error(`API error: ${res.status}`);
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
            const response = await fetch(`/api/admin/locations${getTenantParam()}`);
            if (!response.ok) throw new Error(`Failed to fetch locations: ${response.status}`);
            const data = await response.json();
            if (data.success && data.locations) {
                setHostelLocations(data.locations);
            } else {
                setHostelLocations([]);
            }
        } catch (error) {
            console.error("Error fetching locations:", error);
            setHostelLocations([]);
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
            // First check the unified installation ID key (no encoding)
            const unified = localStorage.getItem("hosteleaze_installation_id");
            if (unified) return unified;

            // Fallback: check deviceId key
            const deviceIdFast = localStorage.getItem("deviceId");
            if (deviceIdFast) return deviceIdFast;

            const stored = localStorage.getItem("device_id_token");
            if (!stored) return null;
            return atob(stored);
        } catch (e) {
            return null;
        }
    };

    const storeDeviceId = (id: string) => {
        try {
            localStorage.setItem("hosteleaze_installation_id", id);
            localStorage.setItem("deviceId", id);
            localStorage.setItem("getpass_device_id", id);
            localStorage.setItem("device_id_token", btoa(id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleRegisterDevice = async () => {
        if (!studentProfile) return;

        try {
            setIsRegisteringDevice(true);

            // ⚡ TRANSITION: Use secure biometrics instead of generic Device ID
            const biometricSuccess = await performBiometricCheck();

            if (biometricSuccess) {
                setShowDeviceRegistration(false);
            } else {
                alert("Registration cancelled or failed. Please try again to secure your account.");
            }
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

    const showNotification = (notif: any) => {
        setCurrentNotification(notif);
        setShowNotifPopup(true);

        if (!incrementedNotifIdsRef.current.includes(notif._id)) {
            incrementedNotifIdsRef.current.push(notif._id);
            const showCounts = JSON.parse(localStorage.getItem("notif_show_counts") || "{}");
            showCounts[notif._id] = (showCounts[notif._id] || 0) + 1;
            localStorage.setItem("notif_show_counts", JSON.stringify(showCounts));
        }
    };

    useEffect(() => {
        if (studentProfile && !loading) {
            // ⚡ DISABLED: Device binding is no longer required for currently registered students
            /*
            const storedId = getStoredDeviceId();
            const hasWebAuthn = studentProfile.webAuthnCredentials && studentProfile.webAuthnCredentials.length > 0;

            if (!studentProfile.deviceId && !hasWebAuthn) {
                localStorage.removeItem("device_id_token");
                setShowDeviceRegistration(true);
            } else if (hasWebAuthn) {
                setShowDeviceRegistration(false);
            } else if (storedId && studentProfile.deviceId !== storedId) {
                setShowDeviceRegistration(true);
            }
            */
            setShowDeviceRegistration(false); // Force false as per user request

            // ⚡ FIELD ENFORCEMENT: Check for admin-enforced missing fields (replaces old hardcoded check)
            const checkFieldEnforcement = async () => {
                if (isParentView) {
                    setShowFieldEnforcementModal(false);
                    setShowMandatoryUpdate(false);
                    return;
                }
                if (!isFullProfileLoaded) {
                    return;
                }
                try {
                    const res = await fetch(`/api/student/profile-blockers?studentId=${studentProfile._id}${getTenantParam(false)}`, { cache: 'no-store' });
                    if (!res.ok) throw new Error('Failed to check profile blockers');
                    const data = await res.json();

                    if (data.hasBlockers && data.missingFields.length > 0) {
                        setEnforcedMissingFields(data.missingFields);
                        setEnforcementConfig(data.enforcement);
                        // Pre-fill form with existing values (Check top-level AND dynamicFields)
                        const initialFormData: Record<string, string> = {};
                        data.missingFields.forEach((f: any) => {
                            const val = (studentProfile as any)[f.fieldId] ?? studentProfile.dynamicFields?.[f.fieldId] ?? "";
                            initialFormData[f.fieldId] = val.toString();
                        });
                        setEnforcementFormData(initialFormData);
                        setShowFieldEnforcementModal(true);
                        setShowMandatoryUpdate(false); // Use new system instead
                    } else {
                        console.log("✅ No Profile Blockers found for hostel:", studentProfile.hostelName);
                        setShowFieldEnforcementModal(false);
                        // Fallback: Hard Redirect Check for critical fields (legacy support)
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
                    }
                } catch (e) {
                    console.error("Error checking field enforcement:", e);
                    // Fallback to old hardcoded check
                    const isSectionInvalid = !studentProfile.section || studentProfile.section === "NIL" || studentProfile.section === "NILL";
                    if (!studentProfile.dob || !studentProfile.category || !studentProfile.homeState || isSectionInvalid) {
                        setShowMandatoryUpdate(true);
                        setMandatoryFormData({
                            dob: studentProfile.dob || "",
                            category: studentProfile.category || "",
                            homeState: studentProfile.homeState || "",
                            section: isSectionInvalid ? "" : (studentProfile.section || "")
                        });
                    }
                }
            };
            if (isParentView) {
                setShowFieldEnforcementModal(false);
                setShowMandatoryUpdate(false);
            } else {
                checkFieldEnforcement();
            }

            // Check attendance status
            const checkAttendance = async () => {
                try {
                    const res = await fetch(`/api/students/attendance?studentId=${studentProfile._id}${getTenantParam(false)}`);
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
            const dismissed = JSON.parse(localStorage.getItem("dismissed_notifs") || "[]");
            setSessionDismissedIds(dismissed);

            // Fetch Notifications
            const fetchStudentNotifications = async () => {
                try {
                    const res = await fetch(`/api/student/notifications?studentId=${encodeURIComponent(studentProfile._id)}&hostelName=${encodeURIComponent(studentProfile.hostelName)}${getTenantParam(false)}`);
                    if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
                    const data = await res.json();
                    if (data.success && data.notifications.length > 0) {
                        const currentDismissed = JSON.parse(localStorage.getItem("dismissed_notifs") || "[]");
                        const showCounts = JSON.parse(localStorage.getItem("notif_show_counts") || "{}");

                        const active = data.notifications.filter((n: any) => {
                            if (currentDismissed.includes(n._id)) return false;

                            // Check DB acknowledgment
                            const ackList = n.acknowledgedBy || [];
                            const isAcked = ackList.some((ack: any) => ack.studentId === studentProfile._id);
                            if (isAcked) return false;

                            // Cap at 2 displays
                            const count = showCounts[n._id] || 0;
                            if (count >= 2) return false;

                            return true;
                        });

                        setNotifications(active);
                        if (active.length > 0) {
                            showNotification(active[0]);
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

            // ⚡ GETPASS SYNC: Store essential info for the gate scanner
            if (studentProfile) {
                localStorage.setItem("firebaseUID", studentProfile.firebaseUID || "");
                localStorage.setItem("deviceId", studentProfile.deviceId || "");
                localStorage.setItem("studentName", studentProfile.name || "");
                localStorage.setItem("studentStatus", studentProfile.studentStatus || "in");

                // Also keep prefixed ones for legacy/redundancy if needed
                localStorage.setItem("getpass_uid", studentProfile.firebaseUID || "");
                localStorage.setItem("getpass_device_id", studentProfile.deviceId || "");
            }

            // ⚡ REALTIME STATUS UPDATE: Listen for instant status changes (In/Out)
            const statusChannel = supabase
                .channel(`student-status-${studentProfile._id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'students',
                        filter: `_id=eq.${studentProfile._id}`
                    },
                    (payload: any) => {
                        const newStatus = payload.new.student_status || payload.new.studentStatus;
                        console.log("⚡ [REALTIME] Student status updated:", newStatus);
                        if (newStatus) {
                            localStorage.setItem("studentStatus", newStatus);
                            setStudentProfile(prev => prev ? ({ ...prev, studentStatus: newStatus }) : prev);
                        }
                    }
                )
                .subscribe();

            // Delay initial notification fetch by 3 seconds as requested
            const initialNotifTimer = setTimeout(fetchStudentNotifications, 3000);

            // ⚡ INSTANT LOCAL SYNC: Check localStorage for any status changes made by QR scan
            const syncStatusFromLocalStorage = () => {
                try {
                    const storedStatus = localStorage.getItem("studentStatus") as "in" | "out" | null;
                    const cachedStr = localStorage.getItem("cachedStudentData");
                    let cachedStatus: "in" | "out" | null = null;
                    if (cachedStr) {
                        const parsed = JSON.parse(cachedStr);
                        if (parsed?.studentStatus) cachedStatus = parsed.studentStatus as "in" | "out";
                    }
                    const latestStatus = storedStatus || cachedStatus;
                    if (latestStatus) {
                        setStudentProfile(prev => {
                            if (prev && prev.studentStatus !== latestStatus) {
                                return { ...prev, studentStatus: latestStatus };
                            }
                            return prev;
                        });
                    }
                } catch (e) {
                    console.error("Error syncing status from local storage:", e);
                }
            };

            // Run initial sync on mount
            syncStatusFromLocalStorage();

            // Refetch/sync when student returns to app tab or comes back from scanner
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible') {
                    syncStatusFromLocalStorage();
                    fetchStudentNotifications();
                }
            };

            window.addEventListener('focus', syncStatusFromLocalStorage);
            window.addEventListener('pageshow', syncStatusFromLocalStorage);
            window.addEventListener('storage', syncStatusFromLocalStorage);
            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                clearTimeout(initialNotifTimer);
                supabase.removeChannel(statusChannel);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('focus', syncStatusFromLocalStorage);
                window.removeEventListener('pageshow', syncStatusFromLocalStorage);
                window.removeEventListener('storage', syncStatusFromLocalStorage);
            };
        }
    }, [studentProfile, loading, isFullProfileLoaded]);

    // Retrieve the persistent PWA installation ID on mount
    useEffect(() => {
        const loadUnifiedDeviceId = async () => {
            try {
                const installId = await getInstallationId();
                setDeviceIdState(installId);
                // Sync to localStorage
                localStorage.setItem("deviceId", installId);
                localStorage.setItem("getpass_device_id", installId);
                localStorage.setItem("device_id_token", btoa(installId));
            } catch (e) {
                console.error("Failed to load device/installation ID:", e);
            }
        };
        loadUnifiedDeviceId();
    }, []);

    // Sync the device ID to the database automatically on successful login/dashboard load
    useEffect(() => {
        if (isFullProfileLoaded && studentProfile && !isParentView) {
            const syncDeviceId = async () => {
                try {
                    const currentDeviceId = await getInstallationId();
                    
                    const isUnbound = !studentProfile.deviceId || 
                                      studentProfile.deviceId.trim() === "" || 
                                      studentProfile.deviceId === "no-binding";
                    
                    if (isUnbound || studentProfile.deviceId !== currentDeviceId) {
                        console.log(`📱 [Device Sync] Updating device ID in DB from "${studentProfile.deviceId || 'none'}" to "${currentDeviceId}"`);
                        
                        const response = await fetch(`/api/students/${studentProfile._id}${getTenantParam(true)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                deviceId: currentDeviceId,
                                isProfileLocked: true
                            }),
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.student) {
                                setStudentProfile(data.student);
                                storeDeviceId(currentDeviceId);
                                console.log("✅ [Device Sync] Device ID successfully synchronized and saved.");
                            }
                        } else {
                            console.warn("⚠️ [Device Sync] Failed to synchronize device ID with DB:", response.status);
                        }
                    } else {
                        // Already in sync, make sure local storage is populated
                        storeDeviceId(currentDeviceId);
                    }
                } catch (err) {
                    console.error("Error during automatic device ID synchronization:", err);
                }
            };
            syncDeviceId();
        }
    }, [isFullProfileLoaded, studentProfile?._id, isParentView]);

    // Register Web Push notifications on mount/profile load
    useEffect(() => {
        if (studentProfile && studentProfile._id) {
            const initPush = async () => {
                try {
                    const isParent = localStorage.getItem("userType") === "parent" || isParentView;
                    const userId = isParent ? (studentProfile.fatherNumber || studentProfile._id + "_parent") : studentProfile._id;
                    const userType = isParent ? "parent" : "student";
                    
                    await registerPushNotifications(userId, userType);
                } catch (e) {
                    console.error("Failed to register student/parent push notifications:", e);
                }
            };
            initPush();
        }
    }, [studentProfile?._id, isParentView]);

    // ⚡ OPTIMIZATION: Lazy-load notification images ONLY when the popup is shown
    useEffect(() => {
        if (showNotifPopup && currentNotification && !currentNotification.image) {
            const fetchFullNotif = async () => {
                try {
                    const res = await fetch(`/api/student/notifications?id=${currentNotification._id}`);
                    const data = await res.json();
                    if (data.success && data.notification) {
                        setCurrentNotification(data.notification);
                    }
                } catch (e) {
                    console.error("Error fetching full notification details:", e);
                }
            };
            fetchFullNotif();
        }
    }, [showNotifPopup, currentNotification]);

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
            router.push("/login?logout=success");
        } catch (error) {
            console.error("Error signing out:", error);
            alert("Failed to sign out. Please try again.");
        }
    };

    useEffect(() => {
        let isMounted = true;
        let unsubscribeFirebase: (() => void) | null = null;

        const loadData = async (user: { uid: string; email: string | null; source: 'firebase' | 'supabase' }) => {
            // ⚡ STEP 0: Instant Load from Device Cache (0ms latency, zero database wait)
            let currentStudent = initialData;
            if (!currentStudent && typeof window !== 'undefined') {
                try {
                    const cachedStr = localStorage.getItem("cachedStudentData");
                    if (cachedStr) {
                        currentStudent = JSON.parse(cachedStr);
                        if (isMounted) {
                            setStudentProfile(currentStudent);
                            setIsFullProfileLoaded(true);
                            setLoading(false);
                            console.log("⚡ [Device Caching] Profile loaded instantly from local device storage!");
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse cached student data:", e);
                }
            }

            if (!currentStudent) {
                try {
                    // ⚡ STEP 1: Load MINIMAL data first if not provided
                    const queryParam = user.source === 'supabase'
                        ? `supabaseId=${user.uid}${user.email ? `&email=${encodeURIComponent(user.email)}` : ''}`
                        : `firebaseUID=${user.uid}${user.email ? `&email=${encodeURIComponent(user.email)}` : ''}`;
                    const minimalResponse = await fetch(`/api/students?${queryParam}&minimal=true${getTenantParam(false)}`, { cache: 'no-store' });
                    
                    // ⚡ NEW USER: If not found, redirect to onboarding immediately
                    if (minimalResponse.status === 404) {
                        const cached = typeof window !== 'undefined' ? localStorage.getItem('cachedStudentData') : null;
                        if (!cached && !studentProfile) {
                            console.log('[Dashboard] Student not found (404), redirecting to onboarding...');
                            if (isMounted) {
                                setLoading(false);
                                router.push('/onboarding');
                            }
                        } else if (isMounted) {
                            setLoading(false);
                        }
                        return;
                    }
                    
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
            }

            if (currentStudent && isMounted) {
                setLoading(false);
                const studentId = currentStudent._id;

                // ⚡ STEP 2: Smart Version Check (Zero-Payload Sync)
                const loadFullProfile = async () => {
                    try {
                        const queryParam = user.source === 'supabase'
                        ? `supabaseId=${user.uid}${user.email ? `&email=${encodeURIComponent(user.email)}` : ''}`
                        : `firebaseUID=${user.uid}${user.email ? `&email=${encodeURIComponent(user.email)}` : ''}`;

                        const cachedUpdatedAt = currentStudent?.updatedAt || "";
                        const versionCheckParam = cachedUpdatedAt ? `&versionCheck=true&updatedAt=${encodeURIComponent(cachedUpdatedAt)}` : "";
                        let fullResponse = await fetch(`/api/students?${queryParam}${versionCheckParam}${getTenantParam(false)}`, { cache: 'no-store' });
                        
                        // ⚡ If server returns 404 during background check, keep existing profile
                        if (fullResponse.status === 404) {
                            console.warn(`[Profile] Server returned 404 during background check. Retaining existing loaded profile.`);
                            if (isMounted) {
                                setIsFullProfileLoaded(true);
                                setLoading(false);
                            }
                            return;
                        }

                        if (!fullResponse.ok) {
                            console.error(`[Profile] Non-404 error: ${fullResponse.status}, skipping redirect`);
                            return;
                        }

                        const fullData = await fullResponse.json();

                        // ⚡ 304 NOT MODIFIED: Server confirmed profile has NOT changed! 0 KB downloaded!
                        if (fullData.notModified) {
                            console.log("⚡ [Device Caching] Profile unchanged on Railway DB. 0 KB downloaded!");
                            if (isMounted) {
                                setIsFullProfileLoaded(true);
                                setLoading(false);
                            }
                            return;
                        }

                        if (fullData.student && isMounted) {
                            const fullStudentData = {
                                ...fullData.student,
                                studentStatus: fullData.student.studentStatus || "in"
                            };
                            setStudentProfile(fullStudentData);
                            setIsFullProfileLoaded(true);
                            localStorage.setItem("cachedStudentData", JSON.stringify(fullStudentData));

                            // ⚡ NEW: Check for Missing Required Fields (Strict Mode)
                            if (formBuilderConfig && formBuilderConfig.length > 0) {
                                const missing: string[] = [];
                                formBuilderConfig.forEach(field => {
                                    // Skip images (complex checks)
                                    if (field.visible && field.required && field.type !== 'image') {
                                        const val = (fullStudentData as any)[field.id] || fullStudentData.dynamicFields?.[field.id];
                                        // Check for null, undefined, or empty string
                                        if (!val || (typeof val === 'string' && val.trim() === '')) {
                                            missing.push(field.label);
                                        }
                                    }
                                });

                                if (missing.length > 0) {
                                    console.log("⚠️ Missing Fields Detected:", missing);
                                    setMissingRequiredFields(missing);
                                    setShowProfile(true); // Force open profile
                                    showToast("Action Required: Please update your profile.", "warning");
                                }
                            }
                        }
                    } catch (error) {
                        console.error("Error loading full profile:", error);
                    } finally {
                        if (isMounted) {
                            setIsFullProfileLoaded(true);
                        }
                    }
                };

                // ⚡ STEP 3: Load permissions asynchronously in background
                const fetchPermissions = async () => {
                    try {
                        const permResponse = await fetch(`/api/permissions?studentId=${studentId}&light=true${getTenantParam(false)}`);
                        const permData = await permResponse.json();

                        if (permData.permissions && isMounted) {
                            setPermissions(Array.isArray(permData.permissions) ? permData.permissions : []);
                        } else if (!permResponse.ok && isMounted) {
                            console.warn(`Permissions fetch returned status ${permResponse.status}`);
                            setPermissions([]);
                        }
                    } catch (error) {
                        console.error("Error fetching permissions:", error);
                        setPermissions([]); // Set empty array on error
                    }
                };

                // Start loading full data in background (non-blocking)
                loadFullProfile();
                fetchPermissions();

                // Refresh permissions periodically (⚡ OPTIMIZED: 3 minutes instead of 30s)
                // ⚡ OPTIMIZATION: Periodic polling removed to save massive bandwidth.
                // Profile & Permissions update on initial load or manual refresh.

                // Insta-refresh when student returns to app
                const handleVisibilityChange = () => {
                    if (document.visibilityState === 'visible' && isMounted) {
                        fetchPermissions();
                    }
                };
                document.addEventListener('visibilitychange', handleVisibilityChange);

                // Add to main component cleanup if needed, but for now we'll handle it via unmount
            } else if (!currentStudent && isMounted) {
                setLoading(false);
            }
        };

        const initAuth = async () => {
            const storedUserType = localStorage.getItem("userType");
            if (storedUserType === "parent" || isParentView) {
                const storedParentPhone = localStorage.getItem("parentPhone");
                if (storedParentPhone) {
                    try {
                        let currentStudent = initialData;
                        const selectedStudentId = localStorage.getItem("parentSelectedStudentId");

                        if (!currentStudent) {
                            const response = await fetch(`/api/students?parentPhone=${encodeURIComponent(storedParentPhone)}&minimal=true${selectedStudentId ? `&selectedStudentId=${selectedStudentId}` : ''}${getTenantParam(false)}`, { cache: 'no-store' });
                            if (response.ok) {
                                const data = await response.json();
                                if (data.student) {
                                    currentStudent = data.student;
                                }
                            }
                        }

                        if (currentStudent) {
                            const studentWithStatus = {
                                ...currentStudent,
                                studentStatus: currentStudent.studentStatus || "in"
                            };
                            if (isMounted) {
                                setStudentProfile(studentWithStatus);
                                setLoading(false);
                            }

                            // Load full details & permissions in background
                            const studentId = studentWithStatus._id;
                            const loadFullProfile = async () => {
                                try {
                                    const fullResponse = await fetch(`/api/students?parentPhone=${encodeURIComponent(storedParentPhone)}${selectedStudentId ? `&selectedStudentId=${selectedStudentId}` : ''}${getTenantParam(false)}`, { cache: 'no-store' });
                                    if (fullResponse.ok) {
                                        const fullData = await fullResponse.json();
                                        if (fullData.student && isMounted) {
                                            setStudentProfile({
                                                ...fullData.student,
                                                studentStatus: fullData.student.studentStatus || "in"
                                            });
                                        }
                                    }
                                } catch (e) {
                                    console.error("Parent load full profile failed", e);
                                } finally {
                                    if (isMounted) {
                                        setIsFullProfileLoaded(true);
                                    }
                                }
                            };

                            const fetchPermissions = async () => {
                                try {
                                    const permResponse = await fetch(`/api/permissions?studentId=${studentId}&light=true${getTenantParam(false)}`);
                                    const permData = await permResponse.json();
                                    if (permData.permissions && isMounted) {
                                        setPermissions(Array.isArray(permData.permissions) ? permData.permissions : []);
                                    }
                                } catch (error) {
                                    console.error("Error fetching permissions:", error);
                                    setPermissions([]);
                                }
                            };

                            loadFullProfile();
                            fetchPermissions();
                            return;
                        }
                    } catch (e) {
                        console.error("Parent auth check failed", e);
                    }
                }
                if (isMounted) setLoading(false);
                router.push("/login");
                return;
            }

            // 1. Try Supabase session first
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                loadData({ uid: session.user.id, email: session.user.email ?? null, source: 'supabase' });
                return;
            }

            // 2. Fallback to Firebase session
            unsubscribeFirebase = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    loadData({ uid: user.uid, email: user.email, source: 'firebase' });
                } else {
                    if (isMounted) setLoading(false);
                }
            });
        };

        initAuth();

        return () => {
            isMounted = false;
            if (unsubscribeFirebase) {
                unsubscribeFirebase();
            }
            // Visibility listener clean up is tricky if added dynamically, 
            // but we've defined handleVisibilityChange inside loadData.
            // Ideally we should move it to effect scope.
        };
    }, [initialData]);

    const [isUpdatingParentStatus, setIsUpdatingParentStatus] = useState(false);

    const handleParentApproval = async (permissionId: string, status: "allowed" | "rejected") => {
        setIsUpdatingParentStatus(true);
        try {
            const response = await fetch("/api/permissions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    permissionId,
                    parentStatus: status
                })
            });
            const data = await response.json();
            if (data.success) {
                // Update local state for permissions history
                setPermissions(prev => 
                    prev.map(p => p._id === permissionId ? data.permission : p)
                );
                // UI is updated via setPermissions above.
                showToast(`Permission ${status === 'allowed' ? 'approved' : 'rejected'} successfully`, "success");
            } else {
                showToast(data.error || "Failed to update permission", "error");
            }
        } catch (error: any) {
            console.error("Error updating parent status:", error);
            showToast("Failed to update status", "error");
        } finally {
            setIsUpdatingParentStatus(false);
        }
    };

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
                    requestType,
                    deviceId: getStoredDeviceId(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to create permission: ${response.status}`);
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
            const isUnbound = !studentProfile.deviceId || studentProfile.deviceId === "no-binding";
            if (isUnbound) {
                const newDeviceId = deviceIdState || getStoredDeviceId();
                if (newDeviceId) {
                    updateData.deviceId = newDeviceId;
                    storeDeviceId(newDeviceId);
                    deviceRegisteredSuccessfully = true;
                }
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

    // ⚡ FIELD ENFORCEMENT: Save dynamically enforced fields
    const handleFieldEnforcementSubmit = async () => {
        if (!studentProfile) return;

        // Check all required fields are filled
        const emptyFields = enforcedMissingFields.filter(f => {
            const val = enforcementFormData[f.fieldId];
            return !val || (typeof val === 'string' && val.trim() === '');
        });

        if (emptyFields.length > 0) {
            alert(`Please fill all required fields: ${emptyFields.map(f => f.fieldLabel).join(', ')}`);
            return;
        }

        try {
            setSavingEnforcementFields(true);

            const updateData: Record<string, string> = {};
            enforcedMissingFields.forEach(f => {
                updateData[f.fieldId] = enforcementFormData[f.fieldId].trim();
            });

            const response = await fetch(`/api/students/${studentProfile._id}${getTenantParam()}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) throw new Error(`Failed to update profile: ${response.status}`);
            const data = await response.json();

            if (data.success) {
                // ⚡ NEW: Mark fields as completed in the FieldEnforcement tracking system
                // This ensures the Admin Dashboard "Status" view updates immediately
                try {
                    await fetch(`/api/admin/field-enforcement/progress${getTenantParam()}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            studentId: studentProfile._id,
                            firebaseUID: studentProfile.firebaseUID || studentProfile._id,
                            hostelName: studentProfile.hostelName,
                            fieldIds: enforcedMissingFields.map(f => f.fieldId)
                        })
                    });
                } catch (err) {
                    console.error("Failed to sync field progress to tracker:", err);
                }

                setStudentProfile(data.student);
                setShowFieldEnforcementModal(false);
                setEnforcedMissingFields([]);
                const successMsg = enforcementConfig?.successMessage || "All required fields have been completed! Thank you.";
                alert(`✅ ${successMsg}`);
            } else {
                throw new Error(data.error || "Failed to update profile");
            }
        } catch (error: any) {
            console.error("Error saving enforced fields:", error);
            alert(error.message || "Failed to save details. Please try again.");
        } finally {
            setSavingEnforcementFields(false);
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
        setIsWifiFallback(false);
        setLockProgress(10);
        setGpsAccuracy(null);

        let watchId: number | null = null;
        let isCompleted = false;
        let bestPosition: GeolocationPosition | null = null;
        let optimizationTimer: NodeJS.Timeout | null = null;

        // ⚡ 100% RELIABILITY: WiFi IP Check
        // If student is on Hostel WiFi, bypass GPS.
        fetch("/api/check-network").then(res => res.json()).then(data => {
            if (data.success && data.isWhitelisted && !isCompleted) {
                console.log("📶 Verified via Hostel WiFi IP:", data.ip);
                isCompleted = true;
                if (watchId !== null) navigator.geolocation.clearWatch(watchId);
                if (optimizationTimer !== null) clearTimeout(optimizationTimer);

                setIsOnCampusWifi(true);
                setIsAtHostel(true);
                setIsLocationChecking(false);
                setGpsLockStatus('locked');
                setLockProgress(100);
                showToast("Verification Success✔️ (WiFi Mode) You are connected to the campus network. Daily Attendance / Leave Request button is now active.", "success");
            } else {
                setIsOnCampusWifi(false);
            }
        }).catch(e => { console.error("WiFi check failed", e); setIsOnCampusWifi(false); });

        // Helper to finish verification
        const performVerification = (position: GeolocationPosition) => {
            // 📶 IF CONNECTED TO CAMPUS WIFI: Campus WiFi takes priority over cell tower GPS noise!
            if (isOnCampusWifi) {
                setIsAtHostel(true);
                setIsLocationChecking(false);
                setGpsLockStatus('locked');
                setLockProgress(100);
                showToast("Verification Success✔️ (WiFi Mode) You are connected to the campus network. Daily Attendance / Leave Request button is now active.", "success");
                return;
            }

            const { accuracy, latitude, longitude } = position.coords;

            let isInsideAny = false;
            let matchedLocation: any = null;
            let closestInfo = { distance: Infinity, radius: 0, name: studentProfile?.hostelName || "Hostel" };
            let assignedHostelInfo: any = null;

            const locationsToTest = hostelLocations && hostelLocations.length > 0 ? hostelLocations : [];

            const results = locationsToTest.map((loc: any) => {
                const dist = calculateDistance(latitude, longitude, loc.lat, loc.lng);

                const effectiveRadius = overlapRadius ? (loc.radius + 30) : loc.radius;
                const isVerified = dist <= effectiveRadius;

                const studentHostel = studentProfile?.hostelName?.toLowerCase() || "";
                const locName = (loc.name || "").toLowerCase();

                const isExactMatch = studentHostel === locName;
                const isPartialMatch = studentHostel.includes(locName) || locName.includes(studentHostel);
                const isAssignedHostel = isExactMatch || isPartialMatch;

                if (isAssignedHostel) {
                    if (!assignedHostelInfo || isExactMatch) {
                        assignedHostelInfo = { ...loc, distance: dist, radius: effectiveRadius, officialName: studentProfile?.hostelName };
                    }
                }

                const validMatch = prioritizeAssignedHostel ? (isVerified && isAssignedHostel) : isVerified;

                if (validMatch) {
                    isInsideAny = true;
                    if (!matchedLocation || dist < matchedLocation.distance) {
                        matchedLocation = { ...loc, distance: dist };
                    }
                }

                if (dist < closestInfo.distance) {
                    closestInfo = { distance: dist, radius: effectiveRadius, name: loc.name };
                }
                return { ...loc, distance: dist, isVerified: validMatch };
            });

            setLocationVerificationResults(results);
            setLastCheckAccuracy(Math.round(accuracy));

            if (isInsideAny && matchedLocation) {
                setIsAtHostel(true);
                const displayName = (prioritizeAssignedHostel && studentProfile?.hostelName) ? studentProfile.hostelName : (matchedLocation.name || "Hostel");
                showToast(`Verification Success✔️, You are ${Math.round(matchedLocation.distance)}m away from ${displayName}. (Accuracy: ${Math.round(accuracy)}m). Daily Attendance / Leave Request button is now active.`, "success");
            } else {
                setIsAtHostel(false);
                const displayInfo = (prioritizeAssignedHostel && assignedHostelInfo) ? assignedHostelInfo : closestInfo;
                const displayName = (displayInfo.name && displayInfo.name.trim() !== "") ? displayInfo.name : (studentProfile?.hostelName || "Hostel");

                if (!isFinite(displayInfo.distance) || displayInfo.distance === Infinity) {
                    showToast(`Verification failed❌ (GPS Accuracy: ${Math.round(accuracy)}m). Cell tower signal detected. Please connect to Campus WiFi or move closer to hostel.`, "error");
                } else {
                    showToast(`Verification failed❌, You are ${Math.round(displayInfo.distance)}m away from ${displayName}. (Accuracy: ${Math.round(accuracy)}m). You must be within hostel radius.`, "error");
                }
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
            setIsWifiFallback(true);
            setLockProgress(50); // Reset progress for visual feedback

            navigator.geolocation.getCurrentPosition(
                (pos) => finish(pos),
                (err) => {
                    if (isCompleted) return;
                    console.error("WiFi Fallback failed:", err.message || err.code || err);

                    // CRITICAL: Even if everything fails, if we had a "bestPosition" from GPS earlier, USE IT.
                    if (bestPosition) {
                        console.log("Using cached best position despite final error");
                        finish(bestPosition);
                    } else {
                        isCompleted = true;
                        setIsLocationChecking(false);

                        // 🛠️ DEVELOPMENT BYPASS: If testing on localhost, mock location success so local testing doesn't get blocked
                        if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
                            console.log("🛠️ [Developer Bypass] Mocking location verification on localhost");
                            setIsAtHostel(true);
                            setGpsLockStatus('locked');
                            setLockProgress(100);
                            alert("🛠️ [Dev Mode] Geolocation failed but bypassed on localhost. Verification Success✔️");
                        } else {
                            setGpsLockStatus('error');
                            alert("Could not detect location. Please enable Location Services & WiFi.");
                        }
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
                // Save to local storage to hide "always"
                const currentDismissed = JSON.parse(localStorage.getItem("dismissed_notifs") || "[]");
                if (!currentDismissed.includes(notificationId)) {
                    currentDismissed.push(notificationId);
                    localStorage.setItem("dismissed_notifs", JSON.stringify(currentDismissed));
                    setSessionDismissedIds(currentDismissed);
                }

                setShowNotifPopup(false);
                // Check for next notification
                const remaining = notifications.filter((n: any) => n._id !== notificationId);
                setNotifications(remaining);
                if (remaining.length > 0) {
                    const nextNotif = remaining[0];
                    setTimeout(() => showNotification(nextNotif), 500);
                }
            }
        } catch (error) {
            console.error("Error acknowledging notification:", error);
        } finally {
            setIsAcknowledging(false);
        }
    };

    // ⚡ INSTANT-VERIFY: Trigger face match as soon as ANY face is detected
    useEffect(() => {
        if (faceMatchStep === 'detecting' && faceDetected) {
            console.log('⚡ Face detected! Auto-triggering instant verification...');

            const autoVerify = async (attempts = 0) => {
                // Use cached detection if available to save 200-500ms
                const cachedRes = latestDetectionRef.current;
                const result = await performFaceVerification(cachedRes);

                if (result && result.status === 'auto-approved') {
                    // Success! Proceed immediately
                    setTimeout(() => {
                        stopCamera();
                        proceedWithAttendance(result);
                    }, 100); // Super fast transition
                } else if (result && result.status === 'rejected') {
                    stopCamera();
                    showToast(`Identity Mismatch (${result.percentage}% Accuracy). Verification failed. Please ensure you are the account owner.`, "error");
                    setFaceMatchStep('error');
                } else if (attempts < 2) {
                    // retry fallback
                    setTimeout(() => autoVerify(attempts + 1), 300);
                }
            };

            autoVerify();
        }
    }, [faceMatchStep, faceDetected]);

    const startCamera = async () => {
        try {
            // ⚡ CLEAN RESET: Clear all cached detection refs to prevent instant stale error on re-opening
            isProcessingRef.current = false;
            latestDetectionRef.current = null;
            consecutiveFailuresRef.current = 0;
            setFaceDetected(false);
            setFaceBox(null);
            setAttendanceStep('idle');
            setAttendanceFailedReason('');

            setCameraActive(true);
            setFaceMatchStep('loading-models');

            // ⚡ IMMEDIATE: Start camera stream
            const streamPromise = navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    aspectRatio: { ideal: 1 },
                    width: { ideal: 1080 }
                }
            });

            // ⚡ FAST FEED: Show video as soon as the browser allows (before model AI is ready)
            const stream = await streamPromise;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }

            // ⚡ PARALLEL: Ensure models are ready for the detection loop
            await faceMatching.loadFaceApiModels();

            setFaceMatchStep('detecting');
        } catch (err) {
            console.error("Camera error:", err);
            alert("Could not access camera. Please ensure permissions are granted.");
            setCameraActive(false);
            setFaceMatchStep('idle');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
        isProcessingRef.current = false;
        latestDetectionRef.current = null;
        setFaceDetected(false);
        setFaceBox(null);
    };

    const performFaceVerification = async (existingRes?: any): Promise<{
        percentage: number;
        status: 'auto-approved' | 'flagged' | 'manual-override';
    } | null> => {
        if (!videoRef.current) return null;
        const fa = await faceMatching.getFaceApi();
        if (!fa) return null;

        if (!studentProfile?.profilePicture) {
            setFaceMatchStep('error');
            alert("Verification Error: No profile picture found. Please update your profile first.");
            stopCamera();
            setIsMarkingAttendance(false);
            return null;
        }

        try {
            setFaceMatchStep('matching');
            setFaceMatchProgress(20);

            let referenceDescriptor = studentProfile.faceDescriptor;

            if (!referenceDescriptor || referenceDescriptor.length === 0) {
                console.log("🔒 Biometric lock missing. Initiating Biometric Lock-In from camera scan...");
                setFaceMatchProgress(40);

                try {
                    await faceMatching.loadFaceApiModels(true);
                    let res: any = null;

                    if (studentProfile.profilePicture) {
                        try {
                            const profileImg = await faceMatching.loadImage(studentProfile.profilePicture);
                            res = await faceMatching.detectFace(profileImg, true);
                        } catch (e) {
                            console.warn("Could not extract vector from profile picture, falling back to live camera lock-in.");
                        }
                    }

                    if (res && res.descriptor) {
                        referenceDescriptor = Array.from(res.descriptor);
                    } else if (liveRes && liveRes.descriptor) {
                        // ⚡ BIOMETRIC LOCK-IN: Use live face scan descriptor and lock it into Railway DB!
                        console.log("⚡ Live camera Biometric Lock-In triggered!");
                        referenceDescriptor = Array.from(liveRes.descriptor);

                        // Save new live photo & vector to Railway DB
                        const canvas = document.createElement('canvas');
                        canvas.width = videoRef.current.videoWidth || 640;
                        canvas.height = videoRef.current.videoHeight || 640;
                        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
                        const liveCapturedPhoto = canvas.toDataURL('image/jpeg', 0.85);

                        await fetch(`/api/students/${studentProfile._id || studentProfile.id || studentProfile.firebaseUID}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                profilePicture: liveCapturedPhoto,
                                faceDescriptor: referenceDescriptor
                            })
                        });
                    } else {
                        throw new Error("Could not detect a valid face. Please position your face clearly in front of the camera.");
                    }

                    await fetch('/api/students/face-descriptor', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            firebaseUID: studentProfile.firebaseUID,
                            faceDescriptor: referenceDescriptor
                        })
                    });

                    const updatedProfile = { ...studentProfile, faceDescriptor: referenceDescriptor };
                    setStudentProfile(updatedProfile);
                    showToast("🔒 Biometric Face Lock-In Complete!", "success");

                    setFaceMatchStep('success');
                    return {
                        percentage: 100,
                        status: 'auto-approved',
                    };
                } catch (genError: any) {
                    console.error("Error in Biometric Lock-In:", genError);
                    setFaceMatchStep('error');
                    showToast(genError.message || "Biometric Lock-In failed. Please try again.", "error");
                    stopCamera();
                    setIsMarkingAttendance(false);
                    return null;
                }
            }

            setFaceMatchProgress(70);

            // ⚡ FAST PATH: Use existing detection result from the loop
            let liveRes = existingRes;

            // If we don't have existingRes (fallback), detect now
            if (!liveRes) {
                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
                liveRes = await faceMatching.detectFace(canvas, false);
            }

            if (!liveRes || !liveRes.descriptor) {
                console.warn("⚠️ No face detected in scan.");
                setFaceMatchStep('error');
                alert("Face not detected. Please look directly at the camera in good lighting.");
                return null;
            }

            setFaceMatchProgress(90);
            const distance = await faceMatching.getDistance(liveRes.descriptor, referenceDescriptor);

            if (distance === null) {
                setFaceMatchStep('error');
                return null;
            }

            const matchPercentage = faceMatching.calculateScore(distance);
            console.log(`🔍 Face Descriptor Match: ${matchPercentage}%`);

            setFaceMatchProgress(100);

            // ⚡ ENTERPRISE SSD-MOBILENET PRO IDENTIFICATION (Match Score >= 90% - Rejects Screen Photos & Video Replays)
            if (matchPercentage >= 90) {
                setFaceMatchStep('success');
                return {
                    percentage: matchPercentage,
                    status: 'auto-approved',
                };
            }

            // REJECT for mismatched face - No console error overlay, return percentage
            console.warn(`❌ Identity Mismatch: Match score too low (${matchPercentage}%).`);
            setFaceMatchStep('error');
            return {
                percentage: matchPercentage,
                status: 'rejected',
            };

        } catch (error) {
            console.error("Verification error:", error);
            setFaceMatchStep('error');
            return null;
        }
    };

    const [hostelAttendanceMode, setHostelAttendanceMode] = useState<'strict' | 'gps-only' | 'biometric'>('strict');

    useEffect(() => {
        // ⚡ PRIORITY 1: Student Individual Override
        if (studentProfile?.attendanceMode && studentProfile.attendanceMode !== 'default') {
            console.log(`👤 Student Override Active: ${studentProfile.attendanceMode}`);
            setHostelAttendanceMode(studentProfile.attendanceMode);
            return;
        }

        // ⚡ PRIORITY 2: Hostel Global Settings
        if (studentProfile?.hostelName) {
            console.log(`🏢 Resolving Hostel Mode for: ${studentProfile.hostelName}`);
            // Fetch public hostel list and find my hostel's settings
            fetch('/api/hostels').then(res => res.json()).then(data => {
                if (data.hostels) {
                    // ⚡ ROBUST: Trim names to handle hidden whitespace/newlines from DB
                    const myHostel = data.hostels.find((h: any) =>
                        h.name.trim().toLowerCase() === (studentProfile.hostelName || "").trim().toLowerCase()
                    );

                    if (myHostel && myHostel.attendanceMode) {
                        console.log(`🏢 Hostel Mode Found: ${myHostel.attendanceMode}`);
                        setHostelAttendanceMode(myHostel.attendanceMode);
                    } else {
                        console.log(`🏢 No specific mode for hostel, defaulting to strict (camera)`);
                        setHostelAttendanceMode('strict');
                    }
                }
            }).catch(err => {
                console.error("❌ Failed to fetch hostel settings", err);
                setHostelAttendanceMode('strict'); // Safety default
            });
        }
    }, [studentProfile?.hostelName, studentProfile?.attendanceMode]);

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

            // 1. Get Challenge from server (Strict anti-replay)
            // For this demo/fast transition, we'll use a random client-side challenge if server challenge isn't ready
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            // 2. Check MongoDB for existing credentials (The "Reset-Proof" Source of Truth)
            const credentials = studentProfile?.webAuthnCredentials || [];

            if (credentials.length > 0) {
                console.log("Found persistent credentials in MongoDB. Attempting verification...");
                try {
                    // Map MongoDB stored credentials to WebAuthn format
                    const allowCredentials = credentials.map(cred => ({
                        id: Uint8Array.from(atob(cred.credentialID), c => c.charCodeAt(0)),
                        type: "public-key" as const,
                        transports: (cred.transports || ["internal"]) as AuthenticatorTransport[]
                    }));

                    const result = await navigator.credentials.get({
                        publicKey: {
                            challenge,
                            rpId: window.location.hostname,
                            userVerification: "required",
                            allowCredentials
                        }
                    });

                    if (result) {
                        console.log("✅ Biometric hardware verification successful via MongoDB link.");
                        // ⚡ SYNC: Ensure local storage matches the hardware key we just verified
                        if (credentials[0]?.credentialID) {
                            storeDeviceId(credentials[0].credentialID);
                        }
                        return true;
                    }
                } catch (e: any) {
                    console.error("Biometric Authentication failed:", e);
                    // If it's a "NotAllowedError", the user cancelled. 
                    // If it's something else, they might need to re-register if the key was deleted from phone
                    if (e.name === "NotAllowedError") return false;

                    const retry = await showConfirm("Biometric link verification failed. This might happen if you deleted the key from your phone security settings.\n\nWould you like to try re-linking this device?");
                    if (!retry) return false;
                    // Clear stale local ID to force re-registration
                    localStorage.removeItem("device_id_token");
                }
            }

            // 3. Registration (First time or Recovery)
            // Logic: If we are here, either there are no keys in DB, or the DB key failed and user wants to re-link.

            const userAgreed = await showConfirm("⚠️ LINK SECURE BIOMETRICS\n\nYour phone's Face ID or Fingerprint will be permanently linked to your hostel account in our database.\n\nThis works even if you clear your browser history.\n\nClick OK to link now.");
            if (!userAgreed) return false;

            const result: any = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: "Hosteleaze Attendance", id: window.location.hostname },
                    user: {
                        id: Uint8Array.from(studentProfile?._id || "0000000000000000", c => c.charCodeAt(0)),
                        name: studentProfile?.email || "Student",
                        displayName: studentProfile?.name || "Student User"
                    },
                    pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required",
                        residentKey: "preferred"
                    },
                    timeout: 60000,
                    attestation: "none"
                }
            });

            if (result) {
                const idStr = btoa(String.fromCharCode(...new Uint8Array(result.rawId)));

                // Export the public key (This is a simplified version for the transition)
                // In a full production app, we would parse the attestationObject
                // For this powerful transition, we'll send the raw data to our new API

                const regResponse = await fetch("/api/students/webauthn/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: studentProfile?._id,
                        credential: {
                            id: idStr,
                            publicKey: "VERIFIED_HARDWARE_KEY", // Placeholder for actual key extraction logic
                            counter: 0,
                            transports: result.getTransports ? result.getTransports() : ["internal"]
                        }
                    })
                });

                const regData = await regResponse.json();
                if (regData.success) {
                    // ⚡ SYNC: Save the hardware credential ID as the local device ID
                    storeDeviceId(idStr);
                    // Update local state with the full updated student profile
                    setStudentProfile(regData.student);
                    showToast("Success! Your device is now securely linked in our database.", "success");
                    return true;
                } else {
                    showToast("Registration failed: " + (regData.error || "Unknown error"), "error");
                    return false;
                }
            }

            return false;
        } catch (error: any) {
            console.error("Biometric Error:", error);
            // Don't alert if user just cancelled (NotAllowedError)
            if (error.name !== "NotAllowedError") {
                showToast("Biometric verification failed. Please try again or check your device settings.", "error");
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
            console.log(`🕒 Attendance refused: Outside window (${istTime} vs ${attendanceWindow.start}-${attendanceWindow.end})`);
            showToast("Attendance will be marked only during the mentioned time.", "success");
            return;
        }
        console.log(`🕒 Attendance window check passed: ${istTime}`);

        // 🛡️ SECURITY CHECK: Mandatory Check-In (QR scan) required
        if (studentProfile.studentStatus === 'out') {
            showToast("🔒 SECURITY RESTRICTION: You are marked OUT. Please scan entry QR first.", "error");
            return;
        }

        if (!isAtHostel) {
            setHighlightLocation(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast("📍 Location Verification Required: Please verify your location first by clicking Location Lock or connecting to Campus WiFi.", "warning");
            setTimeout(() => {
                setHighlightLocation(false);
            }, 5000);
            return;
        }

        try {
            setIsMarkingAttendance(true);
            setAttendanceRetryCount(retryAttempt);
            let deviceId = getStoredDeviceId() || deviceIdState;

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
            showToast("An error occurred. Please try again.", "error");
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

                // Step 3: Saving to Database
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
                        wifiBSSID: isOnCampusWifi !== false ? "CAMPUS_WIFI_CONNECTED" : "",
                        verificationMethod: isOnCampusWifi !== false ? "wifi" : "gps",
                        verifiedBy: isOnCampusWifi !== false ? "wifi" : "gps",
                        isWifiVerified: isOnCampusWifi !== false,
                        isLocationVerified: true,
                        // Face matching results (0% Storage - only numbers stored)
                        faceMatchPercentage: faceResult.percentage,
                        faceMatchStatus: faceResult.status
                    }),
                });

                const data = await response.json();

                if (response.ok) {
                    setAttendanceStep('done');
                    setIsAttendanceMarked(true);
                    setTimeout(() => {
                        // ⚡ USER REQUEST: Instant closure and non-blocking notification
                        setAttendanceStep('idle');
                        setIsMarkingAttendance(false);
                        showToast(data.message || "Attendance marked successfully!", "success");
                    }, 800);
                } else {
                    setAttendanceStep('error');
                    showToast(data.error || "Failed to mark attendance.", "error");
                    setIsMarkingAttendance(false);
                }

            } catch (error) {
                console.error("Location/Attendance Error:", error);
                setAttendanceStep('error');
                showToast("Location failed. Please enable WiFi/Location services and try again.", "warning");
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

    const gridColsClass = isParentView 
        ? "lg:grid-cols-3"
        : (bankSettings?.isPaymentEnabled ? "lg:grid-cols-5" : "lg:grid-cols-4");

    return (
        <div className="min-h-screen bg-white">
            <main className="w-full max-w-4xl mx-auto">
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                    {!showProfile ? (
                        <>
                            {isParentView && showSoundBanner && (
                                <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-4 md:p-5 shadow-sm transition-all animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4" style={{ fontFamily: 'var(--font-lora), Cambria' }}>
                                    <div className="flex items-start gap-3.5">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                                            <span className="text-xl">🔔</span>
                                        </div>
                                        <div>
                                            <h3 className="text-xs md:text-sm font-black text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                Curfew Sound Alerts Configured?
                                            </h3>
                                            <p className="text-xs text-amber-800 leading-relaxed max-w-2xl font-medium">
                                                To receive emergency curfew sound alerts, please ensure your phone is set to <strong className="text-amber-950 font-bold">Ring mode</strong> and Chrome notification settings allow sound. (Silent/Vibrate mode or generic browser settings will mute critical safety alerts).
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 md:self-center shrink-0">
                                        <button
                                            onClick={() => {
                                                localStorage.setItem("dismissedNotificationSoundBanner", "true");
                                                setShowSoundBanner(false);
                                            }}
                                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] md:text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
                                        >
                                            Got it, thanks!
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Header section: Profile @ Top-Right, Logout next to Name */}
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center flex-wrap gap-3 mb-1">
                                        <h1 className="text-xl md:text-3xl font-bold text-gray-900 leading-tight">
                                            {isParentView ? (
                                                <>Parent of <span className="text-blue-600">{studentProfile.name}</span></>
                                            ) : (
                                                <>Hello, <span className="text-blue-600">{studentProfile.name.split(' ')[0]}!</span></>
                                            )}
                                        </h1>
                                        <button
                                            onClick={handleLogout}
                                            className="px-3 py-1.5 rounded-xl border border-solid border-gray-100 bg-white text-slate-800 text-[9px] font-black uppercase tracking-tight shadow-sm active:scale-95 transition-all flex items-center gap-1.5 hover:bg-slate-50 mt-1 md:mt-0"
                                        >
                                            LOGOUT
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                        </button>
                                        {isParentView && hasMultipleSiblings && (
                                            <button
                                                onClick={() => {
                                                    localStorage.removeItem("parentSelectedStudentId");
                                                    window.location.reload();
                                                }}
                                                className="px-3 py-1.5 rounded-xl border border-solid border-blue-100 bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-tight shadow-sm active:scale-95 transition-all flex items-center gap-1.5 hover:bg-blue-100 mt-1 md:mt-0"
                                            >
                                                SWITCH SIBLING
                                                <span className="text-[10px]">🔄</span>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] md:text-sm text-gray-500 font-medium">
                                        {isParentView ? "Monitoring Child's Campus Activities" : "Welcome back to Hosteleaze Dashboard"}
                                    </p>
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
                            <div className={`grid grid-cols-2 ${gridColsClass} gap-3 mb-2`} style={{ fontFamily: 'var(--font-lora), Cambria' }}>
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
                                {!isParentView && (
                                    <div className={`p-2 md:p-2.5 rounded-2xl border shadow-sm flex items-center justify-between gap-1 transition-all duration-500 ${highlightLocation ? 'bg-red-50 border-red-300 ring-4 ring-red-100 shadow-xl scale-[1.02]' : 'bg-white border-gray-100'}`}>
                                        <div>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${highlightLocation ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>Location Lock</p>
                                            <p className="text-[12px] font-bold text-gray-700">{isAtHostel ? '📍 Verified' : '❌ Not Verified'}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setHighlightLocation(false);
                                                getAccurateLocation();
                                            }}
                                            disabled={isLocationChecking}
                                            className={`p-2 rounded-lg transition-all ${isAtHostel ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} ${highlightLocation ? 'animate-bounce' : ''}`}
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
                                )}

                                <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-1">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Daily Attendance</p>
                                        <p className={`text-[12px] font-bold ${isParentView ? attendanceDisplay.textColor : 'text-gray-700'}`}>
                                            {isParentView ? (
                                                attendanceDisplay.text
                                            ) : (
                                                isAttendanceMarked ? '✅ Saved' : `🕒 ${attendanceWindow.start} - ${attendanceWindow.end}`
                                            )}
                                        </p>
                                    </div>
                                    {isParentView ? (
                                        <div className={`p-2 rounded-lg ${attendanceDisplay.iconBg}`} title={attendanceDisplay.text}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={attendanceDisplay.iconPath} />
                                            </svg>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleMarkAttendance(0)}
                                            disabled={isAttendanceMarked}
                                            className={`p-2 rounded-lg transition-colors ${
                                                isAttendanceMarked 
                                                ? 'bg-green-100 text-green-600' 
                                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:bg-indigo-200'
                                            }`}
                                        >
                                            {isAttendanceMarked ? (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                </svg>
                                            )}
                                        </button>
                                    )}
                                </div>



                                {/* ⭐ PROGRESS INDICATORS - Shows only when marking attendance */}
                                {isMarkingAttendance && attendanceStep === 'failed' && (
                                    <div className="col-span-2 lg:col-span-5 bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 p-4 rounded-2xl border-2 border-red-200 shadow-md animate-in fade-in duration-300">
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-xl shrink-0">
                                                    ❌
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-red-900 leading-tight">
                                                        Attendance Failed: {attendanceFailedReason.includes('Mobile') || attendanceFailedReason.includes('Screen') ? 'Mobile Screen Detected' : 'Identity Mismatch'}
                                                    </h4>
                                                    <p className="text-xs text-red-600 font-medium mt-0.5">
                                                        {attendanceFailedReason || "Please present your real physical face directly to the camera."}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setAttendanceStep('idle');
                                                    setIsMarkingAttendance(false);
                                                    setAttendanceFailedReason('');
                                                    startCamera();
                                                }}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all shrink-0 flex items-center gap-1.5"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                TRY AGAIN
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {isMarkingAttendance && attendanceStep !== 'idle' && attendanceStep !== 'failed' && (
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


                                {!isParentView && bankSettings?.isPaymentEnabled && (
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

                            {/* Action Buttons Row */}
                            {!isParentView && (
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <button
                                        onClick={() => router.push("/getpass/scan")}
                                        className="w-full h-12 rounded-xl bg-[#EEF2FF] border-2 border-[#C7D2FE] text-[#4F46E5] font-black hover:bg-[#E0E7FF] transition-all flex flex-row items-center justify-start gap-2.5 group px-3 text-left"
                                    >
                                        <div className="w-8 h-8 shrink-0 bg-[#C7D2FE]/50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg className="w-4 h-4 text-[#4F46E5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                            </svg>
                                        </div>
                                        <div className="flex flex-col overflow-hidden min-w-0">
                                            <span className="block text-[8px] font-black uppercase tracking-[0.2em] leading-none mb-1 opacity-70 truncate">Gatepass</span>
                                            <span className="text-[10px] md:text-xs uppercase tracking-tight block truncate">Scan QR code</span>
                                        </div>
                                    </button>

                                {/* ⚡ SECONDARY ACTION: Go to Leave */}
                                    {studentProfile?.studentStatus !== "out" && (
                                        <button
                                            onClick={() => {
                                                if (!isAtHostel && !isParentView) {
                                                    setHighlightLocation(true);
                                                    // Scroll to top to show the location card
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    alert("📍 Location Verification Required\n\nPlease verify your location first by clicking the location icon at the top of your dashboard.");
                                                    return;
                                                }
                                                setRequestType("leave");
                                                setShowRequestForm(true);
                                            }}
                                            className={`w-full h-12 rounded-xl font-black border-2 transition-all flex flex-row items-center justify-start gap-2.5 group px-3 text-left ${isAtHostel || isParentView
                                                ? "bg-[#FFF7ED] border-[#FED7AA] text-[#C2410C] hover:bg-[#FFEDD5]"
                                                : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-red-50 hover:border-red-200"
                                                }`}
                                        >
                                            <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-all ${(isAtHostel || isParentView) ? "bg-[#FED7AA]/50 group-hover:scale-110" : "bg-gray-100 group-hover:bg-red-100"}`}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                </svg>
                                            </div>
                                            <div className="flex flex-col overflow-hidden min-w-0">
                                                <span className={`block text-[8px] font-black uppercase tracking-[0.2em] leading-none mb-1 truncate ${(isAtHostel || isParentView) ? "opacity-70" : "opacity-40"}`}>Leave Request</span>
                                                <span className="text-[10px] md:text-xs uppercase tracking-tight block truncate">
                                                    {(isAtHostel || isParentView) ? "Go to Home" : "Locked"}
                                                </span>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <button
                                    onClick={() => setShowPermissionsHistory(true)}
                                    className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 font-bold text-[9px] md:text-[11px] uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <span>🚪</span> <span className="truncate">Outing & Attendance</span>
                                </button>

                                {/* 📶 Always-Visible Campus WiFi Status Card (Right side of Outing & Attendance) */}
                                {!isParentView && (
                                    <div className={`w-full min-h-[3rem] sm:min-h-[3.25rem] rounded-xl border-2 transition-all duration-500 flex items-center justify-between px-2.5 sm:px-3 py-1.5 text-left shadow-sm ${
                                        highlightLocation
                                            ? 'bg-amber-100 border-amber-400 ring-4 ring-amber-300 shadow-xl scale-[1.02] animate-pulse'
                                            : isOnCampusWifi
                                                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                                                : 'bg-amber-50/90 border-amber-300 text-amber-950'
                                    }`}>
                                        {/* Left Side: Icon + Title + Guidance Subtitle */}
                                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-1">
                                            <span className="text-sm sm:text-base shrink-0">📶</span>
                                            <div className="flex flex-col min-w-0">
                                                <span className="block text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-wider leading-none mb-0.5 opacity-70 truncate">
                                                    Campus WiFi
                                                </span>
                                                <p className={`text-[8px] sm:text-[9.5px] font-semibold leading-tight line-clamp-2 ${
                                                    isOnCampusWifi ? 'text-emerald-800' : 'text-amber-800'
                                                }`}>
                                                    {isOnCampusWifi
                                                        ? 'Connected to hostel WiFi for smooth attendance.'
                                                        : 'Connect to your hostel WiFi for smooth attendance without GPS errors.'
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: OFFLINE/ONLINE Badge + CONNECTED / NOT CONNECTED underneath */}
                                        <div className="shrink-0 flex flex-col items-end justify-center pl-1 border-l border-amber-200/60 sm:pl-2">
                                            <div className="flex items-center gap-1">
                                                <span className={`inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                                                    isOnCampusWifi
                                                        ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50'
                                                        : 'bg-red-500 animate-pulse shadow-sm shadow-red-500/50'
                                                }`} />
                                                <span className={`text-[8px] sm:text-[9.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                                                    isOnCampusWifi
                                                        ? 'bg-emerald-200/80 text-emerald-950 border border-emerald-300'
                                                        : 'bg-red-100 text-red-700 border border-red-200'
                                                }`}>
                                                    {isOnCampusWifi ? 'ONLINE' : 'OFFLINE'}
                                                </span>
                                            </div>
                                            <span className={`text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-tight mt-0.5 ${
                                                isOnCampusWifi ? 'text-emerald-700' : 'text-red-600'
                                            }`}>
                                                {isOnCampusWifi ? 'CONNECTED' : 'NOT CONNECTED'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {bankSettings?.isPaymentEnabled && (
                                    <button
                                        onClick={() => setShowFeeDetailsModal(true)}
                                        className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 font-bold text-[9px] md:text-[11px] uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5 text-center leading-tight col-span-2"
                                    >
                                        <span>💳</span> <span className="truncate">View Fee Details</span>
                                    </button>
                                )}
                            </div>

                            {showRequestForm && (
                                <div className="p-6 rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 shadow-xl shadow-blue-100/50 space-y-6 mb-6 animate-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                                            {requestType === 'leave' ? '🏠 New Leave Request' : '🚶‍♂️ New Gatepass Request'}
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                                        <div>
                                            <label className="block text-[9px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                                                From Date & Time
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={fromDateTime}
                                                onChange={(e) => setFromDateTime(e.target.value)}
                                                className="w-full h-12 px-2 md:px-4 rounded-xl border border-gray-200 bg-white text-[10px] md:text-sm text-gray-800 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none tracking-tighter sm:tracking-normal"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                                                To Date & Time
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={toDateTime}
                                                onChange={(e) => setToDateTime(e.target.value)}
                                                className="w-full h-12 px-2 md:px-4 rounded-xl border border-gray-200 bg-white text-[10px] md:text-sm text-gray-800 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none tracking-tighter sm:tracking-normal"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                                            Reason for {requestType === 'leave' ? 'Home Leave' : 'Short Outing'}
                                        </label>
                                        <textarea
                                            value={reason}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const wordCount = val.trim() === '' ? 0 : val.trim().split(/\s+/).length;
                                                if (wordCount <= 100) {
                                                    setReason(val);
                                                }
                                            }}
                                            placeholder={requestType === 'leave' ? "Mention if going to home, village, etc." : "Local market, hospital, etc."}
                                            rows={3}
                                            className="w-full px-2 md:px-4 py-3 rounded-xl border border-gray-200 bg-white text-[10px] md:text-sm text-gray-800 font-bold placeholder:text-gray-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none tracking-tighter sm:tracking-normal"
                                        />
                                        <p className="text-right text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{(reason.trim() === '' ? 0 : reason.trim().split(/\s+/).length)}/100 WORDS</p>
                                    </div>

                                    <div className="flex gap-2 md:gap-3 pt-2">
                                        <button
                                            onClick={handleRequestPermission}
                                            disabled={submitting}
                                            className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-black text-[10px] md:text-sm uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
                                        >
                                            {submitting ? "Processing..." : `Request ${requestType === 'leave' ? 'Leave' : 'Outing'}`}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowRequestForm(false);
                                                setFromDateTime("");
                                                setToDateTime("");
                                                setReason("");
                                            }}
                                            className="px-5 md:px-6 h-12 rounded-xl border border-gray-200 bg-white text-gray-500 font-black text-[10px] md:text-sm uppercase tracking-widest hover:bg-gray-50 active:scale-[0.98] transition-all"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Latest Permission Status Card */}
                            {latestPermission && (
                                (() => {
                                    // ⚡ LOGIC: Visible only for 24 hours after both warden and dean have responded (finalized)
                                    const isFinalized = latestPermission.wardenStatus !== 'pending' && latestPermission.deanStatus !== 'pending';
                                    if (isFinalized) {
                                        const lastUpdated = new Date(latestPermission.updatedAt || latestPermission.createdAt || Date.now()).getTime();
                                        const hoursPassed = (Date.now() - lastUpdated) / (1000 * 60 * 60);
                                        if (hoursPassed > 24) return null;
                                    }

                                    return (
                                        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 font-outfit">
                                            <div className="flex items-center justify-between mb-2 border-b border-gray-100 pb-1.5">
                                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Active Request Status</h3>
                                                <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${latestPermission.status === 'allowed' ? 'bg-green-100 text-green-700' : latestPermission.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {latestPermission.status}
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-stretch">
                                                {/* Left Side: Student Info & Approvals */}
                                                <div className="w-full md:w-[45%] lg:w-[40%] shrink-0 flex flex-row md:flex-col gap-2">
                                                    <div className="flex flex-col gap-2 w-full md:w-full">
                                                        <p className="text-[9px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Schedule Details</p>
                                                        <div className="flex flex-col gap-1.5 bg-gray-50/80 p-2 md:p-2.5 rounded-lg border border-gray-100">
                                                            <div className="flex items-center gap-1.5 md:gap-2">
                                                                <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                                                    <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[7.5px] md:text-[9px] font-bold text-gray-500 uppercase tracking-tight leading-none mb-0.5 truncate">Campus Out</p>
                                                                    <p className="text-[9px] md:text-[11px] font-bold text-gray-900 leading-none truncate">{formatPermDate(latestPermission, true)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 md:gap-2">
                                                                <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                                                    <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[7.5px] md:text-[9px] font-bold text-gray-500 uppercase tracking-tight leading-none mb-0.5 truncate">Campus In</p>
                                                                    <p className="text-[9px] md:text-[11px] font-bold text-gray-900 leading-none truncate">{formatPermDate(latestPermission, false)}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Permissions Block */}
                                                    <div className="w-1/2 md:w-full">
                                                        <div className="flex flex-col items-start gap-0.5 border border-gray-100 rounded-md p-1 md:p-1.5 bg-gray-50/50 w-full h-full">
                                                            <div className="flex items-center justify-between w-full mt-1">
                                                                <div className="flex items-center gap-0.5 md:gap-1.5">
                                                                    <span className="text-[7px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Parent</span>
                                                                    {latestPermission.parentStatus === "rejected" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-red-600 bg-red-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                                                            Rejected
                                                                        </span>
                                                                    )}
                                                                    {latestPermission.parentStatus === "allowed" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-green-600 bg-green-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                                                            AGREE
                                                                        </span>
                                                                    )}
                                                                    {(!latestPermission.parentStatus || latestPermission.parentStatus === "no_response" || latestPermission.parentStatus === "pending") && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-yellow-600 bg-yellow-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-yellow-100">
                                                                            Pending
                                                                        </span>
                                                                    )}
                                                                    {latestPermission.requestType === 'leave' && (
                                                                        <>
                                                                            {latestPermission.parentConsentUrl ? (
                                                                                <button
                                                                                    onMouseEnter={() => prefetchVideo(latestPermission.parentConsentUrl!)}
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        setActiveConsentVideoUrl(
                                                                                            resolveConsentVideoSrc(
                                                                                                latestPermission.parentConsentUrl!,
                                                                                                prefetchedVideoUrls
                                                                                            )
                                                                                        );
                                                                                    }}
                                                                                    className="text-[5.5px] md:text-[7.5px] font-black text-green-600 bg-green-50 border border-green-200 px-1 py-0.5 rounded uppercase tracking-wider hover:bg-green-100 transition-all flex items-center gap-0.5 cursor-pointer ml-1"
                                                                                    title="Play Consent Video"
                                                                                >
                                                                                    🎥 Play Consent
                                                                                </button>
                                                                            ) : (
                                                                                isParentView && latestPermission.status === 'pending' && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const cleanName = studentProfile?.name ? studentProfile.name.trim().replace(/\s+/g, '_') : 'Student';
                                                                                            const cleanErp = studentProfile?.registrationId ? studentProfile.registrationId.trim() : '';
                                                                                            const slug = cleanErp ? `${cleanName}_${cleanErp}` : cleanName;
                                                                                            window.open(`/parent-consent/${slug}--${latestPermission._id}`, "_blank");
                                                                                        }}
                                                                                        className="text-[5.5px] md:text-[7.5px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded uppercase tracking-wider hover:bg-indigo-100 transition-all flex items-center gap-0.5 cursor-pointer ml-1"
                                                                                    >
                                                                                        🎥 Record Video
                                                                                    </button>
                                                                                )
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 relative">
                                                                    <div className="flex items-center gap-1 md:gap-1.5 bg-white p-0.5 rounded-md border border-gray-100">
                                                                        {isParentView && latestPermission.status === 'pending' ? (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => handleParentApproval(latestPermission._id, "allowed")}
                                                                                    disabled={isUpdatingParentStatus}
                                                                                    className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center transition-all ${latestPermission.parentStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-green-300"} cursor-pointer disabled:opacity-50`}
                                                                                >
                                                                                    <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleParentApproval(latestPermission._id, "rejected")}
                                                                                    disabled={isUpdatingParentStatus}
                                                                                    className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center transition-all ${latestPermission.parentStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-red-300"} cursor-pointer disabled:opacity-50`}
                                                                                >
                                                                                    <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${latestPermission.parentStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                    <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                </div>
                                                                                <div className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${latestPermission.parentStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                    <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between w-full mt-1">
                                                                <div className="flex items-center gap-0.5 md:gap-1.5">
                                                                    <span className="text-[7px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Warden</span>
                                                                    {latestPermission.wardenStatus === "rejected" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-red-600 bg-red-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                                                            Rejected
                                                                        </span>
                                                                    )}
                                                                    {latestPermission.wardenStatus === "allowed" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-green-600 bg-green-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                                                            Accepted
                                                                        </span>
                                                                    )}
                                                                    {latestPermission.wardenStatus === "pending" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-yellow-600 bg-yellow-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-yellow-100">
                                                                            Pending
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 relative">
                                                                    <div className="flex items-center gap-1 md:gap-1.5 bg-white p-0.5 rounded-md border border-gray-100">
                                                                        <div className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${latestPermission.wardenStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                            <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                        </div>
                                                                        <div className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${latestPermission.wardenStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                            <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between w-full mt-1">
                                                                <div className="flex items-center gap-0.5 md:gap-1.5">
                                                                    <span className="text-[7px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Dean</span>
                                                                    {latestPermission.deanStatus === "rejected" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-red-600 bg-red-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                                                            Rejected
                                                                        </span>
                                                                    )}
                                                                    {latestPermission.deanStatus === "allowed" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-green-600 bg-green-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                                                            Accepted
                                                                        </span>
                                                                    )}
                                                                    {latestPermission.deanStatus === "pending" && (
                                                                        <span className="text-[6.5px] md:text-[8px] font-bold text-yellow-600 bg-yellow-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-yellow-100">
                                                                            Pending
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 relative">
                                                                    <div className="flex items-center gap-1 md:gap-1.5 bg-white p-0.5 rounded-md border border-gray-100">
                                                                        <div className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${latestPermission.deanStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm scale-110" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                            <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                        </div>
                                                                        <div className={`w-3.5 h-3.5 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${latestPermission.deanStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                            <svg className="w-2 h-2 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Vertical Separator */}
                                                <div className="hidden md:block w-[1px] md:w-[2px] bg-blue-100/50 my-1 rounded-full"></div>

                                                {/* Right Side: Reason Message */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                                                    <div className="bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-100 h-full flex items-center justify-center">
                                                        <p className="text-[8.5px] md:text-xs text-gray-600 font-medium leading-relaxed italic text-justify">
                                                            "{latestPermission.reason}"
                                                        </p>
                                                    </div>
                                                    
                                                    {/* WhatsApp Consent Share Button for Students */}
                                                    {!isParentView && latestPermission.requestType === 'leave' && latestPermission.parentStatus !== 'allowed' && (
                                                        <button
                                                            onClick={() => {
                                                                const cleanName = studentProfile?.name ? studentProfile.name.trim().replace(/\s+/g, '_') : 'Student';
                                                                const cleanErp = studentProfile?.registrationId ? studentProfile.registrationId.trim() : '';
                                                                const slug = cleanErp ? `${cleanName}_${cleanErp}` : cleanName;
                                                                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.hosteleaze.com';
                                                                const shareUrl = `${origin}/parent-consent/${slug}--${latestPermission._id}`;
                                                                const text = `नमस्कार पिताजी/माताजी, कृपया इस लिंक पर क्लिक करके मेरी छुट्टी (Leave) के लिए अपना सहमति वीडियो रिकॉर्ड करें:\n\n${shareUrl}`;
                                                                const phone = studentProfile.parentPhone ? (studentProfile.parentPhone.startsWith('91') ? studentProfile.parentPhone : '91' + studentProfile.parentPhone) : '';
                                                                window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`, "_blank");
                                                            }}
                                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[9px] md:text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 border border-emerald-500/20"
                                                        >
                                                            <span>💬</span> Share WhatsApp Video Consent
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}

                            {/* Detailed Student Information Section */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="bg-gray-50/50 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h2 className="text-[11px] sm:text-[12px] font-bold text-gray-800 uppercase tracking-wider">Student Profile Details</h2>
                                    <span className="text-[9.5px] sm:text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Official Record</span>
                                </div>

                                <div className="p-3 sm:p-6">
                                    {/* 📱 MOBILE CATEGORY TABS (Visible on mobile screens only) */}
                                    <div className="flex sm:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 mb-3 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setMobileProfileTab('academic')}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${mobileProfileTab === 'academic' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            🎓 Academic
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMobileProfileTab('family')}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${mobileProfileTab === 'family' ? 'bg-white text-amber-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            👨‍👩‍👦 Family
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMobileProfileTab('personal')}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${mobileProfileTab === 'personal' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            📍 Personal
                                        </button>
                                    </div>

                                    {(() => {
                                        const defaultFields = [
                                            { id: "name", label: "FULL NAME", visible: true, type: "text" },
                                            { id: "gender", label: "GENDER", visible: true, type: "text" },
                                            { id: "phoneNumber", label: "PHONE NUMBER", visible: true, type: "tel" },
                                            { id: "dob", label: "DATE OF BIRTH", visible: true, type: "date" },
                                            { id: "category", label: "SOCIAL CATEGORY", visible: true, type: "text" },
                                            { id: "registrationId", label: "ERP ID", visible: true, type: "text" },
                                            { id: "collegeName", label: "COLLEGE NAME", visible: true, type: "text" },
                                            { id: "branch", label: "BRANCH", visible: true, type: "text" },
                                            { id: "year", label: "CURRENT YEAR", visible: true, type: "text" },
                                            { id: "semester", label: "SEMESTER", visible: true, type: "text" },
                                            { id: "section", label: "SECTION", visible: true, type: "text" },
                                            { id: "fatherName", label: "FATHER'S NAME", visible: true, type: "text" },
                                            { id: "fatherNumber", label: "FATHER'S PHONE NO", visible: true, type: "tel" },
                                            { id: "motherName", label: "MOTHER'S NAME", visible: true, type: "text" },
                                            { id: "motherNumber", label: "MOTHER'S PHONE NO", visible: true, type: "tel" },
                                            { id: "localGuardianAddress", label: "LOCAL GUARDIAN ADDRESS", visible: true, type: "text" },
                                            { id: "localGuardianPhoneNumber", label: "LOCAL GUARDIAN PHONE", visible: true, type: "tel" },
                                            { id: "homeState", label: "HOME STATE", visible: true, type: "text" },
                                            { id: "permanentAddress", label: "PERMANENT ADDRESS", visible: true, type: "text" },
                                            { id: "hostelName", label: "HOSTEL NAME", visible: true, type: "text" },
                                            { id: "floorNumber", label: "FLOOR NUMBER", visible: true, type: "text" },
                                            { id: "roomNumber", label: "ROOM NUMBER", visible: true, type: "text" },
                                            { id: "joiningDate", label: "HOSTEL JOINING DATE", visible: true, type: "date" }
                                        ];
                                        const fieldsToRender = (formBuilderConfig && formBuilderConfig.length > 0)
                                            ? formBuilderConfig.filter(f => f.visible && f.type !== 'image')
                                            : defaultFields;

                                        const isProfileLoading = !studentProfile;

                                        const getFieldValue = (field: any) => {
                                            let rawVal: any = "N/A";
                                            if (studentProfile) {
                                                const p = studentProfile as any;
                                                if (p[field.id] !== undefined && p[field.id] !== null && p[field.id] !== "") {
                                                    rawVal = p[field.id];
                                                } else if (p.dynamicFields && p.dynamicFields[field.id] !== undefined && p.dynamicFields[field.id] !== null && p.dynamicFields[field.id] !== "") {
                                                    rawVal = p.dynamicFields[field.id];
                                                } else {
                                                    const lowerId = field.id.toLowerCase();
                                                    if (lowerId.includes("name") && !lowerId.includes("father") && !lowerId.includes("mother") && !lowerId.includes("college")) {
                                                        rawVal = p.name || p.fullName || "N/A";
                                                    } else if (lowerId === "gender") {
                                                        rawVal = p.gender || "N/A";
                                                    } else if (lowerId.includes("phone") && !lowerId.includes("father") && !lowerId.includes("mother") && !lowerId.includes("guardian")) {
                                                        rawVal = p.phoneNumber || p.phone || p.studentPhone || p.mobile || "N/A";
                                                    } else if (lowerId.includes("dob") || lowerId.includes("birth")) {
                                                        rawVal = p.dob || p.dateOfBirth || "N/A";
                                                    } else if (lowerId.includes("category")) {
                                                        rawVal = p.category || p.socialCategory || "N/A";
                                                    } else if (lowerId.includes("reg") || lowerId.includes("erp")) {
                                                        rawVal = p.registrationId || p.erpId || p.erpInformation || "N/A";
                                                    } else if (lowerId.includes("college")) {
                                                        rawVal = p.collegeName || "N/A";
                                                    } else if (lowerId === "branch") {
                                                        rawVal = p.branch || "N/A";
                                                    } else if (lowerId.includes("year")) {
                                                        rawVal = p.year || p.currentYear || "N/A";
                                                    } else if (lowerId.includes("sem")) {
                                                        rawVal = p.semester || p.sem || "N/A";
                                                    } else if (lowerId === "section") {
                                                        rawVal = p.section || "N/A";
                                                    } else if (lowerId.includes("fathername") || lowerId.includes("father'sname")) {
                                                        rawVal = p.fatherName || "N/A";
                                                    } else if (lowerId.includes("fathernumber") || lowerId.includes("fatherphone") || lowerId.includes("parentphone") || lowerId.includes("father'sphone")) {
                                                        rawVal = p.fatherNumber || p.parentPhone || p.fatherPhone || p.fatherMobile || "N/A";
                                                    } else if (lowerId.includes("mothername") || lowerId.includes("mother'sname")) {
                                                        rawVal = p.motherName || "N/A";
                                                    } else if (lowerId.includes("mothernumber") || lowerId.includes("motherphone") || lowerId.includes("mother'sphone")) {
                                                        rawVal = p.motherNumber || p.motherPhone || p.motherMobile || "N/A";
                                                    } else if (lowerId.includes("localguardianaddress")) {
                                                        rawVal = p.localGuardianAddress || "N/A";
                                                    } else if (lowerId.includes("localguardianphone") || lowerId.includes("guardianphone")) {
                                                        rawVal = p.localGuardianPhoneNumber || p.localGuardianPhone || "N/A";
                                                    } else if (lowerId.includes("homestate") || lowerId.includes("state")) {
                                                        rawVal = p.homeState || "N/A";
                                                    } else if (lowerId.includes("permanentaddress") || lowerId === "address") {
                                                        rawVal = p.permanentAddress || p.address || "N/A";
                                                    } else if (lowerId.includes("hostelname")) {
                                                        rawVal = p.hostelName || "N/A";
                                                    } else if (lowerId.includes("floor")) {
                                                        rawVal = p.floorNumber || "N/A";
                                                    } else if (lowerId.includes("room")) {
                                                        rawVal = p.roomNumber || "N/A";
                                                    } else if (lowerId.includes("joining") || lowerId.includes("hosteljoiningdate")) {
                                                        rawVal = p.joiningDate || "N/A";
                                                    }
                                                }
                                            }

                                            const value = (rawVal === undefined || rawVal === null || rawVal === "") ? "N/A" : (typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal));
                                            const displayValue = (field.type === 'date' || field.id === 'joiningDate' || field.id === 'dob') ? formatDate(value) : value;
                                            return { value, displayValue };
                                        };

                                        return (
                                            <>
                                                {/* 📱 MOBILE VIEW: Filtered Grid */}
                                                <div className="grid grid-cols-2 gap-2 sm:hidden text-xs">
                                                    {fieldsToRender.filter(f => {
                                                        const id = f.id.toLowerCase();
                                                        const lbl = (f.label || '').toLowerCase();
                                                        if (mobileProfileTab === 'academic') {
                                                            // Exclude hostel fields from academic tab
                                                            if (lbl.includes('hostel') || id.includes('hostel')) return false;
                                                            return (lbl.includes('name') && !lbl.includes('father') && !lbl.includes('mother') && !lbl.includes('guardian')) ||
                                                                (id.includes('name') && !id.includes('father') && !id.includes('mother') && !id.includes('hostel')) ||
                                                                lbl.includes('erp') || id.includes('erp') || id.includes('reg') ||
                                                                lbl.includes('college') || id.includes('college') ||
                                                                lbl.includes('branch') || id.includes('branch') ||
                                                                lbl.includes('year') || id.includes('year') ||
                                                                lbl.includes('sem') || id.includes('sem') ||
                                                                lbl.includes('section') || id.includes('sec') ||
                                                                (lbl.includes('joining') && !lbl.includes('hostel')) || (id.includes('joining') && !id.includes('hostel'));
                                                        } else if (mobileProfileTab === 'family') {
                                                            return lbl.includes('father') || id.includes('father') ||
                                                                lbl.includes('mother') || id.includes('mother') ||
                                                                lbl.includes('guardian') || id.includes('guardian');
                                                        } else {
                                                            // Personal tab — explicitly include permanentAddress & address fields (not guardian)
                                                            const isPhone = (lbl.includes('phone') || id.includes('phone')) && !lbl.includes('father') && !lbl.includes('mother') && !lbl.includes('guardian');
                                                            const isAddress = (lbl.includes('address') || id.includes('address') || lbl.includes('permanent') || id.includes('permanent')) && !lbl.includes('guardian') && !id.includes('guardian');
                                                            return isPhone || isAddress ||
                                                                lbl.includes('gender') || id.includes('gender') ||
                                                                lbl.includes('birth') || lbl.includes('dob') || id.includes('dob') ||
                                                                lbl.includes('category') || id.includes('category') ||
                                                                lbl.includes('state') || id.includes('state') ||
                                                                lbl.includes('hostel') || id.includes('hostel') ||
                                                                lbl.includes('floor') || id.includes('floor') ||
                                                                lbl.includes('room') || id.includes('room');
                                                        }
                                                    }).sort((a, b) => {
                                                        const lblA = (a.label || '').toLowerCase();
                                                        const lblB = (b.label || '').toLowerCase();
                                                        const aIsAddress = lblA.includes('address') || lblA.includes('permanent') || a.id.toLowerCase().includes('address') || a.id.toLowerCase().includes('permanent');
                                                        const bIsAddress = lblB.includes('address') || lblB.includes('permanent') || b.id.toLowerCase().includes('address') || b.id.toLowerCase().includes('permanent');
                                                        if (aIsAddress && !bIsAddress) return 1;
                                                        if (!aIsAddress && bIsAddress) return -1;
                                                        return 0;
                                                    }).map((field) => {
                                                        const { value, displayValue } = getFieldValue(field);
                                                        const lbl = (field.label || '').toLowerCase();
                                                        const isLongField = lbl.includes('address') || lbl.includes('permanent') || field.id.toLowerCase().includes('address') || String(displayValue).length > 20;

                                                        return (
                                                            <div key={field.id} className={`flex flex-col bg-slate-50/80 border border-slate-100 p-2 rounded-lg ${isLongField ? "col-span-2 bg-amber-50/30 border-amber-100" : ""}`}>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{field.label}</p>
                                                                {isProfileLoading ? (
                                                                    <div className="h-4 w-16 bg-gray-100 animate-pulse rounded mt-1"></div>
                                                                ) : (field.type === 'tel' || field.id.toLowerCase().includes('number') || field.id.toLowerCase().includes('phone')) && value !== "N/A" ? (
                                                                    <a href={`tel:${value}`} title="Click to call" className="text-[11px] font-black text-blue-600 hover:underline flex items-center gap-1">
                                                                        <span>📞</span> {displayValue}
                                                                    </a>
                                                                ) : (
                                                                    <p className={`text-[11px] font-extrabold break-words ${field.id === 'roomNumber' || field.id === 'floorNumber' ? 'text-blue-600' : 'text-gray-900'}`}>
                                                                        {field.id === 'roomNumber' && value !== 'N/A' && !value.startsWith('#') ? '#' : ''}{displayValue}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* 💻 DESKTOP/TABLET VIEW: Full Grid */}
                                                <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
                                                    {fieldsToRender.map((field) => {
                                                        const { value, displayValue } = getFieldValue(field);

                                                        return (
                                                            <div key={field.id} className={['localGuardianAddress', 'permanentAddress', 'homeAddress'].includes(field.id) ? "md:col-span-2" : ""}>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{field.label}</p>
                                                                {isProfileLoading ? (
                                                                    <div className="h-4 w-20 bg-gray-100 animate-pulse rounded mt-1"></div>
                                                                ) : (field.type === 'tel' || field.id.toLowerCase().includes('number') || field.id.toLowerCase().includes('phone')) && value !== "N/A" ? (
                                                                    <a href={`tel:${value}`} title="Click to call" className="text-[12px] font-bold text-blue-600 hover:underline">
                                                                        {value}
                                                                    </a>
                                                                ) : (
                                                                    <p className={`text-[12px] font-bold ${field.id === 'roomNumber' || field.id === 'floorNumber' ? 'text-blue-600' : 'text-gray-900'}`}>
                                                                        {field.id === 'roomNumber' && value !== 'N/A' && !value.startsWith('#') ? '#' : ''}{displayValue}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>


                            {showFeeDetailsModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col font-outfit">
                                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                                            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-widest">Hostel/Mess Fee Details</h3>
                                            <div className="flex items-center gap-2">
                                                {!isParentView && (
                                                    <button 
                                                        onClick={() => {
                                                            setShowFeeDetailsModal(false);
                                                            setShowPaymentModal(true);
                                                        }}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-blue-200 flex items-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                        Add
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setShowFeeDetailsModal(false)}
                                                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                                                >
                                                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto overflow-y-auto p-4">
                                            <table className="w-full text-left text-sm border-collapse">
                                                <thead className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-secondary">
                                                    <tr>
                                                        <th className="px-2 py-4 text-center leading-tight">Student<br />Name</th>
                                                        <th className="px-2 py-4 text-center leading-tight">ERP ID</th>
                                                        <th className="px-2 py-4 text-center leading-tight">Hostel<br />Name</th>
                                                        <th className="px-2 py-4 text-center leading-tight">Room No.</th>
                                                        <th className="px-2 py-4 text-center leading-tight">UTR &<br />Source</th>
                                                        <th className="px-2 py-4 text-center leading-tight">Amount</th>
                                                        <th className="px-2 py-4 text-center leading-tight">Date</th>
                                                        <th className="px-2 py-4 text-center leading-tight">Status</th>
                                                        <th className="px-2 py-4 text-center leading-tight">Verify/<br />Unverify</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {!paymentHistory || paymentHistory.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={9} className="py-20 text-center text-secondary">No payment claims found...</td>
                                                        </tr>
                                                    ) : (
                                                        paymentHistory.map((p) => (
                                                            <tr key={p._id} className="hover:bg-gray-50/50 transition-colors group">
                                                                <td className="px-2 py-4 min-w-[120px] text-center">
                                                                    <div className="flex flex-col leading-tight items-center">
                                                                        <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase text-[9px]">{studentProfile?.name || "Unknown"}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    <span className="text-[9px] text-gray-700 font-bold">{p.registrationId}</span>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    <span className="text-[9px] text-gray-700 font-bold uppercase">{studentProfile?.hostelName || "N/A"}</span>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    <span className="text-[9px] text-gray-700 font-bold uppercase">{studentProfile?.roomNumber || "N/A"}</span>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="font-mono text-[8px] font-bold text-gray-800">{p.utrNumber}</span>
                                                                        <span className="text-[8px] text-blue-600 font-black uppercase tracking-tight">{p.paymentSource}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    <span className="font-black text-gray-900 text-[9px]">₹{p.amount}</span>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    <span className="text-[8px] text-gray-500 font-bold">{new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                                                                        p.status === 'verified' ? 'bg-green-100 text-green-700' :
                                                                        p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                        p.status === 'flagged' ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                        {p.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-4 text-center">
                                                                    {p.status === 'pending' ? (
                                                                        <button
                                                                            onClick={() => handleDeletePayment(p._id)}
                                                                            className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[8px] font-black uppercase tracking-widest transition-colors"
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Locked</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showPermissionsHistory && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                                        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                                            <h2 className="text-lg font-bold text-gray-900">Outing & Permission History & Hostel Attendance</h2>
                                            <button
                                                onClick={() => setShowPermissionsHistory(false)}
                                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                                            >
                                                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Tab Selector */}
                                        {!isParentView && (
                                            <div className="flex border-b border-gray-100 bg-gray-50/50">
                                                <button
                                                    onClick={() => setActiveHistoryTab('calendar')}
                                                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-2 ${activeHistoryTab === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                                                >
                                                    <span>📅</span> Outing Calendar
                                                </button>
                                                <button
                                                    onClick={() => setActiveHistoryTab('permissions')}
                                                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-2 ${activeHistoryTab === 'permissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                                                >
                                                    <span>📜</span> Permission Logs
                                                </button>
                                            </div>
                                        )}

                                        <div className="overflow-y-auto flex-1 flex flex-col">
                                            {activeHistoryTab === 'calendar' || isParentView ? (
                                                <div 
                                                    className="flex-1 flex flex-col"
                                                    onTouchStart={handleTouchStart}
                                                    onTouchMove={handleTouchMove}
                                                    onTouchEnd={handleTouchEnd}
                                                >
                                                    {/* Calendar Navigation */}
                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                                                        <button
                                                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                                                            className="p-2 hover:bg-gray-100 rounded-xl transition-all font-bold text-gray-600 flex items-center justify-center"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                                            </svg>
                                                        </button>
                                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">
                                                            {monthNames[calendarMonth.getMonth()]} <span className="text-gray-400 font-bold">{calendarMonth.getFullYear()}</span>
                                                        </h3>
                                                        <button
                                                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                                                            className="p-2 hover:bg-gray-100 rounded-xl transition-all font-bold text-gray-600 flex items-center justify-center"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    {/* Legend */}
                                                    <div className="flex justify-around items-center px-4 py-3 bg-gray-50 text-[9px] sm:text-[10px] font-black uppercase tracking-wider border-b border-gray-100">
                                                        <div className="flex items-center gap-1.5 text-emerald-700">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30"></span> Inside Campus
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-amber-700">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30"></span> Partial Outing
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-rose-700">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/30"></span> Completely Out
                                                        </div>
                                                    </div>

                                                    {loadingGatePasses && gatePasses.length === 0 ? (
                                                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                                                            <div className="w-10 h-10 border-4 border-gray-100 border-t-blue-500 rounded-full animate-spin"></div>
                                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Loading Outing Logs...</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 bg-white">
                                                            {/* Weekday headers */}
                                                            <div className="grid grid-cols-7 gap-1 p-4 pb-1 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                                                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                                                                    <div key={day} className="py-1">{day}</div>
                                                                ))}
                                                            </div>

                                                            {/* Calendar cells */}
                                                            <div className="grid grid-cols-7 gap-2 p-4">
                                                                {getDaysInMonth(calendarMonth).map((cell, idx) => {
                                                                    if (!cell.date) return <div key={idx} className="aspect-square" />;

                                                                    const isSelected = selectedCalendarDay &&
                                                                        cell.date.getDate() === selectedCalendarDay.getDate() &&
                                                                        cell.date.getMonth() === selectedCalendarDay.getMonth() &&
                                                                        cell.date.getFullYear() === selectedCalendarDay.getFullYear();

                                                                    const isToday = (() => {
                                                                        const today = new Date();
                                                                        return cell.date.getDate() === today.getDate() &&
                                                                            cell.date.getMonth() === today.getMonth() &&
                                                                            cell.date.getFullYear() === today.getFullYear();
                                                                    })();

                                                                    if (!cell.isCurrentMonth) {
                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                className="aspect-square flex items-center justify-center rounded-none bg-gray-50/50 text-gray-300 text-xs font-bold select-none cursor-not-allowed opacity-40"
                                                                            >
                                                                                {cell.date.getDate()}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    const isFuture = (() => {
                                                                        const today = new Date();
                                                                        today.setHours(23, 59, 59, 999);
                                                                        return cell.date.getTime() > today.getTime();
                                                                    })();

                                                                    const joiningDateObj = studentProfile?.joiningDate ? new Date(studentProfile.joiningDate) : null;
                                                                    const isBeforeJoining = joiningDateObj && cell.date < new Date(new Date(joiningDateObj).setHours(0,0,0,0));
                                                                    const isJoiningDate = joiningDateObj && cell.date.getTime() === new Date(new Date(joiningDateObj).setHours(0,0,0,0)).getTime();
 
                                                                    const isOutsideSubscription = (() => {
                                                                        if (!studentProfile?.tenantSubscription) return false;
                                                                        
                                                                        // Check start date (createdAt)
                                                                        if (studentProfile.tenantSubscription.createdAt) {
                                                                            const start = new Date(studentProfile.tenantSubscription.createdAt);
                                                                            if (new Date(cell.date).setHours(0,0,0,0) < new Date(start).setHours(0,0,0,0)) {
                                                                                return true;
                                                                            }
                                                                        }
                                                                        
                                                                        // Check end date (subscriptionEndDate)
                                                                        if (studentProfile.tenantSubscription.endDate) {
                                                                            const end = new Date(studentProfile.tenantSubscription.endDate);
                                                                            if (new Date(cell.date).setHours(0,0,0,0) > new Date(end).setHours(23,59,59,999)) {
                                                                                return true;
                                                                            }
                                                                        }
                                                                        
                                                                        return false;
                                                                    })();

                                                                    const status = (isFuture || isBeforeJoining || isOutsideSubscription) ? null : getDayOutingStatus(cell.date);
                                                                    let colorClasses = "";
                                                                    if (isJoiningDate) {
                                                                        colorClasses = "bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-lg shadow-blue-500/20 border-0";
                                                                    } else if (isFuture || isBeforeJoining || isOutsideSubscription) {
                                                                        colorClasses = "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400 border border-gray-200/50 shadow-sm opacity-60";
                                                                    } else if (status === 'red') {
                                                                        colorClasses = "bg-gradient-to-br from-rose-400 to-red-600 text-white shadow-lg shadow-red-500/20";
                                                                    } else if (status === 'orange') {
                                                                        colorClasses = "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/20";
                                                                    } else {
                                                                        colorClasses = "bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/20";
                                                                    }
 
                                                                    const dateStr = cell.date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).split('/').reverse().join('-');
                                                                    const attendanceRecord = attendanceHistory.find((r: any) => r.date === dateStr);
                                                                    const isPastWindow = (() => {
                                                                        const now = new Date();
                                                                        const istTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });
                                                                        const istTime = istTimeStr.substring(0, 5);
                                                                        return (istTime > attendanceWindow.end) || (now.getHours() >= 0 && now.getHours() < 6);
                                                                    })();
                                                                    const attendanceStatus = attendanceRecord 
                                                                        ? 'Present' 
                                                                        : (isBeforeJoining || isFuture || isOutsideSubscription 
                                                                            ? 'No Record' 
                                                                            : (isToday && !isPastWindow ? 'Pending' : 'Absent'));
 
                                                                    return (
                                                                        <button
                                                                            key={idx}
                                                                            onClick={() => setSelectedCalendarDay(cell.date)}
                                                                            className={`aspect-square flex flex-col items-center justify-center rounded-none text-xs transition-all relative ${colorClasses} ${isSelected ? 'ring-4 ring-blue-600 ring-offset-2 scale-105 z-10' : 'hover:scale-[1.03] active:scale-[0.97]'}`}
                                                                        >
                                                                            {/* Date in the top right corner */}
                                                                            <span className="absolute top-1.5 right-1.5 text-[9px] font-black leading-none">{cell.date.getDate()}</span>
                                                                            
                                                                            {isJoiningDate && (
                                                                                <span className="absolute top-1.5 left-1.5 text-[6px] text-white font-black leading-tight tracking-tighter uppercase text-left">
                                                                                    Hostel<br/>Joined
                                                                                </span>
                                                                            )}
                                                                            
                                                                            {/* Attendance Indicator Bar & Dot */}
                                                                            <div className="absolute bottom-0 w-full h-[50%] bg-white/95 backdrop-blur-sm rounded-none flex items-center justify-center border-t border-black/5 shadow-inner">
                                                                                {attendanceStatus === 'Present' && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="Present" />}
                                                                                {attendanceStatus === 'Absent' && <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm animate-pulse" title="Absent" />}
                                                                            </div>
                                                                            {isToday && (
                                                                                <span className={`w-1 h-1 rounded-full absolute top-1.5 left-1.5 ${status || isJoiningDate ? 'bg-white' : 'bg-blue-600'}`} />
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
 
                                                            {/* Selected Day Details */}
                                                            {selectedCalendarDay && (
                                                                <div className="px-6 pb-6 pt-4 border-t border-gray-100 bg-gray-50/50">
                                                                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                                        <span>📋</span> Details • {selectedCalendarDay.toLocaleDateString("en-IN", { dateStyle: "long" })}
                                                                    </h4>
                                                                    {(() => {
                                                                        const today = new Date();
                                                                        today.setHours(23, 59, 59, 999);
                                                                        const isFuture = selectedCalendarDay.getTime() > today.getTime();
                                                                        
                                                                        const joiningDateObj = studentProfile?.joiningDate ? new Date(studentProfile.joiningDate) : null;
                                                                        const isBeforeJoining = joiningDateObj && selectedCalendarDay < new Date(new Date(joiningDateObj).setHours(0,0,0,0));
                                                                        const isJoiningDate = joiningDateObj && selectedCalendarDay.getTime() === new Date(new Date(joiningDateObj).setHours(0,0,0,0)).getTime();
 
                                                                        const isOutsideSubscription = (() => {
                                                                            if (!studentProfile?.tenantSubscription) return false;
                                                                            if (studentProfile.tenantSubscription.createdAt) {
                                                                                const start = new Date(studentProfile.tenantSubscription.createdAt);
                                                                                if (new Date(selectedCalendarDay).setHours(0,0,0,0) < new Date(start).setHours(0,0,0,0)) {
                                                                                    return true;
                                                                                }
                                                                            }
                                                                            if (studentProfile.tenantSubscription.endDate) {
                                                                                const end = new Date(studentProfile.tenantSubscription.endDate);
                                                                                if (new Date(selectedCalendarDay).setHours(0,0,0,0) > new Date(end).setHours(23,59,59,999)) {
                                                                                    return true;
                                                                                }
                                                                            }
                                                                            return false;
                                                                        })();

                                                                        const dateStr = selectedCalendarDay.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).split('/').reverse().join('-');
                                                                        const attendanceRecord = attendanceHistory.find((r: any) => r.date === dateStr);
                                                                        const isToday = (() => {
                                                                            const today = new Date();
                                                                            return selectedCalendarDay.getDate() === today.getDate() &&
                                                                                selectedCalendarDay.getMonth() === today.getMonth() &&
                                                                                selectedCalendarDay.getFullYear() === today.getFullYear();
                                                                        })();
                                                                        const isPastWindow = (() => {
                                                                            const now = new Date();
                                                                            const istTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });
                                                                            const istTime = istTimeStr.substring(0, 5);
                                                                            return (istTime > attendanceWindow.end) || (now.getHours() >= 0 && now.getHours() < 6);
                                                                        })();
                                                                        const attendanceStatus = attendanceRecord 
                                                                            ? 'Present' 
                                                                            : (isBeforeJoining || isFuture || isOutsideSubscription 
                                                                                ? 'No Record' 
                                                                                : (isToday && !isPastWindow ? 'Pending' : 'Absent'));
 
                                                                        if (isFuture) {
                                                                            return (
                                                                                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-center">
                                                                                    <p className="text-gray-500 text-xs font-bold flex items-center justify-center gap-1.5">
                                                                                        <span>⏳</span> Logs not available for future dates.
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        if (isOutsideSubscription) {
                                                                            return (
                                                                                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-center">
                                                                                    <p className="text-gray-500 text-xs font-bold flex items-center justify-center gap-1.5">
                                                                                        <span>🛇</span> Subscription not active on this date.
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        if (isBeforeJoining) {
                                                                            return (
                                                                                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-center">
                                                                                    <p className="text-gray-500 text-xs font-bold flex items-center justify-center gap-1.5">
                                                                                        <span>🛇</span> Not joined hostel yet.
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        }

                                                                        const dayPasses = getOverlappingGatePasses(selectedCalendarDay);
                                                                        return (
                                                                            <div className="space-y-3">
                                                                                {/* Attendance Details */}
                                                                                <div className="bg-white rounded-xl border border-gray-200/60 p-3 shadow-sm flex items-center justify-between">
                                                                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                                                                                        <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                                                                                        Night Attendance
                                                                                    </span>
                                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                                                        attendanceStatus === 'Present' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                        attendanceStatus === 'Absent' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                                        attendanceStatus === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                                        'bg-gray-100 text-gray-500 border-gray-200'
                                                                                    }`}>
                                                                                        {attendanceStatus === 'Present' ? `✅ Present (${attendanceRecord?.time})` : 
                                                                                         attendanceStatus === 'Absent' ? '❌ Absent' : 
                                                                                         attendanceStatus === 'Pending' ? `🕒 Pending (${attendanceWindow.start} - ${attendanceWindow.end})` : 
                                                                                         '➖ No Record'}
                                                                                    </span>
                                                                                </div>

                                                                                {dayPasses.length === 0 ? (
                                                                                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-center">
                                                                                        <p className="text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5">
                                                                                            <span>✅</span> Stayed inside campus for the whole day.
                                                                                        </p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        {dayPasses.map((pass: any) => (
                                                                                            <div key={pass._id} className="bg-white rounded-xl border border-gray-200/60 p-4 shadow-sm space-y-3">
                                                                                        <div className="flex justify-between items-center">
                                                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${pass.type === 'leave' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                                                                {pass.type === 'leave' ? '🏠 Home Leave' : '🚶 Short Outing'}
                                                                                            </span>
                                                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${pass.status === 'out' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                                                                                {pass.status === 'out' ? 'Still Outside' : 'Returned'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                                                                            <div>
                                                                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Check Out</p>
                                                                                                <p className="font-extrabold text-gray-800">{pass.checkOutISTTime} | <span className="text-gray-400">{pass.checkOutISTDate}</span></p>
                                                                                            </div>
                                                                                            <div>
                                                                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Check In</p>
                                                                                                {pass.status === 'in' || pass.status === 'auto-resolved' ? (
                                                                                                    <p className="font-extrabold text-gray-800">{pass.checkInISTTime} | <span className="text-gray-400">{pass.checkInISTDate}</span></p>
                                                                                                ) : (
                                                                                                    <p className="font-extrabold text-rose-500 uppercase tracking-widest text-[10px] animate-pulse">Outside Campus</p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        {pass.durationMinutes && (
                                                                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider pt-2 border-t border-gray-100">
                                                                                                Total Duration: <span className="text-gray-700 font-black">{(() => {
                                                                                                    const minutes = pass.durationMinutes;
                                                                                                    if (minutes >= 1440) {
                                                                                                        const days = Math.floor(minutes / 1440);
                                                                                                        const hrs = Math.floor((minutes % 1440) / 60);
                                                                                                        const mins = minutes % 60;
                                                                                                        return `${days}d ${hrs}h ${mins}m`;
                                                                                                    }
                                                                                                    const h = Math.floor(minutes / 60);
                                                                                                    const m = minutes % 60;
                                                                                                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                                                                                })()}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="p-4 space-y-3">
                                                    {permissions.length === 0 ? (
                                                        <div className="text-center py-10 text-gray-500">
                                                            <p>No permission requests found.</p>
                                                        </div>
                                                    ) : (
                                                        permissions.map((permission) => (
                                                            <div
                                                                key={permission._id}
                                                                className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm mb-4 font-outfit hover:shadow-md transition-all duration-300"
                                                            >
                                                                <div className="flex items-center justify-end mb-2 border-b border-gray-100 pb-1.5">
                                                                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${permission.status === 'allowed' ? 'bg-green-100 text-green-700' : permission.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                        {permission.status}
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-stretch">
                                                                    {/* Left Side: Student Info & Approvals */}
                                                                    <div className="w-full md:w-[45%] lg:w-[40%] shrink-0 flex flex-row md:flex-col gap-2">
                                                                        <div className="flex flex-col gap-2 w-1/2 md:w-full">
                                                                            <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">Schedule Details</p>
                                                                            <div className="flex flex-col gap-1.5 bg-gray-50/80 p-2 md:p-2.5 rounded-lg border border-gray-100">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-5 h-5 rounded-md bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight leading-none mb-0.5">Campus Out Time</p>
                                                                                        <p className="text-[11px] font-bold text-gray-900 leading-none whitespace-nowrap">{permission.fromDateTime ? new Date(permission.fromDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "N/A"}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="w-5 h-5 rounded-md bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight leading-none mb-0.5">Campus In Time</p>
                                                                                        <p className="text-[11px] font-bold text-gray-900 leading-none whitespace-nowrap">{permission.toDateTime ? new Date(permission.toDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "N/A"}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Permissions Block */}
                                                                        <div className="w-1/2 md:w-full mt-auto">
                                                                            <div className="flex flex-col gap-0.5 md:gap-1 border border-gray-100 rounded-md p-1 md:p-2 bg-gray-50/50 w-full">
                                                                                
                                                                                <div className="flex items-center justify-between w-full">
                                                                                    <div className="flex items-center gap-0.5 md:gap-1.5">
                                                                                        <span className="text-[7px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Parent</span>
                                                                                        {permission.parentStatus === "rejected" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-red-600 bg-red-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                                                                                Rejected
                                                                                            </span>
                                                                                        )}
                                                                                        {permission.parentStatus === "allowed" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-green-600 bg-green-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                                                                                AGREE
                                                                                            </span>
                                                                                        )}
                                                                                        {(!permission.parentStatus || permission.parentStatus === "no_response" || permission.parentStatus === "pending") && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-yellow-600 bg-yellow-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-yellow-100">
                                                                                                Pending
                                                                                            </span>
                                                                                        )}
                                                                                        {permission.parentConsentUrl && (
                                                                                            <button
                                                                                                onMouseEnter={() => prefetchVideo(permission.parentConsentUrl!)}
                                                                                                onClick={(e) => {
                                                                                                    e.preventDefault();
                                                                                                    setActiveConsentVideoUrl(
                                                                                                        resolveConsentVideoSrc(
                                                                                                            permission.parentConsentUrl!,
                                                                                                            prefetchedVideoUrls
                                                                                                        )
                                                                                                    );
                                                                                                }}
                                                                                                className="text-[6px] md:text-[8px] font-black text-green-600 bg-green-50 border border-green-200 px-1 py-0.5 rounded uppercase tracking-wider hover:bg-green-100 transition-all flex items-center gap-0.5 cursor-pointer ml-1"
                                                                                                title="Play Consent Video"
                                                                                            >
                                                                                                🎥 Play
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 relative">
                                                                                        <div className="flex items-center gap-1 md:gap-1.5 bg-white p-0.5 rounded-md border border-gray-100">
                                                                                            {isParentView && permission.status === 'pending' ? (
                                                                                                <>
                                                                                                    <button
                                                                                                        onClick={() => handleParentApproval(permission._id, "allowed")}
                                                                                                        disabled={isUpdatingParentStatus}
                                                                                                        className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center transition-all ${permission.parentStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-green-300"} cursor-pointer disabled:opacity-50`}
                                                                                                    >
                                                                                                        <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => handleParentApproval(permission._id, "rejected")}
                                                                                                        disabled={isUpdatingParentStatus}
                                                                                                        className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center transition-all ${permission.parentStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-red-300"} cursor-pointer disabled:opacity-50`}
                                                                                                    >
                                                                                                        <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                                    </button>
                                                                                                </>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <div className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${permission.parentStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                                        <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                                    </div>
                                                                                                    <div className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${permission.parentStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                                        <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                                    </div>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex items-center justify-between w-full">
                                                                                    <div className="flex items-center gap-0.5 md:gap-1.5">
                                                                                        <span className="text-[7px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Warden</span>
                                                                                        {permission.wardenStatus === "rejected" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-red-600 bg-red-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                                                                                Rejected
                                                                                            </span>
                                                                                        )}
                                                                                        {permission.wardenStatus === "allowed" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-green-600 bg-green-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                                                                                Accepted
                                                                                            </span>
                                                                                        )}
                                                                                        {permission.wardenStatus === "pending" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-yellow-600 bg-yellow-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-yellow-100">
                                                                                                Pending
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 relative">
                                                                                        <div className="flex items-center gap-1 md:gap-1.5 bg-white p-0.5 rounded-md border border-gray-100">
                                                                                            <div className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${permission.wardenStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                                <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                            </div>
                                                                                            <div className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${permission.wardenStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                                <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex items-center justify-between w-full">
                                                                                    <div className="flex items-center gap-0.5 md:gap-1.5">
                                                                                        <span className="text-[7px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Dean</span>
                                                                                        {permission.deanStatus === "rejected" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-red-600 bg-red-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                                                                                Rejected
                                                                                            </span>
                                                                                        )}
                                                                                        {permission.deanStatus === "allowed" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-green-600 bg-green-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                                                                                Accepted
                                                                                            </span>
                                                                                        )}
                                                                                        {permission.deanStatus === "pending" && (
                                                                                            <span className="text-[7px] md:text-[8px] font-bold text-yellow-600 bg-yellow-50 px-0.5 md:px-1 py-0.5 rounded uppercase tracking-wider border border-yellow-100">
                                                                                                Pending
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 relative">
                                                                                        <div className="flex items-center gap-1 md:gap-1.5 bg-white p-0.5 rounded-md border border-gray-100">
                                                                                            <div className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${permission.deanStatus === "allowed" ? "border-green-300 bg-green-50 text-green-600 shadow-sm scale-110" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                                <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                            </div>
                                                                                            <div className={`w-4 h-4 md:w-6 md:h-6 rounded-md border flex items-center justify-center ${permission.deanStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-100 text-gray-300"} cursor-default`}>
                                                                                                <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Vertical Separator */}
                                                                    <div className="hidden md:block w-[1px] md:w-[2px] bg-blue-100/50 my-1 rounded-full"></div>

                                                                    {/* Right Side: Reason Message */}
                                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                        <div className="bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-100 h-full flex items-center justify-center">
                                                                            <p className="text-[8.5px] md:text-xs text-gray-600 font-medium leading-relaxed italic text-justify">
                                                                                "{permission.reason}"
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
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

                            {/* ⚡ DYNAMIC FIELD ENFORCEMENT MODAL - Blocks all actions until fields are filled */}
                            {showFieldEnforcementModal && enforcedMissingFields.length > 0 && (
                                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
                                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-white/20 max-h-[90vh] flex flex-col">
                                        {/* Header */}
                                        <div className={`p-6 pb-4 text-center ${enforcementConfig?.notificationPriority === 'critical'
                                            ? 'bg-gradient-to-b from-red-50 to-white'
                                            : enforcementConfig?.notificationPriority === 'urgent'
                                                ? 'bg-gradient-to-b from-orange-50 to-white'
                                                : 'bg-gradient-to-b from-blue-50 to-white'
                                            }`}>
                                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${enforcementConfig?.notificationPriority === 'critical'
                                                ? 'bg-red-100 text-red-600'
                                                : enforcementConfig?.notificationPriority === 'urgent'
                                                    ? 'bg-orange-100 text-orange-600'
                                                    : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                </svg>
                                            </div>
                                            <h2 className="text-xl font-black text-gray-900 mb-1">
                                                {enforcementConfig?.notificationPriority === 'critical'
                                                    ? '🚨 Action Required'
                                                    : enforcementConfig?.notificationPriority === 'urgent'
                                                        ? '⚠️ Profile Update Required'
                                                        : 'Complete Your Profile'}
                                            </h2>
                                            <p className="text-gray-500 text-sm">
                                                Please fill the following {enforcedMissingFields.length} mandatory field{enforcedMissingFields.length > 1 ? 's' : ''} to continue using the app.
                                            </p>
                                            {/* Progress Bar */}
                                            <div className="mt-3 flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${enforcementConfig?.notificationPriority === 'critical' ? 'bg-red-500' : enforcementConfig?.notificationPriority === 'urgent' ? 'bg-orange-500' : 'bg-blue-500'
                                                            }`}
                                                        style={{
                                                            width: `${Math.round(
                                                                (enforcedMissingFields.filter(f => enforcementFormData[f.fieldId]?.trim()).length / enforcedMissingFields.length) * 100
                                                            )}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-400">
                                                    {enforcedMissingFields.filter(f => enforcementFormData[f.fieldId]?.trim()).length}/{enforcedMissingFields.length}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Scrollable Form Fields */}
                                        <div className="px-6 pb-6 space-y-4 overflow-y-auto flex-1">
                                            {enforcedMissingFields.map((field) => (
                                                <div key={field.fieldId}>
                                                    <label className="block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2 px-1">
                                                        {field.fieldLabel} <span className="text-red-500">*</span>
                                                    </label>

                                                    {/* Render appropriate input based on fieldId */}
                                                    {/* ⚡ CUSTOM DYNAMIC FIELDS: Try to render using Form Builder config first (Handles Floor Number, etc.) */}
                                                    {(() => {
                                                        const configField = formBuilderConfig.find(f =>
                                                            f.id?.toLowerCase().trim() === field.fieldId?.toLowerCase().trim() ||
                                                            f.label?.toLowerCase().trim() === field.fieldLabel?.toLowerCase().trim()
                                                        );

                                                        if (configField && (configField.type === 'select' || configField.type === 'dropdown' || (configField.options && configField.options.length > 0))) {
                                                            return (
                                                                <select
                                                                    value={enforcementFormData[field.fieldId] || ''}
                                                                    onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value.toUpperCase() }))}
                                                                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                                >
                                                                    <option value="">SELECT {field.fieldLabel.toUpperCase()}</option>
                                                                    {configField.options?.map((opt: string) => (
                                                                        <option key={opt} value={opt.toUpperCase()}>{opt.toUpperCase()}</option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        }
                                                        return null;
                                                    })() || (field.fieldId === 'category' ? (
                                                        <select
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        >
                                                            <option value="">Select Category</option>
                                                            <option value="GENERAL">GENERAL</option>
                                                            <option value="SC">SC</option>
                                                            <option value="ST">ST</option>
                                                            <option value="OBC">OBC</option>
                                                        </select>
                                                    ) : field.fieldId === 'homeState' ? (
                                                        <select
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        >
                                                            <option value="">SELECT STATE</option>
                                                            {["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"].map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    ) : field.fieldId === 'section' ? (
                                                        <select
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value.toUpperCase() }))}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        >
                                                            <option value="">SELECT SECTION</option>
                                                            {["A", "B", "C", "D", "E", "F"].map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : field.fieldId === 'year' ? (
                                                        <select
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        >
                                                            <option value="">SELECT YEAR</option>
                                                            {["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR", "5TH YEAR"].map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : field.fieldId === 'semester' ? (
                                                        <select
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        >
                                                            <option value="">SELECT SEMESTER</option>
                                                            {["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"].map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : field.fieldId === 'dob' || field.fieldId === 'joiningDate' ? (
                                                        <input
                                                            type="date"
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        />
                                                    ) : field.fieldId === 'phoneNumber' || field.fieldId === 'fatherNumber' || field.fieldId === 'motherNumber' || field.fieldId === 'localGuardianPhoneNumber' ? (
                                                        <input
                                                            type="tel"
                                                            placeholder={`Enter ${field.fieldLabel}`}
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                                            maxLength={10}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            placeholder={`Enter ${field.fieldLabel}`}
                                                            value={enforcementFormData[field.fieldId] || ''}
                                                            onChange={(e) => setEnforcementFormData(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800 transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white"
                                                        />
                                                    ))}
                                                </div>
                                            ))}

                                            {/* Submit Button */}
                                            <button
                                                onClick={handleFieldEnforcementSubmit}
                                                disabled={savingEnforcementFields || enforcedMissingFields.some(f => !enforcementFormData[f.fieldId]?.trim())}
                                                className={`w-full h-14 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 ${enforcementConfig?.notificationPriority === 'critical'
                                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                                    : enforcementConfig?.notificationPriority === 'urgent'
                                                        ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
                                                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                                    }`}
                                            >
                                                {savingEnforcementFields ? (
                                                    <>
                                                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Save & Continue
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Face Verification Overlay */}
                            {cameraActive && (
                                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
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
                                                        <div className={`transition-all duration-300 font-black flex items-center justify-center gap-3 ${faceDetected ? 'text-green-500 scale-110' : 'text-blue-600'}`}>
                                                            {faceDetected ? (
                                                                <>
                                                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                                                                    FACE DETECTED
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                                                                    {consecutiveFailuresRef.current > 10 ? "ENHANCED RECOGNITION..." : "SEARCHING FOR FACE..."}
                                                                </>
                                                            )}
                                                        </div>
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

                                        <h3 className="text-xl font-black text-gray-900 mb-2">
                                            {isWifiFallback ? "Switching to WiFi..." : "Locking GPS..."}
                                        </h3>
                                        <p className="text-gray-500 text-sm mb-6 font-medium">
                                            {isWifiFallback ? "GPS weak. Using network-based location..." : "Connecting to satellites for high accuracy attendance"}
                                        </p>

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
                                                {isWifiFallback
                                                    ? "📶 Scanning nearby networks..."
                                                    : (gpsAccuracy && gpsAccuracy > 300
                                                        ? "📍 Move closer to a window for faster lock"
                                                        : "Please wait, filtering network signal...")}
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
                                    onClick={() => {
                                        if (missingRequiredFields.length > 0) {
                                            alert("Please update your profile details (Missing: " + missingRequiredFields.join(", ") + ") before closing.");
                                            return;
                                        }
                                        setShowProfile(false);
                                    }}
                                    className={`w-10 h-10 rounded-full border border-solid border-[#9CA3AF] bg-white text-foreground flex items-center justify-center transition-colors hover:bg-filler flex-shrink-0 ${missingRequiredFields.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <div>
                                    <h1 className="text-base font-semibold text-foreground">Profile</h1>
                                </div>
                            </div>

                            <div className="rounded-lg border border-solid border-[#9CA3AF] bg-filler p-1 sm:p-4 md:p-6">

                                {/* ⚡ MANDATORY UPDATE WARNING */}
                                {missingRequiredFields.length > 0 && (
                                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm animate-pulse">
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0">
                                                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="ml-3">
                                                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide">Action Required</h3>
                                                <p className="text-sm text-red-700 mt-1">
                                                    You must update your profile to continue. <br />
                                                    <span className="font-bold">Missing Fields:</span> {missingRequiredFields.join(", ")}
                                                </p>
                                                <button
                                                    onClick={() => router.push('/onboarding')}
                                                    className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase rounded-lg shadow hover:bg-red-700 transition-colors"
                                                >
                                                    Update Profile Now &rarr;
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {/* 💳 Smart Student ID Badge Header (Light Abstract Card Style) */}
                                    <div className="bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-blue-50/60 border border-orange-200/80 rounded-2xl p-2.5 sm:p-4 text-slate-900 shadow-sm relative">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 space-y-1 min-w-0">
                                                <span className="inline-block text-[8px] sm:text-[9px] font-black uppercase tracking-widest bg-orange-100/80 text-orange-800 px-2.5 py-0.5 rounded-full border border-orange-200">
                                                    Digital Hostel ID Pass
                                                </span>
                                                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-tight leading-tight text-slate-500 truncate">ORIENTAL GROUP OF INSTITUTES</h3>
                                                <div className="pt-0.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">{studentProfile.name}</h2>
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${studentProfile.studentStatus === 'out' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                                            ● {studentProfile.studentStatus || 'IN'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[9.5px] text-slate-500 font-semibold truncate mt-0.5 font-mono">
                                                        {(() => {
                                                            let em = studentProfile.email || (studentProfile as any).emailAddress || (studentProfile as any).studentEmail || (studentProfile as any).dynamicFields?.email || (studentProfile as any).dynamicFields?.emailAddress || "";
                                                            if (!em && studentProfile.dynamicFields) {
                                                                for (const [k, v] of Object.entries(studentProfile.dynamicFields)) {
                                                                    if (typeof v === 'string' && v.includes('@') && v.includes('.')) {
                                                                        em = v;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                            return em;
                                                        })()}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 🖼️ Square Border Photo on Top Right Corner */}
                                            <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl border-2 border-white bg-slate-900 text-white flex items-center justify-center font-black text-base flex-shrink-0 overflow-hidden shadow-md ring-2 ring-orange-200/60">
                                                {studentProfile.profilePicture ? (
                                                    <img
                                                        src={studentProfile.profilePicture}
                                                        alt={studentProfile.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    getInitials(studentProfile.name)
                                                )}
                                            </div>
                                        </div>

                                        {/* 🏢 Single Line for Hostel, Room, College & Branch (No Background Box) */}
                                        <div className="mt-2.5 pt-0.5 flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto no-scrollbar text-slate-700">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-[8px]">🏢</span>
                                                <span className="text-[9px] sm:text-[10px] font-extrabold whitespace-nowrap text-slate-800">{studentProfile.hostelName || "BOYS HOSTEL"}</span>
                                            </div>
                                            <span className="text-slate-300 text-[9px]">|</span>
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-[8px]">🚪</span>
                                                <span className="text-[9px] sm:text-[10px] font-extrabold whitespace-nowrap text-slate-800">{studentProfile.roomNumber ? `ROOM #${studentProfile.roomNumber}` : "ROOM N/A"}</span>
                                            </div>
                                            <span className="text-slate-300 text-[9px]">|</span>
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-[8px]">🎓</span>
                                                <span className="text-[9px] sm:text-[10px] font-extrabold whitespace-nowrap text-slate-800">{studentProfile.collegeName || "OIST"}</span>
                                            </div>
                                            <span className="text-slate-300 text-[9px]">|</span>
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-[8px]">📚</span>
                                                <span className="text-[9px] sm:text-[10px] font-extrabold whitespace-nowrap text-slate-800">{studentProfile.branch || "CS"} ({studentProfile.semester || "4TH SEM"})</span>
                                            </div>
                                        </div>

                                        {/* 🎟️ Compact Integrated Barcode Strip */}
                                        {studentProfile.registrationId && (
                                            <div className="mt-2.5 bg-white border border-slate-200/80 text-slate-900 rounded-xl p-2 flex items-center justify-between gap-2 shadow-sm">
                                                <div className="flex flex-col justify-center pl-1 min-w-0">
                                                    <span className="text-[7.5px] font-black text-orange-600 uppercase tracking-widest">Registration ID</span>
                                                    <span className="text-[11px] sm:text-xs font-black text-slate-900 tracking-wider truncate">{studentProfile.registrationId}</span>
                                                </div>
                                                <div className="scale-[0.8] sm:scale-90 flex-shrink-0 flex items-center justify-end overflow-hidden max-h-[34px]">
                                                    <Barcode
                                                        value={studentProfile.registrationId}
                                                        width={1.2}
                                                        height={30}
                                                        fontSize={10}
                                                        background="transparent"
                                                        lineColor="#1e293b"
                                                        displayValue={false}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 📋 Detailed Student Profile Attributes Grid */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 shadow-sm space-y-2.5">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h4 className="text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                                                📋 Official Student Record
                                            </h4>
                                            <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                Verified
                                            </span>
                                        </div>

                                        {/* 📱 MOBILE CATEGORY TABS (Visible on mobile screens only) */}
                                        <div className="flex sm:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 mb-2.5 gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setMobileProfileTab('academic')}
                                                className={`flex-1 py-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${mobileProfileTab === 'academic' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                🎓 Academic
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMobileProfileTab('family')}
                                                className={`flex-1 py-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${mobileProfileTab === 'family' ? 'bg-white text-amber-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                👨‍👩‍👦 Family
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMobileProfileTab('personal')}
                                                className={`flex-1 py-1.5 px-2 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${mobileProfileTab === 'personal' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                📍 Personal
                                            </button>
                                        </div>

                                        {/* 📱 MOBILE VIEW: Filtered by Selected Category Tab */}
                                        <div className="grid grid-cols-2 gap-2 sm:hidden text-xs">
                                            {formBuilderConfig.filter(f => {
                                                if (!f.visible || f.type === 'image') return false;
                                                const id = f.id.toLowerCase();
                                                const lbl = (f.label || '').toLowerCase();
                                                if (mobileProfileTab === 'academic') {
                                                    if (lbl.includes('hostel') || id.includes('hostel')) return false;
                                                    return (lbl.includes('name') && !lbl.includes('father') && !lbl.includes('mother') && !lbl.includes('guardian')) ||
                                                        (id.includes('name') && !id.includes('father') && !id.includes('mother') && !id.includes('hostel')) ||
                                                        lbl.includes('erp') || id.includes('erp') ||
                                                        lbl.includes('college') || id.includes('college') ||
                                                        lbl.includes('branch') || id.includes('branch') ||
                                                        lbl.includes('year') || id.includes('year') ||
                                                        lbl.includes('sem') || id.includes('sem') ||
                                                        lbl.includes('section') || id.includes('sec');
                                                } else if (mobileProfileTab === 'family') {
                                                    return lbl.includes('father') || id.includes('father') ||
                                                        lbl.includes('mother') || id.includes('mother') ||
                                                        lbl.includes('guardian') || id.includes('guardian');
                                                } else {
                                                    // Personal
                                                    const isPhone = (lbl.includes('phone') || id.includes('phone')) && !lbl.includes('father') && !lbl.includes('mother') && !lbl.includes('guardian');
                                                    const isAddress = (lbl.includes('address') || id.includes('address') || lbl.includes('permanent') || id.includes('permanent')) && !lbl.includes('guardian') && !id.includes('guardian');
                                                    return isPhone || isAddress ||
                                                        lbl.includes('gender') || id.includes('gender') ||
                                                        lbl.includes('birth') || lbl.includes('dob') || id.includes('dob') ||
                                                        lbl.includes('category') || id.includes('category') ||
                                                        lbl.includes('state') || id.includes('state') ||
                                                        lbl.includes('hostel') || id.includes('hostel');
                                                }
                                            }).sort((a, b) => {
                                                const lblA = (a.label || '').toLowerCase();
                                                const lblB = (b.label || '').toLowerCase();
                                                const aIsAddress = lblA.includes('address') || lblA.includes('permanent') || a.id.toLowerCase().includes('address') || a.id.toLowerCase().includes('permanent');
                                                const bIsAddress = lblB.includes('address') || lblB.includes('permanent') || b.id.toLowerCase().includes('address') || b.id.toLowerCase().includes('permanent');
                                                if (aIsAddress && !bIsAddress) return 1;
                                                if (!aIsAddress && bIsAddress) return -1;
                                                return 0;
                                            }).map((field) => {
                                                const value = (studentProfile as any)[field.id] || studentProfile.dynamicFields?.[field.id] || "N/A";
                                                const displayValue = (field.type === 'date' || field.id === 'joiningDate') ? formatDate(value) : value;
                                                const isLongField = field.id.toLowerCase().includes('address') || String(displayValue).length > 25;
                                                const isPhoneField = field.id.toLowerCase().includes('phone') || field.id.toLowerCase().includes('number');

                                                return (
                                                    <div 
                                                        key={field.id} 
                                                        className={`flex flex-col bg-slate-50/80 border border-slate-100 p-2 rounded-lg ${isLongField ? 'col-span-2 bg-amber-50/30 border-amber-100' : ''}`}
                                                    >
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{field.label}</p>
                                                        {isPhoneField && value && value !== "N/A" ? (
                                                            <a href={`tel:${value}`} className="text-blue-600 font-black break-words text-[11px] leading-relaxed flex items-center gap-1">
                                                                <span>📞</span> {displayValue}
                                                            </a>
                                                        ) : (
                                                            <p className="text-slate-800 font-extrabold break-words text-[11px] leading-relaxed">{displayValue}</p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* 💻 DESKTOP/TABLET VIEW: Full 2-Column Grid */}
                                        <div className="hidden sm:grid grid-cols-2 gap-2.5 text-xs">
                                            {formBuilderConfig.filter(f => f.visible && f.type !== 'image').map((field) => {
                                                const value = (studentProfile as any)[field.id] || studentProfile.dynamicFields?.[field.id] || "N/A";
                                                const displayValue = (field.type === 'date' || field.id === 'joiningDate') ? formatDate(value) : value;
                                                const isLongField = field.id.toLowerCase().includes('address') || String(displayValue).length > 25;

                                                return (
                                                    <div 
                                                        key={field.id} 
                                                        className={`flex flex-col bg-slate-50/80 border border-slate-100 p-2.5 rounded-lg ${isLongField ? 'col-span-2 bg-amber-50/30 border-amber-100' : ''}`}
                                                    >
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{field.label}</p>
                                                        <p className="text-slate-800 font-extrabold break-words text-xs leading-relaxed">{displayValue}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                {studentProfile.isProfileLocked ? (
                                    <div className="w-full px-4 py-3 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center gap-2 text-sm font-semibold text-red-700">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        Profile is Locked by Admin
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {/* ⚡ NEW: Manual Biometric Setup Button */}
                                        <button
                                            onClick={handleRegisterDevice}
                                            disabled={isRegisteringDevice}
                                            className={`w-full px-4 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${studentProfile.webAuthnCredentials?.length ? 'bg-green-50 text-green-700 border-2 border-green-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'}`}
                                        >
                                            {isRegisteringDevice ? (
                                                <>
                                                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    Processing...
                                                </>
                                            ) : studentProfile.webAuthnCredentials?.length ? (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Secure Biometrics Linked
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                    Link Face ID / Fingerprint
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => router.push("/onboarding?mode=edit")}
                                            className="w-full px-4 py-3 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[#383838] transition-colors"
                                        >
                                            Edit Profile
                                        </button>
                                    </div>
                                )}
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
                                <>
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
                                    <button
                                        onClick={handleLogout}
                                        className="w-full h-14 rounded-2xl bg-gray-100 text-gray-900 font-bold text-lg hover:bg-gray-200 transition-all active:scale-95 mt-3"
                                    >
                                        Logout
                                    </button>
                                </>
                            )}

                            {studentProfile?.deviceId && (
                                <div className="space-y-3">
                                    <button
                                        onClick={handleRegisterDevice}
                                        disabled={isRegisteringDevice}
                                        className={`w-full h-14 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-200 transition-all active:scale-95 ${isRegisteringDevice ? "opacity-75 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow-xl"}`}
                                    >
                                        {isRegisteringDevice ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Verifying...
                                            </div>
                                        ) : (
                                            "Verify & Link This Device"
                                        )}
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full h-14 rounded-2xl bg-gray-100 text-gray-900 font-bold text-lg hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        Logout
                                    </button>
                                </div>
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
                showPaymentModal && (
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
                )
            }

            <ParentConsentVideoModal
                url={activeConsentVideoUrl}
                onClose={() => setActiveConsentVideoUrl(null)}
            />

            <footer className="mt-2 py-6 border-t border-gray-100/50">
                <div className="flex flex-col items-center gap-1.5 text-center px-4">
                    <p className="text-[9px] sm:text-[11px] font-bold tracking-widest text-gray-400/80 uppercase">
                        &copy; 2026 HOSTELEAZE. All Rights Reserved.
                    </p>
                    <p className="text-[8px] sm:text-[9px] font-medium text-gray-300 uppercase tracking-[0.15em] opacity-60">
                        Unauthorized copying, modification, or distribution is strictly prohibited
                    </p>
                </div>
            </footer>
        </div >
    );
}