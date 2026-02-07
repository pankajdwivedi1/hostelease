import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Hostel from "@/models/Hostel";

// Helper endpoint to set warden password for all hostels at once
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        // Update all hostels with the same password
        const result = await Hostel.updateMany(
            {}, // Update all hostels
            { $set: { wardenPassword: password } }
        );

        return NextResponse.json({
            success: true,
            message: `Updated ${result.modifiedCount} hostels with warden password`,
            modifiedCount: result.modifiedCount
        });
    } catch (error: any) {
        console.error("Error setting bulk passwords:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
