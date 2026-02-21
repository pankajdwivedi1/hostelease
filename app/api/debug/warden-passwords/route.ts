import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

// Diagnostic endpoint to check hostel passwords
export async function GET(request: NextRequest) {
    try {
        const hostels = await db.hostels.getAll();
        const settings = await db.settings.get();
        const globalPassword = settings?.wardenPassword || "warden456";

        const hostelStatus = hostels.map((h: any) => ({
            name: h.name,
            id: h._id,
            hasPassword: !!h.wardenPassword,
            passwordSet: h.wardenPassword || "not set",
            willUseGlobal: !h.wardenPassword,
            effectivePassword: h.wardenPassword || globalPassword
        }));

        return NextResponse.json({
            success: true,
            globalPassword,
            hostels: hostelStatus
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
