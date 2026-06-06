import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function GET(request: Request) {
    try {
        const tenantId = await db.getTenantIdOrThrow();

        // 1. Fetch tenant basic info
        const { data: tenant, error: tenantError } = await db.supabase
            .from('tenants')
            .select('admin_email, subscription_status, subscription_end_date, created_at, slug')
            .eq('id', tenantId)
            .single();

        if (tenantError) throw tenantError;

        // 2. Fetch admin settings (contact info)
        const { data: settings, error: settingsError } = await db.supabase
            .from('admin_settings')
            .select('university_bank_details, leave_approval_method')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        const bankDetails = settings?.university_bank_details || {};

        return NextResponse.json({
            success: true,
            settings: {
                adminEmail: tenant?.admin_email,
                subscriptionStatus: tenant?.subscription_status,
                subscriptionEndDate: tenant?.subscription_end_date,
                subscriptionStartDate: tenant?.created_at,
                slug: tenant?.slug,
                contactName: bankDetails.contactName || '',
                contactPhone: bankDetails.contactPhone || '',
                totalHostelars: bankDetails.totalHostelars || '',
                leaveApprovalMethod: settings?.leave_approval_method || 'app'
            }
        });
    } catch (error: any) {
        console.error("Error fetching admin settings:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
