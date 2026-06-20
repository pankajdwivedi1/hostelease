export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import Razorpay from "razorpay";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // 1. Fetch Tenant
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }

        // 1b. Fetch student count
        const { count: studentCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId);

        // 2. Fetch Payment Settings
        const { data: settingsData } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'boss_payment_config')
            .single();

        const settings = settingsData?.settings;
        if (!settings || !settings.enableRazorpay || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
            return NextResponse.json({ success: false, error: "Razorpay is not fully configured" }, { status: 400 });
        }

        // 3. Calculate amount: studentCount * pricePerStudentPerMonth * 12 (annual billing)
        // Or if we just want monthly, let's just do monthly for now or Annual? Let's just do 12 months for standard subscription
        // The user said "RS 30 per student for monthly". Usually software is billed annually to avoid monthly transaction fees.
        // I will calculate 12 months.
        const months = 12;
        const billableStudents = Math.max(1, studentCount || 0); // Minimum 1 student to avoid 0 amount
        const totalAmountINR = billableStudents * (settings.pricePerStudentPerMonth || 30) * months;
        
        if (totalAmountINR <= 0) {
            return NextResponse.json({ success: false, error: "Calculated amount is 0. Cannot create order." }, { status: 400 });
        }

        // Razorpay expects amount in paise (multiply by 100)
        const amountInPaise = totalAmountINR * 100;

        // 4. Initialize Razorpay
        const razorpay = new Razorpay({
            key_id: settings.razorpayKeyId.trim(),
            key_secret: settings.razorpayKeySecret.trim()
        });

        // 5. Create Order
        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_${tenantId}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        return NextResponse.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: settings.razorpayKeyId,
            collegeName: tenant.name,
            totalINR: totalAmountINR
        });

    } catch (error: any) {
        console.error("Razorpay Order Error:", error);
        // Razorpay often nests errors inside error.error
        const errorMessage = error?.error?.description || error?.message || JSON.stringify(error) || "Failed to create order";
        return NextResponse.json({ success: false, error: `Razorpay Error: ${errorMessage}` }, { status: 500 });
    }
}
