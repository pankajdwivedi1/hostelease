import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();
        
        // Fetch global billing ledger
        const { data, error } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'super_admin_billing_ledger')
            .maybeSingle();

        if (error) throw error;

        const logs = Array.isArray(data?.settings) ? data.settings : [];
        
        // Filter transactions specifically for this tenant
        const tenantLogs = logs.filter((log: any) => log.tenantId === tenantId);

        return NextResponse.json({ success: true, logs: tenantLogs });
    } catch (error: any) {
        console.error("Billing History Fetch Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to fetch billing history" }, { status: 500 });
    }
}
