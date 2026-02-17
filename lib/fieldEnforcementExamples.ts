// Utilities for Field Enforcement
// Non-React helper functions for managing field enforcement

export interface PendingField {
  fieldId: string;
  fieldLabel: string;
  isEnabled: boolean;
  displayMode: "on-login" | "on-first-incomplete" | "on-next-login";
  durationDays?: number;
}

/**
 * Mark a field as completed
 */
export const markFieldAsCompleted = async (
  firebaseUID: string,
  hostelName: string,
  fieldId: string
) => {
  try {
    const response = await fetch(
      "/api/admin/field-enforcement/progress",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUID,
          hostelName,
          fieldId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to mark field as completed");
    }

    return response.json();
  } catch (error) {
    console.error("Error marking field as completed:", error);
    throw error;
  }
};

/**
 * Initialize field progress for a student (call when student logs in for first time)
 */
export const initializeFieldProgress = async (
  firebaseUID: string,
  hostelName: string
) => {
  try {
    const response = await fetch(
      "/api/admin/field-enforcement/progress",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseUID,
          hostelName,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to initialize field progress");
    }

    return response.json();
  } catch (error) {
    console.error("Error initializing field progress:", error);
    throw error;
  }
};

/**
 * Fetch pending fields for a student
 */
export const fetchPendingFields = async (
  firebaseUID: string,
  hostelName: string
) => {
  try {
    const response = await fetch(
      `/api/admin/field-enforcement/progress?firebaseUID=${firebaseUID}&hostelName=${hostelName}`
    );
    const data = await response.json();

    if (data.success) {
      return {
        pendingFields: data.data.pendingFields || [],
        completedFields: data.data.completedFields || [],
        allCompleted: data.data.allCompleted || false,
        error: null,
      };
    } else {
      return {
        pendingFields: [],
        completedFields: [],
        allCompleted: false,
        error: data.error || "Failed to fetch pending fields",
      };
    }
  } catch (error) {
    console.error("Error fetching pending fields:", error);
    return {
      pendingFields: [],
      completedFields: [],
      allCompleted: false,
      error: "Error fetching pending fields",
    };
  }
};
