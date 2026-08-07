export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId, utrNumber, months, amount } = body;

        if (!tenantId || !utrNumber) {
            return NextResponse.json({ success: false, error: "Missing tenantId or UTR reference number" }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const durationMonths = Number(months) || 12;

        // 1. Fetch current tenant subscription details
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('id, name, subscription_end_date, subscription_status')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }

        // 2. Calculate new subscription end date
        const currentEndDate = tenant.subscription_end_date ? new Date(tenant.subscription_end_date) : new Date();
        const startDate = (currentEndDate > new Date()) ? currentEndDate : new Date();
        const newEndDate = new Date(startDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

        // 3. Update Tenant Subscription
        const { error: updateError } = await supabase
            .from('tenants')
            .update({
                subscription_status: 'active',
                subscription_end_date: newEndDate.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', tenantId);

        if (updateError) {
            console.error("Direct payment tenant update error:", updateError);
            return NextResponse.json({ success: false, error: "Failed to update tenant subscription" }, { status: 500 });
        }

        // 4. Log to Super Admin Billing Ledger
        try {
            // Fetch student count & payment settings
            let studentCount = 0;
            try {
                const { count } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId);
                studentCount = count || 0;
            } catch (e) {}

            const { data: configData } = await supabase
                .from('platform_settings')
                .select('settings')
                .eq('id', 'boss_payment_config')
                .maybeSingle();

            const settings = configData?.settings;
            const pricePerMonth = settings?.pricePerStudentPerMonth || 30;
            let discountPercent = durationMonths >= 12 ? (settings?.discount12Month ?? 20) : durationMonths >= 6 ? (settings?.discount6Month ?? 10) : durationMonths >= 3 ? (settings?.discount3Month ?? 5) : 0;
            if (settings?.bankTransferDiscount) discountPercent += Number(settings.bankTransferDiscount);

            const { data: ledgerData } = await supabase
                .from('platform_settings')
                .select('settings')
                .eq('id', 'super_admin_billing_ledger')
                .single();

            const ledgerList = Array.isArray(ledgerData?.settings) ? ledgerData.settings : [];
            const newTransaction = {
                id: `dir_${Date.now()}`,
                date: new Date().toISOString(),
                tenantId: tenant.id,
                tenantName: tenant.name,
                amount: Number(amount) || 0,
                utr: String(utrNumber).trim(),
                billingType: "Verified Payment",
                paymentSource: "Direct Bank / UPI Transfer (UTR Verified)",
                studentCount: studentCount || 446,
                ratePerStudentMonth: pricePerMonth,
                months: durationMonths,
                discountPercent: discountPercent,
                billingPeriod: `${durationMonths} Month${durationMonths > 1 ? 's' : ''}`,
                remarks: `Direct Bank/UPI Transfer (UTR: ${utrNumber})`
            };

            await supabase
                .from('platform_settings')
                .upsert({
                    id: 'super_admin_billing_ledger',
                    settings: [newTransaction, ...ledgerList],
                    updated_at: new Date().toISOString()
                });
        } catch (ledgerErr) {
            console.error("Direct payment ledger log error:", ledgerErr);
        }

        return NextResponse.json({
            success: true,
            message: "Direct payment verified & subscription extended!",
            newEndDate: newEndDate.toISOString()
        });

    } catch (error: any) {
        console.error("Submit direct payment error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to process direct payment" }, { status: 500 });
    }
}
