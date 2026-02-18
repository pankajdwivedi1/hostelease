
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import AdminSettings from '@/models/AdminSettings';

// GET: Fetch current Active DB Source
export async function GET() {
    try {
        await connectDB();
        const settings = await AdminSettings.findOne().select('activeDatabaseSource').lean();
        const currentSource = settings?.activeDatabaseSource || process.env.NEXT_PUBLIC_DB_SOURCE || 'MONGODB';

        return NextResponse.json({ source: currentSource });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Toggle Active DB Source
export async function POST(req: Request) {
    try {
        const { source } = await req.json();

        if (!['MONGODB', 'SUPABASE'].includes(source)) {
            return NextResponse.json({ error: "Invalid source. Must be MONGODB or SUPABASE" }, { status: 400 });
        }

        await connectDB();
        // Update the singleton settings document
        await AdminSettings.findOneAndUpdate({}, { activeDatabaseSource: source }, { upsert: true, new: true });

        return NextResponse.json({ success: true, source });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
