import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import Permission from "@/models/Permission";
import { adminAuth } from "@/lib/firebase-admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const { db } = await import("@/lib/dbAdapter");
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

    // Delete permissions (assuming Permission model is MongoDB only for now, or we can make it DB aware later)
    await Permission.deleteMany({ studentId: studentId });

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
    const { db } = await import("@/lib/dbAdapter");
    const updatedStudent = await db.students.update(studentId, body);

    if (!updatedStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, student: updatedStudent }, { status: 200 });
  } catch (error: any) {
    console.error("❌ BACKEND PATCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error during PATCH" },
      { status: 500 }
    );
  }
}


