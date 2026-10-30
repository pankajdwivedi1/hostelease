export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/dbAdapter';
import { isSuperAdminSession, unauthorizedJson } from '@/lib/authSession';

/**
 * DATABASE TEST API (superadmin only)
 * -----------------
 * This endpoint allows you to test data retrieval from EITHER database
 * by passing a query parameter: ?source=SUPABASE or ?source=MONGODB
 */
export async function GET(request: NextRequest) {
    if (!isSuperAdminSession(request)) {
        return unauthorizedJson("Super admin access required", 403);
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');

    const useSupabase = source === 'SUPABASE';

    try {
        const students = await db.students.getAll(10);

        return NextResponse.json({
            source: useSupabase ? 'SUPABASE ⚡' : 'MONGODB 🍃',
            count: students?.length || 0,
            sample_data: students
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
