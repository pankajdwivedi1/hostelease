import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        // Get client IP
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : (request as any).ip || "127.0.0.1";

        const settings = await db.settings.get();
        const whitelist = settings?.wifiWhitelist || [];

        // Support both old string format and new object format
        let matchingEntry: any = null;
        const isWhitelisted = whitelist.some((w: any) => {
            if (typeof w === 'string') {
                return w.trim() === ip.trim();
            } else if (w && typeof w === 'object') {
                // If it's an IP entry (from manual add)
                if (w.ip && w.ip.trim() === ip.trim()) {
                    matchingEntry = w;
                    return true;
                }
                // If it's a BSSID entry, we can't verify by IP easily here unless we store IP ranges
                // But for now, we only verify by IP if it's explicitly an IP entry
            }
            return false;
        });

        return NextResponse.json({
            success: true,
            ip,
            isWhitelisted,
            hostelName: isWhitelisted ? (matchingEntry?.name || "Hostel WiFi") : null
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
