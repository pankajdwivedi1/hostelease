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
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'super_admin_billing_ledger')
            .maybeSingle();

        if (error) throw error;

        let logs = data?.settings;

        // If no ledger exists, seed it with OGI's payment
        if (!logs || !Array.isArray(logs)) {
            logs = [OGI_SEED_TRANSACTION];
            
            const { error: upsertError } = await supabase
                .from('platform_settings')
                .upsert({
                    id: 'super_admin_billing_ledger',
                    settings: logs,
                    updated_at: new Date().toISOString()
                });
            if (upsertError) throw upsertError;
        }

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newRecord = await request.json(); // { tenantId, tenantName, amount, utr, date, billingType, billingPeriod, remarks, paymentSource }
        const supabase = getSupabaseAdmin();

        // Validate billingType
        const allowedTypes = ["Verified Payment", "Complimentary", "Deferred Billing (On Credit)"];
        if (!allowedTypes.includes(newRecord.billingType)) {
            return NextResponse.json({ success: false, error: "Invalid billing type" }, { status: 400 });
        }

        // Fetch existing from Supabase
        const { data, error: fetchError } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'super_admin_billing_ledger')
            .maybeSingle();

        if (fetchError) throw fetchError;

        const currentLogs = Array.isArray(data?.settings) ? data.settings : [OGI_SEED_TRANSACTION];

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

        // 1. Update Supabase
        const { error: upsertError } = await supabase
            .from('platform_settings')
            .upsert({
                id: 'super_admin_billing_ledger',
                settings: updatedLogs,
                updated_at: new Date().toISOString()
            });

        if (upsertError) throw upsertError;

        // 2. Update Prisma (Railway PostgreSQL)
        try {
            await prisma.platformSetting.upsert({
                where: { id: 'super_admin_billing_ledger' },
                update: { settings: updatedLogs as any, updatedAt: new Date() },
                create: { id: 'super_admin_billing_ledger', settings: updatedLogs as any, updatedAt: new Date() }
            });
        } catch (e: any) {
            console.error("Prisma billing ledger update warning:", e?.message);
        }

        return NextResponse.json({ success: true, logs: updatedLogs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

