import React, { useState, useEffect } from "react";
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
}

const FieldEnforcementComponent: React.FC<FieldEnforcementProps> = ({
  adminPassword = "",
  hostels = ["BOYS HOSTEL", "GANGOTRI HOSTEL", "GAYTRI HOSTEL", "GHB HOSTEL"],
}) => {
  const [selectedHostels, setSelectedHostels] = useState<string[]>([]);
  const [selectedStatusHostels, setSelectedStatusHostels] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<EnforcedField[]>([]);

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

  // Load available fields from admin settings
  const loadAvailableFields = async () => {
    try {
      const tenantParam = getTenantParam();
      const response = await fetch(`/api/admin/settings${tenantParam}`);
      const data = await response.json();
      if (data.success || data.formBuilderConfig) {
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
      console.error("Error loading available fields:", error);
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
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const rulesMap: Record<string, EnforcementRule> = {};
        data.data.forEach((rule: EnforcementRule) => {
          if (rule && rule.hostelName) {
            rulesMap[rule.hostelName.toLowerCase().trim()] = rule;
          }
        });
        setEnforcementRules(rulesMap);
      }
    } catch (error) {
      console.error("Error loading enforcement rules:", error);
      setMessage("Error loading enforcement rules");
    } finally {
      setLoading(false);
    }
  };

  const handleHostelSelect = (hostel: string) => {
    setSelectedHostels((prev) =>
      prev.includes(hostel)
        ? prev.filter((h) => h !== hostel)
        : [...prev, hostel]
    );

    // Load existing fields for this hostel
    const existingRule = enforcementRules[hostel.toLowerCase().trim()];
    if (existingRule) {
      setSelectedFields(existingRule.enforcedFields);
      setNotificationPriority(existingRule.notificationPriority);
      setSuccessMessage(existingRule.successMessage);
      setAutoCloseNotification(existingRule.autoCloseNotification);
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
      const updates = selectedHostels.map(async (hostel) => {
        const response = await fetch(`/api/admin/field-enforcement${tenantParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostelName: hostel,
            enforcedFields: selectedFields.map((f, idx) => ({
              ...f,
              order: idx + 1,
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
      setMessage(`✓ Field enforcement rules applied to ${selectedHostels.length} hostel(s)`);
      setSelectedHostels([]);
      setSelectedFields([]);
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
    setSelectedFields([]);
    setNotificationPriority("normal");
    setDisplayMode("on-login");
    setDurationDays("");
    setSkipCompleted(true);
    setSuccessMessage("All required fields have been completed! Thank you.");
    setAutoCloseNotification(true);
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl sm:rounded-2xl p-4 sm:p-8 border border-slate-200">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Field Enforcement Settings</h2>
        <p className="text-[10px] sm:text-sm text-slate-600">
          Manage which fields are displayed to students after login, and track completion status
        </p>
      </div>

      <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 border-b overflow-hidden flex-nowrap">
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
        <div className="space-y-8">
          {/* Message */}
          {message && (
            <div
              className={`p-3 sm:p-4 rounded-lg text-xs sm:text-sm ${message.includes("✓")
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
                }`}
            >
              {message}
            </div>
          )}

          {/* Step 1: Hostel Selection */}
          <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border border-slate-200">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 sm:mb-4">STEP 1: SELECT HOSTELS</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {hostels.map((hostel) => (
                <button
                  key={hostel}
                  onClick={() => handleHostelSelect(hostel)}
                  className={`p-2 sm:p-3 rounded-lg font-semibold transition text-center text-xs sm:text-sm ${selectedHostels.includes(hostel)
                    ? "bg-blue-600 text-white border-2 border-blue-700"
                    : "bg-slate-100 text-slate-900 border-2 border-slate-200 hover:bg-blue-50"
                    }`}
                >
                  {hostel}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2 sm:mt-3">
              {selectedHostels.length > 0
                ? `${selectedHostels.length} hostel(s) selected`
                : "Select hostels to apply rules"}
            </p>
          </div>

          {/* Step 2: Field Selection */}
          <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border border-slate-200">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-2 sm:mb-4">
              STEP 2: SELECT MANDATORY FIELDS
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-3 sm:mb-4">
              Applying to {selectedHostels.length || 0} hostel(s)
            </p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1 sm:gap-2 md:gap-3">
              {availableFields.map((field) => (
                <label
                  key={field.fieldId}
                  className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 md:p-3 rounded-lg border border-slate-200 hover:bg-blue-50 cursor-pointer transition text-[10px] sm:text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.some((f) => f.fieldId === field.fieldId)}
                    onChange={() => handleFieldToggle(field.fieldId)}
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded"
                  />
                  <span className="font-medium text-slate-900">{field.fieldLabel}</span>
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
                          className="w-full p-1.5 sm:p-2 text-xs border border-slate-300 rounded-lg"
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
                          className="w-full p-1.5 sm:p-2 text-xs border border-slate-300 rounded-lg"
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
                            className="w-4 h-4 rounded"
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
                    className="w-4 h-4 rounded"
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
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 sm:py-3 rounded-lg transition text-xs sm:text-sm"
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
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {hostels.map((hostel) => (
              <button
                key={hostel}
                onClick={() => loadCompletionStatus(hostel)}
                className={`p-2 sm:p-4 rounded-lg font-semibold transition text-xs sm:text-sm border ${selectedStatusHostels.includes(hostel)
                  ? "bg-blue-600 text-white border-blue-700 shadow-md"
                  : "bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100"
                  }`}
              >
                {hostel}
              </button>
            ))}
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
