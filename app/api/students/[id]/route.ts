import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@/lib/dbAdapter";

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
        // We don't necessarily block the DB update if Auth fails, but we should log it.
        // Or should we? If login depends on it, maybe we should.
      }
    }

    // ✅ NEW: Upload base64 profile picture to Supabase storage to save database egress/bandwidth
    if (body.profilePicture && body.profilePicture.startsWith("data:image/")) {
      try {
        const student = await db.students.getById(studentId);
        const firebaseUID = student?.firebaseUID || studentId;
        const tenantId = student?.tenantId || "default";
        
        const { uploadProfilePictureToSupabase } = await import("@/lib/supabaseServer");
        const publicUrl = await uploadProfilePictureToSupabase(body.profilePicture, tenantId, firebaseUID);
        body.profilePicture = publicUrl;
        console.log(`[Storage] Successfully uploaded updated profile picture to Supabase bucket. URL: ${publicUrl}`);
      } catch (err: any) {
        console.error("❌ Failed to upload profile picture to storage, saving as base64 fallback:", err.message);
      }
    }

    // Use the Database Adapter for a database-aware update (Mongo/Supabase)
    const updatedStudent = await db.students.update(studentId, body);

    if (!updatedStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, student: updatedStudent }, { status: 200 });

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

      response.cookies.set('trusted_device_owner', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Immediately expire the cookie → browser deletes it
        path: '/'
      });
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

    // Check for open gate pass to ensure status is accurate
    const openGatePass = await db.gatePasses.findOne({ studentId, status: "out" });
    if (openGatePass && student.studentStatus !== 'out') {
      student.studentStatus = 'out';
    }

    return NextResponse.json({ success: true, student }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch student" },
      { status: 500 }
    );
  }
}
