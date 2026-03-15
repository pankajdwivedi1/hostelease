import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, status, deviceId } = body;

    if (!studentId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const studentRecord = await db.students.getById(studentId, true); // true to fallback to Supabase if needed
    if (!studentRecord) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Verify deviceId if it exists in the record
    const recordDeviceId = studentRecord.deviceId;
    if (recordDeviceId && recordDeviceId !== deviceId) {
      return NextResponse.json(
        { error: "This device is not registered for this student." },
        { status: 403 }
      );
    }

    if (!["in", "out"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'in' or 'out'" },
        { status: 400 }
      );
    }

    const updatedStudent = await db.students.update(studentId, { studentStatus: status });

    if (!updatedStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        student: updatedStudent,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating student status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update student status" },
      { status: 500 }
    );
  }
}


