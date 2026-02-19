import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import GatePass from "@/models/GatePass";

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
        await connectDB();

        const searchParams = request.nextUrl.searchParams;
        const firebaseUID = searchParams.get("firebaseUID");
        const hostelName = searchParams.get("hostelName");
        const status = searchParams.get("status"); // "out" or "in" or "all"
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const limit = parseInt(searchParams.get("limit") || "50");
        const page = parseInt(searchParams.get("page") || "1");

        const query: any = {};

        if (firebaseUID) {
            query.firebaseUID = firebaseUID;
        }

        if (hostelName && hostelName !== "all") {
            query.hostelName = { $regex: hostelName, $options: "i" };
        }

        if (status && status !== "all") {
            query.status = status;
        }

        if (startDate || endDate) {
            query.checkOutTime = {};
            if (startDate) {
                query.checkOutTime.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.checkOutTime.$lte = end;
            }
        }

        const skip = (page - 1) * limit;

        const [records, totalCount] = await Promise.all([
            GatePass.find(query)
                .sort({ checkOutTime: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            GatePass.countDocuments(query),
        ]);

        return NextResponse.json({
            success: true,
            records,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
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
