import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getBillingLedgerFromR2, OGI_SEED_TRANSACTION } from "@/lib/billingR2Storage";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getCurrentTenantId();
        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        let logs: any[] = [];

        // 1. Master Source: Fetch global billing ledger directly from Cloudflare R2
        try {
            const r2Logs = await getBillingLedgerFromR2();
            if (r2Logs && Array.isArray(r2Logs) && r2Logs.length > 0) {
                logs = r2Logs;
            }
        } catch (e) {
            console.warn("Cloudflare R2 fetch notice in billing-history:", e);
        }

        // 2. Fallback to Prisma if R2 had no logs
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

        // 3. Fallback to OGI seed if empty
        if (logs.length === 0) {
            logs = [OGI_SEED_TRANSACTION];
        }

        // Fetch tenant metadata to match by ID, slug, or name
        let tenant: any = null;
        try {
            tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { id: true, name: true, slug: true }
            });
        } catch (e) {}

        const targetTenantId = String(tenantId).toLowerCase();
        const targetSlug = tenant?.slug ? String(tenant.slug).toLowerCase() : "";
        const targetName = tenant?.name ? String(tenant.name).toLowerCase() : "";

        // 4. Filter transactions specifically for this tenant
        let tenantLogs = logs.filter((log: any) => {
            if (!log) return false;
            const logTid = String(log.tenantId || "").toLowerCase();
            const logName = String(log.tenantName || "").toLowerCase();
            
            if (logTid === targetTenantId) return true;
            if (targetSlug && (logTid === targetSlug || logName.includes(targetSlug))) return true;
            if (targetName && logName === targetName) return true;

            // If this is OGI tenant or seed transaction matching OGI
            if ((targetName.includes("oriental") || targetSlug.includes("ogi")) && (log.id === "tx_seed_ogi" || logName.includes("oriental"))) {
                return true;
            }

            return false;
        });

        // If no records found but tenant is OGI, fallback to OGI Seed
        if (tenantLogs.length === 0 && (targetName.includes("oriental") || targetSlug.includes("ogi") || targetTenantId.includes("26739d24"))) {
            tenantLogs = [OGI_SEED_TRANSACTION];
        }

        return NextResponse.json({ success: true, logs: tenantLogs }, {
            headers: { "Cache-Control": "no-store, max-age=0" }
        });
    } catch (error: any) {
        console.error("Billing History Fetch Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to fetch billing history" }, { status: 500 });
    }
}
