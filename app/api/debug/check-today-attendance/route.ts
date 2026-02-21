import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// Debug endpoint to check today's attendance in database
export async function GET(request: NextRequest) {
    try {
        // Get today's date in IST format (YYYY-MM-DD)
        const today = new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).split('/').reverse().join('-');

        // Get all attendance records for today using adapter
        const records = await db.attendance.list({ date: today });
        const count = records.length;

        // Group by hostel
        const byHostel: Record<string, number> = {};
        records.forEach((r: any) => {
            const hostelName = r.hostelName;
            if (!byHostel[hostelName]) {
                byHostel[hostelName] = 0;
            }
            byHostel[hostelName]++;
        });

        return NextResponse.json({
            success: true,
            date: today,
            totalCount: count,
            records: records,
            byHostel: byHostel,
            message: count === 0
                ? "NO ATTENDANCE RECORDS FOUND"
                : `Found ${count} attendance records for today`
        });
    } catch (error: any) {
        console.error("Error checking attendance:", error);
        return NextResponse.json(
            { error: error.message || "Failed to check attendance" },
            { status: 500 }
        );
    }
}
