export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import Razorpay from "razorpay";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, tenantId } = body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !tenantId) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // 1. Fetch Payment Settings to get Secret Key
        const { data: settingsData } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'boss_payment_config')
            .single();

        const settings = settingsData?.settings;
        if (!settings || !settings.razorpayKeySecret) {
            return NextResponse.json({ success: false, error: "Razorpay Secret not configured" }, { status: 500 });
        }

        // 2. Verify HMAC SHA256 Signature
        const generated_signature = crypto
            .createHmac('sha256', settings.razorpayKeySecret.trim())
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return NextResponse.json({ success: false, error: "Invalid payment signature" }, { status: 400 });
        }

        // 3. Fetch Tenant Name and log transaction to global billing ledger
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .single();
        const tenantName = tenantData?.name || "Unknown College";

        // Initialize Razorpay to fetch payment amount
        let amountPaid = 0;
        try {
            const razorpay = new Razorpay({
                key_id: settings.razorpayKeyId.trim(),
                key_secret: settings.razorpayKeySecret.trim()
            });
            const payment: any = await razorpay.payments.fetch(razorpay_payment_id);
            amountPaid = (payment?.amount || 0) / 100; // Razorpay returns amount in paise
        } catch (razorpayFetchErr) {
            console.error("Failed to fetch payment amount from Razorpay:", razorpayFetchErr);
        }

        // Log transaction to global billing ledger
        try {
            const { data: ledgerData } = await supabase
                .from('platform_settings')
                .select('settings')
                .eq('id', 'super_admin_billing_ledger')
                .maybeSingle();

            const currentLogs = Array.isArray(ledgerData?.settings) ? ledgerData.settings : [];
            const newRecord = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                tenantId: tenantId,
                tenantName: tenantName,
                amount: amountPaid || 0,
                utr: razorpay_payment_id,
                date: new Date().toISOString(),
                billingType: "Verified Payment",
                billingPeriod: "1 Year",
                remarks: `Paid via Razorpay (Order: ${razorpay_order_id})`
            };
            const updatedLogs = [newRecord, ...currentLogs];

            await supabase
                .from('platform_settings')
                .upsert({
                    id: 'super_admin_billing_ledger',
                    settings: updatedLogs,
                    updated_at: new Date().toISOString()
                });
        } catch (ledgerErr) {
            console.error("Failed to update billing ledger:", ledgerErr);
            // Do not block subscription activation if ledger logging fails
        }

        // 4. Payment is valid! Update the subscription
        // Set subscription to active and add 1 year to the end date
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        const { error: updateError } = await supabase
            .from('tenants')
            .update({
                subscription_status: 'active',
                subscription_end_date: nextYear.toISOString(),
            })
            .eq('id', tenantId);

        if (updateError) {
            console.error("Failed to update tenant status:", updateError);
            return NextResponse.json({ success: false, error: "Payment verified but failed to activate subscription" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Subscription activated successfully" });

    } catch (error: any) {
        console.error("Razorpay Verify Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to verify payment" }, { status: 500 });
    }
}
