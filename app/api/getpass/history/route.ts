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
        const search = searchParams.get("search");
        const type = searchParams.get("type");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
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

        const { records, total } = historyRes;
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
