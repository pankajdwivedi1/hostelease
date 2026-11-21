export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";

// In-process memory store for live gate sessions
// Shared across all requests within the Railway Node.js container with 0ms latency and 0 DB overhead
interface GateHeartbeatRecord {
    timestamp: number;
    gateName?: string;
    mode?: string;
    deviceId?: string;
    deviceName?: string;
    isExplicitlyOffline?: boolean;
    ip?: string;
}

function getHeartbeatsMap(): Map<string, GateHeartbeatRecord> {
    const g = globalThis as unknown as { __gateHeartbeats?: Map<string, GateHeartbeatRecord> };
    if (!g.__gateHeartbeats) {
        g.__gateHeartbeats = new Map<string, GateHeartbeatRecord>();
    }
    return g.__gateHeartbeats;
}

// ⚡ Active session validity window (12 hours, i.e., current gate operating shift)
// No 2-minute timer needed! A gate remains online from sign-in until explicit logout or shift end.
const SESSION_ACTIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

function formatLastActiveAgo(diffMs: number): string {
    if (diffMs < 45 * 1000) return "Just now";
    const mins = Math.floor(diffMs / 60000);
    if (mins <= 1) return "1 min ago";
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return "1 hr ago";
    return `${hours} hrs ago`;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const gateId = searchParams.get("gateId");
        const heartbeats = getHeartbeatsMap();

        // 1. If checking a specific gate (e.g. ?gateId=main-gate or from SYNC button)
        if (gateId) {
            const trimmedId = gateId.trim();
            const record = heartbeats.get(trimmedId) || 
                           heartbeats.get(trimmedId.toLowerCase()) || 
                           heartbeats.get(trimmedId.toUpperCase());

            let timestamp = record ? record.timestamp : 0;
            const isExplicitlyOffline = Boolean(record?.isExplicitlyOffline);

            // Optional DB Fallback: Check if a pass was scanned at this specific gate today
            if (!timestamp && !isExplicitlyOffline) {
                try {
                    const recentPass = await prisma.gatePass.findFirst({
                        where: {
                            OR: [
                                { gateName: { equals: trimmedId, mode: "insensitive" } },
                                { inGateName: { equals: trimmedId, mode: "insensitive" } }
                            ]
                        },
                        orderBy: { updatedAt: "desc" },
                        select: { updatedAt: true, checkInTime: true, checkOutTime: true }
                    });

                    if (recentPass) {
                        const dateStr = recentPass.updatedAt || recentPass.checkInTime || recentPass.checkOutTime;
                        if (dateStr) {
                            const dbTs = new Date(dateStr).getTime();
                            if (dbTs > timestamp) timestamp = dbTs;
                        }
                    }
                } catch (_) {}
            }

            const diff = timestamp ? Date.now() - timestamp : Infinity;
            const isOnline = !isExplicitlyOffline && timestamp > 0 && diff < SESSION_ACTIVE_WINDOW_MS;
            const lastActiveAgo = isExplicitlyOffline 
                ? "Signed out" 
                : (timestamp ? (isOnline ? "Active now" : `Inactive (${formatLastActiveAgo(diff)})`) : "Offline (No signal)");

            return NextResponse.json({
                success: true,
                gateId: trimmedId,
                online: isOnline,
                lastActiveAgo,
                lastActiveTimestamp: timestamp,
                mode: record?.mode || null,
                deviceId: record?.deviceId || null,
                deviceName: record?.deviceName || null
            });
        }

        // 2. Default GET: Return lastUpdate for existing clients + snapshot of all gate statuses
        const res = await db.gatePasses.list({}, { limit: 1, sortField: "updatedAt", sortOrder: "desc", light: true });
        
        let lastUpdate = 0;
        if (res.records && res.records.length > 0) {
            const record = res.records[0];
            const dateStr = record.updatedAt || record.checkInTime || record.checkOutTime || record.createdAt;
            if (dateStr) {
                lastUpdate = new Date(dateStr).getTime();
            }
        }

        const now = Date.now();
        const gateStatuses: Record<string, { 
            online: boolean; 
            lastActiveAgo: string; 
            lastActiveTimestamp: number;
            deviceId?: string | null;
            deviceName?: string | null;
        }> = {};

        heartbeats.forEach((rec, id) => {
            const diff = now - rec.timestamp;
            const isOnline = !rec.isExplicitlyOffline && rec.timestamp > 0 && diff < SESSION_ACTIVE_WINDOW_MS;
            gateStatuses[id] = {
                online: isOnline,
                lastActiveAgo: rec.isExplicitlyOffline ? "Signed out" : (isOnline ? "Active now" : `Inactive (${formatLastActiveAgo(diff)})`),
                lastActiveTimestamp: rec.timestamp,
                deviceId: rec.deviceId || null,
                deviceName: rec.deviceName || null
            };
        });

        return NextResponse.json({
            success: true,
            lastUpdate,
            gateStatuses
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const rawGateId = body?.gateId || "main-gate";
        const gateId = String(rawGateId).trim();
        const gateName = body?.gateName ? String(body.gateName).trim() : undefined;
        const mode = body?.mode || "qr";
        const deviceId = body?.deviceId ? String(body.deviceId).trim() : undefined;
        const deviceName = body?.deviceName ? String(body.deviceName).trim() : undefined;
        const isOffline = body?.status === "offline" || body?.action === "logout";

        const heartbeats = getHeartbeatsMap();
        const now = Date.now();

        const record: GateHeartbeatRecord = {
            timestamp: now,
            gateName,
            mode,
            deviceId,
            deviceName,
            isExplicitlyOffline: isOffline,
            ip: req.headers.get("x-forwarded-for") || undefined
        };

        // Store by gateId
        heartbeats.set(gateId, record);
        heartbeats.set(gateId.toLowerCase(), record);

        // Also store by gateName if available so lookups by name match
        if (gateName) {
            heartbeats.set(gateName.toLowerCase(), record);
        }

        return NextResponse.json({
            success: true,
            gateId,
            status: isOffline ? "offline" : "online",
            deviceId: deviceId || null,
            recordedAt: now
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
