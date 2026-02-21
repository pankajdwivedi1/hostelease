import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

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
        const searchParams = request.nextUrl.searchParams;
        const hostelName = searchParams.get("hostelName");

        // 1. Get all currently "out" students using adapter
        const filters: any = { status: "out" };
        if (hostelName && hostelName !== "all") {
            filters.hostelName = hostelName;
        }

        const { records: currentlyOut } = await db.gatePasses.list(filters, { limit: 100 });

        // 2. Get student counts using adapter
        const countFilters: any = {};
        if (hostelName && hostelName !== "all") {
            countFilters.hostelName = hostelName;
        }

        const [totalStudents, studentsOut] = await Promise.all([
            db.students.count(countFilters),
            db.students.count({ ...countFilters, studentStatus: "out" }),
        ]);

        // 3. Get recent activity (last 20 records - both check-in and check-out)
        const recentFilters: any = {};
        if (hostelName && hostelName !== "all") {
            recentFilters.hostelName = hostelName;
        }

        const { records: recentActivity } = await db.gatePasses.list(recentFilters, { limit: 20 });

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
                studentsIn: (totalStudents || 0) - (studentsOut || 0),
                studentsOut: studentsOut || 0,
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

