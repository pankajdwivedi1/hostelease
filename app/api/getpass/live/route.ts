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
        const source = await db.getSource ? await db.getSource() : 'SUPABASE'; // Fallback to Supabase
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

        const countFilters: any = {};
        if (hostelName && hostelName !== "all") {
            countFilters.hostelName = hostelName;
        }

        // ⚡ OPTIMIZATION: Heartbeat Mode (Extremely Low Bandwidth)
        if (isMinimal) {
            const returnsFilters: any = {
                status: "in",
                startDate: utcTodayStart.toISOString()
            };
            if (hostelName && hostelName !== "all") {
                returnsFilters.hostelName = hostelName;
            }

            // ⚡ FAST COUNTS: Use Promise.all to fetch counts and recent items in parallel
            const [recentRes, summaryRes, studentsRes] = await Promise.all([
                db.gatePasses.list(returnsFilters, {
                    limit: 5,
                    sortField: source === 'SUPABASE' ? 'check_in_time' : 'checkInTime',
                    sortOrder: 'desc'
                }),
                db.gatePasses.list(filters, { limit: 1, countOnly: true }),
                db.students.count(countFilters)
            ]);

            const { records: miniRecent } = recentRes;
            const uniqueStudentsOut = summaryRes.total || 0;
            const totalStudents = studentsRes || 0;

            return NextResponse.json({
                success: true,
                minimal: true,
                recentActivity: miniRecent,
                summary: {
                    totalStudents,
                    studentsIn: totalStudents - uniqueStudentsOut,
                    studentsOut: uniqueStudentsOut,
                    // Note: leave/pass counts are omitted in minimal to keep it fast
                },
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

        const [totalStudents, fullOutListForBreakdown] = await Promise.all([
            db.students.count(countFilters),
            // Light-weight query for true Pass vs Leave split
            db.gatePasses.list({ ...filters, light: true }, { limit: 500 })
        ]);

        const returnsFilters: any = {
            status: "in",
            startDate: utcTodayStart.toISOString()
        };
        if (hostelName && hostelName !== "all") {
            returnsFilters.hostelName = hostelName;
        }

        const { records: recentActivity } = await db.gatePasses.list(returnsFilters, {
            limit: 20,
            sortField: source === 'SUPABASE' ? 'check_in_time' : 'checkInTime',
            sortOrder: 'desc'
        });

        // ⚡ SELF-HEALING & DEDUPLICATION LOGIC
        // Some students might have duplicate 'out' records due to race conditions.
        // We deduplicate them here for the UI and identify records that need closing.
        const uniqueStudentsMap = new Map();
        const duplicatesToClose: string[] = [];

        // Note: currentlyOut is limited to 100, but fullOutListForBreakdown has more for analysis
        const allOutRecords = fullOutListForBreakdown.records || [];

        allOutRecords.forEach((record: any) => {
            const sId = record.studentId?.toString();
            if (!uniqueStudentsMap.has(sId)) {
                uniqueStudentsMap.set(sId, record);
            } else {
                // This is a duplicate! We keep the newest one (based on sort) and mark this for closing
                duplicatesToClose.push(record._id);
            }
        });

        // Fix the true unique counts
        const uniqueStudentsOut = uniqueStudentsMap.size;

        // ⚡ ASYNC SELF-HEALING: Close duplicates in the background
        if (duplicatesToClose.length > 0) {
            console.log(`[SELF_HEAL] Found ${duplicatesToClose.length} duplicate 'out' records. Resolving...`);
            // We don't await this to keep the API fast
            Promise.all(duplicatesToClose.map(id =>
                db.gatePasses.update(id, {
                    status: 'auto-resolved',
                    checkInTime: now,
                    qrTokenUsedIn: 'SYSTEM_SELF_HEAL_DUPLICATE'
                })
            )).catch(err => console.error("[SELF_HEAL_ERROR]", err));
        }

        // Filter the visible list to be unique as well
        const uniqueVisibleList: any[] = [];
        const seenInVisible = new Set();
        currentlyOut.forEach((record: any) => {
            const sId = record.studentId?.toString();
            if (!seenInVisible.has(sId)) {
                uniqueVisibleList.push(record);
                seenInVisible.add(sId);
            }
        });

        // Calculate split from the FULL list (lightweight records) instead of the limited profile list
        // Calculate split from the UNIQUE map
        const uniqueRecords = Array.from(uniqueStudentsMap.values());
        const leaveCount = uniqueRecords.filter((p: any) => p.type === "leave").length;
        const gatePassCount = uniqueStudentsOut - leaveCount;

        const currentlyOutWithDuration = uniqueVisibleList.map((record: any) => {
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
                studentsIn: (totalStudents || 0) - uniqueStudentsOut,
                studentsOut: uniqueStudentsOut,
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
