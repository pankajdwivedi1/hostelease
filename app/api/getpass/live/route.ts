export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, supabase } from "@/lib/dbAdapter";

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
            const tenantId = await db.getTenantIdOrThrow();
            const returnsFilters: any = {
                status: "in",
                startDate: utcTodayStart.toISOString()
            };
            if (hostelName && hostelName !== "all") {
                returnsFilters.hostelName = hostelName;
            }

            // ⚡ FAST COUNTS: Use Promise.all to fetch counts and recent items in parallel
            // 📡 BANDWIDTH OPTIMIZATION: We fetch ONLY the counts for "leave" and "outing" types 
            // instead of fetching all 700+ rows of data.
            const [recentRes, summaryRes, studentsRes, leaveCountRes, outingCountRes] = await Promise.all([
                db.gatePasses.list(returnsFilters, {
                    limit: 5,
                    sortField: source === 'SUPABASE' ? 'check_in_time' : 'checkInTime',
                    sortOrder: 'desc'
                }),
                db.gatePasses.list(filters, { limit: 1, countOnly: true }),
                db.students.count(countFilters),
                db.gatePasses.list({ ...filters, type: 'leave' }, { countOnly: true }),
                db.gatePasses.list({ ...filters, type: 'outing' }, { countOnly: true })
            ]);

            const { records: miniRecent } = recentRes;
            const uniqueStudentsOut = summaryRes.total || 0;
            const totalStudents = studentsRes || 0;
            const miniLeaveCount = leaveCountRes.total || 0;
            const miniGatePassCount = outingCountRes.total || 0;

            return NextResponse.json({
                success: true,
                minimal: true,
                recentActivity: miniRecent,
                summary: {
                    totalStudents,
                    glitchFix: totalStudents < uniqueStudentsOut ? (uniqueStudentsOut + 10) : totalStudents,
                    studentsIn: (totalStudents - uniqueStudentsOut) < 0 ? 0 : (totalStudents - uniqueStudentsOut),
                    studentsOut: uniqueStudentsOut,
                    leaveCount: miniLeaveCount,
                    gatePassCount: miniGatePassCount,
                },
                currentlyOut: []
            });
        }

        // 2. Full Mode (Heavier Data - Runs Infrequently)
        // ⚡ SPEED FIX: Fetch all data elements in parallel
        const [allOutPassesRes, totalStudents, recentActivityRes] = await Promise.all([
            db.gatePasses.list(filters, { limit: 1000 }),
            db.students.count(countFilters),
            db.gatePasses.list({
                status: "in",
                startDate: utcTodayStart.toISOString(),
                ...(hostelName && hostelName !== "all" ? { hostelName } : {})
            }, {
                limit: 20,
                sortField: source === 'SUPABASE' ? 'check_in_time' : 'checkInTime',
                sortOrder: 'desc'
            })
        ]);

        const openPasses = allOutPassesRes.records || [];
        const recentActivity = recentActivityRes.records || [];
        
        // ⚡ DE-DUPLICATION: Use a Map to keep ONLY the most recent record per student
        const uniqueOutRecords = new Map<string, any>();
        openPasses.forEach((p: any) => {
            const sId = (typeof p.studentId === 'object' ? (p.studentId?._id || p.studentId?.id) : p.studentId)?.toString();
            if (sId && !uniqueOutRecords.has(sId)) {
                uniqueOutRecords.set(sId, p);
            }
        });

        const currentlyOut = Array.from(uniqueOutRecords.values());
        const uniqueStudentsOut = currentlyOut.length;
        
        let leaveCount = 0;
        let gatePassCount = 0;
        currentlyOut.forEach((p) => {
            const t = String(p.type || '').toLowerCase().trim();
            if (t === 'leave' || t === 'home-leave' || t === 'hleave' || t.includes('leave')) {
                leaveCount++;
            } else {
                gatePassCount++;
            }
        });

        // Use the deduplicated list for display (no extra healing needed as it's already mapped)
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

        // ⚡ EXCLUDE CURRENTLY OUT STUDENTS FROM RETURNS TODAY:
        // A student who checked out again belongs strictly in the Outside column, not Returns Today.
        const filteredRecentActivity = recentActivity
            .filter((p: any) => {
                const sId = (typeof p.studentId === 'object' ? (p.studentId?._id || p.studentId?.id) : p.studentId)?.toString();
                return !sId || !uniqueOutRecords.has(sId);
            })
            .map((p: any) => {
                let mins = p.durationMinutes ?? p.duration_minutes;
                if (mins === undefined || mins === null || isNaN(mins) || mins <= 0) {
                    const inT = p.checkInTime || p.check_in_time || p.updatedAt;
                    const outT = p.checkOutTime || p.check_out_time;
                    if (inT && outT) {
                        const diffMs = new Date(inT).getTime() - new Date(outT).getTime();
                        if (!isNaN(diffMs) && diffMs >= 0) {
                            mins = Math.floor(diffMs / 60000);
                        }
                    }
                }
                return {
                    ...p,
                    durationMinutes: mins
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
            recentActivity: filteredRecentActivity,
        });
    } catch (error: any) {
        console.error("❌ Error fetching live gate pass data:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch live data" },
            { status: 500 }
        );
    }
}
