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
        const isMinimal = searchParams.get("minimal") === "true";

        // 1. Prepare common filters
        const filters: any = { status: "out" };
        if (hostelName && hostelName !== "all") {
            filters.hostelName = hostelName;
        }

        // ⚡ TODAY ONLY LOGIC (IST Midnight Refresh)
        // We want the Activity Log to show only scans from the current IST day
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        const istTodayStart = new Date(istNow);
        istTodayStart.setUTCHours(0, 0, 0, 0); // Start of day in IST

        // Convert back to UTC for DB query (since check_out_time is TIMESTAMPTZ)
        const utcTodayStart = new Date(istTodayStart.getTime() - istOffset);

        const recentFilters: any = {
            startDate: utcTodayStart.toISOString()
        };
        if (hostelName && hostelName !== "all") {
            recentFilters.hostelName = hostelName;
        }

        // ⚡ OPTIMIZATION: Heartbeat Mode (Extremely Low Bandwidth)
        if (isMinimal) {
            // Only fetch the latest 5 scans (tiny data packet)
            const { records: miniRecent } = await db.gatePasses.list(recentFilters, { limit: 5 });
            return NextResponse.json({
                success: true,
                minimal: true,
                recentActivity: miniRecent,
                summary: null,
                currentlyOut: []
            });
        }

        // 2. Full Mode (Heavier Data - Runs Infrequently)
        // ⚡ SMART FIX: Fetch full counts separately from the visible list
        // This ensures the summary (116) matches the breakdown labels (Pass/Leave count)
        // even if we only download 100 profiles to save bandwidth.
        const [listData, summaryData] = await Promise.all([
            db.gatePasses.list(filters, { limit: 100 }), // Get profiles (Limit 100 for speed/bandwidth)
            db.gatePasses.list(filters, { limit: 1, countOnly: true }) // Get TRUE counts (Extremely tiny data)
        ]);

        const { records: currentlyOut } = listData;
        const totalOut = summaryData.total || 0;

        const countFilters: any = {};
        if (hostelName && hostelName !== "all") {
            countFilters.hostelName = hostelName;
        }

        const [totalStudents, fullOutListForBreakdown] = await Promise.all([
            db.students.count(countFilters),
            // Light-weight query for true Pass vs Leave split
            db.gatePasses.list({ ...filters, light: true }, { limit: 500 })
        ]);

        const { records: recentActivity } = await db.gatePasses.list(recentFilters, { limit: 20 });

        // Calculate split from the FULL list (lightweight records) instead of the limited profile list
        const leaveCount = fullOutListForBreakdown.records.filter((p: any) => p.type === "leave").length;
        const gatePassCount = totalOut - leaveCount;

        const currentlyOutWithDuration = currentlyOut.map((record: any) => {
            const diffMs = now.getTime() - new Date(record.checkOutTime).getTime();
            const durationMinutes = Math.round(diffMs / 60000);
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;

            let durationText = "";
            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                const remainingHours = hours % 24;
                durationText = `${days}d ${remainingHours}h ${mins}m`;
            } else if (hours > 0) {
                durationText = `${hours}h ${mins}m`;
            } else {
                durationText = `${mins}m`;
            }

            return {
                ...record,
                currentDurationMinutes: durationMinutes,
                currentDurationText: durationText,
            };
        });

        return NextResponse.json({
            success: true,
            summary: {
                totalStudents,
                studentsIn: (totalStudents || 0) - totalOut,
                studentsOut: totalOut,
                leaveCount,
                gatePassCount,
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
