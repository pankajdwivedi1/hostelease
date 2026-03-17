import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// POST - Mark field(s) as completed by student
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firebaseUID, hostelName, fieldId, fieldIds } = body;

    if (!hostelName) {
      return NextResponse.json({ error: "hostelName is required" }, { status: 400 });
    }

    const normalizedHostelName = hostelName.trim();

    if (!firebaseUID || !normalizedHostelName || (!fieldId && !fieldIds)) {
      return NextResponse.json(
        {
          error: "firebaseUID, hostelName, and fieldId(s) are required",
        },
        { status: 400 }
      );
    }

    // Get student via adapter
    const student = await db.students.findOne({ firebaseUID });
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

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

    const targetFieldIds = fieldIds || [fieldId];

    // Parallel fulfillment to speed up response
    const results = await Promise.all(targetFieldIds.map(async (id: string) => {
      // Find the field in enforcement rules
      const field = (enforcement.enforcedFields || []).find(
        (f: any) => f.fieldId === id
      );
      if (!field) return null;

      // Create or update field progress via adapter
      return db.studentFieldProgress.upsert({
        studentId: student._id,
        fieldId: id,
        hostelName: normalizedHostelName,
        firebaseUID,
        fieldLabel: field.fieldLabel,
        isCompleted: true,
        completedAt: new Date(),
      });
    }));

    const filteredResults = results.filter(r => r !== null);

    return NextResponse.json({
      success: true,
      data: filteredResults,
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
    const { searchParams } = new URL(request.url);
    const firebaseUID = searchParams.get("firebaseUID");
    const hostelName = searchParams.get("hostelName");

    if (!firebaseUID || !hostelName) {
      return NextResponse.json(
        { error: "firebaseUID and hostelName are required" },
        { status: 400 }
      );
    }

    const normalizedHostelName = hostelName.trim();

    // Get student via adapter
    const student = await db.students.findOne({ firebaseUID });
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Get active field enforcement rules via adapter
    const rules = await db.fieldEnforcement.find({
      hostelName: { $regex: `^${normalizedHostelName}$` }
    });
    const enforcement = rules.find((r: any) =>
      r.hostelName.toLowerCase() === normalizedHostelName.toLowerCase() && r.isActive
    );

    if (!enforcement || !enforcement.enforcedFields?.length) {
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

    // Get field progress for this student via adapter
    const fieldProgress = await db.studentFieldProgress.find({
      studentId: student._id,
      hostelName: normalizedHostelName,
    });

    const pendingFields: any[] = [];
    const completedFields: any[] = [];

    enforcement.enforcedFields.forEach((field: any) => {
      const progress = fieldProgress.find((fp: any) => fp.fieldId === field.fieldId);
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
    const body = await request.json();
    const { firebaseUID, hostelName } = body;

    if (!firebaseUID || !hostelName) {
      return NextResponse.json(
        { error: "firebaseUID and hostelName are required" },
        { status: 400 }
      );
    }

    const normalizedHostelName = hostelName.trim();

    // Get student via adapter
    const student = await db.students.findOne({ firebaseUID });
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Get field enforcement rules via adapter
    const rules = await db.fieldEnforcement.find({
      hostelName: { $regex: `^${normalizedHostelName}$` }
    });
    const enforcement = rules.find((r: any) =>
      r.hostelName.toLowerCase() === normalizedHostelName.toLowerCase()
    );

    if (!enforcement || !enforcement.enforcedFields?.length) {
      return NextResponse.json({
        success: true,
        message: "No field enforcement rules configured for this hostel",
      });
    }

    // Initialize progress for all enforced fields
    for (const field of enforcement.enforcedFields) {
      await db.studentFieldProgress.upsert({
        studentId: student._id,
        firebaseUID,
        hostelName: normalizedHostelName,
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        isCompleted: false,
      });
    }

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

