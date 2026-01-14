import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Attendance from "@/models/Attendance";

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const today = new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).split('/').reverse().join('-');

        // Get counts grouped by hostelName for today
        const summary = await Attendance.aggregate([
            { $match: { date: today } },
            { $group: { _id: "$hostelName", count: { $sum: 1 } } }
        ]);

        const formattedSummary: Record<string, number> = {};
        summary.forEach(item => {
            formattedSummary[item._id] = item.count;
        });

        // Also get the list of studentIds who marked attendance
        const presentStudents = await Attendance.find({ date: today }).select("studentId");
        const presentStudentIds = presentStudents.map(a => a.studentId.toString());

        return NextResponse.json({
            success: true,
            summary: formattedSummary,
            presentStudentIds,
            date: today
        });
    } catch (error: any) {
        console.error("Error fetching attendance summary:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch attendance summary" },
            { status: 500 }
        );
    }
}
