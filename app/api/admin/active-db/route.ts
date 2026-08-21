export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { clearDbSourceCache } from '@/lib/dbAdapter';

const supabase = getSupabaseAdmin();

// GET: Fetch current Active DB Source
export async function GET() {
    try {
        const settings = await prisma.adminSettings.findFirst({
            select: { activeDatabaseSource: true }
        });
        
        const source = settings?.activeDatabaseSource || 'RAILWAY';
        return NextResponse.json({ source });
    } catch (err: any) {
        return NextResponse.json({ source: 'RAILWAY' });
    }
}

// POST: Toggle Active DB Source
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { source } = body;

        if (!source || !['SUPABASE', 'RAILWAY', 'MONGODB'].includes(source)) {
            return NextResponse.json({ error: "Invalid database source specified." }, { status: 400 });
        }

        // Update in Prisma (Railway)
        try {
            await prisma.adminSettings.updateMany({
                data: { activeDatabaseSource: source }
            });
        } catch (e: any) {
            console.error("Failed to update activeDatabaseSource in Prisma:", e?.message);
        }

        clearDbSourceCache();

        return NextResponse.json({ success: true, source });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to switch active database source" }, { status: 500 });
    }
}
