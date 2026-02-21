import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function PATCH(request: NextRequest) {
    try {
        const { lock } = await request.json();

        if (typeof lock !== "boolean") {
            return NextResponse.json({ error: "Lock status (boolean) is required" }, { status: 400 });
        }

        // Perform bulk update using dbAdapter
        const result = await db.students.bulkUpdate({}, { isProfileLocked: lock });

        return NextResponse.json({
            success: true,
            message: `Successfully ${lock ? 'locked' : 'unlocked'} ${result.count} profiles.`,
            modifiedCount: result.count
        }, { status: 200 });
    } catch (error: any) {
        console.error("Bulk lock error:", error);
        return NextResponse.json({ error: error.message || "Failed to perform bulk lock action" }, { status: 500 });
    }
}
