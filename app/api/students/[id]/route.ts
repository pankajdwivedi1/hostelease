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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    // ⚡ NEXT.js 15+ Compatibility: params is a Promise
    const resolvedParams = await (params as any);
    const studentId = resolvedParams.id;
    const body = await request.json();
    console.log(`PATCH Action [${body.action || "update"}] for student: ${studentId}`);

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    let updateQuery: any;

    if (body.action === "resetDevice") {
      const student = await Student.findById(studentId);
      const oldDeviceId = student?.deviceId;

      updateQuery = {
        $set: {
          deviceId: "",
          webAuthnCredentials: []
        },
        $inc: { deviceResetCount: 1 }
      };

      if (oldDeviceId) {
        updateQuery.$push = {
          deviceHistory: {
            deviceId: oldDeviceId,
            action: "reset",
            timestamp: new Date()
          }
        };
      }
    } else {
      // Check if the body already contains MongoDB operators
      const hasOperators = Object.keys(body).some(key => key.startsWith('$'));
      updateQuery = hasOperators ? body : { $set: body };
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      updateQuery,
      { new: true }
    );

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


