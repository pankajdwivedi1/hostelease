export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

// Helper endpoint to set warden password for all hostels at once
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        // Update all hostels with the same password using dbAdapter
        const result = await db.hostels.bulkUpdate({}, { wardenPassword: password });

        const count = result.modifiedCount ?? (result as any).count ?? 0;
        return NextResponse.json({
            success: true,
            message: `Updated ${count} hostels with warden password`,
            modifiedCount: count
        });
    } catch (error: any) {
        console.error("Error setting bulk passwords:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
