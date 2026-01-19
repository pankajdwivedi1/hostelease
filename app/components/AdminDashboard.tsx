"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Barcode from "react-barcode";
import dynamic from "next/dynamic";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400 text-xs">Loading Map...</div>
});

interface Permission {
  _id: string;
  studentId: {
    _id: string;
    name: string;
    email: string;
    phoneNumber: string;
    hostelName: string;
    roomNumber: string;
    profilePicture?: string;
    studentStatus?: "in" | "out";
    collegeName?: string;
    branch?: string;
    semester?: string;
    section?: string;
  };
  fromDateTime: string | Date;
  toDateTime: string | Date;
  reason: string;
  status: "pending" | "allowed" | "rejected";
  wardenStatus: "pending" | "allowed" | "rejected";
  deanStatus: "pending" | "allowed" | "rejected";
}

interface SimplePermission {
  id: string;
  fromDateTime: string | Date;
  toDateTime: string | Date;
  reason: string;
  status: "pending" | "allowed" | "rejected";
  wardenStatus: "pending" | "allowed" | "rejected";
  deanStatus: "pending" | "allowed" | "rejected";
}

interface AttendanceLog {
  _id: string;
  studentId: {
    name: string;
    email: string;
    hostelName: string;
    roomNumber: string;
    registrationId?: string;
  } | null;
  istTime: string;
  location: {
    accuracy: number;
  };
}

interface DBNotification {
  _id: string;
  message: string;
  image?: string;
  targetType: "all" | "hostel" | "individual";
  targetStudentId?: {
    name: string;
    registrationId: string;
  };
  priority: "normal" | "urgent" | "critical";
  createdAt: string;
  acknowledgedBy: string[];
}

interface StudentDetails {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  hostelName: string;
  roomNumber: string;
  profilePicture?: string;
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
  section?: string;
  homeState?: string;
  dob?: string;
  category?: string;
  studentStatus?: "in" | "out";
  registrationId?: string;
  permissions: SimplePermission[];
}

