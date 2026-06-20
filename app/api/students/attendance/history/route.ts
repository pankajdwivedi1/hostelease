export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const studentId = searchParams.get("studentId");
        
        if (!studentId) {
            return NextResponse.json({ error: "Student ID required" }, { status: 400 });
        }

        // Fetch up to 31 records for the student (approx 1 month)
        const records = await db.attendance.list(
            { studentId },
            { limit: 31 }
        );

        // Map the results to a simplified format for the history view
        const history = records.map((record: any) => ({
            id: record._id || record.id,
            date: record.date,
            time: record.istTime,
            status: record.status || "present",
        }));

        return NextResponse.json({ success: true, history }, { status: 200 });
    } catch (e: any) {
        console.error("Error fetching attendance history:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
