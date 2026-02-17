import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Attendance from "@/models/Attendance";

export const dynamic = "force-dynamic";

// Debug endpoint to check today's attendance in database
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Get today's date in IST format (YYYY-MM-DD)
        const today = new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).split('/').reverse().join('-');

        // Count total attendance for today
        const count = await Attendance.countDocuments({ date: today });

        // Get all attendance records for today
        const records = await Attendance.find({ date: today })
            .select('name hostelName roomNumber istTime status studentId')
            .sort({ istTime: 1 })
            .lean();

        // Group by hostel
        const byHostel: Record<string, number> = {};
        records.forEach(r => {
            if (!byHostel[r.hostelName]) {
                byHostel[r.hostelName] = 0;
            }
            byHostel[r.hostelName]++;
        });

        return NextResponse.json({
            success: true,
            date: today,
            totalCount: count,
            records: records,
            byHostel: byHostel,
            message: count === 0
                ? "NO ATTENDANCE RECORDS FOUND - All queued attendance was lost"
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
