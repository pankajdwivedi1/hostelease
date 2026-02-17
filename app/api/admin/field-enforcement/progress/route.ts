import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import StudentFieldProgress from "@/models/StudentFieldProgress";
import Student from "@/models/Student";
import FieldEnforcement from "@/models/FieldEnforcement";

export const dynamic = "force-dynamic";

// POST - Mark field as completed by student
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { firebaseUID, hostelName, fieldId } = body;

    if (!firebaseUID || !hostelName || !fieldId) {
      return NextResponse.json(
        {
          error:
            "firebaseUID, hostelName, and fieldId are required",
        },
        { status: 400 }
      );
    }

    // Get student
    const student = await Student.findOne({ firebaseUID }).lean();
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
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

    // Find the field in enforcement rules
    const field = enforcement.enforcedFields.find(
      (f: any) => f.fieldId === fieldId
    );
    if (!field) {
      return NextResponse.json(
        { error: "Field not found in enforcement rules" },
        { status: 404 }
      );
    }

    // Create or update field progress
    const fieldProgress = await StudentFieldProgress.findOneAndUpdate(
      {
        studentId: student._id,
        fieldId,
        hostelName,
      },
      {
        $set: {
          firebaseUID,
          fieldLabel: field.fieldLabel,
          isCompleted: true,
          completedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      data: fieldProgress,
    });
  } catch (error: any) {
    console.error("Error marking field as completed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark field as completed" },
      { status: 500 }
    );
  }
}

// GET - Get field completion status for a student
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const firebaseUID = searchParams.get("firebaseUID");
    const hostelName = searchParams.get("hostelName");

    if (!firebaseUID || !hostelName) {
      return NextResponse.json(
        { error: "firebaseUID and hostelName are required" },
        { status: 400 }
      );
    }

    // Get student
    const student = await Student.findOne({ firebaseUID }).lean();
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Get field enforcement rules
    const enforcement = await FieldEnforcement.findOne({
      hostelName,
      isActive: true,
    }).lean();

    if (!enforcement || !enforcement.enforcedFields.length) {
      return NextResponse.json({
        success: true,
        data: {
          firebaseUID,
          hostelName,
          enforcedFields: [],
          completedFields: [],
          pendingFields: [],
          allCompleted: true,
        },
      });
    }

    // Get field progress for this student
    const fieldProgress = await StudentFieldProgress.find({
      studentId: student._id,
      hostelName,
    }).lean();

    const pendingFields: any[] = [];
    const completedFields: any[] = [];

    enforcement.enforcedFields.forEach((field: any) => {
      const progress = fieldProgress.find((fp) => fp.fieldId === field.fieldId);
      const fieldData = {
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        isEnabled: field.isEnabled,
        displayMode: field.displayMode,
        durationDays: field.durationDays,
      };

      if (progress?.isCompleted) {
        completedFields.push({
          ...fieldData,
          completedAt: progress.completedAt,
        });
      } else {
        pendingFields.push(fieldData);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        firebaseUID,
        hostelName,
        enforcedFields: enforcement.enforcedFields,
        completedFields,
        pendingFields,
        allCompleted: pendingFields.length === 0,
        notificationPriority: enforcement.notificationPriority,
        successMessage: enforcement.successMessage,
      },
    });
  } catch (error: any) {
    console.error("Error fetching student field progress:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch student field progress" },
      { status: 500 }
    );
  }
}

// PUT - Initialize field progress for new enforce fields
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { firebaseUID, hostelName } = body;

    if (!firebaseUID || !hostelName) {
      return NextResponse.json(
        { error: "firebaseUID and hostelName are required" },
        { status: 400 }
      );
    }

    // Get student
    const student = await Student.findOne({ firebaseUID }).lean();
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Get field enforcement rules
    const enforcement = await FieldEnforcement.findOne({ hostelName }).lean();
    if (!enforcement || !enforcement.enforcedFields.length) {
      return NextResponse.json({
        success: true,
        message: "No field enforcement rules configured for this hostel",
      });
    }

    // Initialize progress for all enforced fields
    const fieldProgressRecords = enforcement.enforcedFields.map((field: any) => ({
      studentId: student._id,
      firebaseUID,
      hostelName,
      fieldId: field.fieldId,
      fieldLabel: field.fieldLabel,
      isCompleted: false,
    }));

    await StudentFieldProgress.insertMany(fieldProgressRecords, {
      ordered: false,
    }).catch(() => {
      // Ignore duplicate key errors - fields may already exist
    });

    return NextResponse.json({
      success: true,
      message: "Field progress initialized for student",
    });
  } catch (error: any) {
    console.error("Error initializing field progress:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize field progress" },
      { status: 500 }
    );
  }
}
