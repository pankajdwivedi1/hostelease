import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";

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

        // 3. Payment is valid! Update the subscription
        // Set subscription to active and add 1 year to the end date
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        const { error: updateError } = await supabase
            .from('tenants')
            .update({
                subscriptionStatus: 'active',
                endDate: nextYear.toISOString(),
                // clear the expired flag logic usually relies on endDate being in the future
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
