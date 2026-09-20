import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// In-memory cache for server outbound public IP during local development
let cachedServerPublicIp: string | null = null;
let lastPublicIpFetch = 0;

async function getServerPublicIp(): Promise<string | null> {
    const now = Date.now();
    if (cachedServerPublicIp && (now - lastPublicIpFetch < 5 * 60 * 1000)) {
        return cachedServerPublicIp;
    }
    try {
        const res = await fetch("https://api.ipify.org?format=json", { 
            cache: "no-store", 
            signal: AbortSignal.timeout(3000) 
        });
        const data = await res.json();
        if (data?.ip) {
            cachedServerPublicIp = String(data.ip).trim();
            lastPublicIpFetch = now;
            return cachedServerPublicIp;
        }
    } catch (e) {
        // Silently continue if network check times out
    }
    return cachedServerPublicIp;
}

export async function GET(request: NextRequest) {
    try {
        // 1. Gather all potential client IP addresses from query param and standard proxy headers
        const queryIp = request.nextUrl.searchParams.get("ip") || "";
        const forwardedHeader = request.headers.get("x-forwarded-for") || "";
        const realIpHeader = request.headers.get("x-real-ip") || "";
        const cfIpHeader = request.headers.get("cf-connecting-ip") || "";
        const trueClientIp = request.headers.get("true-client-ip") || "";
        const requestIp = (request as any).ip || "127.0.0.1";

        const rawCandidates = [
            queryIp.trim(),
            ...forwardedHeader.split(",").map(s => s.trim()),
            realIpHeader.trim(),
            cfIpHeader.trim(),
            trueClientIp.trim(),
            requestIp.trim(),
        ].filter(Boolean);

        // Normalize IPs (remove ::ffff: IPv6-mapped IPv4 prefix)
        const candidateIps = Array.from(new Set(rawCandidates.map(ip => {
            if (ip.startsWith("::ffff:")) return ip.substring(7);
            return ip;
        })));

        // If accessed from localhost/loopback in dev mode or local testing, resolve the machine's live Public IP
        const hasLocalhost = candidateIps.some(ip => ip === "127.0.0.1" || ip === "::1" || ip === "localhost");
        if (hasLocalhost) {
            const serverPublicIp = await getServerPublicIp();
            if (serverPublicIp && !candidateIps.includes(serverPublicIp)) {
                candidateIps.push(serverPublicIp);
            }
        }

        const primaryIp = candidateIps.find(ip => ip !== "127.0.0.1" && ip !== "::1" && ip !== "localhost") || candidateIps[0] || "127.0.0.1";

        // 2. Extract BSSID if provided by client
        const incomingBSSID = (
            request.nextUrl.searchParams.get("bssid") || 
            request.headers.get("x-bssid") || 
            ""
        ).toUpperCase().trim();

        // 3. Fetch settings for active tenant
        const settings = await db.settings.get();
        let whitelist = settings?.wifiWhitelist || [];

        // Universal Fallback: If tenant-specific whitelist is empty or has no match, load all admin settings whitelist
        const allAdminWhitelists: any[] = [];
        try {
            const allSettings = await prisma.adminSettings.findMany({
                select: { wifiWhitelist: true }
            });
            for (const s of allSettings) {
                if (Array.isArray(s.wifiWhitelist)) {
                    allAdminWhitelists.push(...(s.wifiWhitelist as any[]));
                }
            }
        } catch (err) {
            // Ignore fallback error
        }

        const combinedWhitelist = [
            ...(Array.isArray(whitelist) ? whitelist : []),
            ...allAdminWhitelists
        ];

        // 4. Verify match against IP whitelist and BSSID whitelist
        let isWhitelisted = false;
        let matchingEntry: any = null;

        for (const w of combinedWhitelist) {
            if (!w) continue;

            // A. Check BSSID match if BSSID was provided
            if (incomingBSSID && Array.isArray(w.bssids)) {
                const normalizedBssids = w.bssids.map((b: string) => String(b).toUpperCase().trim());
                if (normalizedBssids.includes(incomingBSSID)) {
                    isWhitelisted = true;
                    matchingEntry = typeof w === 'object' ? w : { name: "Campus WiFi", ip: primaryIp };
                    break;
                }
            }

            // B. Check IP match
            const targetIp = typeof w === 'string' ? w : (w?.ip || w?.name);
            if (targetIp) {
                let cleanW = String(targetIp).trim();
                if (cleanW.startsWith("::ffff:")) cleanW = cleanW.substring(7);

                if (candidateIps.some(cand => cand === cleanW)) {
                    isWhitelisted = true;
                    matchingEntry = typeof w === 'object' ? w : { name: "Campus WiFi", ip: cleanW };
                    break;
                }
            }
        }

        return NextResponse.json(
            {
                success: true,
                ip: primaryIp,
                isWhitelisted,
                hostelName: isWhitelisted ? (matchingEntry?.name || "Hostel WiFi") : null
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
                }
            }
        );
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
