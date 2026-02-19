import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get("date"); // Format: YYYY-MM-DD
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const hostelName = searchParams.get("hostelName");
        const studentId = searchParams.get("studentId");

        // Date Validation Logic
        if (!studentId && !startDate && !date) {
            return NextResponse.json({ error: "Date or Date Range required" }, { status: 400 });
        }

        const filters = {
            date,
            startDate,
            endDate,
            hostelName,
            studentId
        };

        const attendance = await db.attendance.list(filters);

        return NextResponse.json({ success: true, attendance });
    } catch (error: any) {
        console.error("Error fetching attendance logs:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
