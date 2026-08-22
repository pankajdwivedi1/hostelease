import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import connectDB from "@/lib/mongodb";
import HostelLog from "@/models/HostelLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    if (!hostelName) {
      return NextResponse.json({ error: "Missing required parameter: hostelName" }, { status: 400 });
    }

    const source = await db.getSource();
    let logs: any[] = [];

    if (source === 'PRISMA') {
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

      logs = (dbLogs || []).map((item: any) => {
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
    } else if (source === 'SUPABASE') {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const targetHostel = hostelName.toLowerCase().trim();

        const { data, error } = await supabase
          .from("admin_audit_logs")
          .select("id, action, entity_name, details, performed_by, created_at")
          .eq("entity_type", "student")
          .eq("details->>isHostelActivity", "true")
          .in("action", ["STUDENT_CREATED", "STUDENT_DELETED", "STUDENT_EDITED"])
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        logs = (data || [])
          .filter((item: any) => {
            const details = item.details || {};
            if (!details.isHostelActivity) return false;
            if (!details.hostelName) return false;
            const itemHostel = (details.hostelName || "").toLowerCase().trim();
            return itemHostel === targetHostel;
          })
          .map((item: any) => {
            const details = item.details || {};
            let actionType: 'ADD' | 'DELETE' | 'UPDATE' = 'UPDATE';
            if (item.action === 'STUDENT_CREATED') actionType = 'ADD';
            else if (item.action === 'STUDENT_DELETED') actionType = 'DELETE';

            return {
              id: item.id || item._id,
              hostelName: details.hostelName || hostelName,
              actionType,
              studentName: details.studentName || item.entity_name || "Unknown Student",
              erpId: details.erpId || "N/A",
              operator: details.operator || item.performed_by || "Admin",
              createdAt: item.created_at || new Date().toISOString()
            };
          });
      }
    } else {
      // Local MongoDB/Mongoose fallback
      await connectDB();
      const dbLogs = await HostelLog.find({
        hostelName: { $regex: `^${hostelName.trim()}$`, $options: 'i' }
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

      logs = (dbLogs || []).map((log: any) => ({
        id: log._id ? String(log._id) : String(log.id),
        hostelName: log.hostelName,
        actionType: log.actionType,
        studentName: log.studentName,
        erpId: log.erpId,
        operator: log.operator,
        createdAt: log.createdAt || log.created_at
      }));
    }

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

    const source = await db.getSource();
    if (source === 'PRISMA') {
      await (prisma as any).adminAuditLog.deleteMany({
        where: { id: { in: logIds } }
      });
    } else if (source === 'SUPABASE') {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        throw new Error("Supabase client could not be initialized");
      }
      const { error } = await supabase
        .from("admin_audit_logs")
        .delete()
        .in("id", logIds);
      if (error) throw error;
    } else {
      await connectDB();
      await HostelLog.deleteMany({ _id: { $in: logIds } });
    }

    return NextResponse.json({ success: true, message: "Logs deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting hostel activity logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete logs" },
      { status: 500 }
    );
  }
}

