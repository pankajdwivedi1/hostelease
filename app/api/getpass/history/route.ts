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
        const firebaseUID = searchParams.get("firebaseUID");
        const hostelName = searchParams.get("hostelName");
        const status = searchParams.get("status"); // "out" or "in" or "all"
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const limit = parseInt(searchParams.get("limit") || "50");
        const page = parseInt(searchParams.get("page") || "1");

        const filters: any = {};

        if (firebaseUID) {
            filters.firebaseUID = firebaseUID;
        }

        if (hostelName && hostelName !== "all") {
            filters.hostelName = hostelName;
        }

        if (status && status !== "all") {
            filters.status = status;
        }

        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        const { records, total } = await db.gatePasses.list(filters, { page, limit });

        return NextResponse.json({
            success: true,
            records,
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

