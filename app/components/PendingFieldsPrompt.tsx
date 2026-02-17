"use client";

import React, { useState, useEffect } from "react";
import { markFieldAsCompleted, PendingField, fetchPendingFields } from "@/lib/fieldEnforcementExamples";

interface PendingFieldsPromptProps {
  firebaseUID: string;
  hostelName: string;
  onFieldsComplete?: () => void;
}

/**
 * Component to display pending fields that need to be completed
 * Shows as a notification banner with a list of incomplete fields
 */
export const PendingFieldsPrompt: React.FC<PendingFieldsPromptProps> = ({
  firebaseUID,
  hostelName,
  onFieldsComplete,
}) => {
  const [pendingFields, setPendingFields] = useState<PendingField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAsComplete, setMarkingAsComplete] = useState(false);

  // Load pending fields on mount
  useEffect(() => {
    const loadFields = async () => {
      try {
        setLoading(true);
        const result = await fetchPendingFields(firebaseUID, hostelName);
        setPendingFields(result.pendingFields);
        setError(result.error);
      } catch (err) {
        setError("Error loading pending fields");
      } finally {
        setLoading(false);
      }
    };

    if (firebaseUID && hostelName) {
      loadFields();
    }
  }, [firebaseUID, hostelName]);

  // Function to handle field completion
  const handleCompleteField = async (fieldId: string) => {
    try {
      setMarkingAsComplete(true);
      await markFieldAsCompleted(firebaseUID, hostelName, fieldId);
      // Remove from pending list
      setPendingFields((prev) => prev.filter((f) => f.fieldId !== fieldId));
      // Call callback if all fields are now complete
      if (pendingFields.length === 1) {
        onFieldsComplete?.();
      }
    } catch (error) {
      console.error("Error completing field:", error);
      setError("Error marking field as complete");
    } finally {
      setMarkingAsComplete(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        Loading pending fields...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg border border-red-200">
        Error: {error}
      </div>
    );
  }

  if (pendingFields.length === 0) {
    return null; // Don't show if no pending fields
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mb-6">
      <div className="flex items-start gap-4">
        <div className="text-2xl">ℹ️</div>
        <div className="flex-1">
          <h3 className="font-bold text-blue-900 mb-2">Complete Your Profile</h3>
          <p className="text-blue-800 text-sm mb-4">
            You have {pendingFields.length} field(s) that need to be completed
          </p>
          <div className="space-y-2">
            {pendingFields.map((field) => (
              <div
                key={field.fieldId}
                className="flex items-center justify-between bg-white p-3 rounded-lg"
              >
                <span className="text-sm font-medium text-gray-900">
                  {field.fieldLabel}
                </span>
                <button
                  onClick={() => handleCompleteField(field.fieldId)}
                  disabled={markingAsComplete}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition"
                >
                  {markingAsComplete ? "..." : "Complete"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingFieldsPrompt;
