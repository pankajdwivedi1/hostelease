import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { hostelName } = await request.json();

        if (!hostelName) {
            return NextResponse.json({ error: "Hostel name is required" }, { status: 400 });
        }

        // Reset all students in this hostel to 'default' mode using dbAdapter
        const result = await db.students.bulkUpdate({ hostelName: hostelName.trim() }, { attendanceMode: 'default' });

        return NextResponse.json({
            success: true,
            message: `Reset complete. ${result.count} students synced to hostel default.`,
            modifiedCount: result.count
        });
    } catch (error: any) {
        console.error("Error resetting student modes:", error);
        return NextResponse.json(
            { error: error.message || "Failed to reset student modes" },
            { status: 500 }
        );
    }
}