// Cache constants
const CACHE_KEYS = {
  STUDENTS: 'hostelease_students_cache',
  HOSTELS: 'hostelease_hostels_cache',
  TIMESTAMP: 'hostelease_cache_timestamp'
};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export default function AdminDashboard({ title = "Admin Dashboard", showRemoveButton = false }: { title?: string; showRemoveButton?: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "allowed" | "rejected" | "pending">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "in" | "out">("all");
  const [students, setStudents] = useState<StudentDetails[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hostelFilter, setHostelFilter] = useState<string>("all");
  const [collegeFilter, setCollegeFilter] = useState<string>("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string }>>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, number>>({});
  const [presentStudentIds, setPresentStudentIds] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState<"permissions" | "attendance" | "messaging">("permissions");
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [attendanceLogsLoading, setAttendanceLogsLoading] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<DBNotification[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [isEditCameraOpen, setIsEditCameraOpen] = useState(false);
  const editVideoRef = useRef<HTMLVideoElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const [editStudentForm, setEditStudentForm] = useState<Partial<StudentDetails>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [newMessage, setNewMessage] = useState({
    message: "",
    targetType: "all",
    targetHostel: "",
    targetStudentId: "",
    priority: "normal" as const,
    image: "",
    expiryHours: "24" // Default 24 hours
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceHostelFilter, setAttendanceHostelFilter] = useState("all");
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewData, setExportPreviewData] = useState<any[]>([]);
  const [exportType, setExportType] = useState<'students' | 'attendance'>('students');
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [locationVerificationResults, setLocationVerificationResults] = useState<{
    name: string;
    distance: number;
    isVerified: boolean;
    radius: number;
    lat: number;
    lng: number;
    appliedOffset?: number;
  }[]>([]);
  const [lastCheckAccuracy, setLastCheckAccuracy] = useState<number | null>(null);
  const [isLocationChecking, setIsLocationChecking] = useState(false);
  const [selectedAttendanceHostel, setSelectedAttendanceHostel] = useState<string | null>(null);
  const [showAllEntryLogs, setShowAllEntryLogs] = useState(false);
  const [showAllAbsentees, setShowAllAbsentees] = useState(false);

  // Refs for click-outside detection
  const entryLogsRef = useRef<HTMLDivElement>(null);
  const absenteesRef = useRef<HTMLDivElement>(null);

  const [hostelLocations, setHostelLocations] = useState<any[]>([]);
  const [isLocationsLoading, setIsLocationsLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false);

  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: "",
    lat: 0,
    lng: 0,
    radius: 100
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getHostelCategory = (hostelName: string): string | null => {
    const name = hostelName.toLowerCase();
    const exactMatch = hostels.find(h => h.name.toLowerCase() === name);
    if (exactMatch) return exactMatch.name;
    if (name.includes("gaytri") || name.includes("hostel a")) return "Gaytri Hostel";
    if (name.includes("gangotri") || name.includes("hostel b")) return "Gangotri Hostel";
    if (name.includes("guest") || name.includes("guess") || name.includes("hostel d")) return "Guest House Boys Hostel";
    if (name.includes("boys") || name.includes("hostel c")) return "Boys Hostel";
    return null;
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

  const fetchHostelLocations = async () => {
    try {
      setIsLocationsLoading(true);
      const response = await fetch("/api/admin/settings");
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.locations) {
        setHostelLocations(data.locations);
      } else {
        // Fallback to strict defaults (Library = 23.2475529, Gangotri = 23.2483348)
        setHostelLocations([
          { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
          { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
          { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
        ]);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setIsLocationsLoading(false);
    }
  };

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const handleFixCampusSettings = () => {
    setEditingLocationIndex(null);
    setLocationForm({ name: "", lat: 0, lng: 0, radius: 100 });
    setShowLocationModal(true);
  };

  const handleEditLocation = (index: number) => {
    const loc = hostelLocations[index];
    setEditingLocationIndex(index);
    setLocationForm({
      name: loc.name || "",
      lat: loc.lat,
      lng: loc.lng,
      radius: loc.radius
    });
    setShowLocationModal(true);
  };

  const handleDeleteLocation = async (index: number) => {
    if (!confirm("Are you sure you want to delete this location?")) return;

    const newLocations = hostelLocations.filter((_, i) => i !== index);
    await saveLocationsToDB(newLocations);
  };

  const saveLocationsToDB = async (locations: any[]) => {
    try {
      setIsUpdatingSettings(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations })
      });

      if (!res.ok) {
        throw new Error(`Failed to save settings: ${res.status}`);
      }

      if (res.ok) {
        await fetchHostelLocations(); // Refresh immediately
        return true;
      } else {
        alert("Failed to update settings.");
        return false;
      }
    } catch (e) {
      console.error(e);
      alert("Error updating settings.");
      return false;
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!locationForm.name || !locationForm.lat || !locationForm.lng) {
      alert("Please fill all fields");
      return;
    }

    let updatedLocations = [...hostelLocations];
    if (editingLocationIndex !== null) {
      updatedLocations[editingLocationIndex] = locationForm;
    } else {
      updatedLocations.push(locationForm);
    }

    const success = await saveLocationsToDB(updatedLocations);
    if (success) {
      setShowLocationModal(false);
    }
  };

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapZoom, setMapZoom] = useState<number>(18);

  const fillWithCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsGettingLocation(true);

    const successCallback = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const lat = parseFloat(latitude.toFixed(6));
      const lng = parseFloat(longitude.toFixed(6));

      setLocationForm(prev => ({
        ...prev,
        lat,
        lng
      }));
      setMapZoom(12);
      setIsGettingLocation(false);
    };

    const errorCallback = (error: GeolocationPositionError, isHighAccuracy: boolean) => {
      console.warn(`Location error (${isHighAccuracy ? 'High' : 'Low'} Accuracy):`, error.message);

      // If high accuracy failed, try low accuracy
      if (isHighAccuracy) {
        console.log("Falling back to low accuracy...");
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (lowAccError) => errorCallback(lowAccError, false),
          {
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 60000 // Accept older cached positions (1 min)
          }
        );
        return;
      }

      // If both failed
      setIsGettingLocation(false);
      let errorMsg = "Could not retrieve location.";
      if (error.code === 1) errorMsg = "Location permission denied. Please enable location services.";
      else if (error.code === 2) errorMsg = "Position unavailable. Please check your GPS signal.";
      else if (error.code === 3) errorMsg = "Location request timed out. Please move to an open area and try again.";

      alert(errorMsg);
    };

    // First attempt: High Accuracy with 15s timeout
    navigator.geolocation.getCurrentPosition(
      successCallback,
      (error) => errorCallback(error, true),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      }
    );
  };
  const absentees = useMemo(() => {
    let list = students.filter(s => !presentStudentIds.includes(s.id));
    if (currentTab === "attendance" && attendanceHostelFilter !== "all") {
      list = list.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === attendanceHostelFilter);
    }
    return list;
  }, [students, presentStudentIds, attendanceHostelFilter, currentTab, hostels]);

  const fetchHostels = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(CACHE_KEYS.HOSTELS);
        if (cached) {
          setHostels(JSON.parse(cached));
          // Don't return here if we want to background update, but usually hostels don't change often.
          // Let's return to save bandwidth as requested.
          return;
        }
      }

      const response = await fetch("/api/hostels", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to fetch hostels: ${response.status}`);
      const data = await response.json();
      if (data.hostels) {
        setHostels(data.hostels);
        try {
          sessionStorage.setItem(CACHE_KEYS.HOSTELS, JSON.stringify(data.hostels));
        } catch (e) {
          console.warn("Failed to cache hostels");
        }
      }
    } catch (error) {
      console.error("Error fetching hostels:", error);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (isListExpanded) setIsListExpanded(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [isListExpanded]);

  const fetchStudents = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(CACHE_KEYS.STUDENTS);
        const timestamp = sessionStorage.getItem(CACHE_KEYS.TIMESTAMP);

        if (cached && timestamp) {
          const age = Date.now() - parseInt(timestamp);
          if (age < CACHE_DURATION) {
            setStudents(JSON.parse(cached));
            setStudentsLoading(false);
            return;
          }
        }
      }

      setStudentsLoading(true);
      // ⚡ OPTIMIZED: Fetch lightweight data (no big images) to save bandwidth
      const response = await fetch("/api/students?light=true", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to fetch students: ${response.status}`);
      const data = await response.json();
      if (data.students) {
        const formattedStudents = data.students.map((s: any) => ({
          id: s._id,
          name: s.name,
          email: s.email,
          phoneNumber: s.phoneNumber,
          hostelName: s.hostelName,
          roomNumber: s.roomNumber,
          profilePicture: s.profilePicture,
          fatherName: s.fatherName,
          fatherNumber: s.fatherNumber,
          motherName: s.motherName,
          motherNumber: s.motherNumber,
          homePinCode: s.homePinCode,
          erpInformation: s.erpInformation,
          joiningDate: s.joiningDate,
          branch: s.branch,
          collegeName: s.collegeName,
          year: s.year,
          semester: s.semester,
          section: s.section,
          localGuardianAddress: s.localGuardianAddress,
          localGuardianPhoneNumber: s.localGuardianPhoneNumber,
          homeState: s.homeState,
          studentStatus: s.studentStatus || "in",
          registrationId: s.registrationId,
          permissions: []
        }));
        setStudents(formattedStudents);

        try {
          sessionStorage.setItem(CACHE_KEYS.STUDENTS, JSON.stringify(formattedStudents));
          sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
        } catch (e) {
          console.warn("Failed to cache students", e);
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setStudentsLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      // ⚡ OPTIMIZED: Fetch light permissions data (no images) to save massive bandwidth
      const response = await fetch("/api/permissions?light=true", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to fetch permissions: ${response.status}`);
      const data = await response.json();
      if (data.permissions) {
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      const response = await fetch(`/api/admin/attendance-summary?date=${selectedDate}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch summary: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setAttendanceSummary(data.summary);
        setPresentStudentIds(data.presentStudentIds);
      }
    } catch (error: any) {
      console.error("Error fetching attendance summary:", error.message);
      // Fail silently for polling, but log actual error
    }
  };

  const fetchAttendanceLogs = async () => {
    try {
      setAttendanceLogsLoading(true);
      const response = await fetch(`/api/admin/attendance?date=${selectedDate}&hostelName=${attendanceHostelFilter}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        setAttendanceLogs(data.attendance || []);
      }
    } catch (error: any) {
      console.error("Error fetching attendance logs:", error.message);
    } finally {
      setAttendanceLogsLoading(false);
    }
  };

  const fetchAdminNotifications = async () => {
    try {
      const response = await fetch("/api/admin/notifications");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        setAdminNotifications(data.notifications);
      }
    } catch (error: any) {
      console.error("Error fetching notifications:", error.message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMessage(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.message) return;
    try {
      setSendingMessage(true);
      const senderId = sessionStorage.getItem("firebaseUID") || sessionStorage.getItem("userType");

      // Calculate expiry date
      let expiresAt = null;
      if (newMessage.expiryHours !== "never") {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + parseInt(newMessage.expiryHours));
      }

      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newMessage, senderId, expiresAt }),
      });
      if (!response.ok) throw new Error(`Failed to send message: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        alert("Notification broadcasted successfully!");
        setNewMessage({
          message: "",
          targetType: "all",
          targetHostel: "",
          targetStudentId: "",
          priority: "normal",
          image: "",
          expiryHours: "24"
        });
        fetchAdminNotifications();
      } else {
        alert(data.error || "Failed to broadcast notification");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCleanup = async (type: "attendance" | "notifications") => {
    if (!confirm(`Are you sure you want to clean up ${type}? This will delete old records.`)) return;
    try {
      const endpoint = type === "attendance" ? "/api/admin/attendance-cleanup" : "/api/admin/notifications?action=cleanup";
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) throw new Error(`Cleanup failed: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        alert(`${type} cleanup successful! ${data.deletedCount} records removed.`);
        if (type === "attendance") fetchAttendanceLogs();
        else fetchAdminNotifications();
      }
    } catch (error) {
      console.error(`Error cleaning up ${type}:`, error);
    }
  };

  useEffect(() => {
    const loadData = () => {
      setLoading(true);

      // ⚡ OPTIMIZED: Run all fetches independently
      // Permissions (Critical for UI list): Manage loading state
      fetchPermissions().finally(() => setLoading(false));

      // Hostels: Updates filters when ready (safe to render without)
      fetchHostels();

      // Students: Background update
      fetchStudents();
    };

    loadData();
    fetchAdminNotifications();
    if (title === "Developer Dashboard") {
      fetchHostelLocations();
    }
  }, [title]);

  useEffect(() => {
    fetchAttendanceSummary();
    if (currentTab === "attendance") {
      fetchAttendanceLogs();
    }
  }, [selectedDate, attendanceHostelFilter, currentTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPermissions();
      fetchAttendanceSummary();
      if (currentTab === 'attendance') fetchAttendanceLogs();
      if (currentTab === 'messaging') fetchAdminNotifications();
    }, 20000);

    return () => clearInterval(interval);
  }, [currentTab, selectedDate]);

  // Click outside to collapse expanded sections
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Collapse Entry Logs if expanded and clicked outside
      if (showAllEntryLogs && entryLogsRef.current && !entryLogsRef.current.contains(event.target as Node)) {
        setShowAllEntryLogs(false);
      }

      // Collapse Absentees if expanded and clicked outside
      if (showAllAbsentees && absenteesRef.current && !absenteesRef.current.contains(event.target as Node)) {
        setShowAllAbsentees(false);
      }
    };

    // Add event listener when either section is expanded
    if (showAllEntryLogs || showAllAbsentees) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAllEntryLogs, showAllAbsentees]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getAccurateLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocationChecking(true);

    const processLocation = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      const finalAccuracy = Math.round(accuracy);
      setLastCheckAccuracy(finalAccuracy);

      const locationsToTest = hostelLocations.length > 0 ? hostelLocations : [
        { lat: 23.2475529, lng: 77.5035134, radius: 100, name: "Gangotri hostel" },
        { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" },
        { lat: 23.2483348, lng: 77.5026058, radius: 200, name: "Centeral library" }
      ];

      const results = locationsToTest.map(loc => {
        const dist = calculateDistance(latitude, longitude, loc.lat, loc.lng);
        // ⚡ IMPROVED: Account for GPS accuracy (Effective Distance)
        // Cap the accuracy offset at 50m to prevent false positives when GPS is very poor
        const offset = Math.min(finalAccuracy, 50);
        const isVerified = dist <= loc.radius;
        return { ...loc, distance: dist, isVerified: isVerified, appliedOffset: offset };
      });
      setLocationVerificationResults(results);
      setIsLocationChecking(false);
    };

    const handleError = (error: GeolocationPositionError, isHighAccuracy: boolean) => {
      console.warn(`Location test error (${isHighAccuracy ? 'High' : 'Low'} Accuracy):`, error);
      console.warn(`Error code: ${error.code}, Message: ${error.message}`);

      // If high accuracy failed, try low accuracy as fallback
      if (isHighAccuracy) {
        console.log("High accuracy failed. Falling back to low accuracy mode...");
        navigator.geolocation.getCurrentPosition(
          processLocation,
          (lowAccError) => handleError(lowAccError, false),
          {
            enableHighAccuracy: false,
            timeout: 40000, // 40 seconds for low accuracy fallback
            maximumAge: 120000 // Accept cached positions up to 2 minutes old
          }
        );
        return;
      }

      // Both high and low accuracy failed
      setIsLocationChecking(false);
      let errorMsg = "Could not retrieve location. ";

      if (error.code === 1) {
        errorMsg += "Location permission denied. Please enable location services in your browser settings.";
      } else if (error.code === 2) {
        errorMsg += "Position unavailable. Please check your GPS signal and ensure you're not indoors.";
      } else if (error.code === 3) {
        errorMsg += "Location request timed out. Please ensure:\n- GPS is enabled\n- You have a clear view of the sky\n- Location services are allowed for this site\n\nTry moving to an open area and retry.";
      } else {
        errorMsg += "An unknown error occurred. Please try again.";
      }

      alert(errorMsg);
    };

    // First attempt: High accuracy with 30s timeout (mobile-friendly)
    navigator.geolocation.getCurrentPosition(
      processLocation,
      (error) => handleError(error, true),
      {
        enableHighAccuracy: true,
        timeout: 30000, // Increased to 30 seconds for mobile devices
        maximumAge: 10000 // Accept recent positions (10 seconds old)
      }
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem("userType");
      sessionStorage.removeItem("firebaseUID");
      router.push("/login?logout=success");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/login?logout=success");
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      setDeletingStudentId(studentId);
      const response = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete student: ${response.status} - ${text}`);
      }

      const data = JSON.parse(await response.text() || "{}");

      setSelectedStudent(null);
      setShowDeleteConfirm(false);
      setSelectedStudent(null);
      setShowDeleteConfirm(false);
      await Promise.all([fetchPermissions(), fetchStudents(true)]);
    } catch (error: any) {
      console.error("Error deleting student:", error);
      alert(error.message || "Failed to delete student. Please try again.");
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: "allowed" | "rejected") => {
    try {
      const userType = sessionStorage.getItem("userType");
      const updateData: any = { permissionId: id };

      if (userType === "warden") {
        updateData.wardenStatus = newStatus;
      } else if (userType === "admin" || userType === "developer") {
        updateData.deanStatus = newStatus;
      } else {
        updateData.status = newStatus;
      }

      setPermissions((prevPermissions) =>
        prevPermissions.map((perm) =>
          perm._id === id ? {
            ...perm,
            status: userType === "admin" || userType === "developer" ? newStatus : perm.status,
            wardenStatus: userType === "warden" ? newStatus : perm.wardenStatus,
            deanStatus: (userType === "admin" || userType === "developer") ? newStatus : perm.deanStatus,
          } : perm
        )
      );

      const response = await fetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }

      const data = await response.json();

      if (response.ok && data.permission) {
        setPermissions((prevPermissions) =>
          prevPermissions.map((perm) =>
            perm._id === id ? data.permission : perm
          )
        );
        // Refresh students to update their in/out status in the directory
        fetchStudents(true);
      } else {
        fetchPermissions();
      }
    } catch (error) {
      console.error("Error updating permission:", error);
      fetchPermissions();
    }
  };

  const exportToExcel = () => {
    const data = filteredStudents.map(s => ({
      "Student ID": s.registrationId || "N/A",
      Name: s.name,
      Email: s.email,
      Phone: s.phoneNumber,
      Hostel: s.hostelName,
      Room: s.roomNumber,
      College: s.collegeName,
      Branch: s.branch,
      Year: s.year,
      Semester: s.semester
    }));
    setExportPreviewData(data);
    setExportType('students');
    setShowExportPreview(true);
  };

  const exportAttendanceToExcel = () => {
    setShowExportOptionsModal(true);
  };

  const handleExportOption = (option: 'present' | 'absent') => {
    setShowExportOptionsModal(false);

    if (option === 'present') {
      const data = attendanceLogs.map(log => ({
        "Student ID": log.studentId?.registrationId || "N/A",
        Student: log.studentId?.name || "Unknown",
        Email: log.studentId?.email || "N/A",
        Hostel: log.studentId?.hostelName || "N/A",
        Room: log.studentId?.roomNumber || "N/A",
        Time: log.istTime,
        Accuracy: log.location.accuracy ? `${Math.round(log.location.accuracy)}m` : "N/A"
      }));
      setExportPreviewData(data);
      setExportType('attendance');
      setShowExportPreview(true);
    } else {
      let filteredAbsentees = absentees;
      if (attendanceHostelFilter !== 'all') {
        filteredAbsentees = absentees.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === attendanceHostelFilter);
      }

      const data = filteredAbsentees.map(s => ({
        "Student ID": s.registrationId || "N/A",
        Student: s.name,
        Email: s.email,
        Hostel: s.hostelName,
        Room: s.roomNumber,
        Phone: s.phoneNumber,
        Status: "Absent"
      }));
      setExportPreviewData(data);
      setExportType('attendance');
      setShowExportPreview(true);
    }
  };

  const confirmDownload = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportPreviewData);

    if (exportType === 'students') {
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(wb, "students_data.xlsx");
    } else {
      const hostelNameSuffix = attendanceHostelFilter !== "all" ? `_${attendanceHostelFilter}` : "";

      // Determine file name based on data
      const isAbsenteeReport = exportPreviewData.length > 0 && exportPreviewData[0].Status === "Absent";
      const reportPrefix = isAbsenteeReport ? "absentees" : "attendance";

      XLSX.utils.book_append_sheet(wb, ws, `${reportPrefix}${hostelNameSuffix}`.slice(0, 31));
      XLSX.writeFile(wb, `${reportPrefix}_report_${selectedDate}${hostelNameSuffix}.xlsx`);
    }
    setShowExportPreview(false);
  };


  const handleProfileClick = async (studentId: string) => {
    let student = students.find((s) => s.id === studentId);

    // If student doesn't have profile picture (light mode), fetch full details
    if (student && !student.profilePicture) {
      try {
        // Fetch full student details on demand using email
        const res = await fetch(`/api/students?email=${student.email}`);
        const data = await res.json();
        if (data.student) {
          // Merge full details
          student = {
            ...student,
            profilePicture: data.student.profilePicture,
            fatherName: data.student.fatherName,
            fatherNumber: data.student.fatherNumber,
            motherName: data.student.motherName,
            motherNumber: data.student.motherNumber,
            homePinCode: data.student.homePinCode,
            erpInformation: data.student.erpInformation,
            joiningDate: data.student.joiningDate,
            localGuardianAddress: data.student.localGuardianAddress,
            localGuardianPhoneNumber: data.student.localGuardianPhoneNumber,
            homeState: data.student.homeState,
            studentStatus: data.student.studentStatus || "in",
            registrationId: data.student.registrationId,
          };
        }
      } catch (e) {
        console.error("Failed to fetch full student details", e);
      }
    }

    // Fallback: Use partial data from permissions if full student list isn't loaded yet
    if (!student) {
      const permissionWithStudent = permissions.find(p =>
        typeof p.studentId === 'object' && p.studentId._id === studentId
      );

      if (permissionWithStudent && typeof permissionWithStudent.studentId === 'object') {
        const s = permissionWithStudent.studentId;
        student = {
          id: s._id,
          name: s.name,
          email: s.email,
          phoneNumber: s.phoneNumber,
          hostelName: s.hostelName,
          roomNumber: s.roomNumber,
          profilePicture: s.profilePicture,
          permissions: [],
          fatherName: "",
          fatherNumber: "",
          motherName: "",
          motherNumber: "",
          homePinCode: "",
          erpInformation: "",
          joiningDate: "",
          branch: "",
          collegeName: "",
          year: "",
          semester: "",
          section: "",
          localGuardianAddress: "",
          localGuardianPhoneNumber: "",
          homeState: "",
          studentStatus: s.studentStatus || "in",
          registrationId: (s as any).registrationId || "",
        };
      }
    }

    if (student) {
      const studentPermissions = permissions.filter((p) => {
        if (!p.studentId) return false;
        return typeof p.studentId === "object" ? p.studentId._id === studentId : p.studentId === studentId;
      });
      setSelectedStudent({
        ...student,
        permissions: studentPermissions.map((p): SimplePermission => ({
          id: p._id,
          fromDateTime: p.fromDateTime,
          toDateTime: p.toDateTime,
          reason: p.reason,
          status: p.status,
          wardenStatus: p.wardenStatus,
          deanStatus: p.deanStatus,
        })),
      });
    }
  };

  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const student = typeof p.studentId === "object" ? p.studentId : null;
      if (!student) return false;

      const matchesStatus = filter === "all" || p.status === filter;
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).registrationId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.semester?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.branch?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.section?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) {
        matchesHostel = (getHostelCategory(student.hostelName) || student.hostelName) === hostelFilter;
      }

      const matchesCollege = collegeFilter === "all" || student.collegeName === collegeFilter;
      const matchesSemester = semesterFilter === "all" || student.semester?.toUpperCase() === semesterFilter.toUpperCase();
      const matchesBranch = branchFilter === "all" || student.branch === branchFilter;
      const matchesSection = sectionFilter === "all" || student.section?.toUpperCase() === sectionFilter.toUpperCase();

      if (!matchesStatus || !matchesSearch || !matchesHostel || !matchesCollege || !matchesSemester || !matchesBranch || !matchesSection) return false;

      if (statusFilter === "all") return true;
      return student.studentStatus === statusFilter;
    });
  }, [permissions, filter, statusFilter, searchQuery, hostelFilter, collegeFilter, semesterFilter, branchFilter, sectionFilter]);

  // Base list filtered by Search, College, Semester, Branch, and Section
  const dropdownFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).registrationId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.semester?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.branch?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.section?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCollege = collegeFilter === "all" || student.collegeName === collegeFilter;
      const matchesSemester = semesterFilter === "all" || student.semester?.toUpperCase() === semesterFilter.toUpperCase();
      const matchesBranch = branchFilter === "all" || student.branch === branchFilter;
      const matchesSection = sectionFilter === "all" || student.section?.toUpperCase() === sectionFilter.toUpperCase();

      return matchesSearch && matchesCollege && matchesSemester && matchesBranch && matchesSection;
    });
  }, [students, searchQuery, collegeFilter, semesterFilter, branchFilter, sectionFilter]);

  const filteredStudents = useMemo(() => {
    return dropdownFilteredStudents.filter((student) => {
      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) {
        matchesHostel = (getHostelCategory(student.hostelName) || student.hostelName) === hostelFilter;
      }
      const matchesStatus = statusFilter === "all" || student.studentStatus === statusFilter;
      return matchesHostel && matchesStatus;
    });
  }, [dropdownFilteredStudents, hostelFilter, statusFilter]);

  // Optimized counts for status buttons
  const statusCounts = useMemo(() => {
    const baseList = dropdownFilteredStudents.filter(student => {
      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) matchesHostel = (getHostelCategory(student.hostelName) || student.hostelName) === hostelFilter;
      return matchesHostel;
    });

    return {
      all: baseList.length,
      in: baseList.filter(s => s.studentStatus === 'in').length,
      out: baseList.filter(s => s.studentStatus === 'out').length
    };
  }, [dropdownFilteredStudents, hostelFilter]);



  const userType = typeof window !== "undefined" ? sessionStorage.getItem("userType") : null;

  return (
    <div className="min-h-screen bg-white">
      <main className="w-full max-w-4xl mx-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {!showAllStudents ? (
            <>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg md:text-xl font-bold text-foreground">{title}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {studentsLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></span>
                    ) : (
                      <p className="text-sm text-secondary">{students.length} Students</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {title === "Developer Dashboard" && (
                    <button
                      onClick={handleFixCampusSettings}
                      disabled={isUpdatingSettings}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-amber-100 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {isUpdatingSettings ? "Updating..." : "✨ Add New Location"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowAllStudents(true)}
                    className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-blue-600 text-background font-medium transition-colors hover:bg-blue-700 text-sm whitespace-nowrap"
                  >
                    All Students
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm font-medium hover:bg-filler transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>

              {title === "Developer Dashboard" && (
                <div className="mb-6 space-y-4">
                  <button
                    onClick={getAccurateLocation}
                    disabled={isLocationChecking}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm"
                  >
                    {isLocationChecking ? (
                      <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                    ) : (
                      "🔍 Test Current Location Proximity"
                    )}
                  </button>

                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-dashed border-gray-300 font-mono text-[11px] md:text-xs shadow-sm">
                    <div className="text-center space-y-1 mb-6">
                      <h3 className="font-bold text-gray-900 tracking-widest uppercase text-xs md:text-sm">INFORMATION</h3>
                      <p className="font-bold text-gray-500 tracking-wider uppercase text-[10px] md:text-xs">YOU HAVE ADDED {(hostelLocations.length > 0 ? hostelLocations.length : 3)} LOCATION</p>
                    </div>

                    <div className="space-y-2 mb-8 text-gray-600">
                      {(hostelLocations.length > 0 ? hostelLocations : [
                        { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
                        { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
                        { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
                      ]).map((loc, index) => (
                        <div key={index} className="flex items-center group relative gap-2 p-2 rounded hover:bg-gray-50 transition-colors">
                          <span className="flex-1 break-all leading-tight">
                            <span className="font-bold text-gray-800 mr-1">{index + 1}.</span>
                            Lat:{loc.lat}, Lng:{loc.lng},Radius:{loc.radius},Location name: &quot;{loc.name}&quot;
                          </span>
                          <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => handleEditLocation(index)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(index)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {locationVerificationResults.length > 0 ? (
                      <>
                        <div className="text-center mb-4 pt-4 border-t border-dashed border-gray-200">
                          <p className="font-bold text-gray-900 tracking-wider uppercase text-xs">CURRENTLY YOU ARE ON</p>
                        </div>

                        <div className="space-y-3">
                          {locationVerificationResults.map((result, index) => (
                            <div key={index} className="flex flex-col gap-1 group relative p-2 rounded bg-gray-50/50">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-500">{index + 1}.</span>
                                {result.isVerified ? (
                                  <span className="text-green-600 font-bold flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    Verification Success
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-bold flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    Verification Failed
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-700 text-justify leading-relaxed w-full">
                                You are <strong className="text-gray-900">{Math.round(result.distance)} meters</strong> away from <strong className="text-gray-900">{result.name}</strong>
                                {lastCheckAccuracy && (
                                  <span className="inline-flex flex-wrap gap-1 ml-1 align-baseline">
                                    <span className={`text-[10px] ${lastCheckAccuracy > 50 ? "text-orange-600 font-bold" : "text-gray-400"}`}>
                                      (GPS Accuracy: {lastCheckAccuracy}m)
                                    </span>
                                    {Math.round(result.distance) > result.radius && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 font-bold whitespace-nowrap">
                                        Offset Applied: -{result.appliedOffset ?? Math.min(lastCheckAccuracy, 50)}m
                                      </span>
                                    )}
                                  </span>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-gray-400 italic py-4">Click the test button above to verify proximity</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex items-center gap-1 bg-filler p-1 rounded-xl mb-6">
                <button
                  onClick={() => setCurrentTab('permissions')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${currentTab === 'permissions' ? 'bg-white text-blue-600 shadow-sm shadow-blue-100' : 'text-secondary hover:text-foreground'}`}
                >
                  Permissions
                </button>
                <button
                  onClick={() => setCurrentTab('attendance')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${currentTab === 'attendance' ? 'bg-white text-blue-600 shadow-sm shadow-blue-100' : 'text-secondary hover:text-foreground'}`}
                >
                  Daily Attendance
                </button>
                <button
                  onClick={() => setCurrentTab('messaging')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${currentTab === 'messaging' ? 'bg-white text-blue-600 shadow-sm shadow-blue-100' : 'text-secondary hover:text-foreground'}`}
                >
                  Messaging
                </button>
              </div>

              {currentTab === 'permissions' && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex gap-2 md:gap-3 flex-wrap items-center">
                      <button
                        onClick={() => setFilter("all")}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${filter === "all" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFilter("pending")}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${filter === "pending" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                      >
                        Pending
                      </button>
                      <button
                        onClick={() => setFilter("allowed")}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${filter === "allowed" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                      >
                        Accepted
                      </button>
                      <button
                        onClick={() => setFilter("rejected")}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${filter === "rejected" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                      >
                        Rejected
                      </button>

                      <select
                        value={hostelFilter}
                        onChange={(e) => setHostelFilter(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm focus:outline-none focus:border-foreground min-w-[120px]"
                      >
                        <option value="all">Hostel</option>
                        {hostels.map((h) => (
                          <option key={h._id || h.name} value={h.name}>{h.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative flex-1 max-w-sm">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search student..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 h-9 text-sm rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                        <p className="text-secondary text-sm">Loading permissions...</p>
                      </div>
                    ) : filteredPermissions.length === 0 ? (
                      <p className="text-secondary">No permissions found</p>
                    ) : (
                      filteredPermissions.map((permission) => {
                        const student = typeof permission.studentId === "object" ? permission.studentId : null;
                        if (!student) return null;

                        const initials = getInitials(student.name);
                        const profilePic = student.profilePicture && student.profilePicture.trim() !== "" && student.profilePicture !== "undefined";

                        return (
                          <div key={permission._id} className="rounded-lg border border-solid border-[#9CA3AF] bg-filler p-3 md:p-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start gap-3 md:gap-4">
                                <button
                                  onClick={() => handleProfileClick(student._id)}
                                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  {profilePic ? (
                                    <img src={student.profilePicture} alt={student.name} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    initials
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <p className="text-xs md:text-sm font-semibold text-foreground uppercase tracking-tight">{student.name}</p>
                                      <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 mt-0.5 md:mt-1 text-[9px] md:text-xs text-secondary font-medium">
                                        <span>{new Date(permission.fromDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
                                        <span className="hidden md:inline">•</span>
                                        <span>to {new Date(permission.toDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-start gap-2 md:gap-4 pr-1 scale-90 origin-top-right md:scale-100">
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] md:text-[10px] font-black text-secondary uppercase whitespace-nowrap tracking-tighter">Warden</span>
                                        <div className="flex items-center gap-1.5 md:gap-2 bg-white/50 p-1 rounded-full border border-gray-100">
                                          <button
                                            onClick={() => userType === "warden" && handleStatusChange(permission._id, "allowed")}
                                            disabled={userType !== "warden" || permission.deanStatus !== "pending"}
                                            className={`w-6 h-6 md:w-7 md:h-7 rounded-full border flex items-center justify-center transition-all ${permission.wardenStatus === "allowed" ? "border-green-300 bg-green-50 text-gray-500 shadow-sm" : "border-gray-200 text-gray-400 hover:border-green-300"} ${userType !== "warden" ? "cursor-default" : "cursor-pointer"}`}
                                          >
                                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                          </button>
                                          <button
                                            onClick={() => userType === "warden" && handleStatusChange(permission._id, "rejected")}
                                            disabled={userType !== "warden" || permission.deanStatus !== "pending"}
                                            className={`w-6 h-6 md:w-7 md:h-7 rounded-full border flex items-center justify-center transition-all ${permission.wardenStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-red-300"} ${userType !== "warden" ? "cursor-default" : "cursor-pointer"}`}
                                          >
                                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                          </button>
                                        </div>
                                        {permission.wardenStatus === "rejected" && (
                                          <span className="text-[8px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                            Rejected
                                          </span>
                                        )}
                                        {permission.wardenStatus === "allowed" && (
                                          <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                            Accepted
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] md:text-[10px] font-black text-secondary uppercase whitespace-nowrap tracking-tighter">Dean</span>
                                        <div className="flex items-center gap-1.5 md:gap-2 bg-white/50 p-1 rounded-full border border-gray-100">
                                          <button
                                            onClick={() => (userType === "admin" || userType === "developer") && handleStatusChange(permission._id, "allowed")}
                                            disabled={userType !== "admin" && userType !== "developer"}
                                            className={`w-6 h-6 md:w-7 md:h-7 rounded-full border flex items-center justify-center transition-all ${permission.deanStatus === "allowed" ? "border-green-600 bg-green-500 text-white shadow-md scale-105" : "border-gray-200 text-gray-400 hover:border-green-300"} ${userType !== "admin" && userType !== "developer" ? "cursor-default" : "cursor-pointer"}`}
                                          >
                                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                          </button>
                                          <button
                                            onClick={() => (userType === "admin" || userType === "developer") && handleStatusChange(permission._id, "rejected")}
                                            disabled={userType !== "admin" && userType !== "developer"}
                                            className={`w-6 h-6 md:w-7 md:h-7 rounded-full border flex items-center justify-center transition-all ${permission.deanStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-red-300"} ${userType !== "admin" && userType !== "developer" ? "cursor-default" : "cursor-pointer"}`}
                                          >
                                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                          </button>
                                        </div>
                                        {permission.deanStatus === "rejected" && (
                                          <span className="text-[8px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-red-100">
                                            Rejected
                                          </span>
                                        )}
                                        {permission.deanStatus === "allowed" && (
                                          <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-green-100">
                                            Accepted
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </div>
                              <div className="mt-1 md:mt-2">
                                <p className="text-sm md:text-base text-foreground font-medium">{permission.reason}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {currentTab === 'attendance' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Daily Attendance Monitoring</h2>
                        <p className="text-sm text-secondary">Student entries and absentees for {selectedDate === new Date().toISOString().split('T')[0] ? 'today' : selectedDate}</p>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 focus:outline-none focus:border-blue-500 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors flex-1 sm:flex-none"
                        />
                        <select
                          value={attendanceHostelFilter}
                          onChange={(e) => setAttendanceHostelFilter(e.target.value)}
                          className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 focus:outline-none focus:border-blue-500 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors flex-1 sm:flex-none"
                        >
                          <option value="all">All Hostels</option>
                          {hostels.map((h) => (
                            <option key={h._id || h.name} value={h.name}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={exportAttendanceToExcel}
                        className="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export Excel
                      </button>
                      {(userType === "admin" || userType === "developer") && (
                        <button
                          onClick={() => handleCleanup("attendance")}
                          className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          Purge Logs
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div className="bg-filler p-2.5 rounded-lg border border-gray-100 shadow-sm text-center">
                      <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Total Present</p>
                      <p className="text-lg font-black text-blue-600 mt-1">
                        {attendanceHostelFilter === 'all'
                          ? presentStudentIds.length
                          : (attendanceSummary[attendanceHostelFilter] || 0)}
                      </p>
                    </div>
                    <div className="bg-filler p-2.5 rounded-lg border border-gray-100 shadow-sm text-red-600 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-wider">Total Absentees</p>
                      <p className="text-lg font-black mt-1">
                        {absentees.length}
                      </p>
                    </div>
                    <div className="bg-filler p-2.5 rounded-lg border border-gray-100 shadow-sm text-center">
                      <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Present Ratio</p>
                      <p className="text-lg font-black text-foreground mt-1">
                        {(() => {
                          const total = attendanceHostelFilter === 'all'
                            ? students.length
                            : students.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === attendanceHostelFilter).length;
                          const present = attendanceHostelFilter === 'all'
                            ? presentStudentIds.length
                            : (attendanceSummary[attendanceHostelFilter] || 0);

                          return total > 0 ? Math.round((present / total) * 100) : 0;
                        })()}%
                      </p>
                    </div>
                  </div>

                  {/* Hostel Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(attendanceSummary).map(([hostel, count]) => {
                      // Calculate total students in this hostel
                      const totalInHostel = students.filter(s =>
                        (getHostelCategory(s.hostelName) || s.hostelName) === hostel
                      ).length;
                      const percentage = totalInHostel > 0 ? Math.round((count / totalInHostel) * 100) : 0;
                      const isSelected = selectedAttendanceHostel === hostel;

                      return (
                        <button
                          key={hostel}
                          onClick={() => setSelectedAttendanceHostel(isSelected ? null : hostel)}
                          className={`bg-white p-3 rounded-lg border shadow-sm transition-all text-center ${isSelected
                            ? 'border-blue-500 ring-2 ring-blue-200 shadow-md'
                            : 'border-gray-100 hover:border-blue-300 hover:shadow-md'
                            }`}
                        >
                          <p className="text-[10px] font-bold text-secondary uppercase line-clamp-1">{hostel}</p>
                          <p className="text-sm font-bold text-foreground mt-1">
                            {count}/{totalInHostel} = {percentage}%
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Hostel Students List */}
                  {selectedAttendanceHostel && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                      <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Students Present from {selectedAttendanceHostel}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {attendanceLogs
                          .filter(log => {
                            if (!log.studentId) return false;
                            const studentHostel = getHostelCategory(log.studentId.hostelName) || log.studentId.hostelName;
                            return studentHostel === selectedAttendanceHostel;
                          })
                          .map((log) => (
                            <div
                              key={log._id}
                              className="bg-white p-2 rounded-lg border border-blue-100 flex items-center gap-2 hover:shadow-sm transition-shadow"
                            >
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {getInitials(log.studentId?.name || "?")}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-gray-900 truncate">{log.studentId?.name || "Unknown"}</p>
                                <p className="text-[10px] text-gray-500 truncate">{log.istTime}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                      {attendanceLogs.filter(log => {
                        if (!log.studentId) return false;
                        const studentHostel = getHostelCategory(log.studentId.hostelName) || log.studentId.hostelName;
                        return studentHostel === selectedAttendanceHostel;
                      }).length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-4 italic">No students present from this hostel</p>
                        )}
                    </div>
                  )}

                  {/* Entry Logs Table */}
                  <div ref={entryLogsRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-filler px-1 py-1 flex border-b border-gray-200">
                      <p className="px-4 py-2 text-xs font-bold text-secondary uppercase tracking-widest">Entry Logs ({selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedDate})</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#fcfcfc] text-secondary font-bold uppercase text-[9px] border-b border-gray-100">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Hostel/Room</th>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3">Accuracy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {attendanceLogsLoading ? (
                            <tr><td colSpan={4} className="px-4 py-12 text-center text-secondary italic">Refreshing database...</td></tr>
                          ) : attendanceLogs.length === 0 ? (
                            <tr><td colSpan={4} className="px-4 py-12 text-center text-secondary italic">No entries found for {selectedDate === new Date().toISOString().split('T')[0] ? '9:00 PM onwards' : selectedDate}.</td></tr>
                          ) : (
                            (showAllEntryLogs ? attendanceLogs : attendanceLogs.slice(0, 10)).map((log) => (
                              <tr key={log._id} className="hover:bg-filler/50 transition-colors">
                                <td className="px-4 py-3 font-bold text-foreground">{log.studentId?.name || "Unknown"}</td>
                                <td className="px-4 py-3 text-secondary text-xs">{log.studentId?.hostelName} - {log.studentId?.roomNumber}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">{log.istTime}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold ${log.location.accuracy < 50 ? "text-green-600" : "text-orange-500"}`}>
                                    {log.location.accuracy ? `${Math.round(log.location.accuracy)}m` : "N/A"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {!attendanceLogsLoading && attendanceLogs.length > 10 && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-center">
                        <button
                          onClick={() => setShowAllEntryLogs(!showAllEntryLogs)}
                          className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                        >
                          {showAllEntryLogs ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              Show Less
                            </>
                          ) : (
                            <>
                              See More ({attendanceLogs.length - 10} more)
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Absentee List */}
                  <div ref={absenteesRef} className="bg-red-50/30 rounded-xl border border-red-100 p-4">
                    <h3 className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      {selectedDate === new Date().toISOString().split('T')[0] ? "Today's" : selectedDate} Absentee List ({absentees.length} students)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(showAllAbsentees ? absentees : absentees.slice(0, 9)).map(s => (
                        <div key={s.id} className="bg-white p-3 rounded-lg border border-red-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">
                            {getInitials(s.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                            <p className="text-[9px] text-secondary truncate uppercase">{s.hostelName} • {s.roomNumber}</p>
                          </div>
                          <a href={`tel:${s.phoneNumber}`} className="ml-auto w-7 h-7 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          </a>
                        </div>
                      ))}
                    </div>
                    {absentees.length > 9 && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => setShowAllAbsentees(!showAllAbsentees)}
                          className="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                        >
                          {showAllAbsentees ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              Show Less
                            </>
                          ) : (
                            <>
                              See More ({absentees.length - 9} more)
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {currentTab === 'messaging' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Dean Messaging System</h2>
                      <p className="text-sm text-secondary">Broadcast messages to students or individuals</p>
                    </div>
                    <button
                      onClick={() => handleCleanup("notifications")}
                      className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Clear History (30+ Days)
                    </button>
                  </div>

                  <div className="bg-filler p-5 rounded-2xl border border-blue-100 shadow-sm">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-secondary uppercase">Message Content</label>
                          <label className="cursor-pointer bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {newMessage.image ? "Change Image" : "Add Image (Paste/Upload)"}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                          </label>
                        </div>
                        <div className="relative">
                          <textarea
                            value={newMessage.message}
                            onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                            onPaste={(e) => {
                              const item = e.clipboardData.items[0];
                              if (item?.type.startsWith('image/')) {
                                const file = item.getAsFile();
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setNewMessage(prev => ({ ...prev, image: reader.result as string }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }
                            }}
                            placeholder="Type your message here... You can also paste an image directly."
                            className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 min-h-[120px] text-sm"
                          />
                          {newMessage.image && (
                            <div className="mt-3 relative inline-block">
                              <img src={newMessage.image} alt="Preview" className="max-h-40 rounded-lg border border-gray-100 shadow-sm" />
                              <button
                                onClick={() => setNewMessage(prev => ({ ...prev, image: "" }))}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-secondary uppercase mb-2">Target Audience</label>
                          <select
                            value={newMessage.targetType}
                            onChange={(e: any) => setNewMessage({ ...newMessage, targetType: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                          >
                            <option value="all">All Students</option>
                            <option value="hostel">Specific Hostel</option>
                            <option value="individual">Individual Student</option>
                          </select>
                        </div>

                        {newMessage.targetType === "hostel" && (
                          <div>
                            <label className="block text-xs font-bold text-secondary uppercase mb-2">Select Hostel</label>
                            <select
                              value={newMessage.targetHostel}
                              onChange={(e) => setNewMessage({ ...newMessage, targetHostel: e.target.value })}
                              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                            >
                              <option value="">Choose Hostel...</option>
                              {hostels.map((h) => (
                                <option key={h._id} value={h.name}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {newMessage.targetType === "individual" && (
                          <div>
                            <label className="block text-xs font-bold text-secondary uppercase mb-2">Student ID/Email</label>
                            <input
                              type="text"
                              value={newMessage.targetStudentId}
                              onChange={(e) => setNewMessage({ ...newMessage, targetStudentId: e.target.value })}
                              placeholder="Enter Student ID (e.g. BOYS-0001)"
                              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-secondary uppercase mb-2">Priority</label>
                          <select
                            value={newMessage.priority}
                            onChange={(e: any) => setNewMessage({ ...newMessage, priority: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                          >
                            <option value="normal">Normal</option>
                            <option value="urgent">Urgent (Orange)</option>
                            <option value="critical">Critical (Red)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-secondary uppercase mb-2">Display Duration</label>
                          <select
                            value={newMessage.expiryHours}
                            onChange={(e) => setNewMessage({ ...newMessage, expiryHours: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                          >
                            <option value="1">1 Hour</option>
                            <option value="6">6 Hours</option>
                            <option value="12">12 Hours</option>
                            <option value="24">1 Day</option>
                            <option value="72">3 Days</option>
                            <option value="168">1 Week</option>
                            <option value="never">Never (Manual Delete)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !newMessage.message}
                        className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:bg-gray-300 disabled:shadow-none"
                      >
                        {sendingMessage ? "Sending..." : "Send Notification"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-secondary uppercase">Recent Broadcasts</h3>
                    {adminNotifications.length === 0 ? (
                      <p className="text-secondary text-sm italic">No recent messages sent</p>
                    ) : (
                      adminNotifications.map((notif) => (
                        <div key={notif._id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-start gap-4">
                          <div
                            className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.priority === "critical"
                              ? "bg-red-500"
                              : notif.priority === "urgent"
                                ? "bg-orange-500"
                                : "bg-blue-500"
                              }`}
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-secondary tracking-widest">{notif.targetType} broadcast</span>
                                {notif.targetType === "individual" && notif.targetStudentId && (
                                  <span className="text-[10px] font-bold text-blue-600 uppercase mt-0.5">
                                    To: {notif.targetStudentId.name} ({notif.targetStudentId.registrationId})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-secondary">{new Date(notif.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-foreground mt-1">{notif.message}</p>
                            {notif.image && (
                              <div className="mt-2">
                                <img src={notif.image} alt="Broadcast" className="max-h-20 rounded-lg border border-gray-100" />
                              </div>
                            )}
                            <div className="mt-2 text-[10px] font-bold text-blue-600">Acknowledged by: {notif.acknowledgedBy?.length || 0} students</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowAllStudents(false)}
                    className="w-10 h-10 rounded-full border border-solid border-[#9CA3AF] bg-white text-foreground flex items-center justify-center transition-colors hover:bg-filler flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h1 className="text-base font-semibold text-foreground">All Students</h1>
                    <p className="mt-1 md:mt-2 text-sm text-secondary">View and search all students</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm font-medium hover:bg-filler transition-colors"
                >
                  Logout
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground placeholder:text-secondary focus:outline-none focus:border-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">College Name</label>
                    <select
                      value={collegeFilter}
                      onChange={(e) => setCollegeFilter(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm focus:outline-none focus:border-foreground"
                    >
                      <option value="all">All Colleges</option>
                      <option value="OIST">OIST</option>
                      <option value="OCT">OCT</option>
                      <option value="OCP">OCP</option>
                      <option value="OPM">OPM</option>
                      <option value="OIPR">OIPR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Semester</label>
                    <select
                      value={semesterFilter}
                      onChange={(e) => setSemesterFilter(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm focus:outline-none focus:border-foreground"
                    >
                      <option value="all">All Semesters</option>
                      <option value="1ST SEM">1ST SEM</option>
                      <option value="2ND SEM">2ND SEM</option>
                      <option value="3RD SEM">3RD SEM</option>
                      <option value="4TH SEM">4TH SEM</option>
                      <option value="5TH SEM">5TH SEM</option>
                      <option value="6TH SEM">6TH SEM</option>
                      <option value="7TH SEM">7TH SEM</option>
                      <option value="8TH SEM">8TH SEM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Branch</label>
                    <select
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm focus:outline-none focus:border-foreground"
                    >
                      <option value="all">All Branches</option>
                      <option value="CS">CS</option>
                      <option value="AIML">AIML</option>
                      <option value="DS">DS</option>
                      <option value="ME">ME</option>
                      <option value="CE">CE</option>
                      <option value="EC">EC</option>
                      <option value="IT">IT</option>
                      <option value="EX">EX</option>
                      <option value="MCA">MCA</option>
                      <option value="B PHARMA">B PHARMA</option>
                      <option value="D PHARMA">D PHARMA</option>
                      <option value="MBA">MBA</option>
                      <option value="MTECH">MTECH</option>
                      <option value="M PHARMA">M PHARMA</option>
                      <option value="CSBS">CSBS</option>
                      <option value="CYBER SECURITY">CYBER SECURITY</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1.5">Section</label>
                    <select
                      value={sectionFilter}
                      onChange={(e) => setSectionFilter(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm focus:outline-none focus:border-foreground"
                    >
                      <option value="all">All Sections</option>
                      <option value="NIL">NIL</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                      <option value="F">F</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-6 sm:flex sm:flex-nowrap gap-2 md:gap-3">
                  <button
                    onClick={() => setHostelFilter("all")}
                    className={`col-span-3 sm:flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 min-h-[50px] ${hostelFilter === "all"
                      ? "bg-blue-600 text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                      }`}
                  >
                    <span className="text-center leading-[1.1]">Total Registered Students</span>
                    <span className="text-[10px] opacity-90">{studentsLoading ? "..." : dropdownFilteredStudents.length}</span>
                  </button>

                  {/* Move Guest House to second position in first row */}
                  {hostels.filter(h => h.name.toLowerCase().includes("guest")).map((h) => {
                    const count = dropdownFilteredStudents.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === h.name).length;
                    const presentCount = dropdownFilteredStudents.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === h.name && presentStudentIds.includes(s.id)).length;
                    return (
                      <button
                        key={h._id || h.name}
                        onClick={() => setHostelFilter(h.name)}
                        className={`col-span-3 sm:flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 min-h-[50px] ${hostelFilter === h.name
                          ? "bg-blue-600 text-background"
                          : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                          }`}
                      >
                        <span className="text-center leading-tight">{h.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] opacity-75">T: {count}</span>
                          <span className="text-[9px] text-green-600 font-black bg-green-50/50 px-1 rounded">P: {presentCount}</span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Render Boys, Gangotri, Gaytri in Row 2 (3 columns) */}
                  {hostels
                    .filter(h => !h.name.toLowerCase().includes("guest"))
                    .sort((a, b) => {
                      const order = ["boys hostel", "gangotri hostel", "gaytri hostel"];
                      const aIdx = order.indexOf(a.name.toLowerCase());
                      const bIdx = order.indexOf(b.name.toLowerCase());
                      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
                    })
                    .map((h) => {
                      const count = dropdownFilteredStudents.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === h.name).length;
                      const presentCount = dropdownFilteredStudents.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === h.name && presentStudentIds.includes(s.id)).length;

                      return (
                        <button
                          key={h._id || h.name}
                          onClick={() => setHostelFilter(h.name)}
                          className={`col-span-2 sm:flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 min-h-[50px] ${hostelFilter === h.name
                            ? "bg-blue-600 text-background"
                            : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                            }`}
                        >
                          <span className="text-center leading-tight">{h.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] opacity-75">T: {count}</span>
                            <span className="text-[9px] text-green-600 font-black bg-green-50/50 px-1 rounded">P: {presentCount}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>

                <div className="grid grid-cols-3 sm:flex sm:flex-nowrap gap-2 md:gap-3 items-center">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`w-full sm:flex-1 px-1 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 min-h-[50px] ${statusFilter === "all" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                  >
                    <span className="text-center leading-[1.1]">Current Student Count</span>
                    <span className="text-[10px]">{studentsLoading ? "..." : statusCounts.all}</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("in")}
                    className={`w-full sm:flex-1 px-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 min-h-[50px] ${statusFilter === "in" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                  >
                    <span>In</span>
                    <span className="text-[10px]">{studentsLoading ? "..." : statusCounts.in}</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("out")}
                    className={`w-full sm:flex-1 px-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 min-h-[50px] ${statusFilter === "out" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                  >
                    <span>Out</span>
                    <span className="text-[10px]">{studentsLoading ? "..." : statusCounts.out}</span>
                  </button>
                  {showRemoveButton && (
                    <button
                      onClick={exportToExcel}
                      disabled={studentsLoading}
                      className={`w-full sm:flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-green-600 text-white font-medium transition-colors hover:bg-green-700 text-sm whitespace-nowrap flex items-center justify-center gap-1.5 ${studentsLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {studentsLoading ? "Loading..." : "Export Excel"}
                    </button>
                  )}
                </div>

                <div>
                  <div className="space-y-3">
                    {studentsLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                        <p className="text-secondary text-sm">Loading student directory...</p>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <p className="text-secondary text-center py-8">No students found</p>
                    ) : (
                      <>
                        {(isListExpanded ? filteredStudents : filteredStudents.slice(0, 10)).map((student) => {
                          const studentPermissions = permissions.filter((p) => {
                            if (!p.studentId) return false;
                            return typeof p.studentId === "object" ? p.studentId._id === student.id : p.studentId === student.id;
                          });
                          return (
                            <button
                              key={student.id}
                              onClick={() => handleProfileClick(student.id)}
                              className="w-full text-left rounded-xl border border-gray-200 bg-white p-3 hover:shadow-md hover:border-blue-200 transition-all group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 border border-gray-200 flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                                  {student.profilePicture ? (
                                    <img src={student.profilePicture} alt={student.name} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    getInitials(student.name)
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <div className="pr-2">
                                      <h3 className="text-[12px] font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">{student.name}</h3>
                                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{student.email}</p>
                                    </div>
                                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${student.studentStatus === 'out' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                      {student.studentStatus || 'in'}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-medium text-gray-500">
                                    <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 whitespace-nowrap">
                                      {getHostelCategory(student.hostelName) || student.hostelName}
                                    </span>
                                    <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 whitespace-nowrap">
                                      Room {student.roomNumber}
                                    </span>
                                    <a
                                      href={`tel:${student.phoneNumber}`}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Click to call"
                                      className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors whitespace-nowrap"
                                    >
                                      {student.phoneNumber}
                                    </a>
                                  </div>

                                  {presentStudentIds.includes(student.id) && (
                                    <div className="mt-1.5 flex items-center">
                                      <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        Present Today
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {!isListExpanded && filteredStudents.length > 10 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsListExpanded(true);
                            }}
                            className="w-full py-4 mt-2 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 text-blue-600 font-black text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 flex items-center justify-center gap-2 group shadow-sm hover:shadow-blue-100"
                          >
                            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                            </svg>
                            SEE MORE ({filteredStudents.length - 10} MORE STUDENTS)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-semibold text-foreground">Student Details</h2>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="w-8 h-8 rounded-full border border-solid border-[#9CA3AF] bg-white text-foreground flex items-center justify-center transition-colors hover:bg-filler"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <div
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-lg overflow-hidden mb-3 cursor-pointer relative group"
                    onClick={() => selectedStudent.profilePicture && setZoomedImage(selectedStudent.profilePicture)}
                  >
                    {selectedStudent.profilePicture ? (
                      <>
                        <img
                          src={selectedStudent.profilePicture}
                          alt={selectedStudent.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center font-bold text-xl text-gray-400">
                        {getInitials(selectedStudent.name)}
                      </div>
                    )}
                  </div>

                  <div className="text-center w-full">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedStudent.name}</h3>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${selectedStudent.studentStatus === 'out' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                        {selectedStudent.studentStatus || 'in'}
                      </span>
                      {presentStudentIds.includes(selectedStudent.id) && (
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-full border border-green-100 uppercase tracking-wide flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          Present
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 font-medium">{selectedStudent.email}</p>

                    {(selectedStudent.registrationId || selectedStudent.erpInformation) && (
                      <div className="mt-5 mx-auto max-w-sm bg-blue-50/50 rounded-xl border border-blue-100 p-3 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-full -mr-8 -mt-8 opacity-50 transition-transform group-hover:scale-110"></div>
                        <div className="grid grid-cols-2 gap-4 relative z-10 mb-2 text-left">
                          {selectedStudent.registrationId && (
                            <div>
                              <p className="text-[9px] font-black text-blue-500 tracking-widest uppercase mb-0.5">Registration ID</p>
                              <p className="text-sm font-black text-blue-900 leading-tight">{selectedStudent.registrationId}</p>
                            </div>
                          )}
                          {selectedStudent.erpInformation && (
                            <div>
                              <p className="text-[9px] font-black text-blue-500 tracking-widest uppercase mb-0.5">ERP ID</p>
                              <p className="text-sm font-black text-blue-900 leading-tight">{selectedStudent.erpInformation}</p>
                            </div>
                          )}
                        </div>
                        {selectedStudent.registrationId && (
                          <div className="bg-white rounded p-2 inline-block shadow-sm border border-gray-100 relative z-10 w-full">
                            <div className="w-full overflow-hidden flex justify-center h-[30px]">
                              <Barcode
                                value={selectedStudent.registrationId}
                                width={1.8}
                                height={30}
                                fontSize={10}
                                displayValue={false}
                                margin={0}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-100">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:gap-y-5 text-sm">
                    <div className="col-span-1">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Contact</p>
                      <a href={`tel:${selectedStudent.phoneNumber}`} className="text-[12px] text-gray-900 font-semibold hover:text-blue-600 transition-colors block truncate">
                        {selectedStudent.phoneNumber}
                      </a>
                      {selectedStudent.dob && (
                        <p className="text-[10px] text-gray-500 mt-0.5 font-bold">DOB: <span className="text-gray-900">{formatDate(selectedStudent.dob)}</span></p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Hostel & Category</p>
                      <p className="text-[12px] text-gray-900 font-semibold leading-tight">
                        {getHostelCategory(selectedStudent.hostelName) || selectedStudent.hostelName} <span className="text-gray-400 font-light mx-1">|</span> Room {selectedStudent.roomNumber}
                      </p>
                      {selectedStudent.category && (
                        <p className="text-[10px] text-blue-600 font-bold mt-0.5 uppercase">Category: {selectedStudent.category}</p>
                      )}
                      {selectedStudent.joiningDate && (
                        <p className="text-[9px] text-gray-500 mt-1 font-medium italic">Joined: {new Date(selectedStudent.joiningDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      )}
                    </div>

                    {(selectedStudent.branch || selectedStudent.year) && (
                      <div className="col-span-2 md:col-span-2 pt-2 border-t border-gray-100 mt-1">
                        <div className="grid grid-cols-4 gap-2">
                          {selectedStudent.branch && (
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Branch</p>
                              <p className="text-[12px] text-gray-900 font-semibold truncate">{selectedStudent.branch}</p>
                            </div>
                          )}
                          {selectedStudent.year && (
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Year</p>
                              <p className="text-[12px] text-gray-900 font-semibold">{selectedStudent.year}</p>
                            </div>
                          )}
                          {selectedStudent.semester && (
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Sem</p>
                              <p className="text-[12px] text-gray-900 font-semibold">{selectedStudent.semester}</p>
                            </div>
                          )}
                          {selectedStudent.section && (
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Section</p>
                              <p className="text-[12px] text-gray-900 font-semibold">{selectedStudent.section}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(selectedStudent.fatherName || selectedStudent.motherName) && (
                      <div className="col-span-2 pt-2 border-t border-gray-100 mt-1">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Guardian Info</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedStudent.fatherName && (
                            <div className="bg-white p-2 rounded border border-gray-100">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Father</p>
                              <p className="text-[12px] text-gray-900 font-semibold mb-1 truncate">{selectedStudent.fatherName}</p>
                              {selectedStudent.fatherNumber && (
                                <a href={`tel:${selectedStudent.fatherNumber}`} className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[12px] font-medium inline-block hover:underline">
                                  {selectedStudent.fatherNumber}
                                </a>
                              )}
                            </div>
                          )}
                          {selectedStudent.motherName && (
                            <div className="bg-white p-2 rounded border border-gray-100">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Mother</p>
                              <p className="text-[12px] text-gray-900 font-semibold mb-1 truncate">{selectedStudent.motherName}</p>
                              {selectedStudent.motherNumber && (
                                <a href={`tel:${selectedStudent.motherNumber}`} className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[12px] font-medium inline-block hover:underline">
                                  {selectedStudent.motherNumber}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedStudent.homePinCode && (
                      <div className="col-span-2 pt-2 border-t border-gray-100 mt-1">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Permanent Address</p>
                        <p className="text-[12px] text-gray-700 leading-relaxed">
                          {selectedStudent.homePinCode}
                          {selectedStudent.homeState && <span className="text-gray-500">, {selectedStudent.homeState}</span>}
                        </p>
                      </div>
                    )}

                    {(selectedStudent.localGuardianAddress || selectedStudent.localGuardianPhoneNumber) && (
                      <div className="col-span-2 pt-2 border-t border-gray-100 mt-1">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Local Guardian Details</p>
                        <div className="space-y-1">
                          {selectedStudent.localGuardianAddress && (
                            <p className="text-[12px] text-gray-700 leading-relaxed">
                              {selectedStudent.localGuardianAddress}
                            </p>
                          )}
                          {selectedStudent.localGuardianPhoneNumber && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 uppercase font-semibold">Phone:</span>
                              <a href={`tel:${selectedStudent.localGuardianPhoneNumber}`} className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[12px] font-medium inline-block hover:underline">
                                {selectedStudent.localGuardianPhoneNumber}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>


              </div>

              {showRemoveButton && (
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => {
                      setEditStudentForm({ ...selectedStudent });
                      setEditErrors({});
                      setShowEditStudentModal(true);
                    }}
                    className="px-4 py-2 rounded-lg border-2 border-blue-600 text-blue-600 font-bold transition-all hover:bg-blue-50 text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Details
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingStudentId === selectedStudent.id}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove Student
                  </button>
                </div>
              )}

              <div>
                <h3 className="text-base font-semibold text-foreground mb-4">Permission History</h3>
                {selectedStudent.permissions.length === 0 ? (
                  <p className="text-secondary">No permissions found</p>
                ) : (
                  <div className="space-y-3">
                    {selectedStudent.permissions.map((permission) => {
                      const showStatus = permission.status === "allowed" || permission.status === "rejected";
                      return (
                        <div
                          key={permission.id}
                          className="rounded-2xl border-0 bg-slate-50 p-4 shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="space-y-1">
                              <p className="text-[13px] font-black text-[#2D5A9E]">
                                {new Date(permission.fromDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                              </p>
                              <p className="text-[13px] font-black text-[#2D5A9E]">
                                To {new Date(permission.toDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                              </p>
                            </div>
                            {showStatus ? (
                              <div className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${permission.status === "allowed"
                                ? "bg-green-100/80 text-green-700 border border-green-200"
                                : "bg-red-100/80 text-red-700 border border-red-200"
                                }`}>
                                {permission.status === "allowed" ? "Accepted" : "Rejected"}
                              </div>
                            ) : (
                              <div className="px-3 py-1 rounded-full text-[11px] font-black bg-yellow-100 text-yellow-700 border border-yellow-200 uppercase tracking-wider">
                                Pending
                              </div>
                            )}
                          </div>
                          <p className="text-[13px] text-slate-800 leading-relaxed font-medium">
                            {permission.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {
        showDeleteConfirm && selectedStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-foreground mb-2">Confirm Deletion</h3>
              <p className="text-sm text-secondary mb-6">
                Are you sure you want to remove <strong>{selectedStudent.name}</strong>? This action will permanently delete the student from the database and Firebase Auth. This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground font-medium transition-colors hover:bg-filler"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteStudent(selectedStudent.id)}
                  disabled={deletingStudentId === selectedStudent.id}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingStudentId === selectedStudent.id ? "Removing..." : "Remove Student"}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {
        showExportOptionsModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowExportOptionsModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground mb-4">Export Options</h3>
              <div className="space-y-3">
                <button
                  onClick={() => handleExportOption('present')}
                  className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold flex items-center justify-between hover:bg-blue-100 transition-colors"
                >
                  <span>Export Presentees List</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button
                  onClick={() => handleExportOption('absent')}
                  className="w-full px-4 py-3 bg-red-50 text-red-700 rounded-xl font-bold flex items-center justify-between hover:bg-red-100 transition-colors"
                >
                  <span>Export Absentees List</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button
                  onClick={() => setShowExportOptionsModal(false)}
                  className="w-full px-4 py-2 text-center text-sm font-medium text-secondary hover:text-foreground transition-colors mt-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }
      {
        showExportPreview && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Export Preview</h3>
                  <p className="text-sm text-secondary">Verify data before downloading ({exportPreviewData.length} records)</p>
                </div>
                <button
                  onClick={() => setShowExportPreview(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="inline-block min-w-full align-middle">
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-[#fcfcfc]">
                        <tr>
                          {exportPreviewData.length > 0 && Object.keys(exportPreviewData[0]).map((header) => (
                            <th key={header} className="px-4 py-3 text-left font-bold text-secondary uppercase tracking-wider text-[10px]">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {exportPreviewData.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="px-4 py-2.5 text-foreground whitespace-nowrap">
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-3 sticky bottom-0">
                <button
                  onClick={() => setShowExportPreview(false)}
                  className="px-6 py-2.5 rounded-xl border border-gray-200 bg-white text-foreground font-semibold hover:bg-gray-100 transition-all text-sm shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDownload}
                  className="px-8 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all text-sm shadow-lg shadow-green-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Location Mapping Modal */}
      {
        showLocationModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
              <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <h3 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
                    {editingLocationIndex !== null ? "EDIT LOCATION" : "ADD NEW LOCATION"}
                  </h3>
                  <button
                    onClick={() => setShowLocationModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  >
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-2 md:space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-0.5 px-1">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Location Name</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!navigator.geolocation) {
                            alert("Geolocation is not supported by your browser");
                            return;
                          }
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              const lat = parseFloat(position.coords.latitude.toFixed(6));
                              const lng = parseFloat(position.coords.longitude.toFixed(6));
                              setLocationForm(prev => ({ ...prev, lat, lng }));
                            },
                            () => {
                              alert("Could not retrieve your location. Please ensure GPS is on.");
                            },
                            { enableHighAccuracy: true }
                          );
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors bg-blue-50 px-2 py-1 rounded border border-blue-100 uppercase tracking-wider"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                        </svg>
                        Get Location
                      </button>
                    </div>
                    <input
                      type="text"
                      value={locationForm.name}
                      onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                      placeholder="e.g. Gangotri Hostel"
                      className="w-full h-10 md:h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                    />
                  </div>

                  <div className="h-[43vh] min-h-[300px] w-full rounded-xl overflow-hidden border border-gray-200 relative z-0 flex-shrink-0 shadow-inner">
                    <LocationPickerMap
                      lat={locationForm.lat}
                      lng={locationForm.lng}
                      radius={locationForm.radius}
                      zoom={mapZoom}
                      onMove={(lat, lng) => setLocationForm(prev => ({ ...prev, lat, lng }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 px-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={locationForm.lat}
                        onChange={(e) => setLocationForm({ ...locationForm, lat: parseFloat(e.target.value) })}
                        className="w-full h-10 md:h-12 px-3 md:px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 px-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={locationForm.lng}
                        onChange={(e) => setLocationForm({ ...locationForm, lng: parseFloat(e.target.value) })}
                        className="w-full h-10 md:h-12 px-3 md:px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 px-1">Radius (meters)</label>
                    <input
                      type="number"
                      value={locationForm.radius}
                      onChange={(e) => setLocationForm({ ...locationForm, radius: parseInt(e.target.value) })}
                      className="w-full h-10 md:h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                    />
                  </div>

                  <div className="pt-1.5 flex gap-3 pb-safe">
                    <button
                      onClick={() => setShowLocationModal(false)}
                      className="flex-1 h-10 md:h-12 rounded-xl border border-gray-200 text-gray-600 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveLocation}
                      disabled={isUpdatingSettings}
                      className="flex-[2] h-10 md:h-12 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all disabled:opacity-50"
                    >
                      {isUpdatingSettings ? "SAVING..." : "SAVE MAPPING"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {showEditStudentModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b flex items-center justify-between bg-white relative z-10">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">EDIT STUDENT DETAILS</h3>
                <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Updating profile for {editStudentForm.name}</p>
              </div>
              <button
                onClick={() => {
                  if (isEditCameraOpen) {
                    if (editVideoRef.current?.srcObject) {
                      (editVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                    }
                    setIsEditCameraOpen(false);
                  }
                  setShowEditStudentModal(false);
                }}
                className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body - Scrollable Form */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <form id="editStudentForm" onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setIsUpdatingStudent(true);
                  const response = await fetch(`/api/students/${selectedStudent?.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ...editStudentForm,
                      joiningDate: editStudentForm.joiningDate ? new Date(editStudentForm.joiningDate).toISOString() : undefined
                    }),
                  });

                  if (!response.ok) throw new Error("Update failed");

                  const data = await response.json();
                  if (data.success) {
                    alert("Student details updated successfully!");
                    setShowEditStudentModal(false);
                    fetchStudents(true);
                    if (selectedStudent) {
                      setSelectedStudent({ ...selectedStudent, ...editStudentForm } as StudentDetails);
                    }
                  }
                } catch (err) {
                  console.error(err);
                  alert("Failed to update student details");
                } finally {
                  setIsUpdatingStudent(false);
                }
              }} className="space-y-6">

                {/* Photo Section */}
                <div className="flex flex-col items-center gap-4 bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Profile Photo</label>

                  {!isEditCameraOpen ? (
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl relative">
                        {editStudentForm.profilePicture ? (
                          <img src={editStudentForm.profilePicture} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setIsEditCameraOpen(true);
                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                            if (editVideoRef.current) editVideoRef.current.srcObject = stream;
                          } catch (err) {
                            alert("Camera access failed");
                            setIsEditCameraOpen(false);
                          }
                        }}
                        className="absolute bottom-0 right-0 bg-blue-600 text-white p-2.5 rounded-full shadow-lg hover:bg-blue-700 transition-all scale-90 group-hover:scale-100"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-black aspect-square relative shadow-2xl">
                      <video ref={editVideoRef} autoPlay playsInline className="w-full h-full object-cover mirror" />
                      <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (editVideoRef.current?.srcObject) {
                              (editVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                            }
                            setIsEditCameraOpen(false);
                          }}
                          className="px-4 py-2 bg-white/20 backdrop-blur-md text-white rounded-full text-xs font-bold border border-white/30 hover:bg-white/30"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editVideoRef.current && editCanvasRef.current) {
                              const canvas = editCanvasRef.current;
                              const video = editVideoRef.current;
                              canvas.width = video.videoWidth;
                              canvas.height = video.videoHeight;
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.drawImage(video, 0, 0);
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                setEditStudentForm(prev => ({ ...prev, profilePicture: dataUrl }));
                                if (video.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                                setIsEditCameraOpen(false);
                              }
                            }
                          }}
                          className="px-6 py-2 bg-white text-blue-600 rounded-full text-xs font-black shadow-lg"
                        >
                          Capture
                        </button>
                      </div>
                    </div>
                  )}
                  <canvas ref={editCanvasRef} className="hidden" />
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Basic Info */}
                  <div className="col-span-full border-b pb-2">
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest">Personal Information</h4>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Full Name</label>
                    <input
                      type="text"
                      value={editStudentForm.name || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Phone Number</label>
                    <input
                      type="tel"
                      value={editStudentForm.phoneNumber || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editStudentForm.dob ? new Date(editStudentForm.dob).toISOString().split('T')[0] : ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, dob: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Category</label>
                    <select
                      value={editStudentForm.category || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 uppercase"
                    >
                      <option value="">SELECT CATEGORY</option>
                      {["GENERAL", "SC", "ST", "OBC"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">ERP ID</label>
                    <input
                      type="text"
                      value={editStudentForm.erpInformation || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, erpInformation: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Registration ID</label>
                    <input
                      type="text"
                      value={editStudentForm.registrationId || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, registrationId: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  {/* Institution details */}
                  <div className="col-span-full border-b pb-2 pt-4">
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest">Institutional details</h4>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">College Name</label>
                    <select
                      value={editStudentForm.collegeName || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, collegeName: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    >
                      <option value="">SELECT COLLEGE</option>
                      {["OIST", "OCT", "OCP", "OPM", "OIPR"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Branch</label>
                    <select
                      value={editStudentForm.branch || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, branch: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    >
                      <option value="">SELECT BRANCH</option>
                      {["CS", "AIML", "DS", "ME", "CE", "EC", "IT", "EX", "MCA", "B PHARMA", "D PHARMA", "MBA", "MTECH", "M PHARMA", "CSBS", "CYBER SECURITY"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 col-span-full">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Year</label>
                      <select
                        value={editStudentForm.year || ""}
                        onChange={(e) => setEditStudentForm(prev => ({ ...prev, year: e.target.value }))}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                      >
                        <option value="">SELECT YEAR</option>
                        {["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Semester</label>
                      <select
                        value={editStudentForm.semester || ""}
                        onChange={(e) => setEditStudentForm(prev => ({ ...prev, semester: e.target.value }))}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                      >
                        <option value="">SELECT SEMESTER</option>
                        {["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Hostel details */}
                  <div className="col-span-full border-b pb-2 pt-4">
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest">Hostel details</h4>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Hostel Name</label>
                    <select
                      value={editStudentForm.hostelName?.toUpperCase() || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, hostelName: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    >
                      <option value="">SELECT HOSTEL</option>
                      {hostels.map(h => <option key={h._id} value={h.name.toUpperCase()}>{h.name.toUpperCase()}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Room No</label>
                      <input
                        type="text"
                        value={editStudentForm.roomNumber || ""}
                        onChange={(e) => setEditStudentForm(prev => ({ ...prev, roomNumber: e.target.value.toUpperCase() }))}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Joining Date</label>
                      <input
                        type="date"
                        value={editStudentForm.joiningDate ? new Date(editStudentForm.joiningDate).toISOString().split('T')[0] : ""}
                        onChange={(e) => setEditStudentForm(prev => ({ ...prev, joiningDate: e.target.value }))}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                      />
                    </div>
                  </div>

                  {/* Guardian details */}
                  <div className="col-span-full border-b pb-2 pt-4">
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest">Guardian details</h4>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Father's Name</label>
                    <input
                      type="text"
                      value={editStudentForm.fatherName || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, fatherName: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Father's No</label>
                    <input
                      type="tel"
                      value={editStudentForm.fatherNumber || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, fatherNumber: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Mother's Name</label>
                    <input
                      type="text"
                      value={editStudentForm.motherName || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, motherName: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Mother's No</label>
                    <input
                      type="tel"
                      value={editStudentForm.motherNumber || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, motherNumber: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  {/* Address info */}
                  <div className="col-span-full border-b pb-2 pt-4">
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest">Address Information</h4>
                  </div>

                  <div className="col-span-full">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Permanent Address (with PIN)</label>
                    <input
                      type="text"
                      value={editStudentForm.homePinCode || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, homePinCode: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Home State</label>
                    <select
                      value={editStudentForm.homeState || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, homeState: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    >
                      <option value="">SELECT STATE</option>
                      {["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Local Guardian */}
                  <div className="col-span-full border-b pb-2 pt-4">
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest">Local Guardian Details</h4>
                  </div>

                  <div className="col-span-full">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Guardian Address</label>
                    <input
                      type="text"
                      value={editStudentForm.localGuardianAddress || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, localGuardianAddress: e.target.value.toUpperCase() }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Guardian Mobile No</label>
                    <input
                      type="tel"
                      value={editStudentForm.localGuardianPhoneNumber || ""}
                      onChange={(e) => setEditStudentForm(prev => ({ ...prev, localGuardianPhoneNumber: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800"
                    />
                  </div>

                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:p-6 border-t bg-gray-50 flex items-center justify-end gap-4 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setShowEditStudentModal(false)}
                className="px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-100 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="editStudentForm"
                disabled={isUpdatingStudent}
                className="px-8 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all text-sm shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center gap-2"
              >
                {isUpdatingStudent ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating...
                  </>
                ) : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition-colors z-[101]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img
            src={zoomedImage}
            alt="Zoomed Profile"
            className="max-h-[85vh] max-w-[95vw] md:max-w-[80vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
