import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export async function PATCH(request: NextRequest) {
    try {
        await connectDB();
        const { lock } = await request.json();

        if (typeof lock !== "boolean") {
            return NextResponse.json({ error: "Lock status (boolean) is required" }, { status: 400 });
        }

        const result = await Student.updateMany({}, { $set: { isProfileLocked: lock } });

        return NextResponse.json({
            success: true,
            message: `Successfully ${lock ? 'locked' : 'unlocked'} ${result.modifiedCount} profiles.`,
            modifiedCount: result.modifiedCount
        }, { status: 200 });
    } catch (error: any) {
        console.error("Bulk lock error:", error);
        return NextResponse.json({ error: error.message || "Failed to perform bulk lock action" }, { status: 500 });
    }
}
