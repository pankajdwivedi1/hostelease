import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function DELETE(request: Request) {
    try {
        // Cleanup attendance records older than 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const result = await db.attendance.deleteMany({
            timestamp: { $lt: sixMonthsAgo },
        });

        return NextResponse.json({
            success: true,
            message: `Deleted ${result.count} attendance records older than 6 months.`,
            deletedCount: result.count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
