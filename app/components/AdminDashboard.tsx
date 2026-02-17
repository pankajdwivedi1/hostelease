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

const FieldEnforcementComponent = dynamic(() => import("./FieldEnforcementComponent"), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400 text-xs">Loading Field Enforcement...</div>
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
    _id: string;
    name: string;
    email: string;
    hostelName: string;
    roomNumber: string;
    registrationId?: string;
  } | null;
  istTime: string;
  istDate: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  faceMatchPercentage?: number;
  faceMatchStatus?: "auto-approved" | "flagged" | "manual-override";
  flaggedPhotoUrl?: string;
  needsReview?: boolean;
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
  floorNumber?: string;
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
  isProfileLocked?: boolean;
  deviceId?: string;
  deviceResetCount?: number;
  deviceHistory?: {
    deviceId: string;
    action: "registered" | "reset";
    timestamp: string;
  }[];
  attendanceMode?: "default" | "strict" | "gps-only" | "biometric";
  webAuthnCredentials?: {
    credentialID: string;
    publicKey: string;
    counter: number;
    transports?: string[];
    createdAt: string;
  }[];
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
  const [updatingAttendanceMode, setUpdatingAttendanceMode] = useState(false);
  const [showAttendanceModeSelector, setShowAttendanceModeSelector] = useState(false);
  const [collegeFilter, setCollegeFilter] = useState<string>("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string; attendanceMode?: 'strict' | 'gps-only' | 'biometric' }>>([]);
  const [showHostelSettingsModal, setShowHostelSettingsModal] = useState(false);
  const [updatingHostelId, setUpdatingHostelId] = useState<string | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, number>>({});
  const [presentStudentIds, setPresentStudentIds] = useState<string[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [attendanceLogsLoading, setAttendanceLogsLoading] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<DBNotification[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  // Payment States
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [showBankSettingsModal, setShowBankSettingsModal] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    accountName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    upiId: "",
    qrImage: "",
    feeAmount: 0,
    instructions: "",
    isPaymentEnabled: false
  });
  const [isReconciling, setIsReconciling] = useState(false);

  const [currentTab, setCurrentTab] = useState<"permissions" | "attendance" | "messaging" | "payments" | "settings">("permissions");
  const [reviewingLog, setReviewingLog] = useState<AttendanceLog | null>(null);
  const [isEditCameraOpen, setIsEditCameraOpen] = useState(false);
  const editVideoRef = useRef<HTMLVideoElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const [editStudentForm, setEditStudentForm] = useState<Partial<StudentDetails>>({});
  const selectionButtonsRef = useRef<HTMLDivElement>(null);
  const studentsPresentRef = useRef<HTMLDivElement>(null);
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
  const [showAllPresent, setShowAllPresent] = useState(false);
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
  const [gpsLockStatus, setGpsLockStatus] = useState<'idle' | 'locking' | 'locked' | 'error'>('idle');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lockProgress, setLockProgress] = useState(0);
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

  // Attendance Time Settings
  const [attendanceTimeSettings, setAttendanceTimeSettings] = useState({
    startTime: "21:00",
    endTime: "22:30"
  });
  const [showAttendanceTimeModal, setShowAttendanceTimeModal] = useState(false);
  const [isUpdatingAttendanceTime, setIsUpdatingAttendanceTime] = useState(false);

  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // System Settings - New Features
  const [showSystemSettingsModal, setShowSystemSettingsModal] = useState(false);
  const [isSavingSystemSettings, setIsSavingSystemSettings] = useState(false);
  const [showChangePreviewModal, setShowChangePreviewModal] = useState(false);
  const [pendingFormBuilderChanges, setPendingFormBuilderChanges] = useState<any[] | null>(null);
  const [showDBExportModal, setShowDBExportModal] = useState(false);
  const [isExportingDB, setIsExportingDB] = useState(false);
  const [hostelsConfig, setHostelsConfig] = useState<any[]>([]);
  const [registrationFields, setRegistrationFields] = useState<Record<string, any>>({});
  const [formBuilderFields, setFormBuilderFields] = useState<any[]>([]);
  const [savedFormBuilderConfig, setSavedFormBuilderConfig] = useState<any[]>([]); // ⚡ NEW: Reference for Diff
  const [activeSettingsTab, setActiveSettingsTab] = useState<"rooms" | "form" | "password" | "bank" | "system" | "audit">("password");
  const [globalWardenPassword, setGlobalWardenPassword] = useState("warden456");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [overlapRadius, setOverlapRadius] = useState(false); // ⚡ NEW
  const [prioritizeAssignedHostel, setPrioritizeAssignedHostel] = useState(false); // ⚡ NEW

  // Audit States
  const [auditResults, setAuditResults] = useState<any[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeAuditType, setActiveAuditType] = useState<"phone" | "regid" | "gibberish" | null>(null);

  // MERGED WARDEN ACCOUNTS STATE
  const [wardenAccounts, setWardenAccounts] = useState<{ _id?: string, username: string, password?: string, hostels: string[] }[]>([]);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newAccountForm, setNewAccountForm] = useState({ username: "", password: "", hostels: [] as string[] });

  // Student Attendance History State
  const [attendanceViewMode, setAttendanceViewMode] = useState<"daily" | "history">("daily");
  const [attendanceHistoryStartDate, setAttendanceHistoryStartDate] = useState("");
  const [attendanceHistoryEndDate, setAttendanceHistoryEndDate] = useState("");
  const [attendanceHistoryStudentId, setAttendanceHistoryStudentId] = useState("");
  const [attendanceHistorySearchQuery, setAttendanceHistorySearchQuery] = useState("");
  const [attendanceHistoryLogs, setAttendanceHistoryLogs] = useState<any[]>([]);
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] = useState(false);


  // Fetch Warden Accounts
  const fetchWardenAccounts = async () => {
    try {
      const res = await fetch("/api/admin/warden-accounts");
      const data = await res.json();
      if (data.wardenAccounts) setWardenAccounts(data.wardenAccounts);
    } catch (error) {
      console.error("Failed to fetch warden accounts", error);
    }
  };

  // Handle Create/Update/Delete Warden Accounts
  const handleManageWardenAccount = async (action: "create" | "update" | "delete", accountData: any) => {
    try {
      const res = await fetch("/api/admin/warden-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...accountData, action }),
      });
      const data = await res.json();
      if (data.success) {
        setWardenAccounts(data.wardenAccounts);
        if (action === "create" || action === "update") {
          setIsCreatingAccount(false);
          setEditingAccountId(null);
          setNewAccountForm({ username: "", password: "", hostels: [] });
        }
        alert(`Account ${action}d successfully!`);
      } else {
        alert(data.error || "Operation failed");
      }
    } catch (error) {
      console.error(`Failed to ${action} account`, error);
      alert("Error occurred");
    }
  };

  useEffect(() => {
    if (activeSettingsTab === "password") fetchWardenAccounts();
  }, [activeSettingsTab]);

  // Measurement Tool State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [isLocationModalMaximized, setIsLocationModalMaximized] = useState(false);
  const [wardenHostelName, setWardenHostelName] = useState<string | null>(null);
  const [authorizedHostels, setAuthorizedHostels] = useState<string[]>([]);
  const [isWarden, setIsWarden] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState(title);

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

  // Warden Filter Initialization
  useEffect(() => {
    const type = sessionStorage.getItem("userType");
    const hostelName = sessionStorage.getItem("wardenHostelName");
    const authHostelsStr = sessionStorage.getItem("authorizedHostels");

    if (type === "warden" && hostelName) {
      setIsWarden(true);
      setWardenHostelName(hostelName);

      let authHostels: string[] = [hostelName];
      if (authHostelsStr) {
        try {
          authHostels = JSON.parse(authHostelsStr);
        } catch (e) {
          console.error("Failed to parse authorizedHostels:", e);
        }
      }
      setAuthorizedHostels(authHostels);
      setHostelFilter("all"); // Default to all authorized for wardens
      setAttendanceHostelFilter("all");

      // Set dynamic dashboard title for wardens
      if (authHostels.length > 1) {
        setDashboardTitle(`Multi-Hostel Dashboard`);
      } else {
        setDashboardTitle(`${hostelName} Dashboard`);
      }
    } else {
      setDashboardTitle(title);
    }
  }, [title]);

  // Initialize messaging defaults for wardens
  useEffect(() => {
    if (isWarden && wardenHostelName) {
      setNewMessage(prev => ({
        ...prev,
        targetType: "hostel",
        targetHostel: wardenHostelName
      }));
    }
  }, [isWarden, wardenHostelName]);

  const fetchHostelLocations = async () => {
    try {
      setIsLocationsLoading(true);
      const response = await fetch("/api/admin/locations");
      if (!response.ok) {
        throw new Error(`Failed to fetch locations: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.locations) {
        setHostelLocations(data.locations);
      } else {
        // Fallback to strict defaults if no locations exist
        setHostelLocations([
          { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
          { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
          { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
        ]);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      // Set fallback on error
      setHostelLocations([
        { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
        { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
        { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
      ]);
    } finally {
      setIsLocationsLoading(false);
    }
  };

  // Fetch Attendance Time Settings
  const fetchAttendanceTimeSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      if (data.success) {
        setAttendanceTimeSettings({
          startTime: data.startTime || "21:00",
          endTime: data.endTime || "22:30"
        });
      }
    } catch (error) {
      console.error("Error fetching attendance settings:", error);
    }
  };

  // Update Attendance Time Settings
  const handleSaveAttendanceTime = async () => {
    if (!attendanceTimeSettings.startTime || !attendanceTimeSettings.endTime) {
      alert("Please fill both start and end times");
      return;
    }

    try {
      setIsUpdatingAttendanceTime(true);
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: attendanceTimeSettings.startTime,
          endTime: attendanceTimeSettings.endTime
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error("Failed to update attendance time");
      }

      alert("Attendance time updated successfully!");
      setShowAttendanceTimeModal(false);
      await fetchAttendanceTimeSettings();
    } catch (error: any) {
      console.error("Error updating attendance time:", error);
      alert(error.message || "Failed to update attendance time");
    } finally {
      setIsUpdatingAttendanceTime(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setIsUpdatingPassword(true);
      const res = await fetch("/api/admin/passwords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, type: "dean" })
      });

      const data = await res.json();
      if (data.success) {
        setNewPassword("");
        alert("Administrator password updated successfully!");
      } else {
        alert(data.error || "Failed to update password");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const DEFAULT_REGISTRATION_FIELDS = {
    erpInformation: { label: "ERP ID", visible: true, required: true },
    fatherName: { label: "Father's Name", visible: true, required: true },
    fatherNumber: { label: "Father's Phone", visible: true, required: true },
    motherName: { label: "Mother's Name", visible: true, required: true },
    motherNumber: { label: "Mother's Phone", visible: true, required: true },
    homePinCode: { label: "Address & Pincode", visible: true, required: true },
    homeState: { label: "Home State", visible: true, required: true },
    branch: { label: "Branch", visible: true, required: true },
    collegeName: { label: "College Name", visible: true, required: true },
    year: { label: "Year", visible: true, required: true },
    semester: { label: "Semester", visible: true, required: true },
    section: { label: "Section", visible: true, required: true },
    localGuardianAddress: { label: "Local Guardian Address", visible: true, required: true },
    localGuardianPhoneNumber: { label: "Local Guardian Phone", visible: true, required: true },
    dob: { label: "Date of Birth", visible: true, required: true },
    category: { label: "Category", visible: true, required: true },
    joiningDate: { label: "Joining Date", visible: true, required: true },
  };

  const fetchSystemSettings = async () => {
    try {
      // Fetch Registration Fields Config
      const settingsRes = await fetch("/api/admin/settings");
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        const config = settingsData.registrationFieldsConfig || {};
        const mergedFields = { ...DEFAULT_REGISTRATION_FIELDS };

        // Merge DB config into defaults
        Object.keys(config).forEach(key => {
          if (mergedFields[key as keyof typeof DEFAULT_REGISTRATION_FIELDS]) {
            mergedFields[key as keyof typeof DEFAULT_REGISTRATION_FIELDS] = {
              ...mergedFields[key as keyof typeof DEFAULT_REGISTRATION_FIELDS],
              ...config[key]
            };
          }
        });

        setRegistrationFields(mergedFields);
        setRegistrationFields(mergedFields);
        setFormBuilderFields(settingsData.formBuilderConfig || []);
        setSavedFormBuilderConfig(settingsData.formBuilderConfig || []); // ⚡ NEW: Save reference
        if (settingsData.wardenPassword) {
          setGlobalWardenPassword(settingsData.wardenPassword);
        }
        if (settingsData.adminPassword) {
          setNewPassword(settingsData.adminPassword);
        }
        if (settingsData.bankDetails) {
          setBankFormData(prev => ({ ...prev, ...settingsData.bankDetails }));
        }
        if (settingsData.overlapRadius !== undefined) setOverlapRadius(settingsData.overlapRadius);
        if (settingsData.prioritizeAssignedHostel !== undefined) setPrioritizeAssignedHostel(settingsData.prioritizeAssignedHostel);
      }

      // Fetch Hostels (with warden/room info)
      const hostelsRes = await fetch("/api/admin/hostels");
      const hostelsData = await hostelsRes.json();
      if (hostelsData.success) {
        setHostelsConfig(hostelsData.hostels || []);
      }
    } catch (error) {
      console.error("Error fetching system settings:", error);
    }
  };

  useEffect(() => {
    if (showSystemSettingsModal) {
      fetchSystemSettings();
    }
  }, [showSystemSettingsModal]);

  const handleToggleDeveloperSetting = async (key: string, value: boolean) => {
    try {
      setIsUpdatingSettings(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value })
      });
      const data = await res.json();
      if (data.success) {
        if (key === 'overlapRadius') setOverlapRadius(value);
        if (key === 'prioritizeAssignedHostel') setPrioritizeAssignedHostel(value);
      }
    } catch (error) {
      alert("Failed to update setting");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleCreateHostel = async () => {
    const name = prompt("Enter new hostel name:");
    if (!name) return;

    try {
      setIsSavingSystemSettings(true);
      const res = await fetch("/api/admin/hostels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        await fetchSystemSettings();
        await fetchHostels(true);
        alert("Hostel created successfully!");
      } else {
        alert(data.error || "Failed to create hostel");
      }
    } catch (error) {
      alert("Error creating hostel");
    } finally {
      setIsSavingSystemSettings(false);
    }
  };

  const handleDeleteHostelConfig = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This will NOT delete students, but they will lose their hostel association.`)) return;

    try {
      setIsSavingSystemSettings(true);
      const res = await fetch(`/api/admin/hostels?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await fetchSystemSettings();
        await fetchHostels(true);
        alert("Hostel deleted successfully!");
      }
    } catch (error) {
      alert("Failed to delete hostel");
    } finally {
      setIsSavingSystemSettings(false);
    }
  };

  const handleUpdateBankSettings = async () => {
    try {
      setIsSavingSystemSettings(true);

      const payload = {
        universityBankDetails: {
          accountName: bankFormData.accountName,
          accountNumber: bankFormData.accountNumber,
          ifscCode: bankFormData.ifscCode,
          bankName: bankFormData.bankName,
          upiId: bankFormData.upiId,
          qrImage: bankFormData.qrImage
        },
        hostelFeeAmount: bankFormData.feeAmount,
        paymentInstructions: bankFormData.instructions,
        isPaymentEnabled: bankFormData.isPaymentEnabled
      };

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Bank settings configuration updated successfully! Students can now see updated payment details.");
        // await fetchSystemSettings(); // Was this existing? Or maybe meant fetchBankSettings?
        // Let's stick to what was there or what makes sense. The original had fetchSystemSettings but usually we fetch bank settings.
        // Let's call fetchBankSettings() if it exists, or just log success.
        // Looking at context, fetchSystemSettings might not exist or might be confusing. 
        // I will check if fetchBankSettings is available. Yes it is.
        await fetchBankSettings();
      } else {
        alert(data.error || "Failed to update bank settings");
      }
    } catch (error) {
      console.error("Error updating bank settings:", error);
      alert("Error occurred while saving settings.");
    } finally {
      setIsSavingSystemSettings(false);
    }
  };

  const handleUpdateHostelConfig = async (hostel: any) => {
    try {
      setIsSavingSystemSettings(true);
      const res = await fetch("/api/admin/hostels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hostel)
      });
      const data = await res.json();
      if (data.success) {
        await fetchSystemSettings();
      }
    } catch (error) {
      alert("Failed to update hostel");
    } finally {
      setIsSavingSystemSettings(false);
    }
  };

  const handleUpdateRegistrationFields = async (updatedFields: any) => {
    try {
      setIsSavingSystemSettings(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationFieldsConfig: updatedFields })
      });
      const data = await res.json();
      if (data.success) {
        setRegistrationFields(updatedFields);
      }
    } catch (error) {
    } finally {
      setIsSavingSystemSettings(false);
    }
  };

  const confirmUpdateFormBuilder = async () => {
    if (!pendingFormBuilderChanges) return;

    try {
      setIsSavingSystemSettings(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formBuilderConfig: pendingFormBuilderChanges })
      });
      const data = await res.json();
      if (data.success) {
        setFormBuilderFields(pendingFormBuilderChanges);
        setSavedFormBuilderConfig(pendingFormBuilderChanges); // ⚡ NEW: Update reference on save
        setShowChangePreviewModal(false);
        setPendingFormBuilderChanges(null);
        alert("Configuration updated successfully!");
      }
    } catch (error) {
      alert("Failed to update form builder");
    } finally {
      setIsSavingSystemSettings(false);
    }
  };

  const handleUpdateFormBuilder = (updatedFields: any[]) => {
    setPendingFormBuilderChanges(updatedFields);
    setShowChangePreviewModal(true);
  };


  const handleDBExport = async (format: "json" | "csv" | "xlsx") => {
    try {
      setIsExportingDB(true);
      const response = await fetch(`/api/developer/export-data?format=${format}`);

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // For CSV/XLSX, the API returns .xlsx unless we change it. Let's use the extension matching the format.
      // API returns .xlsx for 'xlsx' and 'csv' (as workbook).
      // But if format is csv, we might want zip? No, API returns XLSX logic for CSV too currently.
      // Wait, API implementation for CSV/XLSX uses XLSX.write with appropriate type in buffer.
      // So filename extension matters.
      // Let's rely on Content-Disposition header if possible, but manual download attribute is safer.
      const extension = format === 'json' ? 'json' : (format === 'csv' ? 'csv' : 'xlsx');
      a.download = `hostelease_db_dump_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowDBExportModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to export database");
    } finally {
      setIsExportingDB(false);
    }
  };

  const handleAudit = async (type: "duplicates-phone" | "duplicates-regid" | "gibberish-names") => {
    try {
      setIsAuditing(true);
      setAuditResults([]);
      // Extract middle part or whole for type
      const typeLabel = type.includes('phone') ? 'phone' : (type.includes('regid') ? 'regid' : 'gibberish');
      setActiveAuditType(typeLabel as any);

      const response = await fetch(`/api/developer/audit?type=${type}`);
      const data = await response.json();

      if (data.success) {
        setAuditResults(data.data);
      } else {
        alert(data.error || "Audit failed");
      }
    } catch (e) {
      console.error(e);
      alert("Error performing audit");
    } finally {
      setIsAuditing(false);
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

    try {
      setIsUpdatingSettings(true);
      const response = await fetch(`/api/admin/locations?index=${index}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete location");
      }

      alert(`Location "${data.deletedLocation.name}" deleted successfully!`);
      await fetchHostelLocations(); // Refresh the list
    } catch (error: any) {
      console.error("Error deleting location:", error);
      alert(error.message || "Failed to delete location");
    } finally {
      setIsUpdatingSettings(false);
    }
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

  const fetchAdminPayments = async () => {
    try {
      setPaymentsLoading(true);
      const res = await fetch(`/api/admin/payments?status=${paymentStatusFilter}&search=${paymentSearch}`);
      const data = await res.json();
      if (data.success) setPayments(data.payments);
    } catch (e) {
      console.error("Error fetching payments:", e);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const fetchBankSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) {
        setBankFormData({
          accountName: data.universityBankDetails?.accountName || "",
          accountNumber: data.universityBankDetails?.accountNumber || "",
          ifscCode: data.universityBankDetails?.ifscCode || "",
          bankName: data.universityBankDetails?.bankName || "",
          upiId: data.universityBankDetails?.upiId || "",
          qrImage: data.universityBankDetails?.qrImage || "",
          feeAmount: data.hostelFeeAmount || 0,
          instructions: data.paymentInstructions || "",
          isPaymentEnabled: data.isPaymentEnabled || false
        });
      }
    } catch (e) {
      console.error("Error fetching bank settings:", e);
    }
  };



  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsReconciling(true);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        const csvRecords = data.map(row => {
          const utrKey = Object.keys(row).find(k => k.toLowerCase().includes('utr') || k.toLowerCase().includes('transaction'));
          const amountKey = Object.keys(row).find(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('value'));
          return {
            utr: utrKey ? String(row[utrKey]).trim() : null,
            amount: amountKey ? Number(row[amountKey]) : null
          };
        }).filter(r => r.utr);

        if (csvRecords.length === 0) {
          alert("No valid UTR numbers found in CSV. Please ensure the column is named 'UTR' or 'Transaction ID'.");
          return;
        }

        const res = await fetch("/api/admin/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvRecords })
        });
        const result = await res.json();
        if (result.success) {
          alert(result.message);
          fetchAdminPayments();
        } else {
          alert(result.error || "Reconciliation failed");
        }
      } catch (err) {
        console.error("CSV Parse Error:", err);
        alert("Error parsing CSV file");
      } finally {
        setIsReconciling(false);
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualPaymentAction = async (paymentId: string, status: string) => {
    const remarks = prompt(`Enter remarks for ${status}:`, status === 'verified' ? 'Manually verified by Admin' : 'Incorrect UTR details');
    if (remarks === null) return;

    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, status, adminRemarks: remarks })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchAdminPayments();
      }
    } catch (e) {
      alert("Action failed");
    }
  };

  const handleUpdateHostelMode = async (hostelId: string, mode: 'strict' | 'gps-only' | 'biometric') => {
    try {
      setUpdatingHostelId(hostelId);
      const hostelToUpdate = hostels.find(h => h._id === hostelId);
      if (!hostelToUpdate) throw new Error("Hostel not found");

      const res = await fetch('/api/admin/hostels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...hostelToUpdate,
          id: hostelId,
          attendanceMode: mode
        })
      });

      if (!res.ok) throw new Error("Failed to update");

      const data = await res.json();
      if (data.success) {
        // Update local state
        setHostels(prev => prev.map(h => h._id === hostelId ? { ...h, attendanceMode: mode } : h));
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update attendance mode");
    } finally {
      setUpdatingHostelId(null);
    }
  };

  const handleSyncAllStudents = async (hostelName: string) => {
    if (!confirm(`Are you sure you want to reset all students in '${hostelName}' to use the Hostel Default mode? \n\nThis will remove any individual overrides (like GPS Only or Biometric) set for specific students.`)) return;

    try {
      setUpdatingHostelId('syncing');
      const res = await fetch('/api/admin/hostels/reset-student-modes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostelName })
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to sync students");
    } finally {
      setUpdatingHostelId(null);
    }
  };

  const handleSaveLocation = async () => {
    if (!locationForm.name || !locationForm.lat || !locationForm.lng) {
      alert("Please fill all fields");
      return;
    }

    try {
      setIsUpdatingSettings(true);

      let response;
      if (editingLocationIndex !== null) {
        // UPDATE existing location
        response = await fetch("/api/admin/locations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: editingLocationIndex,
            ...locationForm
          })
        });
      } else {
        // ADD new location
        response = await fetch("/api/admin/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locationForm)
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save location");
      }

      alert(data.message || "Location saved successfully!");
      setShowLocationModal(false);
      setEditingLocationIndex(null);
      setLocationForm({ name: "", lat: 0, lng: 0, radius: 100 });
      await fetchHostelLocations(); // Refresh the list
    } catch (error: any) {
      console.error("Error saving location:", error);
      alert(error.message || "Failed to save location");
    } finally {
      setIsUpdatingSettings(false);
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

    // Filter by authorized hostels for wardens
    if (isWarden && authorizedHostels.length > 0) {
      list = list.filter(s => {
        const studentHostel = getHostelCategory(s.hostelName) || s.hostelName;
        return authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
      });
    }

    // Further filter by attendance hostel filter if not "all"
    if (currentTab === "attendance" && attendanceHostelFilter !== "all") {
      list = list.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === attendanceHostelFilter);
    }

    return list;
  }, [students, presentStudentIds, attendanceHostelFilter, currentTab, hostels, isWarden, authorizedHostels]);

  // Filter attendance logs for wardens to only show their authorized hostels
  const filteredAttendanceLogs = useMemo(() => {
    if (!isWarden || authorizedHostels.length === 0) {
      return attendanceLogs; // Admin/Developer sees all
    }

    return attendanceLogs.filter(log => {
      if (!log.studentId) return false;
      const studentHostel = getHostelCategory(log.studentId.hostelName) || log.studentId.hostelName;
      return authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
    });
  }, [attendanceLogs, isWarden, authorizedHostels]);

  // Calculate filtered present count for wardens (only students from authorized hostels)
  const filteredPresentCount = useMemo(() => {
    if (!isWarden || authorizedHostels.length === 0) {
      return presentStudentIds.length; // Admin/Developer sees all
    }

    // Count only present students from authorized hostels
    return students.filter(s => {
      if (!presentStudentIds.includes(s.id)) return false;
      const studentHostel = getHostelCategory(s.hostelName) || s.hostelName;
      return authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
    }).length;
  }, [students, presentStudentIds, isWarden, authorizedHostels]);

  // Filter absentees based on selected hostel card
  const displayedAbsentees = useMemo(() => {
    if (!selectedAttendanceHostel) return absentees;
    return absentees.filter(s => {
      const studentHostel = getHostelCategory(s.hostelName) || s.hostelName;
      return studentHostel.toLowerCase() === selectedAttendanceHostel.toLowerCase();
    });
  }, [absentees, selectedAttendanceHostel]);

  // Filter present students based on selected hostel card
  const presentStudentsForSelectedHostel = useMemo(() => {
    if (!selectedAttendanceHostel) return [];
    return filteredAttendanceLogs.filter(log => {
      if (!log.studentId) return false;
      const studentHostel = getHostelCategory(log.studentId.hostelName) || log.studentId.hostelName;
      return studentHostel.toLowerCase() === selectedAttendanceHostel.toLowerCase();
    });
  }, [filteredAttendanceLogs, selectedAttendanceHostel]);

  // Reset showAllPresent when selectedHostel changes
  useEffect(() => {
    setShowAllPresent(false);
  }, [selectedAttendanceHostel]);

  // Handle click outside to deselect hostel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!selectedAttendanceHostel) return;

      const target = event.target as Node;

      // Don't deselect if clicking inside specific areas
      if (selectionButtonsRef.current?.contains(target)) return;
      if (studentsPresentRef.current?.contains(target)) return;
      if (absenteesRef.current?.contains(target)) return;
      // Note: absenteesRef is defined elsewhere in the file but accessible here
      // But if it's not defined in scope, we might need to check.
      // Assuming absenteesRef exists globally in component scope.
      // If TypeScript complains, we'll fix it.
      // Checking local ref names...
      // Actually, if absenteesRef is NOT defined in this scope, let's skip checking it for now
      // and rely on the fact that clicking it is "outside" for now?
      // NO, clicking Absentee List MUST NOT deselect.
      // Let's assume absenteesRef is defined.
      // Use explicit any cast if needed to avoid build error? No.
      // I'll try to find it.
      // If I can't find it, I'll add logic to check className? container?
      // Or just add a new ref to the wrapper div of absent list?

      // Let's check entryLogsRef too.
      // if (entryLogsRef.current?.contains(target)) return;

      setSelectedAttendanceHostel(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedAttendanceHostel]);



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
          isProfileLocked: s.isProfileLocked || false,
          deviceId: s.deviceId,
          webAuthnCredentials: s.webAuthnCredentials || [],
          deviceResetCount: s.deviceResetCount || 0,
          deviceHistory: s.deviceHistory || [],
          attendanceMode: s.attendanceMode || "default",
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
      const data = await response.json();
      
      // Handle both success and error responses
      if (data.permissions !== undefined) {
        setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      } else if (!response.ok) {
        console.warn(`Permissions API returned status ${response.status}`);
        setPermissions([]);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setPermissions([]); // Set empty array on error
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

  const fetchStudentHistory = async () => {
    if (!attendanceHistoryStudentId) return;
    try {
      setAttendanceHistoryLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append("studentId", attendanceHistoryStudentId);
      if (attendanceHistoryStartDate) queryParams.append("startDate", attendanceHistoryStartDate);
      if (attendanceHistoryEndDate) queryParams.append("endDate", attendanceHistoryEndDate);

      const response = await fetch(`/api/admin/attendance?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch history");

      const data = await response.json();
      if (data.success) {
        setAttendanceHistoryLogs(data.attendance);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to fetch student history");
    } finally {
      setAttendanceHistoryLoading(false);
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

  const handleToggleProfileLock = async (studentId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isProfileLocked: !currentStatus }),
      });

      if (!response.ok) throw new Error("Failed to update lock status");

      const data = await response.json();
      if (data.success) {
        // Update local state
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, isProfileLocked: !currentStatus } : s));
        if (selectedStudent && selectedStudent.id === studentId) {
          setSelectedStudent({ ...selectedStudent, isProfileLocked: !currentStatus });
        }
        alert(`Profile ${!currentStatus ? 'Locked' : 'Unlocked'} successfully!`);
      }
    } catch (error) {
      console.error("Error toggling profile lock:", error);
      alert("Failed to update profile lock status");
    }
  };

  const handleBulkProfileLock = async (lock: boolean) => {
    const action = lock ? "LOCK" : "UNLOCK";
    if (!confirm(`Are you sure you want to ${action} ALL student profiles?`)) return;

    try {
      setIsUpdatingSettings(true);
      const response = await fetch("/api/admin/students/bulk-lock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lock }),
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchStudents(true); // Refresh student list
      } else {
        throw new Error(data.error || "Failed to update profiles");
      }
    } catch (error: any) {
      console.error("Bulk lock error:", error);
      alert(error.message || "Failed to perform bulk action");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleResetPassword = async (type: "dean" | "warden") => {
    const newPassword = prompt(`Enter new password for ${type}:`);
    if (!newPassword || newPassword.trim().length < 4) {
      if (newPassword !== null) alert("Password must be at least 4 characters long.");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const response = await fetch("/api/admin/passwords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, newPassword: newPassword.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`${type.toUpperCase()} password changed successfully!`);
      } else {
        throw new Error(data.error || "Failed to update password");
      }
    } catch (error: any) {
      console.error("Password reset error:", error);
      alert(error.message || "Something went wrong while resetting password.");
    } finally {
      setIsUpdatingPassword(false);
      setShowPasswordResetModal(false);
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
      fetchAttendanceTimeSettings(); // Fetch attendance time settings
      fetchSystemSettings(); // Fetch new developer settings
    }
  }, [title]);

  useEffect(() => {
    fetchAttendanceSummary();
    if (currentTab === "attendance") {
      fetchAttendanceLogs();
    }
    if (currentTab === 'payments') {
      fetchAdminPayments();
      fetchBankSettings();
    }
  }, [selectedDate, attendanceHostelFilter, currentTab, paymentStatusFilter, paymentSearch]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPermissions();
      fetchAttendanceSummary();
      if (currentTab === 'attendance') fetchAttendanceLogs();
      if (currentTab === 'messaging') fetchAdminNotifications();
      if (currentTab === 'payments') fetchAdminPayments();
    }, 20000);

    return () => clearInterval(interval);
  }, [currentTab, selectedDate, paymentStatusFilter, paymentSearch]);

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

  const getAccurateLocation = (mode: 'test' | 'form' = 'test') => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocationChecking(true);
    setGpsLockStatus('locking');
    setLockProgress(0);
    setGpsAccuracy(null);
    console.log("Starting High-Speed Admin Location Lock...");

    let watchId: number | null = null;
    let isCompleted = false;
    let bestPosition: GeolocationPosition | null = null;
    let lockTimer: NodeJS.Timeout | null = null;

    const performVerification = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      const finalAccuracy = Math.round(accuracy);
      setLastCheckAccuracy(finalAccuracy);

      if (mode === 'form') {
        const lat = parseFloat(latitude.toFixed(8));
        const lng = parseFloat(longitude.toFixed(8));
        setLocationForm(prev => ({ ...prev, lat, lng }));
        setIsLocationChecking(false);
        setGpsLockStatus('idle');
        return;
      }

      // Proximity Test Mode
      const locationsToTest = hostelLocations.length > 0 ? hostelLocations : [
        { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
        { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
        { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
      ];

      const results = locationsToTest.map(loc => {
        const dist = calculateDistance(latitude, longitude, loc.lat, loc.lng);
        const offset = Math.min(finalAccuracy, 50);
        const isVerified = dist <= loc.radius;
        return { ...loc, distance: dist, isVerified: isVerified, appliedOffset: offset };
      });

      setLocationVerificationResults(results);
      setIsLocationChecking(false);
      setGpsLockStatus('idle');
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
        performVerification(finalPosition);
      }, 500);
    };

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

        if (!bestPosition) {
          bestPosition = position;
          lockTimer = setTimeout(finishLock, 2500);
          setLockProgress(40);
        } else if (accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
          setLockProgress((prev) => Math.min(95, prev + 15));
        }

        if (accuracy <= 30) {
          clearTimeout(hardTimeoutId);
          finishLock();
        }
      },
      (error) => {
        console.warn("Admin GPS Lock Search:", error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  const handleUpdateAttendanceMode = async (studentId: string, mode: "default" | "strict" | "gps-only" | "biometric") => {
    try {
      setUpdatingAttendanceMode(true);
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceMode: mode }),
      });

      if (!response.ok) throw new Error("Failed to update mode");

      // Update local state
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, attendanceMode: mode } : s));
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(prev => prev ? { ...prev, attendanceMode: mode } : null);
      }
      setShowAttendanceModeSelector(false);
      alert(`Attendance Mode Updated to: ${mode}`);
    } catch (error) {
      console.error("Error updating attendance mode:", error);
      alert("Failed to update attendance mode");
    } finally {
      setUpdatingAttendanceMode(false);
    }
  };

  const handleResetDeviceID = async (studentId: string) => {
    if (!confirm("Are you sure you want to reset this student's device registration? This will allow them to register a new phone.")) return;

    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetDevice" })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reset device ID on server");
      }

      // Update local state immediately for instant feedback
      if (selectedStudent && selectedStudent.id === studentId) {
        setSelectedStudent({
          ...selectedStudent,
          deviceId: "",
          webAuthnCredentials: [],
          deviceResetCount: (selectedStudent.deviceResetCount || 0) + 1,
          deviceHistory: [
            ...(selectedStudent.deviceHistory || []),
            ...(selectedStudent.deviceId ? [{
              deviceId: selectedStudent.deviceId,
              action: "reset" as const,
              timestamp: new Date().toISOString()
            }] : [])
          ]
        });
      }

      alert("Device registration reset successfully!");
      // 🔄 BACKGROUND REFRESH: Let it happen in the background
      fetchStudents(true);
    } catch (error: any) {
      console.error("Error resetting device ID:", error);
      alert(`Failed to reset device ID: ${error.message || "Unknown error"}. Please try again.`);
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
      Room: s.roomNumber,
      Email: s.email,
      Phone: s.phoneNumber,
      Hostel: s.hostelName,
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
      const data = filteredAttendanceLogs.map(log => ({
        "Student ID": log.studentId?.registrationId || "N/A",
        Student: log.studentId?.name || "Unknown",
        Room: log.studentId?.roomNumber || "N/A",
        Email: log.studentId?.email || "N/A",
        Hostel: log.studentId?.hostelName || "N/A",
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
        Room: s.roomNumber,
        Email: s.email,
        Hostel: s.hostelName,
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
            floorNumber: data.student.floorNumber,
            erpInformation: data.student.erpInformation,
            joiningDate: data.student.joiningDate,
            localGuardianAddress: data.student.localGuardianAddress,
            localGuardianPhoneNumber: data.student.localGuardianPhoneNumber,
            homeState: data.student.homeState,
            studentStatus: data.student.studentStatus || "in",
            registrationId: data.student.registrationId,
            deviceId: data.student.deviceId,
            webAuthnCredentials: data.student.webAuthnCredentials || [],
            deviceResetCount: data.student.deviceResetCount || 0,
            deviceHistory: data.student.deviceHistory || [],
            attendanceMode: data.student.attendanceMode || "default",
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
          floorNumber: "",
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
      // 🔍 UNIVERSAL SEARCH: Match against all fields from registration form  
      const matchesSearch = searchQuery === "" ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).registrationId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.semester?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.branch?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.section?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).fatherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).fatherNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).motherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).motherNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).homeState?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).homePinCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).erpInformation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).localGuardianAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).localGuardianPhoneNumber?.toLowerCase().includes(searchQuery.toLowerCase());

      // For wardens, always filter by their hostel
      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) {
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        matchesHostel = studentHostel === hostelFilter || studentHostel.toLowerCase() === hostelFilter.toLowerCase();
      } else if (isWarden && authorizedHostels.length > 0) {
        // For wardens, if 'all' is selected, must be within authorized hostels
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        matchesHostel = authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
      }

      const matchesCollege = collegeFilter === "all" || student.collegeName === collegeFilter;
      const matchesSemester = semesterFilter === "all" || student.semester?.toUpperCase() === semesterFilter.toUpperCase();
      const matchesBranch = branchFilter === "all" || student.branch === branchFilter;
      const matchesSection = sectionFilter === "all" || student.section?.toUpperCase() === sectionFilter.toUpperCase();

      if (!matchesStatus || !matchesSearch || !matchesHostel || !matchesCollege || !matchesSemester || !matchesBranch || !matchesSection) return false;

      if (statusFilter === "all") return true;
      return student.studentStatus === statusFilter;
    });
  }, [permissions, filter, statusFilter, searchQuery, hostelFilter, collegeFilter, semesterFilter, branchFilter, sectionFilter, isWarden, authorizedHostels]);

  // Base list filtered by Search, College, Semester, Branch, and Section
  const totalHostelStudents = useMemo(() => {
    return students.filter((student) => {
      if (isWarden && authorizedHostels.length > 0) {
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        return authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
      }
      return true;
    });
  }, [students, isWarden, authorizedHostels]);

  const dropdownFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      // For wardens, always restrict to their authorized hostels at the base level
      if (isWarden && authorizedHostels.length > 0) {
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        const isAuthorized = authorizedHostels.some(h =>
          h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase()
        );
        if (!isAuthorized) return false;
      }

      // 🔍 UNIVERSAL SEARCH: Match against all student fields from registration form
      const matchesSearch = searchQuery === "" ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student as any).registrationId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.semester?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.branch?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.section?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.fatherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.fatherNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.motherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.motherNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.homeState?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.homePinCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.erpInformation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.localGuardianAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.localGuardianPhoneNumber?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCollege = collegeFilter === "all" || student.collegeName === collegeFilter;
      const matchesSemester = semesterFilter === "all" || student.semester?.toUpperCase() === semesterFilter.toUpperCase();
      const matchesBranch = branchFilter === "all" || student.branch === branchFilter;
      const matchesSection = sectionFilter === "all" || student.section?.toUpperCase() === sectionFilter.toUpperCase();

      return matchesSearch && matchesCollege && matchesSemester && matchesBranch && matchesSection;
    });
  }, [students, searchQuery, collegeFilter, semesterFilter, branchFilter, sectionFilter, isWarden, wardenHostelName]);

  const filteredStudents = useMemo(() => {
    return dropdownFilteredStudents.filter((student) => {
      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) {
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        matchesHostel = studentHostel === hostelFilter || studentHostel.toLowerCase() === hostelFilter.toLowerCase();
      } else if (isWarden && authorizedHostels.length > 0) {
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        matchesHostel = authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
      }
      const matchesStatus = statusFilter === "all" || student.studentStatus === statusFilter;
      return matchesHostel && matchesStatus;
    });
  }, [dropdownFilteredStudents, hostelFilter, statusFilter, isWarden, authorizedHostels]);

  // Optimized counts for status buttons
  const statusCounts = useMemo(() => {
    const baseList = dropdownFilteredStudents.filter(student => {
      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) {
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        matchesHostel = studentHostel === hostelFilter || studentHostel.toLowerCase() === hostelFilter.toLowerCase();
      } else if (isWarden && authorizedHostels.length > 0) {
        const studentHostel = getHostelCategory(student.hostelName) || student.hostelName;
        matchesHostel = authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
      }
      return matchesHostel;
    });

    return {
      all: baseList.length,
      in: baseList.filter(s => s.studentStatus === 'in').length,
      out: baseList.filter(s => s.studentStatus === 'out').length
    };
  }, [dropdownFilteredStudents, hostelFilter, isWarden, authorizedHostels]);



  const userType = typeof window !== "undefined" ? sessionStorage.getItem("userType") : null;

  return (
    <div className="min-h-screen bg-white">
      <main className="w-full max-w-4xl mx-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {!showAllStudents ? (
            <>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex justify-between items-start w-full md:w-auto">
                  <div>
                    <h1 className="text-lg md:text-xl font-bold text-foreground">{dashboardTitle}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      {studentsLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></span>
                      ) : (
                        <p className="text-sm text-secondary">{filteredStudents.length} Students</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="md:hidden px-4 py-2 rounded-xl border border-solid border-gray-100 bg-white text-foreground text-[10px] font-black uppercase tracking-tight shadow-sm active:scale-95 transition-all flex items-center gap-2"
                  >
                    LOGOUT
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {title === "Developer Dashboard" && (
                    <button
                      onClick={() => setShowSystemSettingsModal(true)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-indigo-100 transition-all whitespace-nowrap"
                    >
                      🛠️ System Settings
                    </button>
                  )}
                  {title === "Developer Dashboard" && (
                    <button
                      onClick={handleFixCampusSettings}
                      disabled={isUpdatingSettings}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-amber-100 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {isUpdatingSettings ? "Updating..." : "✨ Set New Location"}
                    </button>
                  )}
                  {title === "Developer Dashboard" && (
                    <button
                      onClick={() => setShowAttendanceTimeModal(true)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-green-100 transition-all whitespace-nowrap"
                    >
                      ⏰ Set Attendance Time
                    </button>
                  )}
                  {title === "Developer Dashboard" && (
                    <button
                      onClick={() => setShowHostelSettingsModal(true)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-indigo-100 transition-all whitespace-nowrap"
                    >
                      🏢 Manage Hostels
                    </button>
                  )}

                  {title === "Developer Dashboard" && (
                    <button
                      onClick={() => setShowDBExportModal(true)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-emerald-100 transition-all whitespace-nowrap"
                    >
                      💾 Export DB
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
                    className="hidden md:flex px-4 py-2 rounded-xl border border-solid border-gray-100 bg-white text-foreground text-[10px] font-black uppercase tracking-tight shadow-sm active:scale-95 transition-all items-center gap-2 hover:bg-gray-50"
                  >
                    LOGOUT
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>

              {title === "Developer Dashboard" && (
                <div className="mb-6 space-y-4">
                  <div className="space-y-2">
                    <button
                      onClick={() => getAccurateLocation('test')}
                      disabled={isLocationChecking}
                      className="w-full flex items-center justify-center gap-3 py-3.5 bg-indigo-50 text-indigo-700 rounded-xl font-bold border border-indigo-100 hover:bg-indigo-100 transition-all shadow-sm active:scale-95 disabled:opacity-80"
                    >
                      {isLocationChecking ? (
                        <div className="flex items-center gap-3">
                          <div className="relative flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                            <div className="absolute inset-0 bg-indigo-400/10 rounded-full animate-pulse" />
                          </div>
                          <div className="flex flex-col items-start leading-tight">
                            <span className="text-[11px] uppercase tracking-wider">Locking Signal...</span>
                            <span className="text-[10px] font-black text-indigo-500">ACCURACY: {gpsAccuracy ? `${gpsAccuracy}m` : '--'}</span>
                          </div>
                        </div>
                      ) : (
                        "🔍 Test Current Location Proximity"
                      )}
                    </button>
                    {isLocationChecking && (
                      <div className="px-1 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${lockProgress}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest text-center">
                          {gpsAccuracy && gpsAccuracy > 100 ? "📍 Move for better signal" : "Synchronizing..."}
                        </p>
                      </div>
                    )}
                  </div>

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
                {!isWarden && (
                  <button
                    onClick={() => setCurrentTab('settings')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${currentTab === 'settings' ? 'bg-white text-blue-600 shadow-sm shadow-blue-100' : 'text-secondary hover:text-foreground'}`}
                  >
                    Settings
                  </button>
                )}
                {/* <button
                  onClick={() => setCurrentTab('payments')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${currentTab === 'payments' ? 'bg-white text-blue-600 shadow-sm shadow-blue-100' : 'text-secondary hover:text-foreground'}`}
                >
                  Payments
                </button> */}
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
                        disabled={isWarden}
                        className={`h-9 px-3 rounded-lg border border-solid border-[#9CA3AF] bg-white text-foreground text-sm focus:outline-none focus:border-foreground min-w-[120px] ${isWarden ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                                      <p className="text-[11px] md:text-[13px] font-semibold text-foreground uppercase tracking-tight">{student.name}</p>
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
                                <p className="text-[10px] md:text-xs text-foreground font-medium">{permission.reason}</p>
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
                  {/* View Mode Toggle */}
                  <div className="flex justify-center mb-6">
                    <div className="bg-gray-100 p-1 rounded-xl inline-flex">
                      <button
                        onClick={() => setAttendanceViewMode("daily")}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${attendanceViewMode === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                      >
                        Daily Monitor
                      </button>
                      <button
                        onClick={() => setAttendanceViewMode("history")}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${attendanceViewMode === "history" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                      >
                        Student History
                      </button>
                    </div>
                  </div>

                  {attendanceViewMode === "daily" ? (
                    <>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                          <div>
                            <h2 className="text-lg font-bold text-foreground">Daily Attendance Monitoring</h2>
                            <p className="text-sm text-secondary">Student entries and absentees for {selectedDate === new Date().toISOString().split('T')[0] ? 'today' : selectedDate}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:flex sm:items-center">
                            <input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              max={new Date().toISOString().split('T')[0]}
                              className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 focus:outline-none focus:border-blue-500 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors w-full sm:w-auto sm:min-w-[160px]"
                            />
                            <select
                              value={attendanceHostelFilter}
                              onChange={(e) => setAttendanceHostelFilter(e.target.value)}
                              disabled={isWarden}
                              className={`w-full appearance-none bg-blue-50 border-0 text-blue-900 px-4 py-2.5 rounded-xl font-bold text-sm focus:ring-0 focus:outline-none ${isWarden ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                              ? filteredPresentCount
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
                                ? (isWarden && authorizedHostels.length > 0
                                  ? students.filter(s => {
                                    const studentHostel = getHostelCategory(s.hostelName) || s.hostelName;
                                    return authorizedHostels.some(h => h === studentHostel || h.toLowerCase() === studentHostel.toLowerCase());
                                  }).length
                                  : students.length)
                                : students.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === attendanceHostelFilter).length;
                              const present = attendanceHostelFilter === 'all'
                                ? filteredPresentCount
                                : (attendanceSummary[attendanceHostelFilter] || 0);

                              return total > 0 ? Math.round((present / total) * 100) : 0;
                            })()}%
                          </p>
                        </div>
                      </div>

                      {/* Hostel Breakdown */}
                      <div
                        ref={selectionButtonsRef}
                        className="grid grid-cols-2 md:grid-cols-4 gap-3 cursor-pointer"
                        onClick={() => setSelectedAttendanceHostel(null)}
                      >
                        {Object.entries(attendanceSummary)
                          .filter(([hostel]) => {
                            // For wardens, only show their authorized hostels
                            if (isWarden && authorizedHostels.length > 0) {
                              return authorizedHostels.some(h => h === hostel || h.toLowerCase() === hostel.toLowerCase());
                            }
                            return true;
                          })
                          .map(([hostel, count]) => {
                            // Calculate total students in this hostel
                            const totalInHostel = students.filter(s =>
                              (getHostelCategory(s.hostelName) || s.hostelName) === hostel
                            ).length;
                            const percentage = totalInHostel > 0 ? Math.round((count / totalInHostel) * 100) : 0;
                            const isSelected = selectedAttendanceHostel === hostel;

                            return (
                              <button
                                key={hostel}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAttendanceHostel(isSelected ? null : hostel);
                                }}
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
                        <div ref={studentsPresentRef} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                          <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Students Present from {selectedAttendanceHostel}
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(showAllPresent ? presentStudentsForSelectedHostel : presentStudentsForSelectedHostel.slice(0, 8)).map((log) => (
                              <div
                                key={log._id}
                                className="bg-white p-2 rounded-lg border border-blue-100 flex items-center gap-2 hover:shadow-sm transition-shadow"
                              >
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {getInitials(log.studentId?.name || "?")}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-bold text-gray-900 truncate">{log.studentId?.name || "Unknown"}</p>
                                  <p className="text-[9px] font-bold truncate">
                                    <span className="text-gray-900">{log.istTime}, {log.studentId?.roomNumber}, </span>
                                    <span className={`${(!log.location?.accuracy || log.location.accuracy < 50) ? "text-green-600" : "text-orange-500"}`}>
                                      {log.location?.accuracy ? Math.round(log.location.accuracy) : 0}m
                                    </span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {presentStudentsForSelectedHostel.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4 italic">No students present from this hostel</p>
                          )}
                          {presentStudentsForSelectedHostel.length > 8 && (
                            <div className="mt-4 flex justify-center">
                              <button
                                onClick={() => setShowAllPresent(!showAllPresent)}
                                className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                              >
                                {showAllPresent ? (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    See More ({presentStudentsForSelectedHostel.length - 8} more)
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Entry Logs Table */}
                      {!selectedAttendanceHostel && (
                        <div ref={entryLogsRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <div className="bg-filler px-1 py-1 flex border-b border-gray-200">
                            <p className="px-4 py-2 text-xs font-bold text-secondary uppercase tracking-widest">Entry Logs ({selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedDate})</p>
                          </div>
                          <div className="overflow-x-hidden">
                            <table className="w-full text-left table-fixed border-collapse">
                              <thead className="bg-[#fcfcfc] text-secondary font-bold uppercase text-[8px] md:text-[9px] border-b border-gray-100">
                                <tr>
                                  <th className="px-2 md:px-4 py-3 w-[50%] md:w-[35%]">Student</th>
                                  <th className="px-2 md:px-4 py-3 w-[25%] md:w-[25%] hidden md:table-cell">Hostel/Room</th>
                                  <th className="px-2 md:px-4 py-3 w-[25%] md:w-[12%] text-center">Time</th>
                                  <th className="px-2 md:px-4 py-3 w-[15%] md:w-[13%] text-center hidden md:table-cell">Face</th>
                                  <th className="px-2 md:px-4 py-3 w-[25%] md:w-[15%] text-right whitespace-nowrap">Dist / Acc</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {attendanceLogsLoading ? (
                                  <tr><td colSpan={4} className="px-4 py-12 text-center text-secondary italic text-xs">Refreshing database...</td></tr>
                                ) : filteredAttendanceLogs.length === 0 ? (
                                  <tr><td colSpan={4} className="px-4 py-12 text-center text-secondary italic text-xs">No entries found for {selectedDate === new Date().toISOString().split('T')[0] ? '9:00 PM onwards' : selectedDate}.</td></tr>
                                ) : (
                                  (showAllEntryLogs ? filteredAttendanceLogs : filteredAttendanceLogs.slice(0, 10)).map((log) => (
                                    <tr key={log._id} className="hover:bg-filler/50 transition-colors">
                                      <td className="px-2 md:px-4 py-3">
                                        <div className="flex flex-col min-w-0">
                                          <span className="font-bold text-gray-900 text-[9px] md:text-[13px] uppercase truncate tracking-tight">{log.studentId?.name || "Unknown"}</span>
                                          <div className="md:hidden flex items-center gap-1.5 mt-0.5">
                                            <span
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (log.faceMatchStatus === 'flagged') setReviewingLog(log);
                                              }}
                                              className={`text-[8px] font-bold uppercase truncate px-1 rounded-sm ${log.faceMatchStatus === 'flagged' ? 'bg-red-50 text-red-600 animate-pulse cursor-pointer' :
                                                log.faceMatchStatus === 'manual-override' ? 'bg-amber-50 text-amber-600' : 'text-gray-400'
                                                }`}
                                            >
                                              {log.studentId?.hostelName} - {log.studentId?.roomNumber}
                                              {log.faceMatchPercentage !== undefined && ` • ${log.faceMatchPercentage}% Match ${log.faceMatchStatus === 'flagged' ? '🚩' : ''}`}
                                            </span>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-2 md:px-4 py-3 text-secondary text-[9px] md:text-xs truncate hidden md:table-cell">
                                        {log.studentId?.hostelName} - {log.studentId?.roomNumber}
                                      </td>
                                      <td className="px-1 md:px-4 py-2 md:py-3 text-center">
                                        <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-black text-[9px] md:text-xs whitespace-nowrap">{log.istTime}</span>
                                      </td>
                                      <td className="px-1 md:px-4 py-2 md:py-3 text-center hidden md:table-cell">
                                        {log.faceMatchPercentage !== undefined ? (
                                          <button
                                            onClick={() => log.faceMatchStatus === 'flagged' && setReviewingLog(log)}
                                            disabled={log.faceMatchStatus !== 'flagged'}
                                            className={`px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-black transition-all ${log.faceMatchStatus === 'flagged'
                                              ? "bg-red-500 text-white animate-pulse cursor-pointer hover:bg-red-600 shadow-sm"
                                              : (log.faceMatchStatus === 'manual-override'
                                                ? "bg-amber-500 text-white"
                                                : "bg-green-100 text-green-700")
                                              }`}
                                          >
                                            {log.faceMatchPercentage}% {log.faceMatchStatus === 'flagged' && "🚩"}
                                          </button>
                                        ) : (
                                          <span className="text-[9px] text-gray-300 font-black">---</span>
                                        )}
                                      </td>
                                      <td className="px-2 md:px-4 py-3 text-right">
                                        <div className="flex flex-col items-end gap-0.5">
                                          {(() => {
                                            const hostel = hostelLocations.find(l => l.name.toLowerCase() === (getHostelCategory(log.studentId?.hostelName || "") || log.studentId?.hostelName || "").toLowerCase());
                                            if (hostel && log.location?.lat) {
                                              const dist = calculateDistance(log.location.lat, log.location.lng, hostel.lat, hostel.lng);
                                              return (
                                                <span className={`text-[9px] md:text-[10px] font-black ${dist < hostel.radius ? "text-blue-600" : "text-amber-600"}`}>
                                                  {Math.round(dist)}m away
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                          <span className={`text-[8px] md:text-[9px] font-bold ${log.location.accuracy < 50 ? "text-green-500" : "text-orange-400"}`}>
                                            Acc: {log.location.accuracy ? `${Math.round(log.location.accuracy)}m` : "N/A"}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          {!attendanceLogsLoading && filteredAttendanceLogs.length > 10 && (
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
                                    See More ({filteredAttendanceLogs.length - 10} more)
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Absentee List */}
                      <div ref={absenteesRef} className="bg-red-50/30 rounded-xl border border-red-100 p-4">
                        <h3 className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          {selectedDate === new Date().toISOString().split('T')[0] ? "Today's" : selectedDate} Absentee List ({displayedAbsentees.length} students)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {(showAllAbsentees ? displayedAbsentees : displayedAbsentees.slice(0, 9)).map(s => (
                            <div key={s.id} className="bg-white p-3 rounded-lg border border-red-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">
                                {getInitials(s.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-foreground truncate">{s.name}</p>
                                <p className="text-[8px] text-secondary truncate uppercase">{s.roomNumber} • {s.floorNumber || s.hostelName}</p>
                              </div>
                              <a href={`tel:${s.phoneNumber}`} className="ml-auto w-7 h-7 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              </a>
                            </div>
                          ))}
                        </div>
                        {displayedAbsentees.length > 9 && (
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
                                  See More ({displayedAbsentees.length - 9} more)
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Student History View */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          {/* Student Search */}
                          <div className="md:col-span-5 relative z-20">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">Search Student</label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Search anything... (name, phone, parent, district, room, etc.)"
                                value={attendanceHistorySearchQuery}
                                onChange={(e) => {
                                  setAttendanceHistorySearchQuery(e.target.value);
                                  if (e.target.value === "") setAttendanceHistoryStudentId("");
                                }}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm"
                              />
                              {attendanceHistoryStudentId && (
                                <button
                                  onClick={() => {
                                    setAttendanceHistoryStudentId("");
                                    setAttendanceHistorySearchQuery("");
                                    setAttendanceHistoryLogs([]);
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-100 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>

                            {attendanceHistorySearchQuery && !attendanceHistoryStudentId && (
                              <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 shadow-xl rounded-xl max-h-60 overflow-y-auto z-50">
                                {students
                                  .filter(s => s.name.toLowerCase().includes(attendanceHistorySearchQuery.toLowerCase()))
                                  .slice(0, 10)
                                  .map(s => (
                                    <button
                                      key={s.id}
                                      onClick={() => {
                                        setAttendanceHistoryStudentId(s.id);
                                        setAttendanceHistorySearchQuery(s.name);
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between items-center group"
                                    >
                                      <div>
                                        <p className="text-xs font-bold text-gray-800 group-hover:text-blue-600">{s.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{s.hostelName}</p>
                                      </div>
                                      <div className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 font-bold">{s.roomNumber}</div>
                                    </button>
                                  ))}
                                {students.filter(s => s.name.toLowerCase().includes(attendanceHistorySearchQuery.toLowerCase())).length === 0 && (
                                  <div className="p-4 text-center text-xs text-gray-400 italic">No students found</div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Date Range */}
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">From Date</label>
                            <input
                              type="date"
                              value={attendanceHistoryStartDate}
                              onChange={e => setAttendanceHistoryStartDate(e.target.value)}
                              className="w-full h-11 px-3 rounded-xl border border-gray-200 font-bold text-xs focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">To Date</label>
                            <input
                              type="date"
                              value={attendanceHistoryEndDate}
                              onChange={e => setAttendanceHistoryEndDate(e.target.value)}
                              className="w-full h-11 px-3 rounded-xl border border-gray-200 font-bold text-xs focus:border-blue-500 outline-none"
                            />
                          </div>

                          {/* Search Button */}
                          <div className="md:col-span-1">
                            <button
                              onClick={fetchStudentHistory}
                              disabled={!attendanceHistoryStudentId || attendanceHistoryLoading}
                              className="w-full h-11 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center disabled:opacity-50 disabled:shadow-none"
                            >
                              {attendanceHistoryLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* History Results */}
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                          <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Attendance History</p>
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{attendanceHistoryLogs.length} Records Found</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="text-[10px] uppercase text-gray-400 font-black bg-white border-b border-dashed border-gray-200">
                              <tr>
                                <th className="px-4 py-3">Date & Hostel</th>
                                <th className="px-4 py-3 text-center">Time</th>
                                <th className="px-4 py-3 hidden md:table-cell">Hostel Details</th>
                                <th className="px-4 py-3 text-right">Verification</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {attendanceHistoryLogs.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400 italic text-xs">
                                    {attendanceHistoryStudentId ? "No attendance records found for selected range" : "Select a student to view history"}
                                  </td>
                                </tr>
                              ) : (
                                attendanceHistoryLogs.map((log) => (
                                  <tr key={log._id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3">
                                      <p className="font-bold text-gray-800 text-xs">{new Date(log.date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                      <div className="md:hidden flex flex-col mt-0.5">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{log.hostelName}</p>
                                        <p className="text-[9px] text-gray-400 font-medium">ROOM {log.roomNumber}</p>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="inline-block px-1.5 py-0.5 bg-green-50 text-green-700 rounded-lg text-[10px] md:text-xs font-black border border-green-100 shadow-sm">
                                        {log.istTime}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                      <p className="text-xs font-bold text-gray-700">{log.hostelName}</p>
                                      <p className="text-[10px] text-gray-400 font-medium">Room {log.roomNumber}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex flex-col items-end gap-1">
                                        {log.faceMatchPercentage !== undefined && (
                                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${log.faceMatchStatus === 'flagged' ? 'bg-red-100 text-red-600' : (log.faceMatchStatus === 'manual-override' ? 'bg-amber-100 text-amber-600' : 'bg-green-50 text-green-600')}`}>
                                            Face: {log.faceMatchPercentage}%
                                          </span>
                                        )}
                                        {log.location?.accuracy ? (
                                          <span className={`text-[10px] font-black ${log.location.accuracy < 50 ? "text-green-600" : "text-amber-500"}`}>
                                            GPS: {Math.round(log.location.accuracy)}m
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-gray-400 font-medium">No GPS</span>
                                        )}
                                      </div>
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
                </div>
              )}
              {currentTab === 'settings' && !isWarden && (
                <FieldEnforcementComponent hostels={hostels.map(h => h.name)} />
              )}

              {currentTab === 'messaging' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{isWarden ? "Warden Messaging System" : "Dean Messaging System"}</h2>
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
                            onChange={(e: any) => {
                              const targetType = e.target.value;
                              setNewMessage({
                                ...newMessage,
                                targetType,
                                // Auto-set warden's hostel when they select "hostel" or "all"
                                targetHostel: (isWarden && wardenHostelName && (targetType === "hostel" || targetType === "all"))
                                  ? wardenHostelName
                                  : newMessage.targetHostel
                              });
                            }}
                            disabled={isWarden && authorizedHostels.length === 1}
                            className={`w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500 ${(isWarden && authorizedHostels.length === 1) ? 'opacity-70 cursor-not-allowed bg-gray-50' : ''}`}
                          >
                            {isWarden ? (
                              <>
                                <option value="hostel">
                                  {authorizedHostels.length > 1 ? "All Authorized Hostels" : `${authorizedHostels[0]} Students`}
                                </option>
                                {authorizedHostels.length > 1 && (
                                  <option value="specific_hostel">Specific Hostel</option>
                                )}
                              </>
                            ) : (
                              <>
                                <option value="all">All Students</option>
                                <option value="hostel">Specific Hostel</option>
                                <option value="individual">Individual Student</option>
                              </>
                            )}
                          </select>
                        </div>

                        {(newMessage.targetType === "hostel" || newMessage.targetType === "specific_hostel") && (
                          <div>
                            <label className="block text-xs font-bold text-secondary uppercase mb-2">Select Hostel</label>
                            <select
                              value={newMessage.targetHostel}
                              onChange={(e) => setNewMessage({ ...newMessage, targetHostel: e.target.value })}
                              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                              disabled={isWarden && newMessage.targetType === "hostel" && authorizedHostels.length === 1}
                            >
                              <option value="">Choose Hostel...</option>
                              {(isWarden ? authorizedHostels : hostels.map(h => h.name)).map((hName) => (
                                <option key={hName} value={hName}>
                                  {hName}
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

              {false && currentTab === 'payments' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Fee Payment Management</h2>
                      <p className="text-sm text-secondary">Verify student claims and reconcile with bank statements</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowBankSettingsModal(true)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        Bank Settings
                      </button>
                      <label className="cursor-pointer px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        {isReconciling ? "Processing..." : "Upload Bank CSV"}
                        <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleCSVUpload} disabled={isReconciling} onClick={(e: any) => e.target.value = null} />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input
                        type="text"
                        placeholder="Search Registration ID or UTR..."
                        value={paymentSearch}
                        onChange={(e) => setPaymentSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={paymentStatusFilter}
                      onChange={(e) => setPaymentStatusFilter(e.target.value)}
                      className="h-[42px] px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                      <option value="flagged">Flagged</option>
                    </select>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden font-outfit">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-secondary">
                          <tr>
                            <th className="px-4 py-4">Student Details</th>
                            <th className="px-4 py-4">UTR & Source</th>
                            <th className="px-4 py-4 text-center">Amount</th>
                            <th className="px-4 py-4 text-center">Status</th>
                            <th className="px-4 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 italic font-medium">
                          {paymentsLoading ? (
                            <tr>
                              <td colSpan={5} className="py-20 text-center text-secondary">Loading transactions...</td>
                            </tr>
                          ) : payments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-20 text-center text-secondary">No payment claims found</td>
                            </tr>
                          ) : (
                            payments.map((p) => (
                              <tr key={p._id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-4 py-4 min-w-[150px]">
                                  <div className="flex flex-col leading-tight">
                                    <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase">{p.studentId?.name || "Unknown"}</span>
                                    <span className="text-[10px] text-gray-500 font-bold">{p.registrationId}</span>
                                    <span className="text-[9px] text-gray-400 capitalize">{p.studentId?.hostelName} • {p.studentId?.roomNumber}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-mono text-xs font-bold text-gray-800">{p.utrNumber}</span>
                                    <span className="text-[10px] text-blue-600 font-black uppercase tracking-tight">{p.paymentSource}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className="font-black text-gray-900">₹{p.amount}</span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${p.status === 'verified' ? 'bg-green-100 text-green-700' :
                                    p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                      p.status === 'flagged' ? 'bg-orange-100 text-orange-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {p.status}
                                  </span>
                                  {p.reconciledViaCSV && (
                                    <div className="text-[8px] text-green-600 font-bold mt-1 uppercase">Reconciled via Bank</div>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex justify-end gap-2 text-xs">
                                    {p.status !== 'verified' && (
                                      <button
                                        onClick={() => handleManualPaymentAction(p._id, 'verified')}
                                        className="px-2.5 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-bold transition-all"
                                      >
                                        Verify
                                      </button>
                                    )}
                                    {p.status === 'pending' && (
                                      <button
                                        onClick={() => handleManualPaymentAction(p._id, 'rejected')}
                                        className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold transition-all"
                                      >
                                        Reject
                                      </button>
                                    )}
                                  </div>
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
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setShowAllStudents(false);
                      setSearchQuery(""); // Clear search when going back
                    }}
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
                  className="px-4 py-2 rounded-xl border border-solid border-gray-100 bg-white text-foreground text-[10px] font-black uppercase tracking-tight shadow-sm active:scale-95 transition-all flex items-center gap-2"
                >
                  LOGOUT
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
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
                    placeholder="Search anything... (name, phone, parent, district, room, etc.)"
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
                    <span className="text-[10px] opacity-90">{studentsLoading ? "..." : totalHostelStudents.length}</span>
                  </button>

                  {/* Move Guest House to second position in first row */}
                  {hostels.filter(h => {
                    const isGuest = h.name.toLowerCase().includes("guest");
                    if (isWarden && authorizedHostels.length > 0) {
                      return isGuest && authorizedHostels.some(ah => ah === h.name || ah.toLowerCase() === h.name.toLowerCase());
                    }
                    return isGuest;
                  }).map((h) => {
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
                    .filter(h => {
                      const isNotGuest = !h.name.toLowerCase().includes("guest");
                      if (isWarden && authorizedHostels.length > 0) {
                        return isNotGuest && authorizedHostels.some(ah => ah === h.name || ah.toLowerCase() === h.name.toLowerCase());
                      }
                      return isNotGuest;
                    })
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
                                      <h3 className="text-[11px] font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">{student.name}</h3>
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
                                    {student.floorNumber && (
                                      <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 whitespace-nowrap">
                                        {student.floorNumber}
                                      </span>
                                    )}
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

                    <div className="mt-4 flex flex-col items-center gap-2">
                      <button
                        onClick={() => handleToggleProfileLock(selectedStudent.id, !!selectedStudent.isProfileLocked)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm border ${selectedStudent.isProfileLocked
                          ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          }`}
                      >
                        {selectedStudent.isProfileLocked ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Locked (Click to Unlock)
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            Unlocked (Click to Lock)
                          </>
                        )}
                      </button>
                      {selectedStudent.isProfileLocked && (
                        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tight">Student cannot edit profile anymore</p>
                      )}
                    </div>

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
                      {selectedStudent.floorNumber && (
                        <p className="text-[10px] text-gray-500 mt-0.5 font-bold">Floor: <span className="text-gray-900">{selectedStudent.floorNumber}</span></p>
                      )}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowAttendanceModeSelector(!showAttendanceModeSelector)}
                      className="w-full h-full flex flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-2 rounded-xl border-2 border-indigo-600 text-indigo-600 font-bold transition-all hover:bg-indigo-50 text-[10px] sm:text-sm"
                    >
                      <span className="text-base sm:text-lg">
                        {(!selectedStudent.attendanceMode || selectedStudent.attendanceMode === 'default') ? '🛡️' :
                          selectedStudent.attendanceMode === 'gps-only' ? '📍' :
                            selectedStudent.attendanceMode === 'biometric' ? '👆' : '📸'}
                      </span>
                      <span className="leading-tight">
                        {(!selectedStudent.attendanceMode || selectedStudent.attendanceMode === 'default') ? 'Security' :
                          selectedStudent.attendanceMode === 'gps-only' ? 'GPS Only' :
                            selectedStudent.attendanceMode === 'biometric' ? 'Biometric' : 'Strict'}
                      </span>
                    </button>
                    {showAttendanceModeSelector && (
                      <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5 z-50 flex flex-col gap-1 animate-in zoom-in-95 duration-200 origin-bottom-left">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 py-1">Set Attendance Mode</div>
                        <button
                          onClick={() => handleUpdateAttendanceMode(selectedStudent.id, 'default')}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${(!selectedStudent.attendanceMode || selectedStudent.attendanceMode === 'default') ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'}`}
                        >
                          <span>🛡️</span> Default (Hostel)
                        </button>
                        <button
                          onClick={() => handleUpdateAttendanceMode(selectedStudent.id, 'gps-only')}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${selectedStudent.attendanceMode === 'gps-only' ? 'bg-amber-50 text-amber-700' : 'hover:bg-gray-50 text-gray-600'}`}
                        >
                          <span>📍</span> GPS Only
                        </button>
                        <button
                          onClick={() => handleUpdateAttendanceMode(selectedStudent.id, 'biometric')}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${selectedStudent.attendanceMode === 'biometric' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'}`}
                        >
                          <span>👆</span> Biometric
                        </button>
                        <button
                          onClick={() => handleUpdateAttendanceMode(selectedStudent.id, 'strict')}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${selectedStudent.attendanceMode === 'strict' ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50 text-gray-600'}`}
                        >
                          <span>📸</span> Camera (Strict)
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleResetDeviceID(selectedStudent.id)}
                    className="flex flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-2 rounded-xl border-2 border-amber-600 text-amber-600 font-bold transition-all hover:bg-amber-50 text-[10px] sm:text-sm"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="leading-tight">Reset Device ID</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditStudentForm({ ...selectedStudent });
                      setEditErrors({});
                      setShowEditStudentModal(true);
                    }}
                    className="flex flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-2 rounded-xl border-2 border-blue-600 text-blue-600 font-bold transition-all hover:bg-blue-50 text-[10px] sm:text-sm"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="leading-tight">Edit Details</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingStudentId === selectedStudent.id}
                    className="flex flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-2 rounded-xl bg-red-600 text-white font-bold transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] sm:text-sm shadow-lg shadow-red-100"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="leading-tight">Remove Student</span>
                  </button>
                </div>
              )}

              <div className="mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🛡️</span>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Secure Device Info</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Device Status</p>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${(selectedStudent.deviceId || (selectedStudent.webAuthnCredentials && selectedStudent.webAuthnCredentials.length > 0)) ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      <p className={`text-xs font-bold ${(selectedStudent.deviceId || (selectedStudent.webAuthnCredentials && selectedStudent.webAuthnCredentials.length > 0)) ? 'text-green-700' : 'text-red-700'}`}>
                        {(selectedStudent.deviceId || (selectedStudent.webAuthnCredentials && selectedStudent.webAuthnCredentials.length > 0)) ? 'Linked & Verified' : 'Not Registered'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Device Changes</p>
                    <p className="text-xs font-bold text-slate-700">
                      {selectedStudent.deviceResetCount || 0} Times Reset
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1 pt-1 border-t border-slate-200/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hardware ID Token</p>
                    <p className="text-[10px] font-medium text-slate-500 font-mono break-all line-clamp-1">
                      {selectedStudent.deviceId || (selectedStudent.webAuthnCredentials?.[0]?.credentialID) || 'No unique key saved in database'}
                    </p>
                  </div>

                  {selectedStudent.deviceHistory && selectedStudent.deviceHistory.length > 0 && (
                    <div className="col-span-2 space-y-2 mt-1 pt-2 border-t border-slate-200/50">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Device Log (Change History)</p>
                      <div className="max-h-32 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {selectedStudent.deviceHistory.map((history, idx) => (
                          <div key={idx} className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-sm flex flex-col gap-1 hover:border-blue-200 transition-colors">
                            <div className="flex items-center justify-between">
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${history.action === 'registered' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {history.action === 'registered' ? 'NEW LINK' : 'RESET LOG'}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400">
                                {new Date(history.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                            <p className="text-[9px] font-mono text-slate-600 break-all leading-tight">
                              <span className="text-slate-400 mr-1">{idx + 1}.</span> {history.deviceId}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
          <div className={`fixed inset-0 z-[60] flex items-center justify-center ${isLocationModalMaximized ? 'p-0' : 'p-4'} bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`}>
            <div className={`bg-white w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col transition-all duration-300 ${isLocationModalMaximized
              ? 'max-w-none h-screen rounded-none'
              : 'max-w-lg rounded-3xl max-h-[95vh]'
              }`}>
              <div className={`p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col ${isLocationModalMaximized ? 'p-0 md:p-0' : ''}`}>
                <div className={`flex items-center justify-between mb-2 md:mb-3 ${isLocationModalMaximized ? 'p-4 pb-2' : ''}`}>
                  <h3 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
                    {editingLocationIndex !== null ? "EDIT LOCATION" : "ADD NEW LOCATION"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowLocationModal(false);
                        setIsLocationModalMaximized(false);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                    >
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                {!isLocationModalMaximized && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-0.5 px-1">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Location Name</label>
                      <div className="flex items-center gap-3">
                        {isLocationChecking && (
                          <div className="flex flex-col items-end gap-1 animate-in fade-in slide-in-from-right-2">
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">
                              Signal: {gpsAccuracy ? `${gpsAccuracy}m` : '--'}
                            </span>
                            <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${lockProgress}%` }} />
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => getAccurateLocation('form')}
                          disabled={isLocationChecking}
                          className="h-8 md:h-9 px-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-70 group"
                        >
                          {isLocationChecking ? (
                            <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                            </svg>
                          )}
                          <span className="text-[10px] font-black uppercase tracking-wider">{isLocationChecking ? "Locking..." : "Get Location"}</span>
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={locationForm.name}
                      onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                      placeholder="e.g. Gangotri Hostel"
                      className="w-full h-10 md:h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                    />
                  </div>
                )}

                <div className={`w-full rounded-xl overflow-hidden border border-gray-200 relative z-0 flex-shrink-0 shadow-inner transition-all duration-300 ${isLocationModalMaximized ? 'flex-1 mb-0 h-auto rounded-none border-0' : 'h-[43vh] min-h-[300px]'
                  }`}>
                  <LocationPickerMap
                    lat={locationForm.lat}
                    lng={locationForm.lng}
                    radius={locationForm.radius}
                    zoom={mapZoom}
                    onMove={(lat, lng) => {
                      const roundedLat = parseFloat(lat.toFixed(8));
                      const roundedLng = parseFloat(lng.toFixed(8));
                      setLocationForm(prev => ({ ...prev, lat: roundedLat, lng: roundedLng }));
                    }}
                    isMeasuring={isMeasuring}
                    measurePoints={measurePoints}
                    onMeasure={(points, dist) => {
                      setMeasurePoints(points);
                      setMeasureDistance(dist);
                    }}
                    isMaximized={isLocationModalMaximized}
                  />

                  {/* Maximize/Minimize Toggle - Bottom Right Overlay */}
                  <div className="absolute bottom-3 right-3 z-[1000]">
                    <button
                      type="button"
                      onClick={() => setIsLocationModalMaximized(!isLocationModalMaximized)}
                      className="p-1.5 sm:p-3 bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-2xl shadow-xl border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white hover:scale-110 transition-all active:scale-95 flex items-center justify-center group"
                      title={isLocationModalMaximized ? "Minimize View" : "Full Screen Map"}
                    >
                      {isLocationModalMaximized ? (
                        <svg className="w-[14px] h-[14px] sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      ) : (
                        <svg className="w-[14px] h-[14px] sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      )}
                    </button>
                  </div>

                  {/* Measurement Controls Overlay */}
                  <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newMode = !isMeasuring;
                        setIsMeasuring(newMode);
                        if (!newMode) {
                          setMeasurePoints([]);
                          setMeasureDistance(null);
                        }
                      }}
                      className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg border transition-all flex items-center justify-center ${isMeasuring
                        ? "bg-red-600 border-red-500 text-white scale-110"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      title={isMeasuring ? "Stop Measuring" : "Measure Distance"}
                    >
                      {isMeasuring ? (
                        <svg className="w-[14px] h-[14px] sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="w-[14px] h-[14px] sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {isMeasuring && measureDistance !== null && (
                    <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm px-2 py-1 sm:px-4 sm:py-2 rounded-[14px] sm:rounded-2xl shadow-xl border border-blue-100 flex items-center gap-1.5 sm:gap-3 animate-in slide-in-from-bottom-2 duration-300 max-w-[calc(100%-60px)] sm:max-w-none">
                      <div className="flex flex-col">
                        <span className="text-[7px] sm:text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">Measured Distance</span>
                        <span className="text-[10px] sm:text-sm font-black text-gray-900 leading-tight">
                          {measureDistance > 999
                            ? `${(measureDistance / 1000).toFixed(3)} kms`
                            : `${Math.round(measureDistance)} meters`}
                        </span>
                      </div>
                      <div className="w-px h-6 sm:h-8 bg-gray-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setLocationForm(prev => ({ ...prev, radius: Math.round(measureDistance) }));
                          setIsMeasuring(false);
                          setMeasurePoints([]);
                          setMeasureDistance(null);
                        }}
                        className="bg-blue-600 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[8px] sm:text-xs font-black uppercase tracking-tight hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Use as Radius
                      </button>
                    </div>
                  )}

                  {isMeasuring && measurePoints.length > 0 && measurePoints.length < 2 && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest animate-pulse">
                      Click another point to measure
                    </div>
                  )}
                </div>

                {!isLocationModalMaximized && (
                  <>
                    <div className="grid grid-cols-2 gap-3 md:gap-4 mt-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 px-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={locationForm.lat === 0 ? "" : locationForm.lat.toString()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              setLocationForm({ ...locationForm, lat: 0 });
                            } else {
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed)) {
                                setLocationForm({ ...locationForm, lat: parseFloat(parsed.toFixed(8)) });
                              }
                            }
                          }}
                          className="w-full h-10 md:h-12 px-3 md:px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 px-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={locationForm.lng === 0 ? "" : locationForm.lng.toString()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              setLocationForm({ ...locationForm, lng: 0 });
                            } else {
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed)) {
                                setLocationForm({ ...locationForm, lng: parseFloat(parsed.toFixed(8)) });
                              }
                            }
                          }}
                          className="w-full h-10 md:h-12 px-3 md:px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 px-1">Radius (meters)</label>
                      <input
                        type="number"
                        value={locationForm.radius}
                        onChange={(e) => setLocationForm({ ...locationForm, radius: parseInt(e.target.value) })}
                        className="w-full h-10 md:h-12 px-4 rounded-xl border border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-800 text-sm"
                      />
                    </div>
                  </>
                )}

                <div className={`pt-4 flex gap-3 pb-safe ${isLocationModalMaximized ? 'mt-auto' : ''}`}>
                  <button
                    onClick={() => {
                      setShowLocationModal(false);
                      setIsLocationModalMaximized(false);
                    }}
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
        )
      }

      {
        showEditStudentModal && (
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
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 px-1">Permanent Address </label>
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
        )
      }

      {
        zoomedImage && (
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
        )
      }

      {/* Face Verification Review Modal */}
      {reviewingLog && (
        <div className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Review Flagged Face Match</h3>
                <p className="text-xs text-red-500 font-bold uppercase tracking-widest mt-1">Found only {reviewingLog.faceMatchPercentage}% match</p>
              </div>
              <button
                onClick={() => setReviewingLog(null)}
                className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Profile Photo */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Profile Photo</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase">Registered</span>
                  </div>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-200 shadow-inner">
                    {students.find(s => s.id === reviewingLog.studentId?._id)?.profilePicture ? (
                      <img
                        src={students.find(s => s.id === reviewingLog.studentId?._id)?.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">No Photo</div>
                    )}
                  </div>
                  <p className="text-center font-bold text-sm text-gray-900">{reviewingLog.studentId?.name}</p>
                </div>

                {/* Flagged Photo */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Attendance Photo</span>
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-black uppercase">Suspicious</span>
                  </div>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 border-red-200 shadow-xl shadow-red-100/50">
                    {reviewingLog.flaggedPhotoUrl ? (
                      <img
                        src={reviewingLog.flaggedPhotoUrl}
                        alt="Flagged"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">No Photo Saved</div>
                    )}
                  </div>
                  <p className="text-center font-bold text-sm text-red-600">{reviewingLog.istTime} @ {reviewingLog.studentId?.hostelName}</p>
                </div>
              </div>

              <div className="mt-8 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">Review Decision Required</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      This entry was flagged because the face matching score ({reviewingLog.faceMatchPercentage}%) fell below the 70% confidence threshold. Please verify if the person in the attendance photo is indeed <strong>{reviewingLog.studentId?.name}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-4">
              <button
                onClick={() => setReviewingLog(null)}
                className="flex-1 py-4 rounded-2xl border border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-100 transition-all shadow-sm"
              >
                Close Review
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Are you sure you want to manually approve this attendance?")) return;
                  try {
                    const res = await fetch("/api/admin/attendance/verify", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        attendanceId: reviewingLog._id,
                        status: "manual-override"
                      })
                    });
                    if (res.ok) {
                      alert("Attendance approved manually.");
                      setReviewingLog(null);
                      fetchAttendanceLogs();
                    }
                  } catch (e) {
                    alert("Verification failed");
                  }
                }}
                className="flex-[2] py-4 rounded-2xl bg-green-600 text-white font-black hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Approve Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Time Settings Modal */}
      {
        showAttendanceTimeModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  ⏰ SET ATTENDANCE TIME
                </h3>
                <button
                  onClick={() => setShowAttendanceTimeModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={attendanceTimeSettings.startTime}
                    onChange={(e) => setAttendanceTimeSettings({ ...attendanceTimeSettings, startTime: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:ring-4 focus:ring-green-500/20 focus:border-green-500 font-bold text-lg transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={attendanceTimeSettings.endTime}
                    onChange={(e) => setAttendanceTimeSettings({ ...attendanceTimeSettings, endTime: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:ring-4 focus:ring-green-500/20 focus:border-green-500 font-bold text-lg transition-all"
                  />
                </div>

                <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    📌 Students will be able to mark attendance between:
                  </p>
                  <p className="font-black text-lg text-green-900">
                    {attendanceTimeSettings.startTime} to {attendanceTimeSettings.endTime}
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowAttendanceTimeModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAttendanceTime}
                    disabled={isUpdatingAttendanceTime}
                    className="flex-[2] px-4 py-3 rounded-xl bg-green-600 text-white font-black hover:bg-green-700 transition-colors disabled:opacity-50 shadow-lg shadow-green-200"
                  >
                    {isUpdatingAttendanceTime ? "SAVING..." : "SAVE TIME"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        showPasswordResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl transition-all duration-300 scale-100 p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                  Change Password
                </h2>
                <button
                  onClick={() => setShowPasswordResetModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-500 font-medium mb-6">
                Select the account you want to reset the password for:
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => handleResetPassword("dean")}
                  disabled={isUpdatingPassword}
                  className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-100 rounded-2xl transition-all group active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="font-black text-blue-900 uppercase text-sm tracking-tight">Dean Account</p>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Main Admin Access</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-blue-300 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>

                <button
                  onClick={() => handleResetPassword("warden")}
                  disabled={isUpdatingPassword}
                  className="w-full flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-100 rounded-2xl transition-all group active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:-rotate-6 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="font-black text-indigo-900 uppercase text-sm tracking-tight">Warden Account</p>
                      <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Hostel Management</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <button
                onClick={() => setShowPasswordResetModal(false)}
                className="w-full mt-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }
      {
        showSystemSettingsModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="p-5 sm:p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="p-2 sm:p-3 bg-indigo-600 text-white rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-100 text-lg sm:text-2xl">🛠️</span>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-black text-gray-900 uppercase tracking-tight">
                      System Settings
                    </h2>
                    <p className="text-[9px] sm:text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-widest">Config Wardens, Rooms & Forms</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSystemSettingsModal(false)}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl hover:bg-white hover:shadow-xl hover:scale-110 flex items-center justify-center transition-all bg-gray-100 text-gray-500"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex p-1.5 bg-slate-100/50 gap-1 mx-2 sm:mx-8 mt-4 sm:mt-6 rounded-2xl border border-slate-200/50">
                {[
                  { id: "rooms", label: "Rooms", icon: "🏠" },
                  { id: "form", label: "Form", icon: "📝" },
                  { id: "password", label: "Pass", icon: "🔑" },
                  { id: "system", label: "System", icon: "⚙️" },
                  { id: "audit", label: "Audit", icon: "🔍" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSettingsTab(tab.id as any)}
                    className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 ${activeSettingsTab === tab.id
                      ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50"
                      : "text-slate-400 hover:text-slate-600"
                      }`}
                  >
                    <span className="text-sm sm:text-lg mb-0.5">{tab.icon}</span>
                    <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-tighter sm:tracking-widest">
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">

                {activeSettingsTab === "rooms" && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 border-2 border-amber-100 p-4 rounded-2xl flex items-start gap-4 mb-8">
                      <span className="text-xl sm:text-2xl">🔢</span>
                      <p className="text-xs sm:text-sm text-amber-800 font-medium">
                        Manage the total room capacity for each hostel. Students cannot register for rooms beyond this limit.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {hostelsConfig.map((hostel) => (
                        <div key={hostel._id} className="p-6 rounded-3xl border-2 border-gray-100 bg-gray-50/30 flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-4">
                            <h4 className="font-black text-gray-900 uppercase tracking-tight truncate">{hostel.name}</h4>
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">Total Rooms</p>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4 bg-white px-3 sm:px-4 py-2 rounded-2xl border-2 border-gray-100 shadow-sm focus-within:border-indigo-400 transition-all shrink-0">
                            <input
                              type="number"
                              defaultValue={hostel.totalRooms || 0}
                              placeholder="0"
                              onBlur={(e) => {
                                const newVal = parseInt(e.target.value);
                                if (!isNaN(newVal)) {
                                  handleUpdateHostelConfig({ ...hostel, id: hostel._id, totalRooms: newVal });
                                }
                              }}
                              className="w-16 sm:w-24 text-center font-black text-lg sm:text-xl text-gray-900 bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSettingsTab === "form" && (
                  <div className="space-y-6 pb-8">
                    <div className="bg-purple-50 border-2 border-purple-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6">
                      <div className="flex items-start gap-4 flex-1 w-full">
                        <span className="text-xl sm:text-2xl mt-1">⚡</span>
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm text-purple-800 font-bold uppercase tracking-tight">Form Builder Mode</p>
                          <p className="text-[10px] sm:text-xs text-purple-600 font-medium mt-1">
                            Customize your registration form. Add new fields or edit existing ones. Changes are instantly visible to students.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto sm:shrink-0 grid grid-cols-2 sm:flex">
                        <button
                          onClick={() => {
                            if (formBuilderFields.length > 0 && !confirm("This will replace your current form configuration with the 20+ standard registration fields. Continue?")) return;
                            const defaults = [
                              { id: "profilePicture", label: "Profile Photo", type: "image", required: true, visible: true, section: "Personal" },
                              { id: "name", label: "Full Name", type: "text", required: true, visible: true, section: "Personal" },
                              { id: "phoneNumber", label: "Phone Number", type: "tel", required: true, visible: true, section: "Personal" },
                              { id: "dob", label: "Date of Birth", type: "date", required: true, visible: true, section: "Personal" },
                              { id: "category", label: "Social Category", type: "select", options: ["GENERAL", "OBC", "SC", "ST"], required: true, visible: true, section: "Personal" },
                              { id: "erpInformation", label: "ERP ID", type: "text", required: true, visible: true, section: "Academic" },
                              { id: "collegeName", label: "College Name", type: "select", options: ["OIST", "OCT", "OCP", "OPM", "OIPR"], required: true, visible: true, section: "Academic" },
                              { id: "branch", label: "Branch", type: "select", options: ["CS", "AIML", "DS", "ME", "CE", "EC", "IT", "EX", "MCA", "B PHARMA", "D PHARMA", "MBA", "MTECH", "M PHARMA", "CSBS", "CYBER SECURITY"], required: true, visible: true, section: "Academic" },
                              { id: "year", label: "Current Year", type: "select", options: ["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR"], required: true, visible: true, section: "Academic" },
                              { id: "semester", label: "Semester", type: "select", options: ["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"], required: true, visible: true, section: "Academic" },
                              { id: "section", label: "Section", type: "select", options: ["A", "B", "C", "D", "E", "F"], required: true, visible: true, section: "Academic" },
                              { id: "fatherName", label: "Father's Name", type: "text", required: true, visible: true, section: "Guardian" },
                              { id: "fatherNumber", label: "Father's Phone No", type: "tel", required: true, visible: true, section: "Guardian" },
                              { id: "motherName", label: "Mother's Name", type: "text", required: true, visible: true, section: "Guardian" },
                              { id: "motherNumber", label: "Mother's Phone No", type: "tel", required: true, visible: true, section: "Guardian" },
                              { id: "localGuardianAddress", label: "Local Guardian Address", type: "textarea", required: false, visible: true, section: "Guardian" },
                              { id: "localGuardianPhoneNumber", label: "Local Guardian Phone", type: "tel", required: false, visible: true, section: "Guardian" },
                              { id: "homeState", label: "Home State", type: "select", options: ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"], required: true, visible: true, section: "Address" },
                              { id: "homePinCode", label: "Permanent Address", type: "textarea", required: true, visible: true, section: "Address" },
                              { id: "hostelName", label: "Hostel Name", type: "select", options: hostels.map(h => h.name), required: true, visible: true, section: "Registration" },
                              { id: "floorNumber", label: "Floor Number", type: "select", options: ["GND FLOOR", "1ST FLOOR", "2ND FLOOR", "3RD FLOOR", "4TH FLOOR"], required: true, visible: true, section: "Registration" },
                              { id: "roomNumber", label: "Room Number", type: "text", required: true, visible: true, section: "Registration" },
                              { id: "joiningDate", label: "Joining Date", type: "date", required: true, visible: true, section: "Registration" }
                            ];
                            handleUpdateFormBuilder(defaults);
                          }}
                          className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-200 transition-all shadow-sm w-full sm:w-auto"
                        >
                          🔄 Load Form
                        </button>
                        <button
                          onClick={() => {
                            const newField = {
                              id: `custom_${Date.now()}`,
                              label: "New Field",
                              type: "text",
                              required: false,
                              visible: true,
                              section: "Other"
                            };
                            handleUpdateFormBuilder([...formBuilderFields, newField]);
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 w-full sm:w-auto"
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {formBuilderFields.length === 0 ? (
                        <div className="py-12 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
                          <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-4">Form is empty</p>
                          <button
                            onClick={() => {
                              const defaults = [
                                { id: "name", label: "Full Name", type: "text", required: true, visible: true, section: "Personal" },
                                { id: "phoneNumber", label: "Phone Number", type: "tel", required: true, visible: true, section: "Personal" },
                                { id: "dob", label: "Date of Birth", type: "date", required: true, visible: true, section: "Personal" },
                                { id: "category", label: "Social Category", type: "select", options: ["GENERAL", "OBC", "SC", "ST"], required: true, visible: true, section: "Personal" },
                                { id: "erpInformation", label: "ERP ID", type: "text", required: true, visible: true, section: "Academic" },
                                { id: "collegeName", label: "College Name", type: "select", options: ["OIST", "OCT", "OCP", "OPM", "OIPR"], required: true, visible: true, section: "Academic" },
                                { id: "branch", label: "Branch", type: "select", options: ["CS", "AIML", "DS", "ME", "CE", "EC", "IT", "EX", "MCA", "B PHARMA", "D PHARMA", "MBA", "MTECH", "M PHARMA", "CSBS", "CYBER SECURITY"], required: true, visible: true, section: "Academic" },
                                { id: "year", label: "Current Year", type: "select", options: ["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR"], required: true, visible: true, section: "Academic" },
                                { id: "semester", label: "Semester", type: "select", options: ["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"], required: true, visible: true, section: "Academic" },
                                { id: "section", label: "Section", type: "select", options: ["A", "B", "C", "D", "E", "F"], required: true, visible: true, section: "Academic" },
                                { id: "fatherName", label: "Father's Name", type: "text", required: true, visible: true, section: "Guardian" },
                                { id: "fatherNumber", label: "Father's Phone No", type: "tel", required: true, visible: true, section: "Guardian" },
                                { id: "motherName", label: "Mother's Name", type: "text", required: true, visible: true, section: "Guardian" },
                                { id: "motherNumber", label: "Mother's Phone No", type: "tel", required: true, visible: true, section: "Guardian" },
                                { id: "localGuardianAddress", label: "Local Guardian Address", type: "textarea", required: false, visible: true, section: "Guardian" },
                                { id: "localGuardianPhoneNumber", label: "Local Guardian Phone", type: "tel", required: false, visible: true, section: "Guardian" },
                                { id: "homeState", label: "Home State", type: "select", options: ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"], required: true, visible: true, section: "Address" },
                                { id: "homePinCode", label: "Permanent Address", type: "textarea", required: true, visible: true, section: "Address" },
                                { id: "hostelName", label: "Hostel Name", type: "select", options: hostels.map(h => h.name), required: true, visible: true, section: "Registration" },
                                { id: "floorNumber", label: "Floor Number", type: "select", options: ["GND FLOOR", "1ST FLOOR", "2ND FLOOR", "3RD FLOOR", "4TH FLOOR"], required: true, visible: true, section: "Registration" },
                                { id: "roomNumber", label: "Room Number", type: "text", required: true, visible: true, section: "Registration" },
                                { id: "joiningDate", label: "Joining Date", type: "date", required: true, visible: true, section: "Registration" }
                              ];
                              handleUpdateFormBuilder(defaults);
                            }}
                            className="text-purple-600 font-black text-xs uppercase tracking-widest hover:underline"
                          >
                            Load Standard Fields
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
                          {formBuilderFields.map((field, index) => (
                            <div key={field.id} className="group bg-white p-3 rounded-2xl border-2 border-gray-100 hover:border-purple-200 transition-all shadow-sm hover:shadow-lg relative">
                              <div className="flex gap-3 items-start">
                                {/* Field Grip/Order (Simulated) */}
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <button
                                    disabled={index === 0}
                                    onClick={() => {
                                      const updated = [...formBuilderFields];
                                      [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-10 transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                                  </button>
                                  <button
                                    disabled={index === formBuilderFields.length - 1}
                                    onClick={() => {
                                      const updated = [...formBuilderFields];
                                      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-10 transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                  </button>
                                </div>

                                {/* Label Editor */}
                                <div className="flex-1 min-w-0">
                                  <input
                                    type="text"
                                    value={field.label}
                                    onChange={(e) => {
                                      const updated = [...formBuilderFields];
                                      updated[index] = { ...updated[index], label: e.target.value };
                                      setFormBuilderFields(updated);
                                    }}
                                    onBlur={(e) => {
                                      // Trigger modal only on blur (finish editing)
                                      const updated = [...formBuilderFields];
                                      updated[index] = { ...updated[index], label: e.target.value };
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-[11px] font-black text-gray-900 placeholder:text-gray-300 uppercase tracking-tight"
                                    placeholder="Enter Field Label"
                                  />
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{field.type}</span>
                                    <span className="w-0.5 h-0.5 rounded-full bg-gray-200"></span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{field.section || "DEFAULT"}</span>
                                  </div>
                                </div>

                                {/* Configuration Toggles */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      const updated = [...formBuilderFields];
                                      updated[index].visible = !updated[index].visible;
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all ${field.visible
                                      ? "bg-green-500 text-white shadow-sm"
                                      : "bg-gray-100 text-gray-400"
                                      }`}
                                  >
                                    {field.visible ? "VISIBLE" : "HIDDEN"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updated = [...formBuilderFields];
                                      updated[index].required = !updated[index].required;
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all ${field.required
                                      ? "bg-amber-500 text-white shadow-sm"
                                      : "bg-gray-100 text-gray-400"
                                      }`}
                                  >
                                    {field.required ? "REQUIRED" : "OPTIONAL"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      const duplicatedField = {
                                        ...field,
                                        id: `${field.id}_copy_${Date.now()}`,
                                        label: `${field.label} (Copy)`
                                      };
                                      const updated = [...formBuilderFields];
                                      updated.splice(index + 1, 0, duplicatedField);
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    title="Duplicate Field"
                                    className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete field "${field.label}"?`)) {
                                        const updated = formBuilderFields.filter((_, i) => i !== index);
                                        handleUpdateFormBuilder(updated);
                                      }
                                    }}
                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </div>

                              {/* Additional Settings */}
                              <div className="mt-2 pt-2 border-t border-gray-50 flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Type:</label>
                                  <select
                                    value={field.type}
                                    onChange={(e) => {
                                      const updated = [...formBuilderFields];
                                      updated[index].type = e.target.value;
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    className="text-[8px] font-bold bg-transparent border-none p-0 focus:ring-0 text-purple-600 uppercase"
                                  >
                                    <option value="text">Short Text</option>
                                    <option value="textarea">Long Text</option>
                                    <option value="select">Dropdown</option>
                                    <option value="date">Date Picker</option>
                                    <option value="tel">Phone No</option>
                                    <option value="image">Profile Photo/Image</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Section:</label>
                                  <select
                                    value={field.section || "DEFAULT"}
                                    onChange={(e) => {
                                      const updated = [...formBuilderFields];
                                      updated[index].section = e.target.value;
                                      handleUpdateFormBuilder(updated);
                                    }}
                                    className="text-[8px] font-bold bg-transparent border-none p-0 focus:ring-0 text-indigo-600 uppercase"
                                  >
                                    <option value="Personal">Personal</option>
                                    <option value="Academic">Academic</option>
                                    <option value="Guardian">Guardian</option>
                                    <option value="Address">Address</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </div>
                                {field.type === "select" && (
                                  <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-md">
                                    <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Options:</span>
                                    <button
                                      onClick={() => {
                                        const currentOptions = field.options?.join(", ") || "";
                                        const opt = prompt("Enter options separated by comma:", currentOptions);
                                        if (opt !== null) {
                                          const updated = [...formBuilderFields];
                                          updated[index].options = opt.split(",").map(o => o.trim()).filter(o => o !== "");
                                          handleUpdateFormBuilder(updated);
                                        }
                                      }}
                                      className="text-[8px] font-black text-blue-600 uppercase hover:underline"
                                    >
                                      {field.options?.length || 0} EDIT
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSettingsTab === "system" && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl flex items-start gap-4 mb-4">
                      <span className="text-xl sm:text-2xl">⚙️</span>
                      <p className="text-xs sm:text-sm text-slate-800 font-medium">
                        Global system controls. Manage student access and payments here.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <button
                        onClick={() => handleBulkProfileLock(true)}
                        disabled={isUpdatingSettings}
                        className="flex flex-col items-center justify-center gap-2 p-3 sm:p-6 bg-red-50 text-red-700 border-2 border-red-100 rounded-2xl hover:bg-red-100 transition-all font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-sm hover:shadow-lg disabled:opacity-50 group text-center"
                      >
                        <div className="p-2 sm:p-3 bg-red-200 rounded-full text-red-700 group-hover:scale-110 transition-transform shadow-sm">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        Lock All Profiles
                        <span className="text-[7px] sm:text-[9px] text-red-500/70 font-bold normal-case block mt-0.5 sm:mt-1">Prevents all students from editing their profiles</span>
                      </button>
                      <button
                        onClick={() => handleBulkProfileLock(false)}
                        disabled={isUpdatingSettings}
                        className="flex flex-col items-center justify-center gap-2 p-3 sm:p-6 bg-blue-50 text-blue-700 border-2 border-blue-100 rounded-2xl hover:bg-blue-100 transition-all font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-sm hover:shadow-lg disabled:opacity-50 group text-center"
                      >
                        <div className="p-2 sm:p-3 bg-blue-200 rounded-full text-blue-700 group-hover:scale-110 transition-transform shadow-sm">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                        </div>
                        Unlock All Profiles
                        <span className="text-[7px] sm:text-[9px] text-blue-500/70 font-bold normal-case block mt-0.5 sm:mt-1">Allows students to update their details</span>
                      </button>
                    </div>

                    <div className="w-full h-0.5 bg-gray-100/50 my-2"></div>

                    {/* ⚡ NEW: Developer Settings Toggles */}
                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between shadow-sm hover:border-indigo-100 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Slightly Overlap the Radii</h3>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-tight">Accounts for GPS Jitter (+20m offset)</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={overlapRadius}
                            onChange={(e) => handleToggleDeveloperSetting('overlapRadius', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between shadow-sm hover:border-purple-100 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Filter the List</h3>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-tight">Prioritize student's assigned hostel</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={prioritizeAssignedHostel}
                            onChange={(e) => handleToggleDeveloperSetting('prioritizeAssignedHostel', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="w-full h-0.5 bg-gray-100 my-6"></div>

                    <div className="bg-indigo-50 border-2 border-indigo-100 p-4 rounded-2xl flex items-start gap-4 mb-4">
                      <span className="text-xl sm:text-2xl">💰</span>
                      <p className="text-xs sm:text-sm text-indigo-800 font-medium">
                        Configure university bank details and payment settings. Enable students to make payments directly.
                      </p>
                    </div>

                    {/* Global Payment Toggle */}
                    <div className="bg-white p-4 rounded-2xl border-2 border-indigo-100 flex items-center justify-between shadow-sm">
                      <div>
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Enable Student Payments</h3>
                        <p className="text-xs text-indigo-700/80 font-medium mt-0.5">Allow students to view payment details and make transactions</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bankFormData.isPaymentEnabled}
                          onChange={(e) => {
                            const updated = { ...bankFormData, isPaymentEnabled: e.target.checked };
                            setBankFormData(updated);
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Name</label>
                        <input
                          type="text"
                          value={bankFormData.accountName}
                          onChange={(e) => setBankFormData({ ...bankFormData, accountName: e.target.value })}
                          className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                          placeholder="e.g. ORIENTAL INSTITUTE OF SCIENCE"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Number</label>
                        <input
                          type="text"
                          value={bankFormData.accountNumber}
                          onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                          className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                          placeholder="000000000000"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">IFSC Code</label>
                        <input
                          type="text"
                          value={bankFormData.ifscCode}
                          onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value })}
                          className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                          placeholder="SYNB0000..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bank Name</label>
                        <input
                          type="text"
                          value={bankFormData.bankName}
                          onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                          className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                          placeholder="Canara Bank"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">UPI ID (Optional)</label>
                        <input
                          type="text"
                          value={bankFormData.upiId}
                          onChange={(e) => setBankFormData({ ...bankFormData, upiId: e.target.value })}
                          className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                          placeholder="university@upi"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hostel Fee (₹)</label>
                        <input
                          type="number"
                          value={bankFormData.feeAmount}
                          onChange={(e) => setBankFormData({ ...bankFormData, feeAmount: Number(e.target.value) })}
                          className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                          placeholder="45000"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Instructions for Students</label>
                      <textarea
                        value={bankFormData.instructions}
                        onChange={(e) => setBankFormData({ ...bankFormData, instructions: e.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none min-h-[80px]"
                        placeholder="Enter step-by-step payment instructions..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center block mb-2">Upload QR Image (Required for Scan & Pay)</label>
                      <div
                        className="relative group cursor-pointer"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files[0];
                          if (file && file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onloadend = () => setBankFormData({ ...bankFormData, qrImage: reader.result as string });
                            reader.readAsDataURL(file);
                          }
                        }}
                        onPaste={(e) => {
                          const item = e.clipboardData.items[0];
                          if (item?.type.startsWith('image/')) {
                            const file = item.getAsFile();
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setBankFormData({ ...bankFormData, qrImage: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }
                        }}
                      >
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 transition-all group-hover:shadow-lg shadow-indigo-100/50">
                          {bankFormData.qrImage ? (
                            <div className="relative group/img">
                              <img src={bankFormData.qrImage} alt="QR Preview" className="h-40 w-40 object-contain rounded-lg" />
                              <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                <p className="text-white text-[10px] font-black">CHANGE IMAGE</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                              </div>
                              <p className="mb-2 text-sm text-gray-700 font-bold">Click to upload or <span className="text-indigo-600">Paste (Ctrl+V)</span></p>
                              <p className="text-xs text-secondary italic">PNG, JPG or SVG (Max 2MB)</p>
                            </div>
                          )}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setBankFormData({ ...bankFormData, qrImage: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                        {bankFormData.qrImage && (
                          <button
                            onClick={(e) => { e.preventDefault(); setBankFormData({ ...bankFormData, qrImage: "" }); }}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        onClick={handleUpdateBankSettings}
                        className="px-8 py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                      >
                        Update Bank Configuration
                      </button>
                    </div>
                  </div>
                )}

                {activeSettingsTab === "audit" && (
                  <div className="space-y-6">
                    <div className="bg-orange-50 border-2 border-orange-100 p-4 rounded-2xl flex items-start gap-4 mb-4">
                      <span className="text-xl sm:text-2xl">🔍</span>
                      <p className="text-xs sm:text-sm text-orange-800 font-medium">
                        Analyze your student data to find duplicates, invalid entries, and keyboard-mashed names.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <button
                        onClick={() => handleAudit("duplicates-phone")}
                        disabled={isAuditing}
                        className="p-3 sm:p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-500 hover:shadow-xl transition-all group flex flex-col items-center text-center gap-2 sm:gap-3"
                      >
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <span className="text-[7px] sm:text-xs font-black uppercase tracking-tight sm:tracking-widest text-slate-900">Duplicate Phones</span>
                      </button>

                      <button
                        onClick={() => handleAudit("duplicates-regid")}
                        disabled={isAuditing}
                        className="p-3 sm:p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-purple-500 hover:shadow-xl transition-all group flex flex-col items-center text-center gap-2 sm:gap-3"
                      >
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h4m-7 6h6m-6 3h6m-6 3h6" /></svg>
                        </div>
                        <span className="text-[7px] sm:text-xs font-black uppercase tracking-tight sm:tracking-widest text-slate-900">Duplicate Reg IDs</span>
                      </button>

                      <button
                        onClick={() => handleAudit("gibberish-names")}
                        disabled={isAuditing}
                        className="p-3 sm:p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-orange-500 hover:shadow-xl transition-all group flex flex-col items-center text-center gap-2 sm:gap-3"
                      >
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <span className="text-[7px] sm:text-xs font-black uppercase tracking-tight sm:tracking-widest text-slate-900">Invalid Names</span>
                      </button>
                    </div>

                    {isAuditing && (
                      <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Running Deep Scan...</p>
                      </div>
                    )}

                    {!isAuditing && auditResults.length > 0 && (
                      <div className="mt-8 space-y-4">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest px-1">Potential Issues Found ({auditResults.length})</h4>
                        <div className="space-y-3">
                          {auditResults.map((result, idx) => (
                            <div key={idx} className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 overflow-hidden">
                              {result.students ? (
                                <div>
                                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                    <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest">Duplicate: {result._id}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{result.count} ENTRIES</span>
                                  </div>
                                  <div className="space-y-2">
                                    {result.students.map((s: any, sIdx: number) => (
                                      <div key={sIdx} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all">
                                        <div className="min-w-0">
                                          <p className="text-xs font-black text-slate-800 uppercase truncate">{s.name}</p>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{s.hostel} • {s.regId || s.phone || s.id.slice(-6)}</p>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const student = students.find(std => std.id === s.id);
                                            if (student) {
                                              setSelectedStudent(student);
                                              setShowSystemSettingsModal(false);
                                            } else {
                                              setShowSystemSettingsModal(false);
                                              setSearchQuery(s.name);
                                            }
                                          }}
                                          className="text-[9px] font-black text-indigo-600 uppercase hover:underline shrink-0 ml-4"
                                        >
                                          View Info
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-red-600 uppercase truncate">{result.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{result.hostelName} • {result.phoneNumber}</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const studentId = result.id || result._id;
                                      const student = students.find(std => std.id === studentId);
                                      if (student) {
                                        setSelectedStudent(student);
                                        setShowSystemSettingsModal(false);
                                      } else {
                                        setShowSystemSettingsModal(false);
                                        setSearchQuery(result.name);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                                  >
                                    Review Entry
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isAuditing && auditResults.length === 0 && activeAuditType && (
                      <div className="py-12 text-center">
                        <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-widest">No issues found!</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">Your data looks clean for this category.</p>
                      </div>
                    )}
                  </div>
                )}
                {activeSettingsTab === "password" && (
                  <div className="space-y-12">
                    {/* 1. Admin Password Section */}
                    <div className="space-y-6">
                      <div className="bg-purple-50 border-2 border-purple-100 p-4 rounded-2xl flex items-start gap-4">
                        <span className="text-xl sm:text-2xl">🔑</span>
                        <p className="text-xs sm:text-sm text-purple-800 font-medium">
                          Change the dean password. This will update the login credentials for the Dean account.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-3xl border-2 border-gray-100 bg-gray-50/30">
                          <div className="space-y-4">
                            <h4 className="font-black text-gray-900 uppercase tracking-tight mb-4">Dean Credentials</h4>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">New Password</label>
                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                className="w-full p-4 rounded-2xl bg-white border-2 border-gray-100 font-bold text-gray-800 outline-none focus:border-purple-500 focus:shadow-lg focus:shadow-purple-100 transition-all pr-12"
                                placeholder="••••••••"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-4 text-gray-400 hover:text-purple-600 transition-colors"
                              >
                                {showPassword ? (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                              </button>
                            </div>
                            <button
                              onClick={handleChangePassword}
                              disabled={!newPassword || newPassword.length < 6}
                              className="w-full py-3 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 disabled:opacity-50 disabled:shadow-none"
                            >
                              Update Password
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-0.5 bg-slate-100"></div>

                    {/* 2. Warden Management Section (Moved from Wardens Tab) */}
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl flex items-start gap-4 flex-1">
                          <span className="text-xl sm:text-2xl">👮</span>
                          <div className="flex-1">
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-wide mb-1">Warden Management</h3>
                            <p className="text-xs sm:text-sm text-blue-800 font-medium">
                              Map individual wardens to each hostel. They can only see students from their assigned hostel.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleCreateHostel}
                          className="w-full sm:w-auto px-6 py-3.5 sm:py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                          Add Hostel
                        </button>
                      </div>

                      <div className="grid gap-6">
                        {hostelsConfig.map((hostel) => (
                          <div key={hostel._id} className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 hover:shadow-xl transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 blur-[60px] rounded-full group-hover:bg-indigo-100/40 transition-all" />
                            <div className="relative z-10">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3 w-full">
                                  <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-xl shrink-0">🏢</div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight truncate">{hostel.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hostel ID: {hostel._id.slice(-6)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() => {
                                      const newPass = prompt("Enter new password for " + hostel.name + ":", hostel.wardenPassword || "");
                                      if (newPass !== null) handleUpdateHostelConfig({ ...hostel, id: hostel._id, wardenPassword: newPass });
                                    }}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-110 active:scale-95 transition-all text-center"
                                  >
                                    Update Access
                                  </button>
                                  {showRemoveButton && (
                                    <button
                                      onClick={() => handleDeleteHostelConfig(hostel._id, hostel.name)}
                                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/60 p-4 rounded-xl border border-white backdrop-blur-sm">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-0.5">Warden Username</label>
                                  <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                                    <input
                                      type="text"
                                      defaultValue={hostel.wardenUsername || (hostel.name.toLowerCase().replace(/ /g, "_") + "_warden")}
                                      onBlur={(e) => handleUpdateHostelConfig({ ...hostel, id: hostel._id, wardenUsername: e.target.value })}
                                      className="font-black text-slate-700 text-base bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                                    />
                                  </div>
                                </div>
                                <div className="bg-white/60 p-4 rounded-xl border border-white backdrop-blur-sm relative group/pass">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-0.5">Warden Password</label>
                                  <div className="flex items-center gap-3 justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200" />
                                      <span className="font-black text-slate-700 text-base tracking-widest">
                                        {visiblePasswords.has(hostel._id)
                                          ? (hostel.wardenPassword || globalWardenPassword || "Not Set")
                                          : ((hostel.wardenPassword || globalWardenPassword) ? "••••••••" : "Not Set")
                                        }
                                      </span>
                                    </div>
                                    {(hostel.wardenPassword || globalWardenPassword) && (
                                      <button
                                        onClick={() => {
                                          setVisiblePasswords(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(hostel._id)) {
                                              newSet.delete(hostel._id);
                                            } else {
                                              newSet.add(hostel._id);
                                            }
                                            return newSet;
                                          });
                                        }}
                                        className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors group"
                                        title={visiblePasswords.has(hostel._id) ? "Hide password" : "Show password"}
                                      >
                                        {visiblePasswords.has(hostel._id) ? (
                                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                          </svg>
                                        ) : (
                                          <svg className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* MULTI-HOSTEL ACCOUNTS SECTION */}
                      <div className="mt-12 pt-12 border-t-2 border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <h3 className="text-xl font-black text-slate-800">Unified Warden Accounts</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">Manage accounts with access to multiple locations</p>
                          </div>
                          <button
                            onClick={() => {
                              setEditingAccountId(null);
                              setNewAccountForm({ username: "", password: "", hostels: [] });
                              setIsCreatingAccount(!isCreatingAccount);
                            }}
                            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            Create Account
                          </button>
                        </div>

                        {isCreatingAccount && (
                          <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-xl mb-8 animate-in fade-in slide-in-from-top-4">
                            <h4 className="font-black text-indigo-900 uppercase tracking-widest mb-6">{editingAccountId ? "Edit Warden Account" : "New Warden Account"}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Username</label>
                                <input
                                  type="text"
                                  value={newAccountForm.username}
                                  onChange={e => setNewAccountForm({ ...newAccountForm, username: e.target.value })}
                                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold"
                                  placeholder="e.g. super_warden"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Password</label>
                                <input
                                  type="text"
                                  value={newAccountForm.password}
                                  onChange={e => setNewAccountForm({ ...newAccountForm, password: e.target.value })}
                                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold"
                                  placeholder="******"
                                />
                              </div>
                            </div>

                            <div className="mb-8">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Assign Hostels</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {hostelsConfig.map(h => (
                                  <label key={h._id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${newAccountForm.hostels.includes(h.name) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <input
                                      type="checkbox"
                                      checked={newAccountForm.hostels.includes(h.name)}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setNewAccountForm({ ...newAccountForm, hostels: [...newAccountForm.hostels, h.name] });
                                        } else {
                                          setNewAccountForm({ ...newAccountForm, hostels: newAccountForm.hostels.filter(hn => hn !== h.name) });
                                        }
                                      }}
                                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="font-bold text-sm text-slate-700">{h.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => {
                                  setIsCreatingAccount(false);
                                  setEditingAccountId(null);
                                  setNewAccountForm({ username: "", password: "", hostels: [] });
                                }}
                                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (!newAccountForm.username || !newAccountForm.password || newAccountForm.hostels.length === 0) {
                                    alert("Please fill all fields and select at least one hostel.");
                                    return;
                                  }
                                  if (editingAccountId) {
                                    handleManageWardenAccount("update", { ...newAccountForm, accountId: editingAccountId });
                                  } else {
                                    handleManageWardenAccount("create", newAccountForm);
                                  }
                                }}
                                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                              >
                                {editingAccountId ? "Update Account" : "Save Account"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid gap-4">
                          {wardenAccounts.length === 0 && !isCreatingAccount && (
                            <div className="p-8 text-center text-slate-400 font-medium italic bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                              No unified accounts created yet.
                            </div>
                          )}
                          {wardenAccounts.map((acc, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                                  <h4 className="text-lg font-black text-slate-800">{acc.username}</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {acc.hostels.map(h => (
                                    <span key={h} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                                      {h}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-start md:self-center">
                                <button
                                  onClick={() => {
                                    setNewAccountForm({
                                      username: acc.username,
                                      password: acc.password || "",
                                      hostels: acc.hostels
                                    });
                                    setEditingAccountId(acc._id || null);
                                    setIsCreatingAccount(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm("Delete this account?")) handleManageWardenAccount("delete", { username: acc.username });
                                  }}
                                  className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer */}
                {activeSettingsTab === "form" && (
                  <div className="p-4 sm:p-8 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
                    <button
                      onClick={() => {
                        if (confirm("This will overwrite your current form configuration with the standard template (including Floor Number). Are you sure?")) {
                          const DEFAULT_CONFIG = [
                            { id: "profilePicture", label: "Profile Photo", type: "image", section: "Personal", required: true, visible: true },
                            { id: "name", label: "Full Name", type: "text", section: "Personal", required: true, visible: true },
                            { id: "phoneNumber", label: "Phone Number", type: "tel", section: "Personal", required: true, visible: true },
                            { id: "dob", label: "Date of Birth", type: "date", section: "Personal", required: true, visible: true },
                            { id: "category", label: "Social Category", type: "select", section: "Personal", required: true, visible: true, options: ["GENERAL", "OBC", "SC", "ST"] },

                            { id: "erpInformation", label: "ERP ID", type: "text", section: "Academic", required: true, visible: true },
                            { id: "collegeName", label: "College Name", type: "select", section: "Academic", required: true, visible: true, options: ["OIST", "OCT", "OIM", "Pharmacy", "MCA"] },
                            { id: "branch", label: "Branch", type: "select", section: "Academic", required: true, visible: true, options: ["CSE", "AIML", "DS", "IT", "EC", "EX", "ME", "CE", "AU"] },
                            { id: "year", label: "Current Year", type: "select", section: "Academic", required: true, visible: true, options: ["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR"] },
                            { id: "semester", label: "Semester", type: "select", section: "Academic", required: true, visible: true, options: ["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"] },
                            { id: "section", label: "Section", type: "select", section: "Academic", required: true, visible: true, options: ["A", "B", "C", "D", "E"] },

                            { id: "fatherName", label: "Father's Name", type: "text", section: "Guardian", required: true, visible: true },
                            { id: "fatherNumber", label: "Father's Phone No", type: "tel", section: "Guardian", required: true, visible: true },
                            { id: "motherName", label: "Mother's Name", type: "text", section: "Guardian", required: true, visible: true },
                            { id: "motherNumber", label: "Mother's Phone No", type: "tel", section: "Guardian", required: true, visible: true },
                            { id: "localGuardianAddress", label: "Local Guardian Address", type: "textarea", section: "Guardian", required: true, visible: true },
                            { id: "localGuardianPhoneNumber", label: "Local Guardian Phone", type: "tel", section: "Guardian", required: true, visible: true },

                            { id: "homeState", label: "Home State", type: "select", section: "Address", required: true, visible: true, options: ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"] },
                            { id: "joiningDate", label: "Joining Date", type: "date", section: "Other", required: true, visible: true },

                            // NEW FIELD
                            { id: "floorNumber", label: "Floor Number", type: "select", section: "Accommodation", required: true, visible: true, options: ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor"] }
                          ];

                          handleUpdateFormBuilder(DEFAULT_CONFIG);
                        }
                      }}
                      className="w-full sm:w-auto px-6 py-3.5 sm:py-4 bg-gray-100 text-gray-500 font-bold text-xs uppercase tracking-[0.1em] rounded-2xl hover:bg-gray-200 transition-all mr-auto"
                    >
                      ⚠ Reset to Defaults
                    </button>
                    <button
                      onClick={() => setShowSystemSettingsModal(false)}
                      className="w-full sm:w-auto px-10 py-3.5 sm:py-4 bg-gray-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95"
                    >
                      SAVE FORM SETTINGS
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
      {/* Bank Settings Modal */}
      {
        showBankSettingsModal && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <div>
                  <h2 className="text-xl font-bold">University Bank Settings</h2>
                  <p className="text-xs opacity-80 uppercase tracking-widest font-black">Configure payment details for students</p>
                </div>
                <button onClick={() => setShowBankSettingsModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* ⚡ NEW: Global Payment Toggle */}
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Enable Student Payments</h3>
                    <p className="text-xs text-indigo-700/80 font-medium mt-0.5">Allow students to view payment details and make transactions</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bankFormData.isPaymentEnabled}
                      onChange={(e) => setBankFormData({ ...bankFormData, isPaymentEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Name</label>
                    <input
                      type="text"
                      value={bankFormData.accountName}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountName: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                      placeholder="e.g. ORIENTAL INSTITUTE OF SCIENCE"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Number</label>
                    <input
                      type="text"
                      value={bankFormData.accountNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                      placeholder="000000000000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">IFSC Code</label>
                    <input
                      type="text"
                      value={bankFormData.ifscCode}
                      onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                      placeholder="SYNB0000..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bank Name</label>
                    <input
                      type="text"
                      value={bankFormData.bankName}
                      onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                      placeholder="Canara Bank"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">UPI ID (Optional)</label>
                    <input
                      type="text"
                      value={bankFormData.upiId}
                      onChange={(e) => setBankFormData({ ...bankFormData, upiId: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                      placeholder="university@upi"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hostel Fee (₹)</label>
                    <input
                      type="number"
                      value={bankFormData.feeAmount}
                      onChange={(e) => setBankFormData({ ...bankFormData, feeAmount: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none"
                      placeholder="45000"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Instructions for Students</label>
                  <textarea
                    value={bankFormData.instructions}
                    onChange={(e) => setBankFormData({ ...bankFormData, instructions: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold focus:border-indigo-500 outline-none min-h-[80px]"
                    placeholder="Enter step-by-step payment instructions..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center block mb-2">Upload QR Image (Required for Scan & Pay)</label>
                  <div
                    className="relative group cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onloadend = () => setBankFormData({ ...bankFormData, qrImage: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }}
                    onPaste={(e) => {
                      const item = e.clipboardData.items[0];
                      if (item?.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setBankFormData({ ...bankFormData, qrImage: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }
                    }}
                  >
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 transition-all group-hover:shadow-lg shadow-indigo-100/50">
                      {bankFormData.qrImage ? (
                        <div className="relative group/img">
                          <img src={bankFormData.qrImage} alt="QR Preview" className="h-40 w-40 object-contain rounded-lg" />
                          <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                            <p className="text-white text-[10px] font-black">CHANGE IMAGE</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          </div>
                          <p className="mb-2 text-sm text-gray-700 font-bold">Click to upload or <span className="text-indigo-600">Paste (Ctrl+V)</span></p>
                          <p className="text-xs text-secondary italic">PNG, JPG or SVG (Max 2MB)</p>
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setBankFormData({ ...bankFormData, qrImage: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                    {bankFormData.qrImage && (
                      <button
                        onClick={(e) => { e.preventDefault(); setBankFormData({ ...bankFormData, qrImage: "" }); }}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setShowBankSettingsModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBankSettings}
                  className="flex-[2] py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Save Bank Settings
                </button>
              </div>
            </div>
          </div>
        )
      }

      {showHostelSettingsModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-6 border-b flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-black text-gray-800 text-lg md:text-xl tracking-tight">🏢 Hostel Attendance Settings</h3>
                <p className="text-xs text-secondary mt-1 font-bold uppercase tracking-wide">Configure Security Level Per Hostel</p>
              </div>
              <button
                onClick={() => setShowHostelSettingsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6 bg-gray-50/30">
              {/* Info Box */}
              <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 flex gap-3">
                <div className="shrink-0 text-2xl">ℹ️</div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm uppercase tracking-wide mb-1">How Modes Work</h4>
                  <div className="space-y-1 text-xs text-blue-800 leading-relaxed font-medium">
                    <p>🔒 <strong className="font-black">STRICT MODE (Camera):</strong> GPS + Live Camera Photo Match.</p>
                    <p>📍 <strong className="font-black">GPS ONLY:</strong> GPS check only. Fastest, no biometric/camera.</p>
                    <p>👆 <strong className="font-black">BIOMETRIC (New):</strong> GPS + Device Face/Fingerprint (WebAuthn). Most Secure.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {hostels.length === 0 && (
                  <div className="text-center py-8 text-gray-400 font-bold text-sm bg-white rounded-xl border border-dashed">
                    No hostels found. Add hostels via database or script first.
                  </div>
                )}

                {hostels.map(hostel => {
                  const isGpsOnly = hostel.attendanceMode === 'gps-only';
                  const isLoading = updatingHostelId === hostel._id;

                  return (
                    <div key={hostel._id} className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-black text-gray-800 text-base">{hostel.name}</h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Current Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${hostel.attendanceMode === 'gps-only'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : hostel.attendanceMode === 'biometric'
                              ? 'bg-blue-50 text-blue-600 border-blue-100'
                              : 'bg-green-50 text-green-600 border-green-100'
                            }`}>
                            {hostel.attendanceMode === 'gps-only' ? '⚠️ GPS ONLY' : hostel.attendanceMode === 'biometric' ? '👆 BIOMETRIC' : '📸 CAMERA'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleSyncAllStudents(hostel.name)}
                          disabled={updatingHostelId === 'syncing'}
                          className="mt-2 text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 group"
                        >
                          🔄 Force Sync All Students to this Mode
                        </button>
                      </div>

                      <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200 self-start sm:self-auto flex-wrap gap-1">
                        <button
                          disabled={isLoading}
                          onClick={() => handleUpdateHostelMode(hostel._id, 'gps-only')}
                          title="GPS Check Only"
                          className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${hostel.attendanceMode === 'gps-only'
                            ? 'bg-white text-amber-600 shadow-sm ring-1 ring-black/5 scale-[1.02]'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          {isLoading && hostel.attendanceMode === 'gps-only' ? '⏳' : '📍'} GPS Only
                        </button>
                        <button
                          disabled={isLoading}
                          onClick={() => handleUpdateHostelMode(hostel._id, 'biometric')}
                          title="GPS + Device Biometrics"
                          className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${hostel.attendanceMode === 'biometric'
                            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 scale-[1.02]'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          {isLoading && hostel.attendanceMode === 'biometric' ? '⏳' : '👆'} Bio-Auth
                        </button>
                        <button
                          disabled={isLoading}
                          onClick={() => handleUpdateHostelMode(hostel._id, 'strict')}
                          title="GPS + Camera Photo"
                          className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${(!hostel.attendanceMode || hostel.attendanceMode === 'strict')
                            ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5 scale-[1.02]'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                          {isLoading && (!hostel.attendanceMode || hostel.attendanceMode === 'strict') ? '⏳' : '📸'} Camera
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowHostelSettingsModal(false)}
                className="px-6 py-2.5 bg-gray-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-900 transition-colors shadow-lg shadow-gray-200"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Database Export Modal */}
      {showDBExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Export Database</h3>
              <button onClick={() => setShowDBExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Select the format to download all database collections.
                <br />
                <span className="text-xs text-gray-400 italic">Includes Students, Attendance, Permissions, Settings, etc.</span>
              </p>

              <div className="grid gap-3">
                <button
                  onClick={() => handleDBExport('json')}
                  disabled={isExportingDB}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                      { }J{ }
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-gray-800 group-hover:text-blue-700">JSON Format</span>
                      <span className="block text-[10px] text-gray-500">Best for backup & migration (Raw Data)</span>
                    </div>
                  </div>
                  {isExportingDB && <span className="animate-spin text-blue-600">⏳</span>}
                </button>

                <button
                  onClick={() => handleDBExport('xlsx')}
                  disabled={isExportingDB}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-green-50 hover:border-green-200 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-bold text-xs">
                      { }X{ }
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-gray-800 group-hover:text-green-700">Excel (XLSX)</span>
                      <span className="block text-[10px] text-gray-500">Readable spreadsheet with multiple sheets</span>
                    </div>
                  </div>
                  {isExportingDB && <span className="animate-spin text-green-600">⏳</span>}
                </button>

                <button
                  onClick={() => handleDBExport('csv')}
                  disabled={isExportingDB}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-orange-50 hover:border-orange-200 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">
                      { }C{ }
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-gray-800 group-hover:text-orange-700">CSV Format</span>
                      <span className="block text-[10px] text-gray-500">Students List Only (Flat File)</span>
                    </div>
                  </div>
                  {isExportingDB && <span className="animate-spin text-orange-600">⏳</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Preview Modal */}
      {showChangePreviewModal && pendingFormBuilderChanges && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-sm sm:text-xl font-bold text-gray-900 mb-1">Review Configuration Changes</h2>
                <p className="text-xs sm:text-sm text-gray-500">Please review the differences before saving everything to the database.</p>
              </div>
              <button
                onClick={() => {
                  setShowChangePreviewModal(false);
                  setPendingFormBuilderChanges(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50/30">
              <div className="grid grid-cols-2 gap-4 sm:gap-8 h-full">
                {/* Original */}
                <div className="flex flex-col h-full">
                  <div className="mb-3 sm:mb-4 font-black text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    Current / Original
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-3 sm:p-4 overflow-y-auto space-y-2 sm:space-y-3">
                    {savedFormBuilderConfig.length === 0 ? (
                      <p className="text-gray-400 italic text-xs sm:text-sm text-center py-10">No existing configuration</p>
                    ) : (
                      savedFormBuilderConfig.map((field, i) => (
                        <div key={field.id || i} className="bg-white p-2 sm:p-3 rounded-xl border border-gray-100 shadow-sm opacity-60 grayscale">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-xs text-gray-800">{field.label}</span>
                            <span className="text-[9px] sm:text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{field.type}</span>
                          </div>
                          <div className="flex gap-2 text-[8px] sm:text-[10px] text-gray-400">
                            <span>ID: {field.id}</span>
                            <span>•</span>
                            <span>{field.required ? 'Required*' : 'Optional'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* New */}
                <div className="flex flex-col h-full">
                  <div className="mb-3 sm:mb-4 font-black text-xs text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    New / Pending Save
                  </div>
                  <div className="flex-1 bg-blue-50/30 rounded-2xl border-2 border-blue-100 p-3 sm:p-4 overflow-y-auto space-y-2 sm:space-y-3 shadow-inner">
                    {pendingFormBuilderChanges.map((field, i) => {
                      // 🔍 DETECT CHANGES (Compare against SAVED config, not current working copy)
                      const originalIndex = savedFormBuilderConfig.findIndex(f => f.id === field.id);
                      const originalField = originalIndex !== -1 ? savedFormBuilderConfig[originalIndex] : null;

                      let isChanged = false;
                      let changeType = 'unchanged';

                      if (!originalField) {
                        isChanged = true;
                        changeType = 'new';
                      } else {
                        // Check for ANY modification
                        if (
                          originalIndex !== i || // Order changed
                          originalField.label !== field.label ||
                          originalField.required !== field.required ||
                          originalField.type !== field.type ||
                          JSON.stringify(originalField.options) !== JSON.stringify(field.options)
                        ) {
                          isChanged = true;
                          changeType = 'modified';
                        }
                      }

                      return (
                        <div
                          key={field.id || i}
                          className={`bg-white p-2 sm:p-3 rounded-xl border-l-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all ${isChanged
                            ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/10' // 🟢 Green for changes
                            : 'border-blue-200 opacity-60 grayscale-[0.3]' // 🔵 Faded for unchanged
                            }`}
                        >
                          {isChanged && (
                            <div className="absolute top-2 right-2 flex gap-1">
                              {changeType === 'new' && <span className="bg-emerald-500 text-white text-[7px] sm:text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm">NEW</span>}
                              {changeType === 'modified' && <span className="bg-emerald-500 text-white text-[7px] sm:text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm">UPDATED</span>}
                            </div>
                          )}

                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-bold text-xs ${isChanged ? 'text-emerald-600' : 'text-gray-900'}`}>{field.label}</span>
                            <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${field.type === 'select' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                              {field.type}
                            </span>
                          </div>
                          <div className="flex gap-2 text-[8px] sm:text-[10px] text-gray-500 mb-2">
                            <span className="font-mono text-gray-400">{field.id}</span>
                            <span className="text-gray-300">•</span>
                            <span className={field.required ? "text-red-500 font-bold" : "text-gray-400"}>{field.required ? 'Required*' : 'Optional'}</span>
                          </div>
                          {field.options && field.options.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-50 grid grid-cols-2 gap-1">
                              {field.options.slice(0, 6).map((opt: string) => (
                                <span key={opt} className="text-[9px] bg-gray-50 px-1.5 py-0.5 rounded text-gray-500 truncate border border-gray-100">
                                  {opt}
                                </span>
                              ))}
                              {field.options.length > 6 && (
                                <span className="text-[9px] text-gray-400 px-1 italic">+{field.options.length - 6} more...</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-6 border-t border-gray-100 bg-white flex justify-end gap-2 sm:gap-3 z-10">
              <button
                onClick={() => {
                  setShowChangePreviewModal(false);
                  setPendingFormBuilderChanges(null);
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpdateFormBuilder}
                disabled={isSavingSystemSettings}
                className="px-6 sm:px-8 py-2 sm:py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2 text-sm sm:text-base"
              >
                {isSavingSystemSettings ? (
                  <>
                    <span className="animate-spin">⏳</span> Saving...
                  </>
                ) : (
                  <>
                    <span>Confirm & Save Changes</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
