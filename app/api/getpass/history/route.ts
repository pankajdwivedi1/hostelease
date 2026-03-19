import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

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
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const limit = parseInt(searchParams.get("limit") || "50");
        const page = parseInt(searchParams.get("page") || "1");

        const filters: any = {};

        if (studentId) {
            filters.studentId = studentId;
        }

        if (firebaseUID) {
            filters.firebaseUID = firebaseUID;
        }

        if (hostelName && hostelName !== "all") {
            filters.hostelName = hostelName;
        }

        if (status && status !== "all") {
            filters.status = status;
        }

        if (erpId) filters.erpId = erpId;
        if (registrationId) filters.registrationId = registrationId;
        if (collegeName && collegeName !== "all") filters.collegeName = collegeName;
        if (search) filters.search = search;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        const [historyRes, leaveCountRes, passCountRes] = await Promise.all([
            db.gatePasses.list(filters, { page, limit, populate: true }),
            db.gatePasses.list({ ...filters, type: "leave" }, { countOnly: true }),
            db.gatePasses.list({ ...filters, type: "outing" }, { countOnly: true })
        ]);

        const { records, total } = historyRes;
        const leaveCount = leaveCountRes.total || 0;
        const passCount = passCountRes.total || 0;

        return NextResponse.json({
            success: true,
            records,
            summary: {
                total,
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
