import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    if (!hostelName) {
      return NextResponse.json({ error: "Missing required parameter: hostelName" }, { status: 400 });
    }

    const targetHostel = hostelName.toUpperCase().trim();
    const dbLogs: any[] = await prisma.$queryRaw`
      SELECT id, action, entity_name, details, performed_by, created_at
      FROM "admin_audit_logs"
      WHERE (
        (details->>'isHostelActivity' = 'true' AND UPPER(TRIM(COALESCE(details->>'hostelName', ''))) = ${targetHostel})
        OR
        (action IN ('STUDENT_CREATED', 'STUDENT_DELETED', 'STUDENT_EDITED', 'STUDENT_ONBOARDED') AND UPPER(TRIM(COALESCE(details->>'hostelName', ''))) = ${targetHostel})
      )
      ORDER BY created_at DESC
      LIMIT 200
    `;

    const logs = (dbLogs || []).map((item: any) => {
      const details = typeof item.details === 'object' && item.details !== null ? item.details : {};
      const op = details.operator || item.performed_by || item.performedBy || "Admin";
      let actionType: 'ADD' | 'DELETE' | 'UPDATE' | 'ONBOARD' = 'UPDATE';
      if (item.action === 'STUDENT_ONBOARDED' || details.actionType === 'ONBOARD' || String(op).toLowerCase().includes('onboard')) {
        actionType = 'ONBOARD';
      } else if (item.action === 'STUDENT_CREATED') {
        actionType = 'ADD';
      } else if (item.action === 'STUDENT_DELETED') {
        actionType = 'DELETE';
      }

      return {
        id: item.id || item._id,
        hostelName: details.hostelName || hostelName,
        actionType,
        studentName: details.studentName || item.entity_name || item.entityName || "Unknown Student",
        erpId: details.erpId || "N/A",
        operator: op,
        createdAt: item.created_at || item.createdAt || new Date().toISOString()
      };
    });

    return NextResponse.json({ success: true, logs }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching hostel activity logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { logIds } = await request.json();
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return NextResponse.json({ error: "Missing or invalid parameter: logIds" }, { status: 400 });
    }

    await (prisma as any).adminAuditLog.deleteMany({
      where: { id: { in: logIds } }
    });

    return NextResponse.json({ success: true, message: "Logs deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting hostel activity logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete logs" },
      { status: 500 }
    );
  }
}
