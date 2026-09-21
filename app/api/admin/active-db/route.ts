export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearDbSourceCache } from '@/lib/dbAdapter';

// GET: Fetch current Active DB Source
export async function GET() {
    return NextResponse.json({ source: 'RAILWAY' });
}

// POST: Lock Active DB Source to Railway PostgreSQL
export async function POST(req: Request) {
    try {
        await prisma.adminSettings.updateMany({
            data: { activeDatabaseSource: 'RAILWAY' }
        }).catch(() => {});

        clearDbSourceCache();

        return NextResponse.json({ success: true, source: 'RAILWAY' });
    } catch (err: any) {
        return NextResponse.json({ success: true, source: 'RAILWAY' });
    }
}
