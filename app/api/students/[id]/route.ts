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
    await connectDB();

    const { id: studentId } = await params;

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const firebaseUID = student.firebaseUID;

    try {
      await adminAuth.deleteUser(firebaseUID);
    } catch (firebaseError: any) {
      console.error("Error deleting user from Firebase Auth:", firebaseError);
      if (firebaseError.code !== "auth/user-not-found") {
        return NextResponse.json(
          { error: "Failed to delete user from Firebase Auth" },
          { status: 500 }
        );
      }
    }

    await Permission.deleteMany({ studentId: studentId });

    await Student.findByIdAndDelete(studentId);

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

