import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { studentId, status } = body;

    if (!studentId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["in", "out"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'in' or 'out'" },
        { status: 400 }
      );
    }

    const student = await Student.findByIdAndUpdate(
      studentId,
      { studentStatus: status },
      { new: true }
    );

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        student,
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

