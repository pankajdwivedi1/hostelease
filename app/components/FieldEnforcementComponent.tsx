import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface EnforcedField {
  fieldId: string;
  fieldLabel: string;
  isEnabled: boolean;
  displayMode: "on-login" | "on-first-incomplete" | "on-next-login";
  durationDays?: number;
  skipCompletedTitle?: string;
  skipCompleted?: boolean;
  order?: number;
  targetSemesters?: string[];
  targetStudentIds?: string[];
}

interface EnforcementRule {
  hostelName: string;
  enforcedFields: EnforcedField[];
  isActive: boolean;
  notificationPriority: "normal" | "urgent" | "critical";
  successMessage: string;
  autoCloseNotification: boolean;
}

interface CompletionStatus {
  hostelName: string;
  enforcedFields: EnforcedField[];
  studentsCompletionStatus: Array<{
    studentId: string;
    name: string;
    email: string;
    phone: string;
    registrationId: string;
    fieldStatuses: Array<{
      fieldId: string;
      fieldLabel: string;
      isCompleted: boolean;
      completedAt?: Date;
    }>;
    completedCount: number;
    totalFields: number;
    allCompleted: boolean;
  }>;
  completionStats: {
    totalStudents: number;
    totalFields: number;
    completedCount: number;
    pendingCount: number;
    completionPercentage: number;
  };
}

interface FieldEnforcementProps {
  adminPassword?: string;
  hostels?: string[];
  students?: any[];
}

