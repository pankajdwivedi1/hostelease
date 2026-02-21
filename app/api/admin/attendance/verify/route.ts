import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(req: Request) {
    try {
        const { attendanceId, status } = await req.json();

        if (!attendanceId || !status) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const attendance = await db.attendance.update(
            attendanceId,
            {
                faceMatchStatus: status,
                needsReview: false
            }
        );

        if (!attendance) {
            return NextResponse.json({ success: false, error: "Attendance record not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Attendance verified successfully",
            attendance
        });
    } catch (error: any) {
        console.error("Error verifying attendance:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
