"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

interface Permission {
  _id: string;
  fromDateTime: string | Date;
  toDateTime: string | Date;
  reason: string;
  status: "pending" | "allowed" | "rejected";
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
  localGuardianAddress?: string;
  localGuardianPhoneNumber?: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [fromDateTime, setFromDateTime] = useState("");
  const [toDateTime, setToDateTime] = useState("");
  const [reason, setReason] = useState("");
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isAtHostel, setIsAtHostel] = useState(false);
  const [isLocationChecking, setIsLocationChecking] = useState(false);

  const HOSTEL_LAT = 23.2483348;
  const HOSTEL_LNG = 77.5026058;
  const ALLOWED_RADIUS = 200; // meters

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
      localStorage.removeItem("userType");
      localStorage.removeItem("firebaseUID");
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  useEffect(() => {
    let permissionInterval: NodeJS.Timeout | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const response = await fetch(`/api/students?firebaseUID=${user.uid}`);
          const data = await response.json();

          if (data.student) {
            const studentData = {
              ...data.student,
              studentStatus: data.student.studentStatus || "in"
            };
            setStudentProfile(studentData);
            setLoading(false);

            const studentId = data.student._id;

            const fetchStudentProfile = async () => {
              try {
                const response = await fetch(`/api/students?firebaseUID=${user.uid}`);
                const data = await response.json();
                if (data.student) {
                  const studentData = {
                    ...data.student,
                    studentStatus: data.student.studentStatus || "in"
                  };
                  setStudentProfile(studentData);
                }
              } catch (error) {
                console.error("Error fetching student profile:", error);
              }
            };

            const fetchPermissions = async () => {
              try {
                const permResponse = await fetch(`/api/permissions?studentId=${studentId}`);
                const permData = await permResponse.json();

                if (permData.permissions) {
                  setPermissions(permData.permissions);
                  await fetchStudentProfile();
                }
              } catch (error) {
                console.error("Error fetching permissions:", error);
              }
            };

            fetchPermissions();
            permissionInterval = setInterval(() => {
              fetchPermissions();
            }, 2000);
          }
        } catch (error) {
          console.error("Error fetching student data:", error);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (permissionInterval) {
        clearInterval(permissionInterval);
      }
    };
  }, []);

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
          fromDateTime,
          toDateTime,
          reason,
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

      const response = await fetch("/api/students/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: studentProfile._id,
          status: "in",
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
        console.log(`Hostel Location: Lat=${HOSTEL_LAT}, Lng=${HOSTEL_LNG}`);

        const distance = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          HOSTEL_LAT,
          HOSTEL_LNG
        );

        console.log(`\n=== FINAL LOCATION (${reason}) ===`);
        console.log(`Latitude: ${position.coords.latitude}`);
        console.log(`Longitude: ${position.coords.longitude}`);
        console.log(`Accuracy: ${finalAccuracy} meters`);
        console.log(`Distance from hostel: ${Math.round(distance)} meters`);

        if (distance <= ALLOWED_RADIUS) {
          setIsAtHostel(true);
          alert(`Location verified! You are ${Math.round(distance)}m from the hostel. Permission button is now active.`);
        } else {
          setIsAtHostel(false);
          alert(`Verification failed! You are ${Math.round(distance)}m away from the hostel. You must be within 200m to request permission.`);
        }
      } else {
        console.log("Falling back to getCurrentPosition...");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const distance = calculateDistance(latitude, longitude, HOSTEL_LAT, HOSTEL_LNG);

            if (distance <= ALLOWED_RADIUS) {
              setIsAtHostel(true);
              alert(`Location verified (fallback)! You are ${Math.round(distance)}m from the hostel.`);
            } else {
              setIsAtHostel(false);
              alert(`Verification failed! You are ${Math.round(distance)}m from the hostel.`);
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
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-semibold text-foreground">Student Dashboard</h1>
                  <p className="mt-1 md:mt-2 text-sm text-secondary">Request outing permissions</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={getAccurateLocation}
                    disabled={isLocationChecking}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${isAtHostel
                      ? "bg-green-600 text-white"
                      : "bg-foreground text-background hover:bg-[#383838]"
                      } ${isLocationChecking ? "opacity-75 cursor-not-allowed" : ""}`}
                    title="Get accurate location"
                  >
                    {isLocationChecking ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        Verifying...
                      </>
                    ) : (
                      <>📍 {isAtHostel ? "Verified" : "Location"}</>
                    )}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm font-medium hover:bg-filler transition-colors"
                    title="Logout"
                  >
                    Logout
                  </button>
                  <button
                    onClick={() => setShowProfile(true)}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {studentProfile?.profilePicture ? (
                      <img
                        src={studentProfile.profilePicture}
                        alt={studentProfile.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      studentProfile && getInitials(studentProfile.name)
                    )}
                  </button>
                </div>
              </div>

              {studentProfile?.studentStatus === "out" ? (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="w-full h-12 rounded-lg bg-foreground text-background font-medium transition-colors hover:bg-[#383838] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingIn ? "Checking in..." : "I'm In"}
                </button>
              ) : (
                <button
                  onClick={() => setShowRequestForm(!showRequestForm)}
                  disabled={!isAtHostel}
                  className={`w-full h-12 rounded-lg font-medium transition-colors ${isAtHostel
                    ? "bg-foreground text-background hover:bg-[#383838]"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  {isAtHostel ? "Request Permission" : "Verify Location to Request Permission"}
                </button>
              )}

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
                      className="flex-1 h-12 rounded-lg bg-foreground text-background font-medium transition-colors hover:bg-[#383838] disabled:opacity-50 disabled:cursor-not-allowed"
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

              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Permission History</h2>
                {permissions.length === 0 ? (
                  <p className="text-secondary text-sm">No permission requests yet</p>
                ) : (
                  <div className="space-y-3">
                    {permissions.map((permission) => (
                      <div
                        key={permission._id}
                        className="p-3 md:p-4 rounded-lg border border-solid border-[#9CA3AF] bg-filler"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm text-secondary">
                              From: {new Date(permission.fromDateTime).toLocaleString()}
                            </p>
                            <p className="text-base font-medium text-foreground mt-0.5 md:mt-1">
                              To: {new Date(permission.toDateTime).toLocaleString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs font-medium ${getStatusColor(
                              permission.status
                            )}`}
                          >
                            {permission.status.charAt(0).toUpperCase() + permission.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mt-1.5 md:mt-2">Reason: {permission.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                    <div className="text-center space-y-1">
                      <p className="text-base font-semibold text-foreground">{studentProfile.name}</p>
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
                        <p className="text-foreground font-medium">{new Date(studentProfile.joiningDate).toLocaleDateString()}</p>
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
                        <p className="text-secondary mb-1">Home Pin Code</p>
                        <p className="text-foreground font-medium">{studentProfile.homePinCode}</p>
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

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => router.push("/onboarding")}
                  className="flex-1 px-4 py-3 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[#383838] transition-colors"
                >
                  Edit Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm font-medium hover:bg-filler transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
