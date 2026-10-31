export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { jsonWithEtag } from "@/lib/etag";

/**
 * GET /api/getpass/history
 * 
 * Get outing history. Supports filtering by:
 * - firebaseUID (student's own history)
 * - hostelName (admin filter)
 * - date range (startDate, endDate)
 * - status ("out" for currently outside)
 * - limit (pagination)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const studentId = searchParams.get("studentId");
        const firebaseUID = searchParams.get("firebaseUID");
        const hostelName = searchParams.get("hostelName");
        const status = searchParams.get("status");
        const erpId = searchParams.get("erpId");
        const registrationId = searchParams.get("registrationId");
        const collegeName = searchParams.get("collegeName");
        const semester = searchParams.get("semester");
        const search = searchParams.get("search");
        const type = searchParams.get("type");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const startTime = searchParams.get("startTime");
        const endTime = searchParams.get("endTime");
        const timeMode = searchParams.get("timeMode") || "out";
        const limit = parseInt(searchParams.get("limit") || "50");
        const page = parseInt(searchParams.get("page") || "1");

        const filters: any = {};

        // ⚡ FAST PATH: Avoid redundant student lookup when studentId or registrationId is already known
        if (studentId) {
            filters.studentId = studentId;
            if (registrationId) filters.registrationId = registrationId;
        } else if (registrationId) {
            filters.registrationId = registrationId;
        } else if (erpId || firebaseUID) {
            const student = await db.students.findOne({
                ...(erpId ? { erpInformation: erpId } : {}),
                ...(firebaseUID ? { firebaseUID } : {})
            }, { minimal: true });

            if (student) {
                filters.studentId = (student._id || student.id)?.toString();
                filters.registrationId = student.registrationId;
            }
        }

        if (hostelName && hostelName !== "all") {
            filters.hostelName = hostelName;
        }

        if (status && status !== "all") {
            filters.status = status;
        }

        if (type && type !== "all") filters.type = type;
        if (erpId) filters.erpId = erpId;
        if (registrationId) filters.registrationId = registrationId;
        if (collegeName && collegeName !== "all") filters.collegeName = collegeName;
        if (search) filters.search = search;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (semester && semester !== "all") filters.semester = semester;
        if (startTime) filters.startTime = startTime;
        if (endTime) filters.endTime = endTime;
        if (timeMode) filters.timeMode = timeMode;

        const populateParam = searchParams.get("populate");
        const populate = populateParam === "false" ? false : true;

        // ⚡ HIGH-PERFORMANCE STATS: Run history list and single groupBy aggregation in parallel
        const [historyRes, typeCounts] = await Promise.all([
            db.gatePasses.list(filters, { page, limit, populate }),
            (async () => {
                try {
                    const { prisma } = await import("@/lib/prisma");
                    let tenantId: string | null = null;
                    try { tenantId = await db.getTenantIdOrThrow(); } catch (e) {}
                    const statsWhere: any = {};
                    if (tenantId) statsWhere.tenantId = tenantId;
                    if (filters.studentId) statsWhere.studentId = filters.studentId;
                    if (filters.registrationId) statsWhere.registrationId = { equals: filters.registrationId, mode: 'insensitive' };
                    if (filters.hostelName && filters.hostelName !== 'all') statsWhere.hostelName = { equals: filters.hostelName, mode: 'insensitive' };
                    if (filters.status && filters.status !== 'all') statsWhere.status = filters.status;

                    // ⚡ SYNC STATS TO DATE RANGE: Ensure Daily Pass and Leave counts match the selected date filters (e.g. Last 7 Days, Today, This Month, All Time)
                    if (filters.startDate || filters.endDate || filters.startTime || filters.endTime) {
                        const dateCondition: any = {};
                        const todayIso = new Date().toISOString().split('T')[0];
                        const sDate = filters.startDate || todayIso;
                        const eDate = filters.endDate || sDate;
                        if (filters.startDate || filters.startTime) {
                            const sTime = filters.startTime ? `${filters.startTime}:00` : '00:00:00';
                            const s = filters.startDate && filters.startDate.includes('T') 
                                ? new Date(filters.startDate) 
                                : new Date(`${sDate}T${sTime}+05:30`);
                            if (!isNaN(s.getTime())) dateCondition.gte = s;
                        }
                        if (filters.endDate || filters.endTime) {
                            const eTime = filters.endTime ? `${filters.endTime}:59.999` : '23:59:59.999';
                            const e = filters.endDate && filters.endDate.includes('T') 
                                ? new Date(filters.endDate) 
                                : new Date(`${eDate}T${eTime}+05:30`);
                            if (!isNaN(e.getTime())) dateCondition.lte = e;
                        }
                        if (dateCondition.gte || dateCondition.lte) {
                            const timeField = filters.timeMode === 'in' ? 'checkInTime' : 'checkOutTime';
                            statsWhere[timeField] = dateCondition;
                            if (filters.timeMode === 'in') {
                                statsWhere.status = 'in';
                            }
                        }
                    }

                    if (filters.collegeName && filters.collegeName !== 'all') {
                        statsWhere.student = {
                            ...(statsWhere.student || {}),
                            collegeName: { equals: filters.collegeName, mode: 'insensitive' }
                        };
                    }

                    if (filters.semester && filters.semester !== 'all') {
                        statsWhere.student = {
                            ...(statsWhere.student || {}),
                            semester: { contains: filters.semester.trim(), mode: 'insensitive' }
                        };
                    }

                    if (filters.search && filters.search.trim()) {
                        const term = filters.search.trim();
                        statsWhere.OR = [
                            { studentName: { contains: term, mode: 'insensitive' } },
                            { registrationId: { contains: term, mode: 'insensitive' } },
                            { student: { erpInformation: { contains: term, mode: 'insensitive' } } },
                            { student: { phoneNumber: { contains: term, mode: 'insensitive' } } },
                            { student: { name: { contains: term, mode: 'insensitive' } } }
                        ];
                    }

                    return await prisma.gatePass.groupBy({
                        by: ['type'],
                        where: statsWhere,
                        _count: { id: true }
                    });
                } catch (e) {
                    return [];
                }
            })()
        ]);

        let { records, total } = historyRes;
        if (filters.startTime || filters.endTime) {
            const [startH, startM] = (filters.startTime || '00:00').split(':').map(Number);
            const [endH, endM] = (filters.endTime || '23:59').split(':').map(Number);
            const startMins = (isNaN(startH) ? 0 : startH) * 60 + (isNaN(startM) ? 0 : startM);
            const endMins = (isNaN(endH) ? 23 : endH) * 60 + (isNaN(endM) ? 59 : endM);

            const targetField = filters.timeMode === 'in' ? 'checkInTime' : 'checkOutTime';
            records = (records || []).filter((r: any) => {
                const t = r[targetField];
                if (!t) return false;
                const d = new Date(t);
                const istMins = ((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440);
                return istMins >= startMins && istMins <= endMins;
            });
        }
        let leaveCount = 0;
        let passCount = 0;
        (typeCounts || []).forEach((tc: any) => {
            const rawT = String(tc.type || '').toLowerCase().trim();
            if (rawT === 'leave' || rawT === 'home-leave' || rawT === 'hleave' || rawT === 'home') {
                leaveCount += (tc._count?.id || 0);
            } else {
                passCount += (tc._count?.id || 0);
            }
        });

        // ⚡ TARGETED ENRICHMENT: Only fetch reason for the exact permission IDs present in this page
        try {
            const permissionIds = (records || []).map((r: any) => r.permissionId || r.permission_id).filter(Boolean);
            const uniquePermIds: string[] = Array.from(new Set(permissionIds.map((id: any) => String(id).trim()))).filter(Boolean) as string[];
            if (uniquePermIds.length > 0) {
                const { prisma } = await import("@/lib/prisma");
                const matchedPerms = await prisma.permission.findMany({
                    where: { id: { in: uniquePermIds } },
                    select: { id: true, reason: true }
                });
                const permsMap = new Map<string, any>();
                matchedPerms.forEach((p: any) => {
                    if (p.id) permsMap.set(p.id, p);
                });

                records.forEach((r: any) => {
                    const pid = (r.permissionId || r.permission_id)?.toString();
                    const perm = pid ? permsMap.get(pid) : null;
                    if (perm?.reason) {
                        r.leaveReason = perm.reason;
                        if (!r.reason || r.reason.includes('Manual Approval') || r.reason.includes('Override')) {
                            r.reason = perm.reason;
                        }
                    }
                });
            }
        } catch (enrichErr) {
            console.warn("History permission enrichment error:", enrichErr);
        }
        
        // Calculate grand total from the independent counts
        const grandTotal = leaveCount + passCount;

        return jsonWithEtag(request, {
            success: true,
            records,
            summary: {
                total: grandTotal,
                leaveCount,
                passCount
            },
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        console.error("❌ Error fetching gate pass history:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch history" },
            { status: 500 }
        );
    }
}
