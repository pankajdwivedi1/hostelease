import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Get field enforcement completion status for a hostel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    const normalizedHostelName = hostelName.trim();

    // Get the enforcement rules for this hostel using adapter
    const rules = await db.fieldEnforcement.find({
      hostelName: { $regex: `^${normalizedHostelName}$` }
    });

    // Find the active rule or the one matching the hostel
    const enforcement = rules.find((r: any) =>
      r.hostelName.toLowerCase() === normalizedHostelName.toLowerCase()
    );

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
            completionPercentage: 0
          },
        },
      });
    }

    // Get all students in this hostel using adapter
    const students = await db.students.list({
      hostelName: normalizedHostelName
    });

    // Get field progress for all students via adapter
    const fieldProgress = await db.studentFieldProgress.find({
      hostelName: normalizedHostelName,
    });

    // Build completion status per student
    const studentsCompletionStatus = students.map((student: any) => {
      const studentProgress = fieldProgress.filter(
        (fp: any) => (fp.studentId || "").toString() === (student._id || "").toString()
      );

      const fieldStatuses = (enforcement.enforcedFields || []).map((field: any) => {
        const progress = studentProgress.find(
          (fp: any) => fp.fieldId === field.fieldId
        );
        return {
          fieldId: field.fieldId,
          fieldLabel: field.fieldLabel,
          isCompleted: progress?.isCompleted || false,
          completedAt: progress?.completedAt,
        };
      });

      const completedCount = fieldStatuses.filter((fs: any) => fs.isCompleted).length;
      const allCompleted = completedCount === fieldStatuses.length;

      return {
        studentId: student._id,
        name: student.name,
        email: student.email,
        phone: student.phoneNumber,
        registrationId: student.registrationId,
        fieldStatuses,
        completedCount,
        totalFields: (enforcement.enforcedFields || []).length,
        allCompleted,
      };
    });

    // Calculate completion stats accurately based on actual students
    const totalStudents = studentsCompletionStatus.length;
    const completedStudentsCount = studentsCompletionStatus.filter((s: any) => s.allCompleted).length;
    const pendingStudentsCount = totalStudents - completedStudentsCount;
    const completionPercentage = totalStudents > 0
      ? Math.round((completedStudentsCount / totalStudents) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        hostelName,
        enforcedFields: enforcement.enforcedFields,
        studentsCompletionStatus,
        completionStats: {
          totalStudents,
          totalFields: (enforcement.enforcedFields || []).length,
          completedCount: completedStudentsCount,
          pendingCount: pendingStudentsCount,
          completionPercentage,
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