const FieldEnforcementComponent: React.FC<FieldEnforcementProps> = ({
  adminPassword = "",
  hostels = ["BOYS HOSTEL", "GANGOTRI HOSTEL", "GAYTRI HOSTEL", "GHB HOSTEL"],
  students = [],
}) => {
  const [selectedHostels, setSelectedHostels] = useState<string[]>([]);
  const [selectedStatusHostels, setSelectedStatusHostels] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<EnforcedField[]>([]);

  // Semester & Student-wise enforcement states
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [allStudents, setAllStudents] = useState<any[]>(students || []);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  const [selectedFields, setSelectedFields] = useState<EnforcedField[]>([]);
  const [enforcementRules, setEnforcementRules] = useState<Record<string, EnforcementRule>>({});
  const [completionStatus, setCompletionStatus] = useState<Record<string, CompletionStatus>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"rules" | "status">("rules");

  // Settings for selected fields
  const [notificationPriority, setNotificationPriority] = useState<"normal" | "urgent" | "critical">("normal");
  const [displayMode, setDisplayMode] = useState<"on-login" | "on-first-incomplete" | "on-next-login">(
    "on-login"
  );
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [skipCompleted, setSkipCompleted] = useState(true);
  const [successMessage, setSuccessMessage] = useState(
    "All required fields have been completed! Thank you."
  );
  const [autoCloseNotification, setAutoCloseNotification] = useState(true);

  // Helper to get tenant from URL
  const getTenantParam = () => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const tenant = params.get('tenant');
    return tenant ? `?tenant=${tenant}` : '';
  };

  // Sync / fetch students
  useEffect(() => {
    if (students && students.length > 0) {
      setAllStudents(students);
    } else {
      const loadStudents = async () => {
        try {
          setLoadingStudents(true);
          const tenantParam = getTenantParam();
          const response = await fetch(`/api/students?limit=2000${tenantParam.replace('?', '&')}`);
          if (!response.ok) return;
          const data = await response.json();
          if (data && data.success && Array.isArray(data.students)) {
            setAllStudents(data.students);
          } else if (Array.isArray(data)) {
            setAllStudents(data);
          }
        } catch (err) {
          console.warn("Failed to load students for field enforcement:", err);
        } finally {
          setLoadingStudents(false);
        }
      };
      loadStudents();
    }
  }, [students]);

  // Load available fields from admin settings
  const loadAvailableFields = async () => {
    try {
      const tenantParam = getTenantParam();
      const response = await fetch(`/api/admin/settings${tenantParam}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data && (data.success || data.formBuilderConfig)) {
        // Extract fields from formBuilderConfig
        const formConfig = data.formBuilderConfig || [];
        const fields: EnforcedField[] = formConfig.map((field: any) => ({
          fieldId: field.id,
          fieldLabel: field.label,
          isEnabled: false,
          displayMode: "on-login" as const,
        }));
        setAvailableFields(fields);
      }
    } catch (error) {
      console.warn("Error loading available fields:", error);
      // Fallback to default fields if fetch fails
      setAvailableFields([
        { fieldId: "phoneNumber", fieldLabel: "Phone Number", isEnabled: false, displayMode: "on-login" },
        { fieldId: "name", fieldLabel: "Full Name", isEnabled: false, displayMode: "on-login" },
        { fieldId: "email", fieldLabel: "Email Address", isEnabled: false, displayMode: "on-login" },
        { fieldId: "fatherName", fieldLabel: "Father's Name", isEnabled: false, displayMode: "on-login" },
        { fieldId: "fatherNumber", fieldLabel: "Father's Number", isEnabled: false, displayMode: "on-login" },
        { fieldId: "motherName", fieldLabel: "Mother's Name", isEnabled: false, displayMode: "on-login" },
        { fieldId: "motherNumber", fieldLabel: "Mother's Number", isEnabled: false, displayMode: "on-login" },
        { fieldId: "dob", fieldLabel: "Date of Birth", isEnabled: false, displayMode: "on-login" },
        { fieldId: "category", fieldLabel: "Category", isEnabled: false, displayMode: "on-login" },
        { fieldId: "erpInformation", fieldLabel: "ERP ID", isEnabled: false, displayMode: "on-login" },
        { fieldId: "collegeName", fieldLabel: "College Name", isEnabled: false, displayMode: "on-login" },
        { fieldId: "branch", fieldLabel: "Branch", isEnabled: false, displayMode: "on-login" },
        { fieldId: "year", fieldLabel: "Year", isEnabled: false, displayMode: "on-login" },
        { fieldId: "semester", fieldLabel: "Semester", isEnabled: false, displayMode: "on-login" },
        { fieldId: "section", fieldLabel: "Section", isEnabled: false, displayMode: "on-login" },
        { fieldId: "permanentAddress", fieldLabel: "Permanent Address", isEnabled: false, displayMode: "on-login" },
        { fieldId: "homeState", fieldLabel: "Home State", isEnabled: false, displayMode: "on-login" },
        { fieldId: "localGuardianAddress", fieldLabel: "Local Guardian Address", isEnabled: false, displayMode: "on-login" },
        { fieldId: "localGuardianPhoneNumber", fieldLabel: "Local Guardian Phone", isEnabled: false, displayMode: "on-login" },
      ]);
    }
  };

  // Load existing rules and available fields
  useEffect(() => {
    loadEnforcementRules();
    loadAvailableFields();
  }, []);

  const loadEnforcementRules = async () => {
    try {
      setLoading(true);
      const tenantParam = getTenantParam();
      const response = await fetch(`/api/admin/field-enforcement${tenantParam}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.success && Array.isArray(data.data)) {
        const rulesMap: Record<string, EnforcementRule> = {};
        data.data.forEach((rule: EnforcementRule) => {
          if (rule && rule.hostelName) {
            rulesMap[rule.hostelName.toLowerCase().trim()] = rule;
          }
        });
        setEnforcementRules(rulesMap);
      }
    } catch (error) {
      console.warn("Error loading enforcement rules:", error);
      setMessage("Error loading enforcement rules");
    } finally {
      setLoading(false);
    }
  };

  const handleHostelSelect = (hostel: string) => {
    let nextHostels: string[];
    if (selectedHostels.includes(hostel)) {
      nextHostels = selectedHostels.filter((h) => h !== hostel);
    } else {
      nextHostels = [...selectedHostels, hostel];
    }
    setSelectedHostels(nextHostels);

    if (nextHostels.length === 0) {
      setSelectedFields([]);
    } else {
      const existingRule = enforcementRules[hostel.toLowerCase().trim()];
      if (existingRule) {
        setSelectedFields(existingRule.enforcedFields || []);
        setNotificationPriority(existingRule.notificationPriority || "normal");
        setSuccessMessage(existingRule.successMessage || "All required fields have been completed! Thank you.");
        setAutoCloseNotification(existingRule.autoCloseNotification ?? true);

        // Auto-restore semester and students if configured in rule
        const firstWithSem = (existingRule.enforcedFields || []).find((f: any) => Array.isArray(f.targetSemesters) && f.targetSemesters.length > 0);
        if (firstWithSem && firstWithSem.targetSemesters && firstWithSem.targetSemesters[0]) {
          setSelectedSemester(firstWithSem.targetSemesters[0]);
        }
        const firstWithStudents = (existingRule.enforcedFields || []).find((f: any) => Array.isArray(f.targetStudentIds) && f.targetStudentIds.length > 0);
        if (firstWithStudents && firstWithStudents.targetStudentIds && firstWithStudents.targetStudentIds.length > 0) {
          setSelectedStudentIds(firstWithStudents.targetStudentIds);
        }
      }
    }
  };

  // Filter students based on selected hostel and selected semester
  const filteredStudents = useMemo(() => {
    if (!allStudents || allStudents.length === 0) return [];
    return allStudents.filter((st: any) => {
      // 1. Filter by selected hostels (if hostels are chosen)
      if (selectedHostels.length > 0) {
        const hName = (st.hostelName || "").trim().toLowerCase();
        const matchHostel = selectedHostels.some(h => h.trim().toLowerCase() === hName);
        if (!matchHostel) return false;
      }
      // 2. Filter by selected semester
      if (selectedSemester && selectedSemester !== "all") {
        const sSem = (st.semester || "").toString().trim().toUpperCase();
        const sTarget = selectedSemester.toString().trim().toUpperCase();
        const sDigit = sSem.match(/\d+/)?.[0];
        const tDigit = sTarget.match(/\d+/)?.[0];
        if (sDigit && tDigit) {
          if (sDigit !== tDigit) return false;
        } else if (!sSem.includes(sTarget) && !sTarget.includes(sSem)) {
          return false;
        }
      }
      return true;
    });
  }, [allStudents, selectedHostels, selectedSemester]);

  // Count students per semester based on selected hostel (or all hostels)
  const semesterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
      "7": 0,
      "8": 0,
    };

    if (!allStudents || allStudents.length === 0) return counts;

    const hostelStudents = selectedHostels.length > 0
      ? allStudents.filter((st: any) => {
          const hName = (st.hostelName || "").trim().toLowerCase();
          return selectedHostels.some(h => h.trim().toLowerCase() === hName);
        })
      : allStudents;

    counts.all = hostelStudents.length;

    hostelStudents.forEach((st: any) => {
      const sSem = (st.semester || "").toString().trim().toUpperCase();
      const digit = sSem.match(/\d+/)?.[0];
      if (digit && counts[digit] !== undefined) {
        counts[digit]++;
      }
    });

    return counts;
  }, [allStudents, selectedHostels]);

  // Filtered by search query for display
  const displayedStudents = useMemo(() => {
    if (!studentSearchQuery) return filteredStudents;
    const q = studentSearchQuery.toLowerCase().trim();
    return filteredStudents.filter((st: any) =>
      (st.name || "").toLowerCase().includes(q) ||
      (st.registrationId || "").toLowerCase().includes(q) ||
      (st.roomNumber || "").toLowerCase().includes(q) ||
      (st.erpId || "").toLowerCase().includes(q) ||
      (st.erpInformation || "").toLowerCase().includes(q) ||
      (st.dynamicFields?.erpId || "").toLowerCase().includes(q) ||
      (st.dynamicFields?.erpInformation || "").toLowerCase().includes(q) ||
      (st.email || "").toLowerCase().includes(q) ||
      (st.phoneNumber || "").includes(q)
    );
  }, [filteredStudents, studentSearchQuery]);

  // Handle select all / deselect all students
  const handleSelectAllFilteredStudents = () => {
    const ids = filteredStudents.map((s: any) => (s._id || s.id || "").toString());
    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAllStudents = () => {
    const currentFilteredIds = new Set(filteredStudents.map((s: any) => (s._id || s.id || "").toString()));
    setSelectedStudentIds(prev => prev.filter(id => !currentFilteredIds.has(id)));
  };

  const handleToggleStudent = (id: string) => {
    const sId = id.toString();
    setSelectedStudentIds(prev =>
      prev.includes(sId) ? prev.filter(item => item !== sId) : [...prev, sId]
    );
  };

  const deactivateAllRules = async () => {
    if (!confirm("Are you sure you want to deactivate all field enforcement rules for all hostels? Students will not be prompted on login.")) {
      return;
    }
    try {
      setLoading(true);
      const tenantParam = getTenantParam();
      for (const h of hostels) {
        await fetch(`/api/admin/field-enforcement${tenantParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostelName: h,
            enforcedFields: [],
            isActive: false,
            notificationPriority: "normal",
            successMessage: "All required fields have been completed! Thank you.",
            autoCloseNotification: true,
            targetSemesters: [],
            targetStudentIds: [],
          }),
        });
      }
      setSelectedFields([]);
      setSelectedHostels([]);
      setSelectedSemester("");
      setSelectedStudentIds([]);
      setMessage("✓ All field enforcement rules have been deactivated successfully.");
      await loadEnforcementRules();
    } catch (err: any) {
      setMessage("Failed to deactivate rules: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields((prev) => {
      const existing = prev.find((f) => f.fieldId === fieldId);
      if (existing) {
        return prev.filter((f) => f.fieldId !== fieldId);
      } else {
        const field = availableFields.find((f) => f.fieldId === fieldId);
        if (field) {
          return [
            ...prev,
            {
              ...field,
              isEnabled: true,
              displayMode,
              durationDays: durationDays !== "" ? durationDays : undefined,
              skipCompleted,
              order: prev.length + 1,
              targetSemesters: selectedSemester ? (selectedSemester === "all" ? [] : [selectedSemester]) : [],
              targetStudentIds: selectedStudentIds,
            },
          ];
        }
      }
      return prev;
    });
  };

  const updateFieldSetting = (fieldId: string, key: string, value: any) => {
    setSelectedFields((prev) =>
      prev.map((field) =>
        field.fieldId === fieldId ? { ...field, [key]: value } : field
      )
    );
  };

  const applyRulesToHostels = async () => {
    if (selectedHostels.length === 0 || selectedFields.length === 0) {
      setMessage("Please select at least one hostel and one field");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const tenantParam = getTenantParam();
      const targetSemArray = selectedSemester ? (selectedSemester === "all" ? [] : [selectedSemester]) : [];

      const updates = selectedHostels.map(async (hostel) => {
        const response = await fetch(`/api/admin/field-enforcement${tenantParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostelName: hostel,
            targetSemesters: targetSemArray,
            targetStudentIds: selectedStudentIds,
            enforcedFields: selectedFields.map((f, idx) => ({
              ...f,
              order: idx + 1,
              targetSemesters: targetSemArray,
              targetStudentIds: selectedStudentIds,
            })),
            isActive: true,
            notificationPriority,
            successMessage,
            autoCloseNotification,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update ${hostel}`);
        }

        return response.json();
      });

      await Promise.all(updates);
      await loadEnforcementRules();

      const studentScopeText = selectedStudentIds.length > 0
        ? `for ${selectedStudentIds.length} specific student(s)`
        : selectedSemester
          ? `for ${selectedSemester === "all" ? "all semesters" : `Semester ${selectedSemester}`}`
          : "hostel-wide";

      setMessage(`✓ Field enforcement rules applied to ${selectedHostels.length} hostel(s) ${studentScopeText}`);
    } catch (error) {
      console.error("Error applying rules:", error);
      setMessage("Error applying rules");
    } finally {
      setLoading(false);
    }
  };

  const loadCompletionStatus = async (hostel: string) => {
    // Toggle logic
    if (selectedStatusHostels.includes(hostel)) {
      setSelectedStatusHostels(prev => prev.filter(h => h !== hostel));
      return;
    }

    setSelectedStatusHostels(prev => [...prev, hostel]);

    // Only fetch if not already in dictionary
    if (completionStatus[hostel]) return;

    try {
      setLoading(true);
      const tenantParam = getTenantParam();
      const response = await fetch(`/api/admin/field-enforcement/status?hostelName=${hostel}${tenantParam.replace('?', '&')}`);
      const data = await response.json();
      if (data.success) {
        setCompletionStatus((prev) => ({
          ...prev,
          [hostel]: data.data,
        }));
      }
    } catch (error) {
      console.error("Error loading completion status:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetAllFields = () => {
    setSelectedHostels([]);
    setSelectedSemester("");
    setSelectedStudentIds([]);
    setStudentSearchQuery("");
    setSelectedFields([]);
    setNotificationPriority("normal");
    setDisplayMode("on-login");
    setDurationDays("");
    setSkipCompleted(true);
    setSuccessMessage("All required fields have been completed! Thank you.");
    setAutoCloseNotification(true);
  };

  return (
    <div className="bg-transparent sm:bg-gradient-to-br sm:from-slate-50 sm:to-slate-100 sm:rounded-2xl p-0 sm:p-8 border-0 sm:border sm:border-slate-200">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-sm sm:text-base md:text-lg font-bold text-foreground leading-tight tracking-tight mb-0.5">Field Enforcement Settings</h2>
        <p className="text-[9px] sm:text-xs text-slate-600">
          Manage which fields are displayed to students after login, and track completion status
        </p>
      </div>

      <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6 border-b overflow-hidden flex-nowrap">
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold transition whitespace-nowrap ${activeTab === "rules"
            ? "text-blue-600 border-b-2 border-blue-600"
            : "text-slate-600 hover:text-slate-900"
            }`}
        >
          📋 Configure
        </button>
        <button
          onClick={() => setActiveTab("status")}
          className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold transition whitespace-nowrap ${activeTab === "status"
            ? "text-blue-600 border-b-2 border-blue-600"
            : "text-slate-600 hover:text-slate-900"
            }`}
        >
          📊 Status
        </button>
      </div>

      {/* Rules Configuration Tab */}
      {activeTab === "rules" && (
        <div className="space-y-3.5 sm:space-y-6">
          {/* Message */}
          {message && (
            <div
              className={`p-2.5 sm:p-4 rounded-lg text-[10px] sm:text-xs ${message.includes("✓")
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
                }`}
            >
              {message}
            </div>
          )}

          {/* Step 1: Hostel & Semester Selection */}
          <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-5 border border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3.5">
              <h3 className="text-[10px] sm:text-xs font-bold text-slate-900">
                STEP 1: SELECT HOSTELS & SEMESTER
              </h3>
              <button
                onClick={deactivateAllRules}
                disabled={loading}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md sm:rounded-lg text-[8px] sm:text-[10px] font-bold transition flex items-center gap-1"
              >
                🚫 Deactivate All Enforcement
              </button>
            </div>

            {/* Controls Bar: Hostel Dropdown + Semester Dropdown side-by-side on mobile & desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                {/* Choose Hostel */}
                <div className="min-w-0">
                  <select
                    value=""
                    onChange={(e) => {
                      const h = e.target.value;
                      if (h && !selectedHostels.includes(h)) {
                        setSelectedHostels([...selectedHostels, h]);
                      }
                    }}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition cursor-pointer truncate"
                  >
                    <option value="">-- Choose Hostel --</option>
                    {hostels.map(h => (
                      <option key={h} value={h} disabled={selectedHostels.includes(h)}>
                        {h} {selectedHostels.includes(h) ? "(Already Selected)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 👉 Choose Semester Dropdown: Placed directly to the right of Choose Hostel */}
                <div className="min-w-0">
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-indigo-200 rounded-lg px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-indigo-900 outline-none focus:border-indigo-500 transition cursor-pointer truncate"
                  >
                    <option value="">-- Choose Semester --</option>
                    <option value="all">All Semesters ({semesterCounts.all})</option>
                    <option value="1">Semester 1 ({semesterCounts["1"]})</option>
                    <option value="2">Semester 2 ({semesterCounts["2"]})</option>
                    <option value="3">Semester 3 ({semesterCounts["3"]})</option>
                    <option value="4">Semester 4 ({semesterCounts["4"]})</option>
                    <option value="5">Semester 5 ({semesterCounts["5"]})</option>
                    <option value="6">Semester 6 ({semesterCounts["6"]})</option>
                    <option value="7">Semester 7 ({semesterCounts["7"]})</option>
                    <option value="8">Semester 8 ({semesterCounts["8"]})</option>
                  </select>
                </div>
              </div>

              {/* Select All Hostels Button */}
              <button
                type="button"
                onClick={() => {
                  if (selectedHostels.length === hostels.length) {
                    setSelectedHostels([]);
                  } else {
                    setSelectedHostels([...hostels]);
                  }
                }}
                className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] sm:text-xs rounded-lg transition whitespace-nowrap text-center"
              >
                {selectedHostels.length === hostels.length ? "Deselect All" : "Select All Hostels"}
              </button>
            </div>

            {/* Selected Hostels Badges */}
            {selectedHostels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {selectedHostels.map(h => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-[9px] sm:text-xs font-bold"
                  >
                    {h}
                    <button
                      type="button"
                      onClick={() => setSelectedHostels(selectedHostels.filter(item => item !== h))}
                      className="text-blue-500 hover:text-blue-700 font-black ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-2 text-[9px] sm:text-[11px] text-slate-500">
              <span>
                {selectedHostels.length > 0
                  ? `${selectedHostels.length} hostel(s) selected`
                  : "Select hostels to apply rules"}
              </span>
              {selectedSemester && (
                <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                  {selectedSemester === "all" ? `All Semesters (${semesterCounts.all} Students)` : `Semester ${selectedSemester} (${semesterCounts[selectedSemester] || 0} Students)`}
                </span>
              )}
            </div>

            {/* 👉 STUDENT SELECTION CHECKLIST (APPEARS UNDER CHOOSE SEMESTER) */}
            {selectedSemester && (
              <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg">👥</span>
                    <div>
                      <h4 className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-tight">
                        Select Students to Enforce ({filteredStudents.length} Students in {selectedSemester === "all" ? "All Semesters" : `Semester ${selectedSemester}`})
                      </h4>
                      <p className="text-[8.5px] sm:text-[9.5px] text-slate-500">
                        Check specific students to enforce field completion, or click "Check All"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredStudents}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-[9px] sm:text-[10px] font-bold transition"
                    >
                      Check All ({filteredStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllStudents}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[9px] sm:text-[10px] font-bold transition"
                    >
                      Uncheck All
                    </button>
                    <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-md text-[9px] sm:text-[10px] font-bold shadow-xs">
                      {selectedStudentIds.length} Selected
                    </span>
                  </div>
                </div>

                {/* Quick Search inside Students */}
                <div className="mb-2.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      placeholder="🔍 Search student by name, registration ID, room, ERP ID..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 outline-none transition"
                    />
                    {studentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStudentSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Student Cards with Checkboxes */}
                {displayedStudents.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto pr-0 sm:pr-1 border-0 sm:border border-slate-200 rounded-none sm:rounded-xl bg-transparent sm:bg-slate-50/70 p-0 sm:p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                    {displayedStudents.map((st: any) => {
                      const stId = (st._id || st.id || "").toString();
                      const isChecked = selectedStudentIds.includes(stId);
                      const erpId = st.erpId || st.erpInformation || st.dynamicFields?.erpId || st.dynamicFields?.erpInformation || "";
                      return (
                        <label
                          key={stId}
                          className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition select-none ${
                            isChecked
                              ? "bg-indigo-50 border-indigo-300 shadow-xs"
                              : "bg-white border-slate-200 hover:bg-slate-100/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudent(stId)}
                            className="mt-0.5 w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-[10px] sm:text-[11px] font-bold text-slate-900 truncate">
                                {st.name}
                              </p>
                              <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase shrink-0">
                                Sem {st.semester || selectedSemester}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[8.5px] text-slate-500 font-medium overflow-hidden">
                              <span className="truncate shrink-0">{st.registrationId || st.rollNumber || "ID: " + stId.slice(-4)}</span>
                              <span>•</span>
                              <span className="truncate shrink-0">{st.roomNumber ? `Room ${st.roomNumber}` : st.hostelName}</span>
                              {erpId && (
                                <>
                                  <span>•</span>
                                  <span className="truncate font-semibold text-slate-700">{erpId}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-center bg-white rounded-xl border border-dashed border-slate-200">
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                      {loadingStudents
                        ? "Loading students..."
                        : `No students found matching ${selectedSemester === "all" ? "the selected hostels" : `Semester ${selectedSemester}`}.`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Field Selection (Mandatory Fields to Enforce) */}
          <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-5 border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5 sm:mb-3">
              <h3 className="text-[10px] sm:text-xs font-bold text-slate-900">
                STEP 2: SELECT MANDATORY FIELDS
              </h3>
              <span className="text-[9px] sm:text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md self-start sm:self-auto">
                {selectedStudentIds.length > 0
                  ? `Targeting ${selectedStudentIds.length} Student(s)`
                  : selectedSemester
                    ? `Targeting All Students in ${selectedSemester === 'all' ? 'All Semesters' : `Semester ${selectedSemester}`}`
                    : `Targeting All Students in ${selectedHostels.length || 0} Hostel(s)`}
              </span>
            </div>
            <p className="text-[9px] sm:text-xs text-slate-500 mb-2.5 sm:mb-3.5">
              Select which fields students will be forced to complete upon login:
            </p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1 sm:gap-2 md:gap-3">
              {availableFields.map((field) => (
                <label
                  key={field.fieldId}
                  title={field.fieldLabel}
                  className="flex items-center gap-1 sm:gap-2 p-1 sm:p-2 md:p-3 rounded-md sm:rounded-lg border border-slate-200 hover:bg-blue-50 cursor-pointer transition text-[8.5px] sm:text-[10px] md:text-xs min-w-0 shadow-2xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.some((f) => f.fieldId === field.fieldId)}
                    onChange={() => handleFieldToggle(field.fieldId)}
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 shrink-0"
                  />
                  <span className="font-semibold text-slate-900 truncate leading-tight min-w-0 flex-1">{field.fieldLabel}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 3: Field Configuration */}
          {selectedFields.length > 0 && (
            <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border border-slate-200">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 sm:mb-4">
                STEP 3: CONFIGURE SELECTED FIELDS
              </h3>
              <div className="space-y-3 sm:space-y-4">
                {selectedFields.map((field, idx) => (
                  <div key={field.fieldId} className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-start mb-2 sm:mb-3">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-xs sm:text-sm">{field.fieldLabel}</h4>
                        <p className="text-xs text-slate-500">Order: {idx + 1}</p>
                      </div>
                      <button
                        onClick={() =>
                          setSelectedFields((prev) =>
                            prev.filter((f) => f.fieldId !== field.fieldId)
                          )
                        }
                        className="text-red-600 hover:text-red-700 font-semibold text-xs sm:text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Display Mode</label>
                        <select
                          value={field.displayMode || "on-login"}
                          onChange={(e) =>
                            updateFieldSetting(
                              field.fieldId,
                              "displayMode",
                              e.target.value as any
                            )
                          }
                          className="w-full p-1.5 sm:p-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="on-login">On Login</option>
                          <option value="on-first-incomplete">On First Incomplete</option>
                          <option value="on-next-login">On Next Login</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Duration (Days)</label>
                        <input
                          type="number"
                          value={field.durationDays ?? ""}
                          onChange={(e) =>
                            updateFieldSetting(
                              field.fieldId,
                              "durationDays",
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                          placeholder="No limit"
                          className="w-full p-1.5 sm:p-2 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!field.skipCompleted}
                            onChange={(e) =>
                              updateFieldSetting(field.fieldId, "skipCompleted", e.target.checked)
                            }
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-xs font-medium text-slate-900">
                            Hide after completion
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Global Settings */}
          <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border border-slate-200">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 sm:mb-4">STEP 4: GLOBAL SETTINGS</h3>
            <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                  Notification Priority
                </label>
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  {["normal", "urgent", "critical"].map((priority) => (
                    <button
                      key={priority}
                      onClick={() => setNotificationPriority(priority as any)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold transition text-xs sm:text-sm ${notificationPriority === priority
                        ? `${priority === "normal"
                          ? "bg-blue-600 text-white"
                          : priority === "urgent"
                            ? "bg-orange-600 text-white"
                            : "bg-red-600 text-white"
                        }`
                        : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                        }`}
                    >
                      {priority.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                  Success Message
                </label>
                <textarea
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg text-xs sm:text-sm"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 items-start">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCloseNotification}
                    onChange={(e) => setAutoCloseNotification(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs sm:text-sm font-medium text-slate-900">
                    Auto-close notification after completion
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={applyRulesToHostels}
              disabled={loading || selectedHostels.length === 0 || selectedFields.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 sm:py-3 rounded-lg transition text-xs sm:text-sm shadow-sm"
            >
              {loading ? "Applying..." : "✓ APPLY RULES"}
            </button>
            <button
              onClick={resetAllFields}
              className="px-4 sm:px-6 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold py-2 sm:py-3 rounded-lg transition text-xs sm:text-sm whitespace-nowrap"
            >
              CLEAR
            </button>
          </div>
        </div>
      )}

      {/* Status View Tab */}
      {activeTab === "status" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <label className="block text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                🏢 Select Hostel to Inspect Status
              </label>
              <select
                value=""
                onChange={(e) => {
                  const h = e.target.value;
                  if (h) {
                    loadCompletionStatus(h);
                  }
                }}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition cursor-pointer"
              >
                <option value="">-- Choose a Hostel --</option>
                {hostels.map(h => (
                  <option key={h} value={h}>
                    {h} {selectedStatusHostels.includes(h) ? "(Viewing)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                hostels.forEach(h => loadCompletionStatus(h));
              }}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] sm:text-xs rounded-lg border border-blue-200 transition self-end sm:self-auto"
            >
              Load All Hostels
            </button>
          </div>

          {selectedStatusHostels.map((hostel) => {
            const status = completionStatus[hostel];
            if (!status) return null;

            return (
              <div key={hostel} className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tighter">{hostel}</h3>
                  <button
                    onClick={() => setSelectedStatusHostels(prev => prev.filter(h => h !== hostel))}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Overall Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <div className="bg-slate-50 p-2 sm:p-4 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Students</p>
                    <p className="text-xl sm:text-3xl font-black text-slate-900">
                      {status.completionStats.totalStudents}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-2 sm:p-4 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enforced Fields</p>
                    <p className="text-xl sm:text-3xl font-black text-slate-900">
                      {status.completionStats.totalFields}
                    </p>
                  </div>
                  <div className="bg-green-50 p-2 sm:p-4 rounded-lg border border-green-100">
                    <p className="text-[10px] font-black text-green-600/50 uppercase tracking-widest">Completed</p>
                    <p className="text-xl sm:text-3xl font-black text-green-600">
                      {status.completionStats.completedCount}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-2 sm:p-4 rounded-lg border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600/50 uppercase tracking-widest">Completion %</p>
                    <p className="text-xl sm:text-3xl font-black text-blue-600">
                      {status.completionStats.completionPercentage}%
                    </p>
                  </div>
                </div>

                {/* Students Table */}
                {status.studentsCompletionStatus.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50/50 border-b">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-2 sm:px-4 py-3 text-left">Student</th>
                          <th className="px-2 sm:px-4 py-3 text-center">Progress</th>
                          <th className="px-2 sm:px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.studentsCompletionStatus.map((student) => (
                          <tr key={student.studentId} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="px-2 sm:px-4 py-3">
                              <div>
                                <p className="font-bold text-slate-900 uppercase tracking-tight">{student.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">{student.registrationId}</p>
                              </div>
                            </td>
                            <td className="px-2 sm:px-4 py-3 text-center">
                              <p className="font-black text-xs sm:text-sm text-slate-700">
                                {student.completedCount}/{student.totalFields}
                              </p>
                            </td>
                            <td className="px-2 sm:px-4 py-3 text-center">
                              {student.allCompleted ? (
                                <div className="inline-flex items-center justify-center bg-green-100 text-green-700 p-1.5 rounded-lg">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center bg-amber-100 text-amber-700 p-1.5 rounded-lg">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-6 sm:py-8 text-xs sm:text-sm italic">No field enforcement rules configured for this hostel</p>
                )}
              </div>
            );
          })}

          {selectedStatusHostels.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Select a hostel above to view enrollment status</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldEnforcementComponent;
