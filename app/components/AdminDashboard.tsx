"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

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
}

interface SimplePermission {
  id: string;
  fromDateTime: string | Date;
  toDateTime: string | Date;
  reason: string;
  status: "pending" | "allowed" | "rejected";
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
  permissions: SimplePermission[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "allowed" | "rejected" | "pending">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "in" | "out">("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hostelFilter, setHostelFilter] = useState<"all" | "A" | "B" | "C" | "D">("all");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem("userType");
    router.push("/login");
  };

  useEffect(() => {
    if (showAllStudents) {
      window.history.pushState({ page: "all-students" }, "", "");
    }
  }, [showAllStudents]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (showAllStudents) {
        setShowAllStudents(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showAllStudents]);

  const fetchPermissions = async () => {
    try {
      const response = await fetch("/api/permissions");
      const data = await response.json();
      if (data.permissions) {
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/students");
      const data = await response.json();
      if (data.students) {
        setStudents(data.students);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPermissions(), fetchStudents()]);
      setLoading(false);
    };

    loadData();

    const interval = setInterval(() => {
      fetchPermissions();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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
      await Promise.all([fetchPermissions(), fetchStudents()]);
    } catch (error: any) {
      console.error("Error deleting student:", error);
      alert(error.message || "Failed to delete student. Please try again.");
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleProfileClick = (studentId: string) => {
    const student = students.find((s) => s._id === studentId);
    if (student) {
      const studentPermissions = permissions.filter((p) => {
        if (!p.studentId) return false;
        return typeof p.studentId === "object" ? p.studentId._id === studentId : p.studentId === studentId;
      });
      setSelectedStudent({
        id: student._id,
        name: student.name,
        email: student.email,
        phoneNumber: student.phoneNumber,
        hostelName: student.hostelName,
        roomNumber: student.roomNumber,
        profilePicture: student.profilePicture,
        fatherName: student.fatherName,
        fatherNumber: student.fatherNumber,
        motherName: student.motherName,
        motherNumber: student.motherNumber,
        homePinCode: student.homePinCode,
                            permissions: studentPermissions.map((p): SimplePermission => ({
                              id: p._id,
                              fromDateTime: p.fromDateTime,
                              toDateTime: p.toDateTime,
                              reason: p.reason,
                              status: p.status,
                            })),
      });
    }
  };

  const handleStatusChange = async (id: string, newStatus: "allowed" | "rejected") => {
    try {
      // Optimistically update the UI
      setPermissions((prevPermissions) =>
        prevPermissions.map((perm) =>
          perm._id === id ? { ...perm, status: newStatus } : perm
        )
      );

      const response = await fetch("/api/permissions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissionId: id,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (response.ok && data.permission) {
        // Update with the full permission data from server
        setPermissions((prevPermissions) =>
          prevPermissions.map((perm) =>
            perm._id === id ? data.permission : perm
          )
        );
      } else {
        // Revert on error
        fetchPermissions();
      }
    } catch (error) {
      console.error("Error updating permission:", error);
      // Revert on error
      fetchPermissions();
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

  const filteredPermissions = permissions.filter((p) => {
    const matchesStatus = filter === "all" || p.status === filter;
    if (!matchesStatus) return false;
    
    if (statusFilter === "all") return true;
    
    const student = typeof p.studentId === "object" ? p.studentId : null;
    if (!student) return false;
    
    return student.studentStatus === statusFilter;
  });

  const getHostelLetter = (hostelName: string): "A" | "B" | "C" | "D" | null => {
    const name = hostelName.toLowerCase();
    if (name.includes("hostel a") || name.includes("a")) return "A";
    if (name.includes("hostel b") || name.includes("b")) return "B";
    if (name.includes("hostel c") || name.includes("c")) return "C";
    if (name.includes("hostel d") || name.includes("d")) return "D";
    return null;
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesHostel = hostelFilter === "all" || getHostelLetter(student.hostelName) === hostelFilter;
    return matchesSearch && matchesHostel;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="w-full max-w-4xl mx-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {!showAllStudents ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-semibold text-foreground">Admin Dashboard</h1>
                  <p className="mt-1 md:mt-2 text-sm text-secondary">{students.length} Students</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAllStudents(true)}
                    className="px-4 md:px-6 py-2 md:py-2.5 rounded-lg bg-foreground text-background font-medium transition-colors hover:bg-[#383838] text-sm whitespace-nowrap"
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
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === "all"
                      ? "bg-foreground text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("pending")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === "pending"
                      ? "bg-foreground text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilter("allowed")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === "allowed"
                      ? "bg-foreground text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                  }`}
                >
                  Accepted
                </button>
                <button
                  onClick={() => setFilter("rejected")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === "rejected"
                      ? "bg-foreground text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                  }`}
                >
                  Rejected
                </button>
              </div>

              <div className="flex gap-2 md:gap-3 flex-wrap">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === "all"
                      ? "bg-foreground text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                  }`}
                >
                  All Students
                </button>
                <button
                  onClick={() => setStatusFilter("in")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === "in"
                      ? "bg-foreground text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                  }`}
                >
                  In
                </button>
                <button
                  onClick={() => setStatusFilter("out")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === "out"
                      ? "bg-foreground text-background"
                      : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                  }`}
                >
                  Out
                </button>
              </div>

              <div className="space-y-3">
                {filteredPermissions.length === 0 ? (
                  <p className="text-secondary">No permissions found</p>
                ) : (
                  filteredPermissions.map((permission) => {
                    const student = typeof permission.studentId === "object" ? permission.studentId : null;
                    if (!student) {
                      return null;
                    }
                    
                    const initials = getInitials(student.name);
                    const showStatus = permission.status === "allowed" || permission.status === "rejected";
                    const profilePic = student.profilePicture && student.profilePicture.trim() !== "" && student.profilePicture !== "undefined";

                    return (
                      <div
                        key={permission._id}
                        className="rounded-lg border border-solid border-[#9CA3AF] bg-filler p-3 md:p-4"
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <button
                            onClick={() => handleProfileClick(student._id)}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                          >
                            {profilePic ? (
                              <img
                                src={student.profilePicture}
                                alt={student.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              initials
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 md:gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  {student.name}
                                </p>
                                <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1 text-sm text-secondary">
                                  <span>{new Date(permission.fromDateTime).toLocaleString()}</span>
                                  <span>•</span>
                                  <span>to {new Date(permission.toDateTime).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-foreground mt-1.5 md:mt-2">
                                  {permission.reason}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 md:gap-3">
                                {showStatus && (
                                  <Badge
                                    variant={permission.status === "allowed" ? "default" : "destructive"}
                                    className={`text-xs px-2 md:px-2.5 py-0.5 whitespace-nowrap ${
                                      permission.status === "allowed"
                                        ? "bg-green-100 text-green-800 border-green-200"
                                        : "bg-red-100 text-red-800 border-red-200"
                                    }`}
                                  >
                                    {permission.status === "allowed" ? "Accepted" : "Rejected"}
                                  </Badge>
                                )}
                                {permission.status === "pending" && (
                                  <div className="flex items-center gap-1.5 md:gap-2">
                                    <button
                                      onClick={() => handleStatusChange(permission._id, "allowed")}
                                      className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-solid border-[#9CA3AF] bg-white text-foreground flex items-center justify-center transition-colors hover:bg-filler"
                                      title="Allow"
                                    >
                                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(permission._id, "rejected")}
                                      className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-solid border-[#9CA3AF] bg-white text-foreground flex items-center justify-center transition-colors hover:bg-filler"
                                      title="Reject"
                                    >
                                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
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

                <div className="flex gap-2 md:gap-3 flex-wrap">
                  <button
                    onClick={() => setHostelFilter("all")}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                      hostelFilter === "all"
                        ? "bg-foreground text-background"
                        : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setHostelFilter("A")}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                      hostelFilter === "A"
                        ? "bg-foreground text-background"
                        : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                    }`}
                  >
                    Hostel A
                  </button>
                  <button
                    onClick={() => setHostelFilter("B")}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                      hostelFilter === "B"
                        ? "bg-foreground text-background"
                        : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                    }`}
                  >
                    Hostel B
                  </button>
                  <button
                    onClick={() => setHostelFilter("C")}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                      hostelFilter === "C"
                        ? "bg-foreground text-background"
                        : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                    }`}
                  >
                    Hostel C
                  </button>
                  <button
                    onClick={() => setHostelFilter("D")}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
                      hostelFilter === "D"
                        ? "bg-foreground text-background"
                        : "bg-filler text-foreground hover:bg-[#E8E8E6]"
                    }`}
                  >
                    Hostel D
                  </button>
                </div>

                <div className="space-y-3">
                  {filteredStudents.length === 0 ? (
                    <p className="text-secondary text-center py-8">No students found</p>
                  ) : (
                    filteredStudents.map((student) => {
                      const studentPermissions = permissions.filter((p) => {
                        if (!p.studentId) return false;
                        return typeof p.studentId === "object" ? p.studentId._id === student._id : p.studentId === student._id;
                      });
                      return (
                      <button
                        key={student._id}
                        onClick={() => {
                          setSelectedStudent({
                            id: student._id,
                            name: student.name,
                            email: student.email,
                            phoneNumber: student.phoneNumber,
                            hostelName: student.hostelName,
                            roomNumber: student.roomNumber,
                            profilePicture: student.profilePicture,
                            fatherName: student.fatherName,
                            fatherNumber: student.fatherNumber,
                            motherName: student.motherName,
                            motherNumber: student.motherNumber,
                            homePinCode: student.homePinCode,
                            permissions: studentPermissions.map((p): SimplePermission => ({
                              id: p._id,
                              fromDateTime: p.fromDateTime,
                              toDateTime: p.toDateTime,
                              reason: p.reason,
                              status: p.status,
                            })),
                          });
                          setShowAllStudents(false);
                        }}
                        className="w-full text-left rounded-lg border border-solid border-[#9CA3AF] bg-filler p-3 md:p-4 hover:bg-[#E8E8E6] transition-colors"
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {student.profilePicture ? (
                              <img
                                src={student.profilePicture}
                                alt={student.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              getInitials(student.name)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-foreground">{student.name}</p>
                            <p className="text-sm text-secondary mt-0.5">{student.email}</p>
                            <div className="flex items-center gap-3 md:gap-4 mt-2 text-sm text-secondary">
                              <span>{student.hostelName}</span>
                              <span>•</span>
                              <span>Room {student.roomNumber}</span>
                              <span>•</span>
                              <span>{student.phoneNumber}</span>
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
                <div className="flex items-start gap-4">
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
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-base font-semibold text-foreground">{selectedStudent.name}</p>
                      <p className="text-sm text-secondary">{selectedStudent.email}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-sm">
                      <div>
                        <p className="text-secondary">Phone Number</p>
                        <p className="text-foreground font-medium">{selectedStudent.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-secondary">Hostel Name</p>
                        <p className="text-foreground font-medium">{selectedStudent.hostelName}</p>
                      </div>
                      <div>
                        <p className="text-secondary">Room Number</p>
                        <p className="text-foreground font-medium">{selectedStudent.roomNumber}</p>
                      </div>
                      {selectedStudent.fatherName && (
                        <div>
                          <p className="text-secondary">Father's Name</p>
                          <p className="text-foreground font-medium">{selectedStudent.fatherName}</p>
                        </div>
                      )}
                      {selectedStudent.fatherNumber && (
                        <div>
                          <p className="text-secondary">Father's Number</p>
                          <p className="text-foreground font-medium">{selectedStudent.fatherNumber}</p>
                        </div>
                      )}
                      {selectedStudent.motherName && (
                        <div>
                          <p className="text-secondary">Mother's Name</p>
                          <p className="text-foreground font-medium">{selectedStudent.motherName}</p>
                        </div>
                      )}
                      {selectedStudent.motherNumber && (
                        <div>
                          <p className="text-secondary">Mother's Number</p>
                          <p className="text-foreground font-medium">{selectedStudent.motherNumber}</p>
                        </div>
                      )}
                      {selectedStudent.homePinCode && (
                        <div>
                          <p className="text-secondary">Home Pin Code</p>
                          <p className="text-foreground font-medium">{selectedStudent.homePinCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingStudentId === selectedStudent.id}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingStudentId === selectedStudent.id ? "Removing..." : "Remove Student"}
                  </button>
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
                            className="rounded-lg border border-solid border-[#9CA3AF] bg-filler p-3 md:p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 md:gap-2 text-sm text-secondary mb-1">
                                  <span>{new Date(permission.fromDateTime).toLocaleString()}</span>
                                  <span>•</span>
                                  <span>to {new Date(permission.toDateTime).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-foreground">
                                  {permission.reason}
                                </p>
                              </div>
                              {showStatus && (
                                <Badge
                                  variant={permission.status === "allowed" ? "default" : "destructive"}
                                  className={`text-xs px-2 md:px-2.5 py-0.5 whitespace-nowrap ml-3 ${
                                    permission.status === "allowed"
                                      ? "bg-green-100 text-green-800 border-green-200"
                                      : "bg-red-100 text-red-800 border-red-200"
                                  }`}
                                >
                                  {permission.status === "allowed" ? "Accepted" : "Rejected"}
                                </Badge>
                              )}
                              {permission.status === "pending" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2 md:px-2.5 py-0.5 whitespace-nowrap ml-3 bg-yellow-100 text-yellow-800 border-yellow-200"
                                >
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
      )}
    </div>
  );
}

