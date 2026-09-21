export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQueueStatus } from "@/lib/attendanceQueue";
import { getRateLimitStatus } from "@/lib/requestLimiter";

/**
 * 🏥 Health Check Endpoint for Database & Attendance Pipeline
 */

export async function GET(request: NextRequest) {
  try {
    let dbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch (e) {
      dbConnected = false;
    }

    // Get queue metrics
    const queueStatus = getQueueStatus();

    // Get a sample rate limit status (from test student)
    const sampleRateLimit = getRateLimitStatus("test-student-001");

    return NextResponse.json({
      status: dbConnected ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        provider: "PostgreSQL (Railway Prisma)",
        connected: dbConnected,
        state: dbConnected ? "connected" : "disconnected"
      },
      queue: {
        pendingRecords: queueStatus.size,
        lastFlushTime: queueStatus.lastFlush,
        isProcessing: queueStatus.isProcessing,
        maxBatchSize: 50,
        flushIntervalSeconds: 10,
      },
      rateLimiting: {
        maxRequestsPerWindow: 2,
        windowSizeSeconds: 10,
        sampleStudentStatus: sampleRateLimit,
      },
      optimizations: {
        connectionPooling: "✅ Managed via PostgreSQL connection pool",
        queryOptimization: "✅ Prisma compiled queries & indexes",
        databaseIndexes: "✅ Primary & compound indexes active",
        requestBatching: "✅ Enabled (50-record batches)",
        rateLimiting: "✅ Enabled (2 req/10sec per student)",
        caching: "✅ AdminSettings & Tenants cached in-memory",
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
