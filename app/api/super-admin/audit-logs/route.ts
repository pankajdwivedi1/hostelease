import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'super_admin_audit_logs')
            .single();

        if (error || !data) {
            return NextResponse.json({ success: true, logs: [] });
        }

        return NextResponse.json({ success: true, logs: data.settings });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newLog = await request.json(); // { action: string, details: string, user: string }
        const supabase = getSupabaseAdmin();

        // Fetch existing
        const { data } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'super_admin_audit_logs')
            .maybeSingle();

        const currentLogs = Array.isArray(data?.settings) ? data.settings : [];
        
        // Append log at beginning (newest first)
        const updatedLogs = [
            {
                ...newLog,
                timestamp: new Date().toISOString()
            },
            ...currentLogs
        ].slice(0, 1000); // Limit to last 1000 logs to prevent overflow

        const { error } = await supabase
            .from('platform_settings')
            .upsert({
                id: 'super_admin_audit_logs',
                settings: updatedLogs,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        return NextResponse.json({ success: true, logs: updatedLogs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { timestamps, clearAll } = body;
        const supabase = getSupabaseAdmin();

        if (clearAll) {
            const { error } = await supabase
                .from('platform_settings')
                .upsert({
                    id: 'super_admin_audit_logs',
                    settings: [],
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
            return NextResponse.json({ success: true, logs: [] });
        }

        if (Array.isArray(timestamps) && timestamps.length > 0) {
            const { data } = await supabase
                .from('platform_settings')
                .select('settings')
                .eq('id', 'super_admin_audit_logs')
                .maybeSingle();

            const currentLogs = Array.isArray(data?.settings) ? data.settings : [];
            const updatedLogs = currentLogs.filter((log: any) => !timestamps.includes(log.timestamp));

            const { error } = await supabase
                .from('platform_settings')
                .upsert({
                    id: 'super_admin_audit_logs',
                    settings: updatedLogs,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return NextResponse.json({ success: true, logs: updatedLogs });
        }

        return NextResponse.json({ success: false, error: "No timestamps or clearAll flag provided" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
