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

    // ✅ Save updated profile picture directly to Cloudflare R2 CDN ($0 Railway egress)
    if (body.profilePicture && (body.profilePicture.startsWith("data:image/") || body.profilePicture.startsWith("data:"))) {
      try {
        const student = await db.students.getById(studentId);
        const firebaseUID = student?.firebaseUID || studentId;
        const tenantId = student?.tenantId || "default";
        
        const { saveFileToRailway } = await import("@/lib/fileStorage");
        const filename = `${firebaseUID}_${Date.now()}`;
        const savedUrl = await saveFileToRailway(body.profilePicture, `profile-pictures/${tenantId}`, filename);
        if (savedUrl) {
          body.profilePicture = savedUrl;
        }
        console.log(`[Storage] Saved updated profile picture to R2 for ${filename} -> ${body.profilePicture}`);
      } catch (err: any) {
        console.warn("❌ Failed to save updated profile picture to R2:", err.message);
      }
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
    const resolvedParams = await (params as any);
    const rawId = resolvedParams.id;
    const studentId = decodeURIComponent(rawId || '').trim();
    let student = await db.students.getById(studentId);

    if (!student) {
      student = await db.students.findOne({
        _id: studentId,
        firebaseUID: studentId,
        registrationId: studentId,
        erpId: studentId,
        phoneNumber: studentId,
        email: studentId,
        name: studentId
      });
    }

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Fast lookup for latest gate pass history using skipCount
    let lastOuting = null;
    const studentDbId = (student.id || student._id || "").toString();
    try {
      let historyRes = await db.gatePasses.list(
        { studentId: studentDbId },
        { limit: 1, sortField: 'checkOutTime', sortOrder: 'desc', skipCount: true }
      );
      if ((!historyRes?.records || historyRes.records.length === 0) && student.registrationId) {
        try {
          historyRes = await db.gatePasses.list(
            { registrationId: student.registrationId },
            { limit: 1, sortField: 'checkOutTime', sortOrder: 'desc', skipCount: true }
          );
        } catch (e) {}
      }
      if (historyRes?.records && historyRes.records.length > 0) {
        lastOuting = historyRes.records[0];
        if (student.studentStatus === 'out' && (lastOuting.status === 'out' || lastOuting.action === 'CHECK_OUT')) {
          student.studentStatus = 'out';
        }
      }
    } catch (e) {
      console.warn("Could not fetch last outing for student:", e);
    }

    // Fast lookup for latest / active leave permission to enrich Home-Leave dates
    try {
      let permRes = await db.permissions.list(
        { studentId: studentDbId },
        { limit: 10 } as any
      );
      let perms = Array.isArray(permRes) ? permRes : (permRes?.records || (permRes as any)?.permissions || []);
      if (perms.length === 0 && student.registrationId) {
        try {
          const fallbackPermRes = await db.permissions.list(
            { registrationId: student.registrationId },
            { limit: 10 } as any
          );
          perms = Array.isArray(fallbackPermRes) ? fallbackPermRes : (fallbackPermRes?.records || (fallbackPermRes as any)?.permissions || []);
        } catch (e) {}
      }
      const leavePerm = perms.find((p: any) => {
        const t = String(p.requestType || '').toLowerCase();
        return t.includes('leave') || t === 'hleave';
      }) || perms[0];

      if (leavePerm) {
        const s = student as any;
        s.outingType = leavePerm.requestType || s.outingType || 'leave';
        s.leaveFrom = leavePerm.fromDateTime || s.leaveFrom;
        s.leaveTo = leavePerm.toDateTime || s.leaveTo;
        s.leaveReason = leavePerm.reason || s.leaveReason;
        s.permissionStatus = leavePerm.status;

        if (lastOuting) {
          lastOuting = {
            ...lastOuting,
            type: (lastOuting as any).type || leavePerm.requestType,
            fromDateTime: (lastOuting as any).fromDateTime || leavePerm.fromDateTime,
            toDateTime: (lastOuting as any).toDateTime || leavePerm.toDateTime,
            expectedReturnDate: (lastOuting as any).expectedReturnDate || leavePerm.toDateTime,
            reason: (lastOuting as any).reason || leavePerm.reason,
          };
        }
      }

      if (lastOuting) {
        const lo = lastOuting as any;
        const s = student as any;
        if (lo.toDateTime || lo.expectedReturnDate) {
          s.leaveTo = s.leaveTo || lo.toDateTime || lo.expectedReturnDate;
        }
        if (lo.fromDateTime) {
          s.leaveFrom = s.leaveFrom || lo.fromDateTime;
        }
        if (lo.reason) {
          s.leaveReason = s.leaveReason || lo.reason;
        }
      }

      // ⚡ If Home-Leave is active or recent and no explicit return date was set, default to 6 days from departure
      const rawType = String((lastOuting as any)?.type || (lastOuting as any)?.requestType || (student as any)?.outingType || (student as any)?.dynamicFields?.outingType || '').toLowerCase();
      const isHomeLeave = rawType.includes('leave') || rawType === 'hleave';
      if (isHomeLeave) {
        const s = student as any;
        const lo = lastOuting as any;
        if (!s.leaveTo && (!lo || (!lo.toDateTime && !lo.expectedReturnDate))) {
          const departure = lo?.checkOutTime || lo?.createdAt || s.leaveFrom || s.dynamicFields?.leaveFrom || new Date();
          const autoSixDays = new Date(new Date(departure).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
          s.leaveTo = autoSixDays;
          if (lo) {
            lo.expectedReturnDate = autoSixDays;
            lo.toDateTime = autoSixDays;
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch latest permission for student:", e);
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
