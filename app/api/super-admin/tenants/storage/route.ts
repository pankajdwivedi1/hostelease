export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
    try {
        const { tenantId } = await request.json();
        if (!tenantId) return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });

        const supabase = getSupabaseAdmin();

        // 1. Calculate real bytes
        const { data: bytes, error: rpcError } = await supabase.rpc('get_tenant_storage_bytes', { tenant_uuid: tenantId });
        if (rpcError) throw rpcError;

        // 2. Fetch existing settings to update
        const { data: settings, error: fetchError } = await supabase
            .from('admin_settings')
            .select('university_bank_details')
            .eq('tenant_id', tenantId)
            .maybeSingle();
            
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        const bankDetails = settings?.university_bank_details || {};
        bankDetails.lastStorageBytes = bytes || 0;

        // 3. Save it back
        const { error: updateError } = await supabase
            .from('admin_settings')
            .update({ university_bank_details: bankDetails })
            .eq('tenant_id', tenantId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, storageBytes: bytes || 0 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
