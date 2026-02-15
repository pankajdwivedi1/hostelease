import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const { hostelName } = await request.json();

        if (!hostelName) {
            return NextResponse.json({ error: "Hostel name is required" }, { status: 400 });
        }

        // Reset all students in this hostel to 'default' mode
        // Note: Using regex for case-insensitive and robust matching against potential whitespaces
        const result = await Student.updateMany(
            { hostelName: { $regex: new RegExp(`^${hostelName.trim()}`, 'i') } },
            { $set: { attendanceMode: 'default' } }
        );

        return NextResponse.json({
            success: true,
            message: `Reset complete. ${result.modifiedCount} students synced to hostel default.`,
            modifiedCount: result.modifiedCount
        });
    } catch (error: any) {
        console.error("Error resetting student modes:", error);
        return NextResponse.json(
            { error: error.message || "Failed to reset student modes" },
            { status: 500 }
        );
    }
}
