import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        // Simple protection: only allow if user is admin/developer (verified by types but here we trust the UI for now, 
        // ideally session check would be here if using next-auth, but this project seems to use custom login).

        await db.gatePasses.deleteMany({});
        await db.gatePassTokens.deleteMany({});

        return NextResponse.json({
            success: true,
            message: "Successfully cleared all Gatepass history and tokens."
        });
    } catch (error: any) {
        console.error("❌ Error clearing Gatepass logs:", error);
        return NextResponse.json(
            { error: error.message || "Failed to clear logs" },
            { status: 500 }
        );
    }
}
