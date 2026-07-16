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

        // Support both old string format and new object format
        let matchingEntry: any = null;
        const isWhitelisted = whitelist.some((w: any) => {
            if (typeof w === 'string') {
                let cleanW = w.trim();
                if (cleanW.startsWith("::ffff:")) cleanW = cleanW.substring(7);
                return cleanW === ip;
            } else if (w && typeof w === 'object') {
                // If it's an IP entry (from manual add)
                if (w.ip) {
                    let cleanW = w.ip.trim();
                    if (cleanW.startsWith("::ffff:")) cleanW = cleanW.substring(7);
                    if (cleanW === ip) {
                        matchingEntry = w;
                        return true;
                    }
                }
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
