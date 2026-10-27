export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearDbSourceCache } from '@/lib/dbAdapter';
import { isSuperAdminSession } from '@/lib/authSession';
import { NextRequest } from 'next/server';

// GET: Fetch current Active DB Source
export async function GET(request: NextRequest) {
    if (!isSuperAdminSession(request)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    return NextResponse.json({ source: 'RAILWAY' });
}

// POST: Lock Active DB Source to Railway PostgreSQL
export async function POST(req: NextRequest) {
    if (!isSuperAdminSession(req)) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
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
