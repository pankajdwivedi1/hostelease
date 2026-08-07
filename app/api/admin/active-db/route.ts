export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { clearDbSourceCache } from '@/lib/dbAdapter';

const supabase = getSupabaseAdmin();

// GET: Fetch current Active DB Source
export async function GET() {
    try {
        // First try reading from adminSettings via Prisma
        const settings = await prisma.adminSettings.findFirst({
            select: { activeDatabaseSource: true }
        });
        
        if (settings && settings.activeDatabaseSource) {
            return NextResponse.json({ source: settings.activeDatabaseSource });
        }

        // Fallback check in Supabase
        const { data } = await supabase
            .from('admin_settings')
            .select('active_database_source')
            .limit(1)
            .maybeSingle();

        const source = data?.active_database_source || 'SUPABASE';
        return NextResponse.json({ source });
    } catch (err: any) {
        console.error("GET active-db error:", err?.message);
        return NextResponse.json({ source: 'SUPABASE' });
    }
}

// POST: Toggle Active DB Source between SUPABASE and RAILWAY
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

        // Also update in Supabase
        try {
            await supabase
                .from('admin_settings')
                .update({ active_database_source: source })
                .neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (e: any) {
            console.error("Failed to update active_database_source in Supabase:", e?.message);
        }

        clearDbSourceCache();

        return NextResponse.json({ success: true, source });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to switch active database source" }, { status: 500 });
    }
}
