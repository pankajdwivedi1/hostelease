export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({
        success: true,
        message: "Database synchronization is not required. Application is running permanently and exclusively on Railway PostgreSQL via Prisma.",
        activeDatabase: "RAILWAY_PRISMA"
    });
}
