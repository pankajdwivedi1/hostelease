export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        await prisma.$queryRaw`SELECT 1`;

        // Import queue status
        const { getQueueStatus } = await import("@/lib/attendanceQueue");
        const queueStatus = getQueueStatus();

        return NextResponse.json({
            status: "OK",
            timestamp: new Date().toISOString(),
            database: {
                provider: "PostgreSQL (Railway)",
                connected: true
            },
            attendanceQueue: queueStatus
        });
    } catch (error: any) {
        return NextResponse.json({
            status: "ERROR",
            error: error.message
        }, { status: 500 });
    }
}
