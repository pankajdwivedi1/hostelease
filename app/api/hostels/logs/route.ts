import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
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

    if (source === 'SUPABASE') {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Fetch student audit logs, newest first
        const { data, error } = await supabase
          .from("admin_audit_logs")
          .select("*")
          .eq("entity_type", "student")
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        // Filter by hostelName in the details JSON field (case insensitive)
        const targetHostel = hostelName.toLowerCase().trim();
        logs = (data || [])
          .filter((item: any) => {
            const details = item.details || {};
            const itemHostel = (details.hostelName || "").toLowerCase().trim();
            return itemHostel === targetHostel;
          })
          .map((item: any) => {
            const details = item.details || {};
            // Determine action type
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
