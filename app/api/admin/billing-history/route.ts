import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();
        let logs: any[] = [];

        // 1. Fetch global billing ledger from Supabase
        try {
            const { data } = await supabase
                .from('platform_settings')
                .select('settings')
                .eq('id', 'super_admin_billing_ledger')
                .maybeSingle();

            if (data?.settings && Array.isArray(data.settings)) {
                logs = data.settings;
            }
        } catch (e) {}

        // 2. Fallback check via Prisma if empty
        if (logs.length === 0) {
            try {
                const setting = await prisma.platformSetting.findUnique({
                    where: { id: 'super_admin_billing_ledger' }
                });
                if (setting?.settings && Array.isArray(setting.settings)) {
                    logs = setting.settings as any[];
                }
            } catch (e) {}
        }

        // 3. Filter transactions specifically for this tenant
        const tenantLogs = logs.filter((log: any) => 
            log.tenantId === tenantId || 
            String(log.tenantId).toLowerCase() === String(tenantId).toLowerCase()
        );

        return NextResponse.json({ success: true, logs: tenantLogs });
    } catch (error: any) {
        console.error("Billing History Fetch Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to fetch billing history" }, { status: 500 });
    }
}

