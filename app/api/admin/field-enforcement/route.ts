import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { createCachedResponse } from "@/lib/cacheHelper";

export const dynamic = "force-dynamic";

// GET all field enforcement rules or for a specific hostel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    let filter: any = {};
    if (hostelName) {
      filter.hostelName = { $regex: `^${hostelName.trim()}$` };
    }

    const enforcementRules = await db.fieldEnforcement.find(filter);

    return createCachedResponse({
      success: true,
      data: enforcementRules,
    }, request, 30);
  } catch (error: any) {
    console.error("Error fetching field enforcement rules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch field enforcement rules" },
      { status: 500 }
    );
  }
}

// Helper to deactivate enforcement for specific students
async function deactivateStudentsEnforcement(hostelList: string[], studentIds: string[]) {
  const cleanStudentIds = (studentIds || []).map(id => String(id).trim()).filter(Boolean);
  if (cleanStudentIds.length === 0) {
    return { success: false, error: "studentIds array must not be empty" };
  }

  // Determine target hostels
  let targetHostels = (hostelList || []).map(h => String(h).trim()).filter(Boolean);
  if (targetHostels.length === 0) {
    const activeRules = await db.fieldEnforcement.find({ isActive: true });
    targetHostels = (activeRules || []).map((r: any) => r.hostelName).filter(Boolean);
  }

  if (targetHostels.length === 0) {
    const allRules = await db.fieldEnforcement.find({});
    targetHostels = (allRules || []).filter((r: any) => {
      const ids = Array.isArray(r.targetStudentIds) ? r.targetStudentIds : [];
      return ids.some((id: string) => cleanStudentIds.includes(String(id)));
    }).map((r: any) => r.hostelName).filter(Boolean);
  }

  console.log(`[FieldEnforcement API] Deactivating ${cleanStudentIds.length} students across hostels:`, targetHostels);

  const updatedRules = [];

  for (const hostel of targetHostels) {
    const rules = await db.fieldEnforcement.find({
      hostelName: { $regex: `^${hostel.trim()}$` }
    });
    const rule = rules && rules.length > 0 ? rules[0] : null;
    if (!rule) continue;

    const currentRuleTargets = Array.isArray(rule.targetStudentIds) ? rule.targetStudentIds.map(String) : [];
    const hadSpecificRuleTargets = currentRuleTargets.length > 0;
    const updatedRuleTargets = currentRuleTargets.filter(id => !cleanStudentIds.includes(id));

    const currentRuleExclusions = Array.isArray(rule.excludedStudentIds) ? rule.excludedStudentIds.map(String) : [];
    const updatedRuleExclusions = Array.from(new Set([...currentRuleExclusions, ...cleanStudentIds]));

    const updatedFields = (rule.enforcedFields || []).map((f: any) => {
      const fieldTargets = Array.isArray(f.targetStudentIds) ? f.targetStudentIds.map(String) : [];
      const newFieldTargets = fieldTargets.filter(id => !cleanStudentIds.includes(id));

      const fieldExclusions = Array.isArray(f.excludedStudentIds) ? f.excludedStudentIds.map(String) : [];
      const newFieldExclusions = Array.from(new Set([...fieldExclusions, ...cleanStudentIds]));

      return {
        ...f,
        targetStudentIds: newFieldTargets,
        excludedStudentIds: newFieldExclusions,
      };
    });

    let isActive = rule.isActive;
    const anyFieldHasTargets = updatedFields.some((f: any) => Array.isArray(f.targetStudentIds) && f.targetStudentIds.length > 0);
    if (hadSpecificRuleTargets && updatedRuleTargets.length === 0 && !anyFieldHasTargets) {
      isActive = false;
    }

    const updated = await db.fieldEnforcement.findOneAndUpdate(
      { hostelName: rule.hostelName },
      {
        $set: {
          targetStudentIds: updatedRuleTargets,
          excludedStudentIds: updatedRuleExclusions,
          enforcedFields: updatedFields,
          isActive,
          updatedAt: new Date(),
        }
      },
      { new: true }
    );
    updatedRules.push(updated);

    // Mark studentFieldProgress as completed/exempted
    for (const studentId of cleanStudentIds) {
      for (const f of rule.enforcedFields || []) {
        try {
          await db.studentFieldProgress.upsert({
            studentId,
            hostelName: rule.hostelName,
            fieldId: f.fieldId,
            fieldLabel: f.fieldLabel || f.fieldId,
            isCompleted: true,
            completedAt: new Date(),
          });
        } catch (progErr) {
          console.warn("[FieldEnforcement API] Error updating studentFieldProgress on deactivation:", progErr);
        }
      }
    }
  }

  // Clear any pending enforcement notifications for deactivated students
  try {
    for (const sId of cleanStudentIds) {
      await db.notifications.deleteMany({
        targetStudentId: sId,
        message: { $regex: "Please update your", $options: "i" }
      });
    }
  } catch (notifErr) {
    console.warn("[FieldEnforcement API] Error clearing notifications:", notifErr);
  }

  return {
    success: true,
    message: `Enforcement deactivated for ${cleanStudentIds.length} student(s) successfully`,
    data: updatedRules,
  };
}

