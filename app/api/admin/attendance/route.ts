import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";

export async function GET(request: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(request.url);
        const date = searchParams.get("date"); // Format: YYYY-MM-DD
        const hostelName = searchParams.get("hostelName");

        if (!date) {
            return NextResponse.json({ error: "Date required" }, { status: 400 });
        }

        let query: any = { date };
        if (hostelName && hostelName !== "all" && hostelName !== "") {
            query.hostelName = { $regex: hostelName, $options: "i" };
        }

        const attendance = await Attendance.find(query)
            .populate({
                path: "studentId",
                model: Student,
                select: "name email hostelName roomNumber phoneNumber registrationId",
            })
            .sort({ timestamp: -1 });

        return NextResponse.json({ success: true, attendance });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
