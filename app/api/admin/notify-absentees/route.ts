import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { sendPushNotification } from "@/lib/pushNotification";

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

    // Fetch the detailed records for all absent students in batches to avoid Supabase URL limits (max 100 per batch)
    const BATCH_SIZE = 100;
    const students: any[] = [];
    
    for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
      const batchIds = studentIds.slice(i, i + BATCH_SIZE);
      const batchStudents = await db.students.list({
        _id: { $in: batchIds },
        tenant_id: currentTenantId
      }, { limit: batchIds.length });
      
      if (Array.isArray(batchStudents)) {
        students.push(...batchStudents);
      }
    }

    console.log(`[NOTIFY_ABSENTEES] Found ${students.length} students to notify for date: ${date}`);

    let notifiedCount = 0;

    // Send notifications to each parent
    const notifyPromises = students.map(async (student: any) => {
      const parentPhone = student.fatherNumber || student.motherNumber;
      if (!parentPhone) return;

      const parentUserId = student.fatherNumber || (student._id.toString() + "_parent");
      const studentPhoto = (student as any)?.profilePicture || (student as any)?.photoUrl || (student as any)?.photo || (student as any)?.image;
      
      const res = await sendPushNotification(parentUserId, "parent", "parentNightAbsent", {
        title: customMessage ? "⚠️ Urgent Parent Alert" : "Night Attendance Alert",
        body: customMessage 
          ? customMessage.replace("{name}", student.name) 
          : `Your ward ${student.name} has NOT marked night curfew attendance for today ${date || 'today'}.`,
        url: "/",
        icon: studentPhoto || "/icons/icon-192x192.png",
        image: studentPhoto || undefined
      });

      if (res.success) {
        notifiedCount++;
      }
    });

    await Promise.all(notifyPromises);

    return NextResponse.json({
      success: true,
      notifiedCount
    });
  } catch (error: any) {
    console.error("Error sending bulk absentee notifications:", error);
    return NextResponse.json(
      { error: error.message || "Failed to notify parents" },
      { status: 500 }
    );
  }
}

