"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Barcode from "react-barcode";

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

  const latestPermission = useMemo(() => {
    if (permissions.length === 0) return null;
    // Sort by date (assuming _id also correlates or fromDateTime)
    return [...permissions].sort((a, b) =>
      new Date(b.fromDateTime).getTime() - new Date(a.fromDateTime).getTime()
    )[0];
  }, [permissions]);

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

      const newDeviceId = generateUUID();

      const response = await fetch("/api/students/register-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: studentProfile._id,
          deviceId: newDeviceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to register device: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      storeDeviceId(newDeviceId);
      setStudentProfile({ ...studentProfile, deviceId: newDeviceId });
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
      // If no ID in localStorage, OR if DB has an ID but it doesn't match localStorage
      if (!storedId || (studentProfile.deviceId && studentProfile.deviceId !== storedId)) {
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
    setLockProgress(0);
    setGpsAccuracy(null);
    console.log("Starting High-Speed Location Lock...");

    let watchId: number | null = null;
    let isCompleted = false;
    let bestPosition: GeolocationPosition | null = null;
    let lockTimer: NodeJS.Timeout | null = null;

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

    const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (lockTimer !== null) clearTimeout(lockTimer);
    };

    const finishLock = () => {
      if (isCompleted || !bestPosition) return;
      isCompleted = true;
      const finalPosition = bestPosition;
      cleanup();

      setGpsLockStatus('locked');
      setLockProgress(100);

      setTimeout(() => {
        setIsLocationChecking(false);
        performVerification(finalPosition);
      }, 500);
    };

    // Hard limit: 15 seconds if absolutely no signal
    const hardTimeoutId = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        cleanup();
        setIsLocationChecking(false);
        setGpsLockStatus('error');
        alert("Location Error: Please ensure GPS is enabled and try again.");
      }
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (isCompleted) return;

        const { accuracy } = position.coords;
        setGpsAccuracy(Math.round(accuracy));

        // Use the first location immediately as bestPosition
        if (!bestPosition) {
          bestPosition = position;
          // Start a 2.5 second "refinement" buffer as soon as we get the FIRST data
          lockTimer = setTimeout(finishLock, 2500);
          setLockProgress(40);
        } else if (accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
          setLockProgress((prev) => Math.min(95, prev + 15));
        }

        // If accuracy is already very good (<50m), don't wait for the buffer
        if (accuracy <= 50) {
          clearTimeout(hardTimeoutId);
          finishLock();
        }
      },
      (error) => {
        console.warn("GPS Lock Search:", error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  const handleMarkAttendance = async () => {
    if (!studentProfile) return;

    // Clear previous error
    setAttendanceError(null);

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
      const deviceId = getStoredDeviceId();

      // Get current position for the request
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

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
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setIsAttendanceMarked(true);
          alert(data.message || "Attendance marked successfully!");
        } else {
          alert(data.error || "Failed to mark attendance");
        }
        setIsMarkingAttendance(false);
      }, (error) => {
        console.error("Location error:", error);
        alert("Failed to get location for attendance.");
        setIsMarkingAttendance(false);
      }, { enableHighAccuracy: true });

    } catch (error: any) {
      console.error("Error in attendance flow:", error);
      alert("An error occurred. Please try again.");
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
              {/* Header section with Welcome */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                    Hello, <span className="text-blue-600">{studentProfile.name.split(' ')[0]}!</span>
                  </h1>
                  <p className="text-[11px] md:text-sm text-gray-500 font-medium whitespace-nowrap">Welcome back to Hostelease Dashboard</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleLogout}
                    className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all hover:text-red-600"
                    title="Logout"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowProfile(true)}
                    className="w-11 h-11 rounded-full ring-2 ring-blue-100 ring-offset-2 overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    {studentProfile?.profilePicture ? (
                      <img
                        src={studentProfile.profilePicture}
                        alt={studentProfile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center font-bold">
                        {getInitials(studentProfile.name)}
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2" style={{ fontFamily: 'Cambria, Cochin, Georgia, Times, "Times New Roman", serif' }}>
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
                      onClick={handleMarkAttendance}
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
                  className="flex-1 h-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                >
                  🕙 Outing History
                </button>
                {studentProfile?.studentStatus === "out" ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="flex-[2] h-12 rounded-xl bg-green-600 text-white font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {checkingIn ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : "✅ I'm Back In"}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRequestForm(!showRequestForm)}
                    disabled={!isAtHostel}
                    className={`flex-[2] h-12 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${isAtHostel
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
                  <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Student Profile Details</h2>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Official Record</span>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                      <a href={`tel:${studentProfile.phoneNumber}`} title="Click to call" className="text-sm font-bold text-blue-600 hover:underline">
                        {studentProfile.phoneNumber}
                      </a>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
                      <p className="text-sm font-medium text-gray-600 truncate">{studentProfile.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hostel Name</p>
                      <p className="text-sm font-bold text-gray-900">{studentProfile.hostelName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Room Number</p>
                      <p className="text-sm font-bold text-blue-600">#{studentProfile.roomNumber}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">College</p>
                      <p className="text-sm font-bold text-gray-900">{studentProfile.collegeName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Branch</p>
                      <p className="text-sm font-bold text-gray-900">{studentProfile.branch || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Semester/Year</p>
                      <p className="text-sm font-bold text-gray-900">{studentProfile.semester || "N/A"} ({studentProfile.year || "N/A"})</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ERP Info</p>
                      <p className="text-sm font-bold text-gray-900">{studentProfile.erpInformation || "N/A"}</p>
                    </div>

                    <div className="col-span-2 md:col-span-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Category</p>
                        <p className="text-sm font-bold text-gray-900">{studentProfile.category || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Date of Birth</p>
                        <p className="text-sm font-bold text-gray-900">{formatDate(studentProfile.dob)}</p>
                      </div>
                    </div>

                    <div className="col-span-2 md:col-span-4 h-px bg-gray-50 my-2"></div>

                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Father's Name</p>
                      <p className="text-sm font-bold text-gray-900">{studentProfile.fatherName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Father's Phone</p>
                      {studentProfile.fatherNumber ? (
                        <a href={`tel:${studentProfile.fatherNumber}`} title="Click to call" className="text-sm font-bold text-blue-600 hover:underline">
                          {studentProfile.fatherNumber}
                        </a>
                      ) : (
                        <p className="text-sm font-bold text-gray-900">N/A</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mother's Name</p>
                      <p className="text-sm font-bold text-gray-900">{studentProfile.motherName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mother's Phone</p>
                      {studentProfile.motherNumber ? (
                        <a href={`tel:${studentProfile.motherNumber}`} title="Click to call" className="text-sm font-bold text-blue-600 hover:underline">
                          {studentProfile.motherNumber}
                        </a>
                      ) : (
                        <p className="text-sm font-bold text-gray-900">N/A</p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Permanent Address</p>
                      <p className="text-sm font-medium text-gray-700">{studentProfile.homePinCode || "N/A"}, {studentProfile.homeState || ""}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Local Guardian</p>
                      <p className="text-sm font-medium text-gray-700">
                        {studentProfile.localGuardianAddress || "N/A"}
                        {studentProfile.localGuardianPhoneNumber && (
                          <>
                            {" "}(
                            <a href={`tel:${studentProfile.localGuardianPhoneNumber}`} title="Click to call" className="text-blue-600 hover:underline font-bold">
                              {studentProfile.localGuardianPhoneNumber}
                            </a>
                            )
                          </>
                        )}
                      </p>
                    </div>
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
                    <div className="flex flex-col">
                      <p className="text-secondary mb-1">Phone Number</p>
                      <p className="text-foreground font-medium">{studentProfile.phoneNumber}</p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-secondary mb-1">Hostel Name</p>
                      <p className="text-foreground font-medium">{studentProfile.hostelName}</p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-secondary mb-1">Room Number</p>
                      <p className="text-foreground font-medium">{studentProfile.roomNumber}</p>
                    </div>
                    {studentProfile.erpInformation && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">ERP Information</p>
                        <p className="text-foreground font-medium">{studentProfile.erpInformation}</p>
                      </div>
                    )}
                    {studentProfile.joiningDate && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Joining Date</p>
                        <p className="text-foreground font-medium">{new Date(studentProfile.joiningDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                      </div>
                    )}
                    {studentProfile.branch && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Branch</p>
                        <p className="text-foreground font-medium">{studentProfile.branch}</p>
                      </div>
                    )}
                    {studentProfile.collegeName && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">College Name</p>
                        <p className="text-foreground font-medium">{studentProfile.collegeName}</p>
                      </div>
                    )}
                    {studentProfile.year && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Year</p>
                        <p className="text-foreground font-medium">{studentProfile.year}</p>
                      </div>
                    )}
                    {studentProfile.semester && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Semester</p>
                        <p className="text-foreground font-medium">{studentProfile.semester}</p>
                      </div>
                    )}
                    {studentProfile.section && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Section</p>
                        <p className="text-foreground font-medium">{studentProfile.section}</p>
                      </div>
                    )}
                    {studentProfile.fatherName && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Father&apos;s Name</p>
                        <p className="text-foreground font-medium">{studentProfile.fatherName}</p>
                      </div>
                    )}
                    {studentProfile.fatherNumber && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Father&apos;s Number</p>
                        <p className="text-foreground font-medium">{studentProfile.fatherNumber}</p>
                      </div>
                    )}
                    {studentProfile.motherName && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Mother&apos;s Name</p>
                        <p className="text-foreground font-medium">{studentProfile.motherName}</p>
                      </div>
                    )}
                    {studentProfile.motherNumber && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Mother&apos;s Number</p>
                        <p className="text-foreground font-medium">{studentProfile.motherNumber}</p>
                      </div>
                    )}
                    {studentProfile.homePinCode && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Permanent Address</p>
                        <p className="text-foreground font-medium">{studentProfile.homePinCode}</p>
                      </div>
                    )}
                    {studentProfile.homeState && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">State</p>
                        <p className="text-foreground font-medium">{studentProfile.homeState}</p>
                      </div>
                    )}
                    {studentProfile.localGuardianAddress && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Local Guardian Address</p>
                        <p className="text-foreground font-medium">{studentProfile.localGuardianAddress}</p>
                      </div>
                    )}
                    {studentProfile.localGuardianPhoneNumber && (
                      <div className="flex flex-col">
                        <p className="text-secondary mb-1">Local Guardian Phone</p>
                        <p className="text-foreground font-medium">{studentProfile.localGuardianPhoneNumber}</p>
                      </div>
                    )}
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
      </main >

      {/* Mandatory Device Registration Modal */}
      {
        showDeviceRegistration && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-3xl">
                📱
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Device Verification Required</h2>
                <p className="text-gray-600">
                  To ensure security and prevent unauthorized check-ins, you must register this device with your account. This is a one-time mandatory step.
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 font-medium font-outfit">
                Note: Once registered, your check-ins and permissions will be locked to this specific device.
              </div>
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
                  "Register Device Now"
                )}
              </button>
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
      {/* Floating Toast Notification */}
      {
        showToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 px-4 w-full max-w-sm">
            <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-500/20 backdrop-blur-md">
              <svg className="w-6 h-6 text-white/90 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-bold tracking-tight" style={{ fontFamily: 'Cambria, serif' }}>{toastMessage}</p>
            </div>
          </div>
        )
      }
    </div >
  );
}
