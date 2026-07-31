import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// ⚡ IN-MEMORY CACHE for hostel stats (Reduces DB queries on date change)
const statsCache = new Map<string, { stats: any, hostelStats: any, expires: number }>();
const STATS_CACHE_TTL = 30 * 1000; // 30 seconds cache

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const requestedDate = searchParams.get("date");
        const hostelFilter = searchParams.get("hostelName");
        const authHostelsParam = searchParams.get("authorizedHostels");

        // Parse authorized hostels if provided
        let authorizedHostels: string[] = [];
        if (authHostelsParam) {
            try {
                authorizedHostels = JSON.parse(authHostelsParam);
            } catch (e) {
                authorizedHostels = [authHostelsParam];
            }
        } else if (hostelFilter && hostelFilter !== "all") {
            authorizedHostels = [hostelFilter];
        }

        // Get today's date in IST YYYY-MM-DD
        const dateObj = new Date();
        const istDateStr = dateObj.toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });

        const dateParts = istDateStr.split(/[^0-9]/);
        let today = "";

        if (dateParts.length >= 3) {
            if (dateParts[0].length === 4) {
                today = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
            } else {
                today = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
        } else {
            today = dateObj.toISOString().split('T')[0];
        }

        const date = requestedDate || today;

        // Fetch hostels for mapping and category initialization
        const hostelsList = await db.hostels.getAll();

        if (!Array.isArray(hostelsList)) {
            console.error("[ATTENDANCE_SUMMARY] hostelsList is not an array:", hostelsList);
            throw new Error("Failed to retrieve hostels list");
        }

        const canonicalHostelNames = hostelsList
            .filter(h => h && h.name)
            .map((h: any) => h.name);

        console.log(`[ATTENDANCE_SUMMARY] Canonical Hostels:`, canonicalHostelNames);

        // 3. Helper to categorize hostel names (handling old data variations)
        const getHostelCategory = (rawName: string) => {
            if (!rawName) return "Other";
            const name = rawName.toUpperCase();

            // Priority 1: Match canonical names exactly first
            const exactMatch = canonicalHostelNames.find(c => c.toUpperCase() === name);
            if (exactMatch) return exactMatch;

            // Priority 2: Fuzzy matching for known categories
            if (name.includes("GUEST") || name.includes("GHB")) return "GHB HOSTEL";
            if (name.includes("GANGOTRI")) return "GANGOTRI HOSTEL";
            if (name.includes("GAYATRI") || name.includes("GAYTRI")) return "GAYTRI HOSTEL";
            if (name.includes("BOYS")) return "BOYS HOSTEL";

            return rawName; // Fallback to raw name if no category matches
        };

        // 4. Initialize summary with 0 for all canonical hostels
        const formattedSummary: Record<string, number> = {};
        canonicalHostelNames.forEach(name => {
            formattedSummary[name] = 0;
        });

        // 5. Fetch Attendance Summary from DB
        const tenantIdForLog = await db.getTenantIdOrThrow();
        console.log(`[ATTENDANCE_SUMMARY] Fetching for date: ${date}, tenantId: ${tenantIdForLog}`);
        const result = await db.attendance.summary(date);
        console.log(`[ATTENDANCE_SUMMARY] result.presentStudentIds count:`, result?.presentStudentIds?.length);

        let summaryData = result;
        if (!summaryData) {
            console.warn("[ATTENDANCE_SUMMARY] db.attendance.summary returned null/undefined, using fallback empty summary");
            summaryData = { presentStudentIds: [], summary: [] };
        }

        let presentStudentIds: string[] = summaryData.presentStudentIds || [];

        // 6. Aggregate results into categories using the summary returned by the adapter
        if (summaryData.summary && Array.isArray(summaryData.summary)) {
            // summaryData.summary is [{_id: 'Hostel Name', count: 10}]
            summaryData.summary.forEach((item: any) => {
                const category = getHostelCategory(item._id);
                // Filter by authorized hostels if provided
                if (authorizedHostels.length > 0 && !authorizedHostels.includes(category)) return;
                formattedSummary[category] = (formattedSummary[category] || 0) + (item.count || 0);
            });
        }

        // 7. Get global settings for manual attendance toggle
        const settings = await db.settings.get();
        const enableManualAttendance = settings?.enableManualAttendance ?? false;

        // ⚡ MAJOR OPTIMIZATION: Use parallel aggregate count queries instead of downloading entire database
        const pendingCountResult = await db.permissions.count({ status: 'pending' });
        const pendingCount = typeof pendingCountResult === 'number' ? pendingCountResult : 0;


        const tenantId = await db.getTenantIdOrThrow();
        const cacheKey = `${tenantId}_${authorizedHostels.join(',')}`;
        const cachedStats = statsCache.get(cacheKey);

        let stats;
        let hostelStats: Record<string, { total: number; in: number; out: number }>;

        if (cachedStats && cachedStats.expires > Date.now()) {
            stats = cachedStats.stats;
            hostelStats = cachedStats.hostelStats;
        } else {
            const activeHostels = authorizedHostels.length > 0 ? authorizedHostels : canonicalHostelNames;
            hostelStats = {};
            let totalStudents = 0;
            let totalIn = 0;
            let totalOut = 0;

            await Promise.all(activeHostels.map(async (h) => {
                const [hTotal, hIn, hOut] = await Promise.all([
                    db.students.count({ hostelName: h }),
                    db.students.count({ hostelName: h, studentStatus: 'in' }),
                    db.students.count({ hostelName: h, studentStatus: 'out' })
                ]);
                
                hostelStats[h] = { total: hTotal, in: hIn, out: hOut };
                totalStudents += hTotal;
                totalIn += hIn;
                totalOut += hOut;
            }));

            stats = {
                totalStudents,
                totalIn,
                totalOut,
                pendingPermissions: pendingCount
            };

            statsCache.set(cacheKey, {
                stats,
                hostelStats,
                expires: Date.now() + STATS_CACHE_TTL
            });
        }

        // ⚡ WARDEN FILTER: If authorized hostels are specified, filter the presentStudentIds
        if (authorizedHostels.length > 0) {
            const authorizedIds = new Set<string>();
            // Only fetch strictly necessary lightweight IDs
            await Promise.all(authorizedHostels.map(async (h) => {
                const studentsInHostel = await db.students.list({ hostelName: h }, { select: '_id', limit: 5000 });
                studentsInHostel.forEach((s: any) => authorizedIds.add(String(s.id || s._id)));
            }));
            presentStudentIds = presentStudentIds.filter(id => authorizedIds.has(String(id)));
        }

        return NextResponse.json({
            success: true,
            summary: formattedSummary, 
            hostelStats,              
            stats,
            presentStudentIds,
            enableManualAttendance,
            date
        });


    } catch (error: any) {
        console.error("❌ [ATTENDANCE_SUMMARY_ERROR]:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Internal Server Error",
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
