import { NextResponse } from 'next/server';

// GET: Fetch current Active DB Source
export async function GET() {
    // 🔒 Permanently set to Supabase due to full migration
    return NextResponse.json({ source: 'SUPABASE' });
}

// POST: Toggle Active DB Source
export async function POST() {
    // 🚫 Disabled to prevent accidental switch-back
    return NextResponse.json({
        error: "Database switching is disabled. The system has been permanently migrated to Supabase."
    }, { status: 400 });
}
