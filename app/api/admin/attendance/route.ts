import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";

export async function GET(request: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(request.url);
        const date = searchParams.get("date"); // Format: YYYY-MM-DD
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const hostelName = searchParams.get("hostelName");
        const studentId = searchParams.get("studentId");

        let query: any = { isTest: { $ne: true } };

        // Date Filtering Logic
        if (startDate && endDate) {
            query.date = { $gte: startDate, $lte: endDate };
        } else if (date) {
            query.date = date;
        } else {
            // If no date params, default to today or return error? 
            // Existing logic required date, but for range it might differ.
            // Let's keep strict requirement if no range provided.
            if (!studentId && !startDate) { // RELAX requirement if studentId is the focus, but usually we want a date range.
                return NextResponse.json({ error: "Date or Date Range required" }, { status: 400 });
            }
        }

        // Student & Hostel Filtering
        if (studentId) {
            query.studentId = studentId;
        }

        if (hostelName && hostelName !== "all" && hostelName !== "") {
            query.hostelName = { $regex: hostelName, $options: "i" };
        }

        const attendance = await Attendance.find(query)
            .populate({
                path: "studentId",
                model: Student,
                select: "name email hostelName roomNumber phoneNumber registrationId",
            })
            .sort({ date: -1, timestamp: -1 }); // Sort by date first for ranges

        return NextResponse.json({ success: true, attendance });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
