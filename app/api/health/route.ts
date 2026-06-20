export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";

export async function GET() {
    try {
        await connectDB();

        // Import queue status
        const { getQueueStatus } = await import("@/lib/attendanceQueue");
        const queueStatus = getQueueStatus();

        return NextResponse.json({
            status: "OK",
            timestamp: new Date().toISOString(),
            mongodb: {
                connected: mongoose.connection.readyState === 1,
                poolSize: (mongoose.connection as any).base?.options?.maxPoolSize || "standard",
                currentConnections: mongoose.connections.length
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
