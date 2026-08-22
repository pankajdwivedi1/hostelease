export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const tenantId = await db.getTenantIdOrThrow();

        // 1. Fetch tenant basic info from Railway PostgreSQL
        let tenant: any = null;
        try {
            tenant = await prisma.tenant.findUnique({
                where: { id: tenantId }
            });
        } catch (e) {
            console.error("Tenant lookup error in settings/get:", e);
        }

        // 2. Fetch admin settings (contact info) via dbAdapter
        const settings = await db.settings.get();

        const bankDetails = ((settings?.universityBankDetails || settings?.university_bank_details) || {}) as any;

        return NextResponse.json({
            success: true,
            settings: {
                adminEmail: tenant?.adminEmail || tenant?.admin_email || '',
                subscriptionStatus: tenant?.subscriptionStatus || tenant?.subscription_status || 'active',
                subscriptionEndDate: tenant?.subscriptionEndDate || tenant?.subscription_end_date || null,
                subscriptionStartDate: tenant?.createdAt || tenant?.created_at || null,
                slug: tenant?.slug || '',
                contactName: bankDetails.contactName || '',
                contactPhone: bankDetails.contactPhone || '',
                totalHostelars: bankDetails.totalHostelars || '',
                leaveApprovalMethod: settings?.leaveApprovalMethod || settings?.leave_approval_method || 'app'
            }
        });
    } catch (error: any) {
        console.error("Error fetching admin settings:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
