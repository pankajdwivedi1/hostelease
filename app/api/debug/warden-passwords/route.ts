export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

// Diagnostic endpoint to check hostel passwords
export async function GET(request: NextRequest) {
    try {
        const hostels = await db.hostels.getAll();
        const settings = await db.settings.get();
        const globalPasswordConfigured = !!(settings?.wardenPassword || process.env.WARDEN_LOGIN_PASSWORD);

        const hostelStatus = hostels.map((h: any) => ({
            name: h.name,
            id: h._id,
            hasPassword: !!h.wardenPassword,
            passwordSet: !!h.wardenPassword,
            willUseGlobal: !h.wardenPassword,
            effectivePasswordState: h.wardenPassword ? "hostel-specific" : (globalPasswordConfigured ? "global" : "not configured")
        }));

        return NextResponse.json({
            success: true,
            globalPasswordConfigured,
            hostels: hostelStatus
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
