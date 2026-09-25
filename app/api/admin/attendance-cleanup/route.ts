export const dynamic = "force-dynamic";

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

        const count = result.deletedCount ?? (result as any).count ?? 0;
        return NextResponse.json({
            success: true,
            message: `Deleted ${count} attendance records older than 6 months.`,
            deletedCount: count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
