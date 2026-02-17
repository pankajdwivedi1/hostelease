import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FieldEnforcement from "@/models/FieldEnforcement";
import StudentFieldProgress from "@/models/StudentFieldProgress";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

// POST - Initialize field progress for all students in a hostel
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { hostelName, enforcedFieldIds } = body;

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    // Get field enforcement rules
    const enforcement = await FieldEnforcement.findOne({ hostelName }).lean();
    if (!enforcement) {
      return NextResponse.json(
        { error: "Field enforcement rules not found for this hostel" },
        { status: 404 }
      );
    }

    // Get all students in this hostel
    const students = await Student.find({ hostelName }).select("_id firebaseUID").lean();

    let createdCount = 0;
    let skippedCount = 0;

    // For each student, initialize field progress
    for (const student of students) {
      for (const enforcedField of enforcement.enforcedFields) {
        // Check if progress record already exists
        const existing = await StudentFieldProgress.findOne({
          studentId: student._id,
          fieldId: enforcedField.fieldId,
          hostelName,
        });

        if (!existing) {
          // Create new progress record
          try {
            await StudentFieldProgress.create({
              studentId: student._id,
              firebaseUID: student.firebaseUID,
              hostelName,
              fieldId: enforcedField.fieldId,
              fieldLabel: enforcedField.fieldLabel,
              isCompleted: false,
            });
            createdCount++;
          } catch (err) {
            // Skip if duplicate or other insert error
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Initialized field progress for ${hostelName}`,
      stats: {
        totalStudents: students.length,
        totalFields: enforcement.enforcedFields.length,
        recordsCreated: createdCount,
        recordsSkipped: skippedCount,
        potentialRecords: students.length * enforcement.enforcedFields.length,
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
    await connectDB();
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    const result = await StudentFieldProgress.deleteMany({ hostelName });

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
