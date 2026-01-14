"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

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
  studentStatus?: "in" | "out";
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
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string }>>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, number>>({});
  const [presentStudentIds, setPresentStudentIds] = useState<string[]>([]);

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
      if (data.permissions) {
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      const response = await fetch("/api/admin/attendance-summary");
      const data = await response.json();
      if (data.success) {
        setAttendanceSummary(data.summary);
        setPresentStudentIds(data.presentStudentIds);
      }
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
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

    // ⚡ Fetch Attendance Summary
    fetchAttendanceSummary();

    const interval = setInterval(() => {
      fetchPermissions();
      fetchAttendanceSummary();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem("userType");
      sessionStorage.removeItem("firebaseUID");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/login");
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      setDeletingStudentId(studentId);
      const response = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete student");
      }

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
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(students.map(s => ({
      Name: s.name,
      Email: s.email,
      Phone: s.phoneNumber,
      Hostel: s.hostelName,
      Room: s.roomNumber,
      College: s.collegeName,
      Branch: s.branch,
      Year: s.year,
      Semester: s.semester
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_data.xlsx");
  };

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
            // Update any other fields if needed
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
          };

          // Optionally update the main list cache with this new detail so subsequent clicks are fast?
          // That might complicate the cache size again. Let's just keep it in selectedStudent for now.
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
          // Default empty strings for fields not present in permission population
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
      const matchesStatus = filter === "all" || p.status === filter;
      if (!matchesStatus) return false;
      if (statusFilter === "all") return true;
      const student = typeof p.studentId === "object" ? p.studentId : null;
      if (!student) return false;
      return student.studentStatus === statusFilter;
    });
  }, [permissions, filter, statusFilter]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) {
        matchesHostel = (getHostelCategory(student.hostelName) || student.hostelName) === hostelFilter;
      }

      const matchesCollege = collegeFilter === "all" || student.collegeName === collegeFilter;
      const matchesSemester = semesterFilter === "all" || student.semester === semesterFilter;
      const matchesBranch = branchFilter === "all" || student.branch === branchFilter;
      const matchesStatus = statusFilter === "all" || student.studentStatus === statusFilter;
      return matchesSearch && matchesHostel && matchesCollege && matchesSemester && matchesBranch && matchesStatus;
    });
  }, [students, searchQuery, hostelFilter, collegeFilter, semesterFilter, branchFilter, statusFilter]);

  // Optimized counts for status buttons
  const statusCounts = useMemo(() => {
    const baseList = students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesHostel = hostelFilter === "all";
      if (!matchesHostel) matchesHostel = (getHostelCategory(student.hostelName) || student.hostelName) === hostelFilter;
      const matchesCollege = collegeFilter === "all" || student.collegeName === collegeFilter;
      const matchesSemester = semesterFilter === "all" || student.semester === semesterFilter;
      const matchesBranch = branchFilter === "all" || student.branch === branchFilter;
      return matchesSearch && matchesHostel && matchesCollege && matchesSemester && matchesBranch;
    });

    return {
      all: baseList.length,
      in: baseList.filter(s => s.studentStatus === 'in').length,
      out: baseList.filter(s => s.studentStatus === 'out').length
    };
  }, [students, searchQuery, hostelFilter, collegeFilter, semesterFilter, branchFilter]);



  const userType = typeof window !== "undefined" ? sessionStorage.getItem("userType") : null;

  return (
    <div className="min-h-screen bg-white">
      <main className="w-full max-w-4xl mx-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {!showAllStudents ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-semibold text-foreground">{title}</h1>
                  <div className="flex items-center gap-2 mt-1 md:mt-2">
                    {studentsLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></span>
                    ) : (
                      <p className="text-sm text-secondary">{students.length} Students</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAllStudents(true)}
                    className="px-4 md:px-6 py-2 md:py-2.5 rounded-lg bg-blue-600 text-background font-medium transition-colors hover:bg-blue-700 text-sm whitespace-nowrap"
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

              <div className="flex gap-2 md:gap-3 flex-wrap">
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
                              <p className="text-sm md:text-base font-semibold text-foreground">{student.name}</p>
                              <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 mt-0.5 md:mt-1 text-xs md:text-sm text-secondary">
                                <span>{new Date(permission.fromDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
                                <span className="hidden md:inline">•</span>
                                <span>to {new Date(permission.toDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
                              </div>
                              <p className="text-sm text-foreground mt-1.5 md:mt-2">{permission.reason}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-around md:justify-end md:gap-8 pt-2 border-t border-gray-200 md:border-0 md:pt-0">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[11px] md:text-[13px] font-medium text-foreground whitespace-nowrap">Warden approval</span>
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <button
                                  onClick={() => userType === "warden" && handleStatusChange(permission._id, "allowed")}
                                  disabled={userType !== "warden" || permission.deanStatus !== "pending"}
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border flex items-center justify-center transition-all ${permission.wardenStatus === "allowed" ? "border-green-300 bg-green-50 text-gray-500 shadow-sm" : "border-gray-200 text-gray-400 hover:border-green-300"} ${userType !== "warden" ? "cursor-default" : "cursor-pointer"}`}
                                >
                                  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button
                                  onClick={() => userType === "warden" && handleStatusChange(permission._id, "rejected")}
                                  disabled={userType !== "warden" || permission.deanStatus !== "pending"}
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border flex items-center justify-center transition-all ${permission.wardenStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-red-300"} ${userType !== "warden" ? "cursor-default" : "cursor-pointer"}`}
                                >
                                  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                              {/* Warden Status Label */}
                              {permission.wardenStatus === "rejected" && (
                                <span className="text-[10px] md:text-xs font-medium text-red-600 bg-red-50 px-1.5 md:px-2 py-0.5 rounded">
                                  Rejected
                                </span>
                              )}
                              {permission.wardenStatus === "allowed" && (
                                <span className="text-[10px] md:text-xs font-medium text-green-600 bg-green-50 px-1.5 md:px-2 py-0.5 rounded">
                                  Accepted
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[11px] md:text-[13px] font-medium text-foreground whitespace-nowrap">Dean approval</span>
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <button
                                  onClick={() => (userType === "admin" || userType === "developer") && handleStatusChange(permission._id, "allowed")}
                                  disabled={userType !== "admin" && userType !== "developer"}
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border flex items-center justify-center transition-all ${permission.deanStatus === "allowed" ? "border-green-600 bg-green-500 text-white shadow-md scale-105" : "border-gray-200 text-gray-400 hover:border-green-300"} ${userType !== "admin" && userType !== "developer" ? "cursor-default" : "cursor-pointer"}`}
                                >
                                  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button
                                  onClick={() => (userType === "admin" || userType === "developer") && handleStatusChange(permission._id, "rejected")}
                                  disabled={userType !== "admin" && userType !== "developer"}
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border flex items-center justify-center transition-all ${permission.deanStatus === "rejected" ? "border-red-500 bg-red-50 text-red-600 shadow-sm" : "border-gray-200 text-gray-400 hover:border-red-300"} ${userType !== "admin" && userType !== "developer" ? "cursor-default" : "cursor-pointer"}`}
                                >
                                  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                              {/* Dean Status Label */}
                              {permission.deanStatus === "rejected" && (
                                <span className="text-[10px] md:text-xs font-medium text-red-600 bg-red-50 px-1.5 md:px-2 py-0.5 rounded">
                                  Rejected
                                </span>
                              )}
                              {permission.deanStatus === "allowed" && (
                                <span className="text-[10px] md:text-xs font-medium text-green-600 bg-green-50 px-1.5 md:px-2 py-0.5 rounded">
                                  Accepted
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      <option value="1st Sem">1st Sem</option>
                      <option value="2nd Sem">2nd Sem</option>
                      <option value="3rd Sem">3rd Sem</option>
                      <option value="4th Sem">4th Sem</option>
                      <option value="5th Sem">5th Sem</option>
                      <option value="6th Sem">6th Sem</option>
                      <option value="7th Sem">7th Sem</option>
                      <option value="8th Sem">8th Sem</option>
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
                      <option value="MBA">MBA</option>
                      <option value="CSBS">CSBS</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 md:gap-3 flex-wrap">
                  <button
                    onClick={() => setHostelFilter("all")}
                    className={`px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors flex flex-col items-center gap-1 ${hostelFilter === "all"
                      ? "bg-blue-600 text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                      }`}
                  >
                    <span>All</span>
                    <span className="text-xs font-bold">{studentsLoading ? "..." : students.length}</span>
                  </button>
                  {hostels.map((h) => {
                    const count = students.filter(s => (getHostelCategory(s.hostelName) || s.hostelName) === h.name).length;
                    const presentCount = attendanceSummary[h.name] || 0;

                    return (
                      <button
                        key={h._id || h.name}
                        onClick={() => setHostelFilter(h.name)}
                        className={`px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors flex flex-col items-center gap-1 ${hostelFilter === h.name
                          ? "bg-blue-600 text-background"
                          : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                          }`}
                      >
                        <span className="font-bold">{h.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] opacity-75">T: {count}</span>
                          <span className="text-[10px] text-green-500 font-bold bg-green-50 px-1 rounded">P: {presentCount}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 md:gap-3 flex-wrap items-center">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors flex flex-col items-center gap-1 ${statusFilter === "all" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                  >
                    <span>All Students</span>
                    <span className="text-xs font-bold">{studentsLoading ? "..." : statusCounts.all}</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("in")}
                    className={`px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors flex flex-col items-center gap-1 ${statusFilter === "in" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                  >
                    <span>In</span>
                    <span className="text-xs font-bold">{studentsLoading ? "..." : statusCounts.in}</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("out")}
                    className={`px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors flex flex-col items-center gap-1 ${statusFilter === "out" ? "bg-blue-600 text-background" : "bg-filler text-foreground hover:bg-[#E8E8E6]"}`}
                  >
                    <span>Out</span>
                    <span className="text-xs font-bold">{studentsLoading ? "..." : statusCounts.out}</span>
                  </button>
                  {showRemoveButton && (
                    <button
                      onClick={exportToExcel}
                      disabled={studentsLoading}
                      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-green-600 text-white font-medium transition-colors hover:bg-green-700 text-sm whitespace-nowrap flex items-center gap-1.5 ${studentsLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {studentsLoading ? "Loading..." : "Export Excel"}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {studentsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                      <p className="text-secondary text-sm">Loading student directory...</p>
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <p className="text-secondary text-center py-8">No students found</p>
                  ) : (
                    filteredStudents.map((student) => {
                      const studentPermissions = permissions.filter((p) => {
                        if (!p.studentId) return false;
                        return typeof p.studentId === "object" ? p.studentId._id === student.id : p.studentId === student.id;
                      });
                      return (
                        <button
                          key={student.id}
                          onClick={() => handleProfileClick(student.id)}
                          className="w-full text-left rounded-lg border border-solid border-[#9CA3AF] bg-filler p-3 md:p-4 hover:bg-[#E8E8E6] transition-colors"
                        >
                          <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm flex-shrink-0">
                              {student.profilePicture ? (
                                <img src={student.profilePicture} alt={student.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                getInitials(student.name)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <p className="text-base font-semibold text-foreground">{student.name}</p>
                                  {presentStudentIds.includes(student.id) && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded-full border border-green-200 uppercase">
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Present
                                    </span>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${student.studentStatus === 'out' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                  {student.studentStatus || 'in'}
                                </span>
                              </div>
                              <p className="text-sm text-secondary mt-0.5">{student.email}</p>
                              <div className="flex items-center gap-3 md:gap-4 mt-2 text-sm text-secondary">
                                <span>{getHostelCategory(student.hostelName) || student.hostelName}</span>
                                <span>•</span>
                                <span>Room {student.roomNumber}</span>
                                <span>•</span>
                                <a href={`tel:${student.phoneNumber}`} title="Click to call" className="hover:text-blue-600 hover:underline">
                                  {student.phoneNumber}
                                </a>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
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
                <div className="flex flex-col items-center gap-3 md:gap-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-lg md:text-xl flex-shrink-0">
                    {selectedStudent.profilePicture ? (
                      <img
                        src={selectedStudent.profilePicture}
                        alt={selectedStudent.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      getInitials(selectedStudent.name)
                    )}
                  </div>
                  <div className="text-center space-y-2">
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-base font-semibold text-foreground">{selectedStudent.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedStudent.studentStatus === 'out' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                          {selectedStudent.studentStatus || 'in'}
                        </span>
                        {presentStudentIds.includes(selectedStudent.id) && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded border border-green-200 uppercase">
                            Attendance Saved
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-secondary">{selectedStudent.email}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-5 text-base">
                    <div>
                      <p className="text-secondary text-sm mb-1.5">Phone Number</p>
                      <a href={`tel:${selectedStudent.phoneNumber}`} title="Click to call" className="text-blue-600 font-medium break-words hover:underline">
                        {selectedStudent.phoneNumber}
                      </a>
                    </div>
                    <div>
                      <p className="text-secondary text-sm mb-1.5">Hostel Name</p>
                      <p className="text-foreground font-medium break-words">{getHostelCategory(selectedStudent.hostelName) || selectedStudent.hostelName}</p>
                    </div>
                    <div>
                      <p className="text-secondary text-sm mb-1.5">Room Number</p>
                      <p className="text-foreground font-medium break-words">{selectedStudent.roomNumber}</p>
                    </div>
                    {selectedStudent.fatherName && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Father's Name</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.fatherName}</p>
                      </div>
                    )}
                    {selectedStudent.fatherNumber && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Father's Number</p>
                        <a href={`tel:${selectedStudent.fatherNumber}`} title="Click to call" className="text-blue-600 font-medium break-words hover:underline">
                          {selectedStudent.fatherNumber}
                        </a>
                      </div>
                    )}
                    {selectedStudent.motherName && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Mother's Name</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.motherName}</p>
                      </div>
                    )}
                    {selectedStudent.motherNumber && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Mother's Number</p>
                        <a href={`tel:${selectedStudent.motherNumber}`} title="Click to call" className="text-blue-600 font-medium break-words hover:underline">
                          {selectedStudent.motherNumber}
                        </a>
                      </div>
                    )}
                    {selectedStudent.homePinCode && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Permanent Address</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.homePinCode}</p>
                      </div>
                    )}
                    {selectedStudent.homeState && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">State</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.homeState}</p>
                      </div>
                    )}
                    {selectedStudent.erpInformation && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">ERP Information</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.erpInformation}</p>
                      </div>
                    )}
                    {selectedStudent.joiningDate && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Joining Date</p>
                        <p className="text-foreground font-medium break-words">{new Date(selectedStudent.joiningDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                      </div>
                    )}
                    {selectedStudent.branch && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Branch</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.branch}</p>
                      </div>
                    )}
                    {selectedStudent.collegeName && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">College Name</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.collegeName}</p>
                      </div>
                    )}
                    {selectedStudent.year && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Year</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.year}</p>
                      </div>
                    )}
                    {selectedStudent.semester && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Semester</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.semester}</p>
                      </div>
                    )}
                    {selectedStudent.section && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Section</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.section}</p>
                      </div>
                    )}
                    {selectedStudent.localGuardianAddress && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Local Guardian Address</p>
                        <p className="text-foreground font-medium break-words">{selectedStudent.localGuardianAddress}</p>
                      </div>
                    )}
                    {selectedStudent.localGuardianPhoneNumber && (
                      <div>
                        <p className="text-secondary text-sm mb-1.5">Local Guardian Phone</p>
                        <a href={`tel:${selectedStudent.localGuardianPhoneNumber}`} title="Click to call" className="text-blue-600 font-medium break-words hover:underline">
                          {selectedStudent.localGuardianPhoneNumber}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>


              {showRemoveButton && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingStudentId === selectedStudent.id}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingStudentId === selectedStudent.id ? "Removing..." : "Remove Student"}
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

      {showDeleteConfirm && selectedStudent && (
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
    </div>
  );
}
