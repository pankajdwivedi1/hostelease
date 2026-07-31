import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        // Get client IP and normalize (remove ::ffff: IPv6-mapping if present)
        const forwarded = request.headers.get("x-forwarded-for");
        let rawIp = forwarded ? forwarded.split(",")[0] : (request as any).ip || "127.0.0.1";
        rawIp = rawIp.trim();
        const ip = rawIp.startsWith("::ffff:") ? rawIp.substring(7) : rawIp;

        const settings = await db.settings.get();
        const whitelist = settings?.wifiWhitelist || [];

        // Support string format, object format, and local dev server (localhost / 127.0.0.1 / ::1)
        let matchingEntry: any = null;
        const isLocalHost = ip === "127.0.0.1" || ip === "::1" || ip === "localhost";

        const isWhitelisted = whitelist.some((w: any) => {
            const targetIp = typeof w === 'string' ? w : w?.ip;
            if (!targetIp) return false;
            let cleanW = targetIp.trim();
            if (cleanW.startsWith("::ffff:")) cleanW = cleanW.substring(7);
            
            // Direct IP match or local dev server match when whitelist is configured
            if (cleanW === ip || cleanW === "127.0.0.1" || cleanW === "::1" || (isLocalHost && whitelist.length > 0)) {
                matchingEntry = typeof w === 'object' ? w : { name: "Campus WiFi", ip: cleanW };
                return true;
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