// POST - Create or update field enforcement rules for a hostel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a request to deactivate enforcement for specific students
    if (body.action === "deactivateStudents") {
      const studentIds = body.studentIds || (body.studentId ? [body.studentId] : []);
      const hostelList = body.hostelNames || (body.hostelName ? [body.hostelName] : []);
      const result = await deactivateStudentsEnforcement(hostelList, studentIds);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to deactivate students" }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const {
      hostelName,
      enforcedFields,
      isActive,
      notificationPriority,
      successMessage,
      autoCloseNotification,
      targetSemesters,
      targetStudentIds,
      excludedStudentIds,
    } = body;

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    if (!enforcedFields || !Array.isArray(enforcedFields)) {
      return NextResponse.json(
        { error: "enforcedFields must be an array" },
        { status: 400 }
      );
    }

    const normalizedHostelName = hostelName.trim();

    const sortedFields = enforcedFields.map((f: any) => ({
      ...f,
      targetSemesters: Array.isArray(f.targetSemesters) ? f.targetSemesters : (Array.isArray(targetSemesters) ? targetSemesters : []),
      targetStudentIds: Array.isArray(f.targetStudentIds) ? f.targetStudentIds : (Array.isArray(targetStudentIds) ? targetStudentIds : []),
      excludedStudentIds: Array.isArray(f.excludedStudentIds) ? f.excludedStudentIds : (Array.isArray(excludedStudentIds) ? excludedStudentIds : []),
    })).sort(
      (a: any, b: any) => (a.order || 0) - (b.order || 0)
    );

    const updateData = {
      hostelName: normalizedHostelName,
      enforcedFields: sortedFields,
      isActive: isActive ?? false,
      notificationPriority: notificationPriority || "normal",
      successMessage: successMessage || "All required fields have been completed! Thank you.",
      autoCloseNotification: autoCloseNotification ?? true,
      targetSemesters: Array.isArray(targetSemesters) ? targetSemesters : [],
      targetStudentIds: Array.isArray(targetStudentIds) ? targetStudentIds : [],
      excludedStudentIds: Array.isArray(excludedStudentIds) ? excludedStudentIds : [],
      updatedAt: new Date(),
    };

    console.log(`[FieldEnforcement API] Saving rules for ${normalizedHostelName}...`);
    const enforcement = await db.fieldEnforcement.findOneAndUpdate(
      { hostelName: { $regex: `^${normalizedHostelName}$` } },
      { $set: updateData },
      { upsert: true, new: true }
    );
    console.log(`[FieldEnforcement API] Success for ${normalizedHostelName}`);

    // If active rules are applied, reset progress records for this hostel so all students get prompted
    if (isActive && sortedFields.length > 0) {
      try {
        if (Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
          await db.studentFieldProgress.deleteMany({
            hostelName: normalizedHostelName,
            studentId: { $in: targetStudentIds }
          });
          console.log(`[FieldEnforcement API] Cleared old progress for ${targetStudentIds.length} targeted students in ${normalizedHostelName}`);
        } else {
          await db.studentFieldProgress.deleteMany({ hostelName: normalizedHostelName });
          console.log(`[FieldEnforcement API] Cleared old progress for ${normalizedHostelName}`);
        }
      } catch (delErr) {
        console.warn("[FieldEnforcement API] Could not clear old studentFieldProgress:", delErr);
      }

      // ⚡ INSTANT PUSH NOTIFICATION DISPATCH (Lock Screen Banner + Live Dashboard Modal)
      (async () => {
        try {
          const { sendPushNotification } = await import("@/lib/pushNotification");
          const fieldNames = sortedFields.map((f: any) => f.fieldLabel || f.fieldId).join(", ");
          const pushTitle = "⚠️ Profile Update Required";
          const pushBody = `Admin has enforced: ${fieldNames}. Tap here to update your student profile.`;
          const payload = {
            title: pushTitle,
            body: pushBody,
            url: "/",
            tag: `enforcement_${Date.now()}`
          };

          // Also create an in-app notification in notification inbox
          await db.notifications.create({
            senderId: "admin",
            senderRole: "admin",
            senderHostel: normalizedHostelName,
            targetType: (Array.isArray(targetStudentIds) && targetStudentIds.length > 0) ? "individual" : "hostel",
            targetHostel: normalizedHostelName,
            targetStudentId: (Array.isArray(targetStudentIds) && targetStudentIds.length === 1) ? targetStudentIds[0] : null,
            message: `⚠️ Action Required: Please update your ${fieldNames} in your student profile.`,
            priority: notificationPriority === "critical" ? "critical" : (notificationPriority === "high" ? "high" : "normal"),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }).catch(() => {});

          if (Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
            for (const sId of targetStudentIds) {
              if (!sId) continue;
              const std = await db.students.getById(sId).catch(() => null);
              const pushId = std?._id || std?.id || sId;
              sendPushNotification(String(pushId), "student", "studentFieldEnforcement", payload).catch(err => {
                console.warn(`[FieldEnforcement Push] Failed for student ${pushId}:`, err.message);
              });
              if (std?.phoneNumber) {
                sendPushNotification(String(std.phoneNumber), "student", "studentFieldEnforcement", payload).catch(() => {});
              }
            }
          } else {
            const students = await db.students.list({ hostelName: normalizedHostelName });
            const targetSems = Array.isArray(targetSemesters) && targetSemesters.length > 0 ? targetSemesters.map(String) : [];

            for (const s of (students || [])) {
              if (!s) continue;
              const sId = s._id || s.id;
              if (!sId) continue;

              if (targetSems.length > 0) {
                const sSem = String(s.semester || s.dynamicFields?.semester || s.dynamicFields?.Semester || "").trim();
                if (!targetSems.includes(sSem)) continue;
              }

              sendPushNotification(String(sId), "student", "studentFieldEnforcement", payload).catch(err => {
                console.warn(`[FieldEnforcement Push] Failed for student ${sId}:`, err.message);
              });
              if (s.phoneNumber) {
                sendPushNotification(String(s.phoneNumber), "student", "studentFieldEnforcement", payload).catch(() => {});
              }
            }
          }
        } catch (pushErr: any) {
          console.warn("[FieldEnforcement API] Error sending push notification:", pushErr.message);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      data: enforcement,
    });
  } catch (error: any) {
    console.error("[FieldEnforcement API] CRITICAL ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save field enforcement rules" },
      { status: 500 }
    );
  }
}

