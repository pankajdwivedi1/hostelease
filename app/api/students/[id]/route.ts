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
    const firebaseUID = student.firebase_uid || student.firebaseUID;

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

    // Use the Database Adapter for a database-aware update (Mongo/Supabase)
    const updatedStudent = await db.students.update(studentId, body);

    if (!updatedStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, student: updatedStudent }, { status: 200 });

    // 🔓 DEVICE RESET: If admin resets a student's device, we MUST also clear the
    // browser-side 'trusted_device_owner' cookie so the student can re-register freely.
    // Without this, the 10-year cookie would still block re-registration even though
    // the DB was wiped clean. We delete it by setting maxAge to 0 (immediate expiry).
    if (body.action === "resetDevice") {
      response.cookies.set('trusted_device_owner', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Immediately expire the cookie → browser deletes it
        path: '/'
      });
      console.log(`🔓 Cleared trusted_device_owner cookie for student: ${studentId}`);
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

    return NextResponse.json({ success: true, student }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch student" },
      { status: 500 }
    );
  }
}
