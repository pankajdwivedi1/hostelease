export const dynamic = "force-dynamic";


import { NextResponse } from 'next/server';
import { db } from '@/lib/dbAdapter';

/**
 * DATABASE TEST API
 * -----------------
 * This endpoint allows you to test data retrieval from EITHER database
 * by passing a query parameter: ?source=SUPABASE or ?source=MONGODB
 */
export async function GET(request: Request) {
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
