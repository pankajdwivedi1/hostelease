import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OGI_SEED_TRANSACTION = {
    id: "tx_seed_ogi",
    tenantId: "26739d24-0214-409b-aa81-42e628e88c2b",
    tenantName: "Oriental Group of Institutes (OGI)",
    amount: 23130,
    utr: "659864589235",
    date: "2026-03-07T16:23:43.395Z",
    billingType: "Verified Payment",
    paymentSource: "Direct Bank / UPI Transfer (UTR Verified)",
    billingPeriod: "1 Year",
    remarks: "Initial seeded payment proof"
};

export async function GET() {
    try {
        let logs: any[] = [];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_billing_ledger' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                logs = setting.settings as any[];
            }
        } catch (e) {}

        if (logs.length === 0) {
            logs = [OGI_SEED_TRANSACTION];
            try {
                await prisma.platformSetting.upsert({
                    where: { id: 'super_admin_billing_ledger' },
                    update: { settings: logs as any, updatedAt: new Date() },
                    create: { id: 'super_admin_billing_ledger', settings: logs as any, updatedAt: new Date() }
                });
            } catch (e) {}
        }

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newRecord = await request.json(); // { tenantId, tenantName, amount, utr, date, billingType, billingPeriod, remarks, paymentSource }

        // Validate billingType
        const allowedTypes = ["Verified Payment", "Complimentary", "Deferred Billing (On Credit)"];
        if (!allowedTypes.includes(newRecord.billingType)) {
            return NextResponse.json({ success: false, error: "Invalid billing type" }, { status: 400 });
        }

        // Fetch existing from Prisma (Railway)
        let currentLogs: any[] = [OGI_SEED_TRANSACTION];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_billing_ledger' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                currentLogs = setting.settings as any[];
            }
        } catch (e) {}

        const updatedRecord = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            tenantId: newRecord.tenantId,
            tenantName: newRecord.tenantName,
            amount: Number(newRecord.amount) || 0,
            utr: newRecord.utr || "",
            date: newRecord.date || new Date().toISOString(),
            billingType: newRecord.billingType,
            paymentSource: newRecord.paymentSource || (newRecord.utr ? "Direct Bank / UPI Transfer (UTR Verified)" : "Direct Bank Transfer"),
            billingPeriod: newRecord.billingPeriod || "1 Month",
            remarks: newRecord.remarks || ""
        };

        const updatedLogs = [updatedRecord, ...currentLogs];

        // Update Prisma (Railway PostgreSQL)
        await prisma.platformSetting.upsert({
            where: { id: 'super_admin_billing_ledger' },
            update: { settings: updatedLogs as any, updatedAt: new Date() },
            create: { id: 'super_admin_billing_ledger', settings: updatedLogs as any, updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, logs: updatedLogs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

