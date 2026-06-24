export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "gatepass";
        const beforeDateStr = url.searchParams.get("beforeDate");
        const hostelName = url.searchParams.get("hostelName");

        const filter: any = {};
        if (beforeDateStr) {
            const date = new Date(beforeDateStr);
            // Set to end of day to include the entire day
            date.setHours(23, 59, 59, 999);
            filter.beforeDate = date;
        }
        if (hostelName && hostelName !== "all" && hostelName !== "") {
            filter.hostelName = hostelName;
        }

        const dateSuffix = beforeDateStr ? ` before or on ${beforeDateStr}` : "";
        const hostelSuffix = hostelName && hostelName !== "all" && hostelName !== "" ? ` for ${hostelName}` : "";
        const fullSuffix = `${dateSuffix}${hostelSuffix}`;

        if (type === "attendance") {
            await db.attendance.deleteMany(filter);
            return NextResponse.json({
                success: true,
                message: `Successfully cleared all Night Attendance history${fullSuffix}.`
            });
        } else if (type === "permissions") {
            await db.permissions.deleteMany(filter);
            return NextResponse.json({
                success: true,
                message: `Successfully cleared all Leave Permissions${fullSuffix}.`
            });
        } else {
            await db.gatePasses.deleteMany(filter);
            // Only clear tokens if we are doing a full wipe (no date or hostel filters)
            if (!beforeDateStr && (!hostelName || hostelName === "all" || hostelName === "")) {
                await db.gatePassTokens.deleteMany({});
            }
            return NextResponse.json({
                success: true,
                message: `Successfully cleared all Gatepass history and tokens${fullSuffix}.`
            });
        }
    } catch (error: any) {
        console.error("❌ Error clearing logs:", error);
        return NextResponse.json(
            { error: error.message || "Failed to clear logs" },
            { status: 500 }
        );
    }
}
