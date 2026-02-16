import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Attendance from "@/models/Attendance";

export async function POST(req: Request) {
    try {
        await connectDB();
        const { attendanceId, status } = await req.json();

        if (!attendanceId || !status) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const attendance = await Attendance.findByIdAndUpdate(
            attendanceId,
            {
                faceMatchStatus: status,
                needsReview: false
            },
            { new: true }
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
