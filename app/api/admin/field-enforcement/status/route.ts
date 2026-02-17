import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import StudentFieldProgress from "@/models/StudentFieldProgress";
import Student from "@/models/Student";
import FieldEnforcement from "@/models/FieldEnforcement";

export const dynamic = "force-dynamic";

// GET - Get field enforcement completion status for a hostel
export async function GET(request: NextRequest) {
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

    // Get the enforcement rules for this hostel
    const enforcement = await FieldEnforcement.findOne({ hostelName }).lean();

    if (!enforcement || !enforcement.enforcedFields) {
      return NextResponse.json({
        success: true,
        data: {
          hostelName,
          enforcedFields: [],
          studentsCompletionStatus: [],
          completionStats: {
            totalStudents: 0,
            totalFields: 0,
            completedCount: 0,
            pendingCount: 0,
          },
        },
      });
    }

    // Get all students in this hostel
    const students = await Student.find({ hostelName }).select("_id name email phoneNumber registrationId").lean();

    // Get field progress for all students
    const fieldProgress = await StudentFieldProgress.find({
      hostelName,
    }).lean();

    // Build completion status per student
    const studentsCompletionStatus = students.map((student) => {
      const studentProgress = fieldProgress.filter(
        (fp) => fp.studentId.toString() === student._id.toString()
      );

      const fieldStatuses = enforcement.enforcedFields.map((field) => {
        const progress = studentProgress.find(
          (fp) => fp.fieldId === field.fieldId
        );
        return {
          fieldId: field.fieldId,
          fieldLabel: field.fieldLabel,
          isCompleted: progress?.isCompleted || false,
          completedAt: progress?.completedAt,
        };
      });

      const completedCount = fieldStatuses.filter((fs) => fs.isCompleted).length;
      const allCompleted = completedCount === fieldStatuses.length;

      return {
        studentId: student._id,
        name: student.name,
        email: student.email,
        phone: student.phoneNumber,
        registrationId: student.registrationId,
        fieldStatuses,
        completedCount,
        totalFields: enforcement.enforcedFields.length,
        allCompleted,
      };
    });

    // Calculate completion stats
    const totalStudents = students.length;
    const totalFields = enforcement.enforcedFields.length;
    const completedCount = fieldProgress.filter((fp) => fp.isCompleted).length;
    const potentialCompletions = totalStudents * totalFields;
    const pendingCount = potentialCompletions - completedCount;

    return NextResponse.json({
      success: true,
      data: {
        hostelName,
        enforcedFields: enforcement.enforcedFields,
        studentsCompletionStatus,
        completionStats: {
          totalStudents,
          totalFields,
          completedCount,
          pendingCount,
          completionPercentage: totalFields > 0 ? Math.round((completedCount / potentialCompletions) * 100) : 0,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching field enforcement status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch field enforcement status" },
      { status: 500 }
    );
  }
}
