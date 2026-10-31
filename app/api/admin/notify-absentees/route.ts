import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";
import { sendBulkPushToParents } from "@/lib/pushNotification";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentIds, date, customMessage } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: studentIds" },
        { status: 400 }
      );
    }

    const currentTenantId = await db.getTenantIdOrThrow();

    // ⚡ Fast direct indexed seek for absent students
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: currentTenantId
      },
      select: {
        id: true,
        name: true,
        fatherNumber: true,
        motherNumber: true,
        profilePicture: true
      }
    });

    console.log(`[NOTIFY_ABSENTEES] Found ${students.length} matching students in DB to notify for date: ${date}`);

    if (!students || students.length === 0) {
      return NextResponse.json({
        success: true,
        notifiedCount: 0
      });
    }

    // ⚡ Fast bulk dispatch using indexed single query
    const result = await sendBulkPushToParents(students, "parentNightAbsent", {
      title: customMessage ? "⚠️ Urgent Parent Alert" : "Night Attendance Alert",
      bodyTemplate: customMessage 
        ? customMessage 
        : `Your ward {name} has NOT marked night curfew attendance for today ${date || 'today'}.`,
      url: "/"
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error sending bulk absentee notifications:", error);
    return NextResponse.json(
      { error: error.message || "Failed to notify parents" },
      { status: 500 }
    );
  }
}
