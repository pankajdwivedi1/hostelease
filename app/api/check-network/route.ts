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
            
            // Strict exact match against whitelisted IP only
            if (cleanW === ip) {
                matchingEntry = typeof w === 'object' ? w : { name: "Campus WiFi", ip: cleanW };
                return true;
            }
            return false;
        });


        return NextResponse.json(
            {
                success: true,
                ip,
                isWhitelisted,
                hostelName: isWhitelisted ? (matchingEntry?.name || "Hostel WiFi") : null
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
                }
            }
        );
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
