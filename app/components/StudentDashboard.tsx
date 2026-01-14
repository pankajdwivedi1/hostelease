"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

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
  const [attendanceWindow, setAttendanceWindow] = useState({ start: "21:00", end: "22:30" });
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const latestPermission = useMemo(() => {
    if (permissions.length === 0) return null;
    // Sort by date (assuming _id also correlates or fromDateTime)
    return [...permissions].sort((a, b) =>
      new Date(b.fromDateTime).getTime() - new Date(a.fromDateTime).getTime()
    )[0];
  }, [permissions]);

  const HOSTEL_LOCATIONS = [
    { lat: 23.2483348, lng: 77.5026058, radius: 200, name: "Original Location" },
    { lat: 23.2475529, lng: 77.5035134, radius: 100, name: "Loc 1" },
    { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Loc 2" }
  ];
  const ACCURACY_THRESHOLD = 50; // meters

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to register device");
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

      // Check attendance status
      const checkAttendance = async () => {
        try {
          const res = await fetch(`/api/students/attendance?studentId=${studentProfile._id}`);
          const data = await res.json();
          if (data.marked) setIsAttendanceMarked(true);
          if (data.startTime && data.endTime) {
            setAttendanceWindow({ start: data.startTime, end: data.endTime });
          }
        } catch (e) {
          console.error("Error checking attendance status:", e);
        }
      };
      checkAttendance();
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
      sessionStorage.removeItem("userType");
      sessionStorage.removeItem("firebaseUID");
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
          const minimalResponse = await fetch(`/api/students?firebaseUID=${user.uid}&minimal=true`);
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
            const fullResponse = await fetch(`/api/students?firebaseUID=${user.uid}`);
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create permission");
      }

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check in");
      }

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
    console.log("Getting accurate location...");

    let watchId: number | null = null;
    let bestAccuracy = Infinity;
    let bestPosition: GeolocationPosition | null = null;
    let attempts = 0;
    let isCompleted = false;

    const completeLocation = (position: GeolocationPosition | null, reason: string) => {
      if (isCompleted) return;
      isCompleted = true;
      setIsLocationChecking(false);

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      if (position) {
        const finalAccuracy = Math.round(position.coords.accuracy);

        // Log coordinates before calculation
        console.log(`\n=== COORDINATE CHECK ===`);
        console.log(`Student Location: Lat=${position.coords.latitude}, Lng=${position.coords.longitude}`);
        console.log(`Accuracy: ${finalAccuracy} meters`);

        if (finalAccuracy > ACCURACY_THRESHOLD) {
          setIsAtHostel(false);
          alert(`Waiting for better GPS signal... (Current Accuracy: ${finalAccuracy}m). Please stay in an open area.`);
          return;
        }

        // Check if student is within any of the allowed circles
        let isInsideAny = false;
        let closestInfo = { distance: Infinity, radius: 0 };

        HOSTEL_LOCATIONS.forEach(loc => {
          const dist = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            loc.lat,
            loc.lng
          );
          if (dist <= loc.radius) {
            isInsideAny = true;
          }
          if (dist < closestInfo.distance) {
            closestInfo = { distance: dist, radius: loc.radius };
          }
        });

        console.log(`\n=== FINAL LOCATION (${reason}) ===`);
        console.log(`Min Distance: ${Math.round(closestInfo.distance)} meters (Required: ${closestInfo.radius}m)`);

        if (isInsideAny) {
          setIsAtHostel(true);
          alert(`Location verified! Permission button is now active.`);
        } else {
          setIsAtHostel(false);
          alert(`Verification failed! You are ${Math.round(closestInfo.distance)}m away. You must be within the restricted radius of the campus hostels.`);
        }
      } else {
        console.log("Falling back to getCurrentPosition...");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const finalAccuracy = Math.round(accuracy);

            if (finalAccuracy > ACCURACY_THRESHOLD) {
              setIsAtHostel(false);
              alert(`Waiting for better GPS signal... (Current Accuracy: ${finalAccuracy}m).`);
              return;
            }

            let isInsideAny = false;
            let closestInfo = { distance: Infinity, radius: 0 };

            HOSTEL_LOCATIONS.forEach(loc => {
              const dist = calculateDistance(latitude, longitude, loc.lat, loc.lng);
              if (dist <= loc.radius) {
                isInsideAny = true;
              }
              if (dist < closestInfo.distance) {
                closestInfo = { distance: dist, radius: loc.radius };
              }
            });

            if (isInsideAny) {
              setIsAtHostel(true);
              alert(`Location verified (fallback)!`);
            } else {
              setIsAtHostel(false);
              alert(`Verification failed! You are ${Math.round(closestInfo.distance)}m away from the nearest campus point.`);
            }
          },
          (err) => {
            console.error("Fallback geolocation error:", err.code, err.message);
            setIsLocationChecking(false);

            let errorMessage = "Could not get location. ";
            if (err.code === 1) {
              errorMessage += "Please enable location permission in your browser settings.";
              if (!window.location.protocol.includes('https') && !window.location.hostname.includes('localhost')) {
                errorMessage += " Note: Your browser may require HTTPS for location access.";
              }
            } else if (err.code === 2) {
              errorMessage += "Location unavailable. Please enable GPS/location services on your device.";
            } else if (err.code === 3) {
              errorMessage += "Location request timed out. Please try again.";
            } else {
              errorMessage += "Please ensure GPS is on and permission is granted.";
            }
            alert(errorMessage);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        attempts++;
        const { accuracy } = position.coords;

        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestPosition = position;
        }

        if (accuracy <= 20) {
          completeLocation(bestPosition, "reached 20m accuracy");
        }
      },
      (error) => {
        console.error("WatchPosition error:", error.code, error.message);

        // Try getCurrentPosition as immediate fallback
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!isCompleted) {
              bestPosition = position;
              completeLocation(bestPosition, "fallback to getCurrentPosition");
            }
          },
          (fallbackError) => {
            console.error("Fallback geolocation error:", fallbackError.code, fallbackError.message);
            setIsLocationChecking(false);

            let errorMessage = "Could not get location. ";
            if (fallbackError.code === 1) {
              errorMessage += "Please enable location permission in your browser settings. ";
              if (!window.location.protocol.includes('https') && !window.location.hostname.includes('localhost')) {
                errorMessage += "Note: Location access requires HTTPS for security.";
              }
            } else if (fallbackError.code === 2) {
              errorMessage += "Location unavailable. Please check your GPS/location services.";
            } else if (fallbackError.code === 3) {
              errorMessage += "Location request timed out. Please try again.";
            }

            alert(errorMessage);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    setTimeout(() => {
      if (!isCompleted) {
        completeLocation(bestPosition, "timeout after 15 seconds");
      }
    }, 15000);
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
      setAttendanceError("This function will be activated between 9:00 PM to 10:30PM");
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Hello, <span className="text-blue-600">{studentProfile.name.split(' ')[0]}!</span>
                  </h1>
                  <p className="text-sm text-gray-500 font-medium">Welcome back to Hostelease Dashboard</p>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Current Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${studentProfile.studentStatus === 'out' ? 'bg-red-500' : 'bg-green-500'}`} />
                    <p className="text-lg font-bold text-gray-900 capitalize">Currently {studentProfile.studentStatus || 'IN'}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hostel & Room</p>
                  <p className="text-lg font-bold text-gray-900">{studentProfile.hostelName}<span className="text-blue-600 ml-1">#{studentProfile.roomNumber}</span></p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Location Lock</p>
                    <p className="text-sm font-bold text-gray-700">{isAtHostel ? '📍 Verified' : '❌ Not Verified'}</p>
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
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Daily Attendance</p>
                    <p className={`text-sm font-bold ${attendanceError ? 'text-red-600' : 'text-gray-700'}`}>
                      {isAttendanceMarked ? '✅ Saved' : attendanceError ? attendanceError : `🕒 Allowed ${attendanceWindow.start} - ${attendanceWindow.end}`}
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
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${latestPermission.wardenStatus === "allowed" ? "border-green-500 bg-green-50 text-green-600 shadow-sm ring-4 ring-green-50" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${latestPermission.wardenStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm ring-4 ring-red-50" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
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
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${latestPermission.deanStatus === "allowed" ? "border-green-600 bg-green-500 text-white shadow-lg shadow-green-100 scale-110" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${latestPermission.deanStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm ring-4 ring-red-50" : "border-gray-100 text-gray-300"}`}>
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
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

              {showRequestForm && (
                <div className="p-6 rounded-lg border border-solid border-[#9CA3AF] bg-filler space-y-4">
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
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Enter reason for outing"
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
                            <p className="text-[14px] text-slate-800 leading-relaxed font-medium">
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
      </main>

      {/* Mandatory Device Registration Modal */}
      {showDeviceRegistration && (
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
      )}
    </div>
  );
}
