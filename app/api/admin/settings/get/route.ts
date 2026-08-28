export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const tenantId = await db.getTenantIdOrThrow();

        // 1. Fetch tenant basic info and settings concurrently in parallel
        const [tenant, settings] = await Promise.all([
            prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    adminEmail: true,
                    subscriptionStatus: true,
                    subscriptionEndDate: true,
                    createdAt: true,
                    slug: true,
                }
            }).catch(e => {
                console.error("Tenant lookup error in settings/get:", e);
                return null;
            }),
            db.settings.get().catch(e => {
                console.error("Settings lookup error in settings/get:", e);
                return null;
            })
        ]);

        const bankDetails = ((settings?.universityBankDetails || settings?.university_bank_details) || {}) as any;

        return NextResponse.json({
            success: true,
            settings: {
                adminEmail: tenant?.adminEmail || '',
                subscriptionStatus: tenant?.subscriptionStatus || 'active',
                subscriptionEndDate: tenant?.subscriptionEndDate || null,
                subscriptionStartDate: tenant?.createdAt || null,
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
