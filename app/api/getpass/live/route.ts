import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import GatePass from "@/models/GatePass";
import Student from "@/models/Student";

/**
 * GET /api/getpass/live
 * 
 * Live dashboard data for the gate desktop screen.
 * Returns:
 * - Students currently outside campus
 * - Total counts (in/out)
 * - Recent outing activity
 */
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const searchParams = request.nextUrl.searchParams;
        const hostelName = searchParams.get("hostelName");

        // 1. Get all currently "out" students
        const outQuery: any = { status: "out" };
        if (hostelName && hostelName !== "all") {
            outQuery.hostelName = { $regex: hostelName, $options: "i" };
        }

        const currentlyOut = await GatePass.find(outQuery)
            .sort({ checkOutTime: -1 })
            .lean();

        // 2. Get student counts
        const studentQuery: any = {};
        if (hostelName && hostelName !== "all") {
            studentQuery.hostelName = { $regex: hostelName, $options: "i" };
        }

        const [totalStudents, studentsOut] = await Promise.all([
            Student.countDocuments(studentQuery),
            Student.countDocuments({ ...studentQuery, studentStatus: "out" }),
        ]);

        // 3. Get recent activity (last 20 records - both check-in and check-out)
        const recentActivity = await GatePass.find(
            hostelName && hostelName !== "all"
                ? { hostelName: { $regex: hostelName, $options: "i" } }
                : {}
        )
            .sort({ updatedAt: -1 })
            .limit(20)
            .lean();

        // 4. Calculate duration for students who are still out
        const now = new Date();
        const currentlyOutWithDuration = currentlyOut.map((record: any) => {
            const diffMs = now.getTime() - new Date(record.checkOutTime).getTime();
            const durationMinutes = Math.round(diffMs / 60000);
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            return {
                ...record,
                currentDurationMinutes: durationMinutes,
                currentDurationText: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
            };
        });

        return NextResponse.json({
            success: true,
            summary: {
                totalStudents,
                studentsIn: totalStudents - studentsOut,
                studentsOut,
            },
            currentlyOut: currentlyOutWithDuration,
            recentActivity,
        });
    } catch (error: any) {
        console.error("❌ Error fetching live gate pass data:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch live data" },
            { status: 500 }
        );
    }
}