// PUT - Update specific hostel enforcement rules
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostelName, ...updateData } = body;

    const normalizedHostelName = hostelName.trim();
    // Sort fields by order if enforcedFields is provided
    if (updateData.enforcedFields && Array.isArray(updateData.enforcedFields)) {
      updateData.enforcedFields = updateData.enforcedFields.sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );
    }

    const enforcement = await db.fieldEnforcement.findOneAndUpdate(
      { hostelName: { $regex: `^${normalizedHostelName}$` } },
      { $set: updateData },
      { new: true }
    );

    if (!enforcement) {
      return NextResponse.json(
        { error: "Hostel enforcement rules not found" },
        { status: 404 }
      );
    }

    if (updateData.isActive && Array.isArray(updateData.enforcedFields) && updateData.enforcedFields.length > 0) {
      (async () => {
        try {
          const { sendPushNotification } = await import("@/lib/pushNotification");
          const fieldNames = updateData.enforcedFields.map((f: any) => f.fieldLabel || f.fieldId).join(", ");
          const pushTitle = "⚠️ Profile Update Required";
          const pushBody = `Admin has enforced: ${fieldNames}. Tap here to update your student profile.`;
          const payload = {
            title: pushTitle,
            body: pushBody,
            url: "/",
            tag: `enforcement_${Date.now()}`
          };

          const targetStudentIds = updateData.targetStudentIds;
          if (Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
            for (const sId of targetStudentIds) {
              if (!sId) continue;
              const std = await db.students.getById(sId).catch(() => null);
              const pushId = std?._id || std?.id || sId;
              sendPushNotification(String(pushId), "student", "studentFieldEnforcement", payload).catch(() => {});
              if (std?.phoneNumber) {
                sendPushNotification(String(std.phoneNumber), "student", "studentFieldEnforcement", payload).catch(() => {});
              }
            }
          } else {
            const students = await db.students.list({ hostelName: normalizedHostelName });
            for (const s of (students || [])) {
              if (!s) continue;
              const sId = s._id || s.id;
              if (sId) {
                sendPushNotification(String(sId), "student", "studentFieldEnforcement", payload).catch(() => {});
              }
              if (s.phoneNumber) {
                sendPushNotification(String(s.phoneNumber), "student", "studentFieldEnforcement", payload).catch(() => {});
              }
            }
          }
        } catch (pushErr: any) {
          console.warn("[FieldEnforcement API PUT] Error sending push notification:", pushErr.message);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      data: enforcement,
    });
  } catch (error: any) {
    console.error("Error updating field enforcement rules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update field enforcement rules" },
      { status: 500 }
    );
  }
}

// DELETE - Delete field enforcement rules for a hostel
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    const result = await db.fieldEnforcement.findOneAndDelete({
      hostelName: { $regex: `^${hostelName.trim()}$` }
    });

    if (!result) {
      return NextResponse.json(
        { error: "Hostel enforcement rules not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Field enforcement rules deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting field enforcement rules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete field enforcement rules" },
      { status: 500 }
    );
  }
}

// PATCH - Deactivate enforcement for specific student(s)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const studentIds = body.studentIds || (body.studentId ? [body.studentId] : []);
    const hostelList = body.hostelNames || (body.hostelName ? [body.hostelName] : []);

    const result = await deactivateStudentsEnforcement(hostelList, studentIds);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to deactivate students" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[FieldEnforcement API PATCH] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to deactivate students" },
      { status: 500 }
    );
  }
}


