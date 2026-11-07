export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// In-memory cache to prevent DB hammering under high traffic
let cachedStatus: { enabled: boolean; message: string; estimatedTime: string; updatedAt?: string } | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

export function clearMaintenanceCache() {
    cachedStatus = null;
    lastCacheTime = 0;
}

const CACHE_HEADERS = {
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
    try {
        const now = Date.now();
        if (cachedStatus && (now - lastCacheTime < CACHE_TTL_MS)) {
            return NextResponse.json({ success: true, ...cachedStatus }, { headers: CACHE_HEADERS });
        }

        const row = await prisma.platformSetting.findUnique({
            where: { id: 'boss_maintenance_mode' }
        });

        const settings = (row?.settings as any) || {
            enabled: false,
            message: "",
            estimatedTime: ""
        };

        cachedStatus = {
            enabled: Boolean(settings.enabled),
            message: settings.message || "We are currently performing scheduled platform maintenance and system updates. All services will resume shortly.",
            estimatedTime: settings.estimatedTime || "",
            updatedAt: row?.updatedAt?.toISOString() || new Date().toISOString()
        };
        lastCacheTime = now;

        return NextResponse.json({ success: true, ...cachedStatus }, { headers: CACHE_HEADERS });
    } catch (error: any) {
        console.warn("Maintenance status check failed, defaulting to active:", error?.message);
        return NextResponse.json({
            success: true,
            enabled: false,
            message: "",
            estimatedTime: ""
        }, { headers: CACHE_HEADERS });
    }
}
