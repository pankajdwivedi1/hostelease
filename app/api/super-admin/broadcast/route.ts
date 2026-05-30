import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message, type = 'info' } = body;

        const supabase = getSupabaseAdmin();

        // We fetch all settings records
        const { data: settings, error: fetchError } = await supabase
            .from('admin_settings')
            .select('_id, university_bank_details');

        if (fetchError) throw fetchError;

        // Update each record with the broadcast message
        const updatePromises = settings.map((setting: any) => {
            const bankDetails = setting.university_bank_details || {};
            if (message) {
                bankDetails.broadcast = { message, type, timestamp: new Date().toISOString() };
            } else {
                delete bankDetails.broadcast;
            }
            return supabase
                .from('admin_settings')
                .update({ university_bank_details: bankDetails })
                .eq('_id', setting._id);
        });

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true, message: message ? "Broadcast sent to all nodes." : "Broadcast cleared." });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
