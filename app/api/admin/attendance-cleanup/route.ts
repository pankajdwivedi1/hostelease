import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Attendance from "@/models/Attendance";

export async function DELETE(request: Request) {
    try {
        await dbConnect();

        // Cleanup attendance records older than 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const result = await Attendance.deleteMany({
            timestamp: { $lt: sixMonthsAgo },
        });

        return NextResponse.json({
            success: true,
            message: `Deleted ${result.deletedCount} attendance records older than 6 months.`,
            deletedCount: result.deletedCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
