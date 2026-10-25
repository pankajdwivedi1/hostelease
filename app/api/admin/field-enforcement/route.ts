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

// POST - Create or update field enforcement rules for a hostel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      hostelName,
      enforcedFields,
      isActive,
      notificationPriority,
      successMessage,
      autoCloseNotification,
      targetSemesters,
      targetStudentIds,
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

