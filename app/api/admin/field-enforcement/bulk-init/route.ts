import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// POST - Initialize field progress for all students in a hostel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostelName } = body;

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    const normalizedHostelName = hostelName.trim();

    // Get field enforcement rules via adapter
    const rules = await db.fieldEnforcement.find({
      hostelName: { $regex: `^${normalizedHostelName}$` }
    });
    const enforcement = rules.find((r: any) =>
      r.hostelName.toLowerCase() === normalizedHostelName.toLowerCase()
    );

    if (!enforcement) {
      return NextResponse.json(
        { error: "Field enforcement rules not found for this hostel" },
        { status: 404 }
      );
    }

    // Get all students in this hostel via adapter
    const students = await db.students.list({
      hostelName: normalizedHostelName
    });

    let createdCount = 0;
    let skippedCount = 0;

    // For each student, initialize field progress
    for (const student of students) {
      for (const enforcedField of (enforcement.enforcedFields || [])) {
        // Upsert handles checking if it exists
        try {
          await db.studentFieldProgress.upsert({
            studentId: student._id,
            firebaseUID: student.firebaseUID,
            hostelName: normalizedHostelName,
            fieldId: enforcedField.fieldId,
            fieldLabel: enforcedField.fieldLabel,
            isCompleted: false,
          });
          createdCount++;
        } catch (err) {
          skippedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Initialized field progress for ${hostelName}`,
      stats: {
        totalStudents: students.length,
        totalFields: (enforcement.enforcedFields || []).length,
        recordsCreated: createdCount,
        recordsSkipped: skippedCount,
        potentialRecords: students.length * (enforcement.enforcedFields || []).length,
      },
    });
  } catch (error: any) {
    console.error("Error initializing field progress:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize field progress" },
      { status: 500 }
    );
  }
}

// DELETE - Clear all field progress for a hostel
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

    const result = await db.studentFieldProgress.deleteMany({ hostelName });

    return NextResponse.json({
      success: true,
      message: `Cleared field progress for ${hostelName}`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error("Error clearing field progress:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear field progress" },
      { status: 500 }
    );
  }
}

