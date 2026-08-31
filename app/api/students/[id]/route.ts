export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@/lib/dbAdapter";
import { writeAdminAuditLog, writeHostelActivityLog } from "@/lib/auditLog";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const student = await db.students.getById(studentId);

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Get Firebase UID for deletion from Auth
    const firebaseUID = student.firebaseUID;

    if (firebaseUID) {
      try {
        await adminAuth.deleteUser(firebaseUID);
      } catch (firebaseError: any) {
        console.error("Error deleting user from Firebase Auth:", firebaseError);
        if (firebaseError.code !== "auth/user-not-found") {
          // Continue even if Firebase delete fails but log it
          console.warn("Firebase Auth deletion failed, continuing with DB deletion");
        }
      }
    }

    // Delete permissions using adapter
    await db.permissions.deleteMany({ studentId: studentId });

    // Perform database-aware deletion
    await db.students.delete(studentId);

    // 📝 AUDIT LOG: Record this sensitive action
    const adminEmail = request.headers.get("x-admin-email") || "admin";
    writeAdminAuditLog({
      action: "STUDENT_DELETED",
      entityType: "student",
      entityId: studentId,
      entityName: student.name || "Unknown Student",
      details: {
        studentName: student.name,
        studentPhone: student.phoneNumber,
        hostelName: student.hostelName,
        roomNumber: student.roomNumber,
        deletedAt: new Date().toISOString(),
      },
      performedBy: adminEmail,
    }).catch(console.error); // fire-and-forget

    // 📝 LOG ACTIVITY
    try {
      await writeHostelActivityLog({
        hostelName: student.hostelName,
        actionType: 'DELETE',
        studentName: student.name || "Unknown Student",
        erpId: student.erpInformation || "N/A",
        operator: adminEmail,
      });
    } catch (logErr) {
      console.error("Failed to write hostel activity log for delete:", logErr);
    }

    return NextResponse.json(
      { success: true, message: "Student deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete student" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ⚡ NEXT.js 15+ Compatibility: params is a Promise
    const resolvedParams = await (params as any);
    const studentId = resolvedParams.id;
    const body = await request.json();
    console.log(`PATCH Action [${body.action || "update"}] for student: ${studentId}`);

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    // ⚡ SYNC WITH FIREBASE AUTH: If email is being updated, we MUST update it in Firebase too
    if (body.email) {
      try {
        const student = await db.students.getById(studentId);
        const firebaseUID = student?.firebaseUID;
        const currentEmail = student?.email;

        if (firebaseUID && body.email.toLowerCase() !== currentEmail?.toLowerCase()) {
          console.log(`[AUTH_SYNC] Updating email in Firebase for ${firebaseUID} to ${body.email}`);
          await adminAuth.updateUser(firebaseUID, {
            email: body.email.toLowerCase(),
          });
        }
      } catch (authError: any) {
        console.error("❌ Firebase Auth update failed:", authError);
      }
    }

    // ✅ NEW: Extract any non-standard fields (custom dynamic fields) and merge them into dynamicFields
    const standardFields = new Set([
      'firebaseUID', 'firebase_uid', 'name', 'email', 'phoneNumber', 'phone_number',
      'hostelName', 'hostel_name', 'roomNumber', 'room_number', 'profilePicture', 'profile_picture',
      'studentStatus', 'student_status', 'supabaseId', 'supabase_id', 'tenantId', 'tenant_id',
      'dob', 'category', 'fatherName', 'father_name', 'fatherNumber', 'father_number',
      'motherName', 'mother_name', 'motherNumber', 'mother_number', 'permanentAddress', 'permanent_address',
      'homePinCode', 'home_pin_code', 'homeState', 'home_state', 'erpInformation', 'erp_id',
      'joiningDate', 'joining_date', 'branch', 'collegeName', 'college_name', 'year', 'semester',
      'section', 'floorNumber', 'floor_number', 'localGuardianAddress', 'local_guardian_address',
      'localGuardianPhoneNumber', 'local_guardian_phone_number', 'registrationId', 'registration_id',
      'createdByErpId', 'created_by_erp_id', 'deviceId', 'device_id', 'deviceResetCount', 'device_reset_count',
      'deviceHistory', 'device_history', 'isProfileLocked', 'is_profile_locked', 'faceDescriptor', 'face_descriptor',
      'thumbImpressionId', 'thumb_impression_id', 'attendanceMode', 'attendance_mode',
      'webAuthnCredentials', 'web_authn_credentials', 'lastCheckInLocation', 'last_check_in_location',
      'authProvider', 'auth_provider', 'action', 'dynamicFields', 'dynamic_fields'
    ]);

    const customKeys = Object.keys(body).filter(key => !standardFields.has(key));
    if (customKeys.length > 0 || body.dynamicFields) {
      try {
        console.log(`[DynamicFields] Processing dynamic fields updates. Custom keys: ${customKeys.join(', ')}`);
        const student = await db.students.getById(studentId);
        const currentDynamicFields = student?.dynamicFields || {};
        const clientDynamicFields = body.dynamicFields || {};
        const mergedDynamicFields = { 
          ...currentDynamicFields, 
          ...clientDynamicFields 
        };
        
        customKeys.forEach(key => {
          mergedDynamicFields[key] = body[key];
          delete body[key];
        });
        
        body.dynamicFields = mergedDynamicFields;
      } catch (err: any) {
        console.error("❌ Failed to process dynamic fields update:", err);
      }
    }

    // ✅ OPTION 1: Store base64 image permanently in PostgreSQL database (and cache to disk)
    if (body.profilePicture && body.profilePicture.startsWith("data:image/")) {
      try {
        const student = await db.students.getById(studentId);
        const firebaseUID = student?.firebaseUID || studentId;
        const tenantId = student?.tenantId || "default";
        
        const { saveFileToRailway } = await import("@/lib/fileStorage");
        const filename = `${firebaseUID}_${Date.now()}`;
        await saveFileToRailway(body.profilePicture, `profile-pictures/${tenantId}`, filename);
        console.log(`[Storage] Cached updated profile picture to disk for ${filename}`);
      } catch (err: any) {
        console.warn("❌ Failed to cache profile picture to disk, preserved in DB:", err.message);
      }
      // Preserve direct base64 image in PostgreSQL so Railway redeployments never wipe it!
    }

    // 🔒 OPTION A ENFORCEMENT: If profile picture is updated without explicit new faceDescriptor, clear old vector array
    if (body.profilePicture && (!body.faceDescriptor || !Array.isArray(body.faceDescriptor) || body.faceDescriptor.length === 0)) {
      body.faceDescriptor = [];
      console.log(`🔒 [Option A Enforcement] Profile picture updated for ${studentId}. Cleared old faceDescriptor vector array.`);
    }

    // Use the Database Adapter for a database-aware update (Mongo/Supabase)
    const updatedStudent = await db.students.update(studentId, body);

    if (!updatedStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, student: updatedStudent }, { status: 200 });

    const adminEmail = request.headers.get("x-admin-email") || "admin";

    // 🔓 DEVICE RESET: If admin resets a student's device, we MUST also clear the
    // browser-side 'trusted_device_owner' cookie so the student can re-register freely.
    if (body.action === "resetDevice") {
      const student = await db.students.getById(studentId);
      const updateData = {
        deviceId: null,
        webAuthnCredentials: [], // Also clear biometric if used
        isProfileLocked: false,  // Unlock profile so they can register new device
        deviceResetCount: (student?.deviceResetCount || 0) + 1,
        deviceHistory: [
          ...((student as any)?.deviceHistory || []),
          { 
            deviceId: student?.deviceId || "none", 
            action: "reset_by_admin", 
            timestamp: new Date().toISOString() 
          }
        ]
      };
      
      await db.students.update(studentId, updateData);
      console.log(`🔓 [DEVICE_RESET] Cleared device mapping for student: ${studentId}`);

      // 📝 AUDIT LOG: device reset
      writeAdminAuditLog({
        action: "STUDENT_DEVICE_RESET",
        entityType: "student",
        entityId: studentId,
        entityName: updatedStudent?.name || "Unknown",
        details: { resetAt: new Date().toISOString() },
        performedBy: adminEmail,
      }).catch(console.error);

      response.cookies.set('trusted_device_owner', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Immediately expire the cookie → browser deletes it
        path: '/'
      });
    } else if (body.isProfileLocked !== undefined) {
      // 📝 AUDIT LOG: profile lock/unlock
      writeAdminAuditLog({
        action: body.isProfileLocked ? "STUDENT_PROFILE_LOCKED" : "STUDENT_PROFILE_UNLOCKED",
        entityType: "student",
        entityId: studentId,
        entityName: updatedStudent?.name || "Unknown",
        details: { changedAt: new Date().toISOString() },
        performedBy: adminEmail,
      }).catch(console.error);
    } else if (body.studentStatus) {
      // 📝 AUDIT LOG: status change
      writeAdminAuditLog({
        action: "STUDENT_STATUS_CHANGED",
        entityType: "student",
        entityId: studentId,
        entityName: updatedStudent?.name || "Unknown",
        details: { newStatus: body.studentStatus, changedAt: new Date().toISOString() },
        performedBy: adminEmail,
      }).catch(console.error);
    }

    // Write general edit audit log
    if (!body.action && body.isProfileLocked === undefined && !body.studentStatus) {
      writeAdminAuditLog({
        action: "STUDENT_EDITED",
        entityType: "student",
        entityId: studentId,
        entityName: updatedStudent?.name || "Unknown",
        details: { editedAt: new Date().toISOString() },
        performedBy: adminEmail,
      }).catch(console.error);

      // 📝 LOG ACTIVITY
      try {
        await writeHostelActivityLog({
          hostelName: updatedStudent.hostelName,
          actionType: 'UPDATE',
          studentName: updatedStudent.name || "Unknown Student",
          erpId: updatedStudent.erpInformation || "N/A",
          operator: adminEmail,
        });
      } catch (logErr) {
        console.error("Failed to write hostel activity log for update:", logErr);
      }
    }

    return response;

  } catch (error: any) {
    console.error("❌ BACKEND PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error during PATCH" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const student = await db.students.getById(studentId);

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Fast lookup for latest gate pass history using skipCount
    let lastOuting = null;
    try {
      const historyRes = await db.gatePasses.list(
        { studentId },
        { limit: 1, sortField: 'createdAt', sortOrder: 'desc', skipCount: true }
      );
      if (historyRes.records && historyRes.records.length > 0) {
        lastOuting = historyRes.records[0];
        if (lastOuting.status === 'out' || lastOuting.action === 'CHECK_OUT') {
          student.studentStatus = 'out';
        }
      }
    } catch (e) {
      console.warn("Could not fetch last outing for student:", e);
    }

    return NextResponse.json({ success: true, student, lastOuting }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch student" },
      { status: 500 }
    );
  }
}
