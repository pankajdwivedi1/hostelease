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

        // 1. Fetch Tenant, Student Count, and Payment Settings concurrently in parallel for maximum speed!
        const [
          { data: tenant, error: tenantError },
          { count: studentCount },
          { data: settingsData }
        ] = await Promise.all([
          supabase.from('tenants').select('name').eq('id', tenantId).single(),
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          supabase.from('platform_settings').select('settings').eq('id', 'boss_payment_config').single()
        ]);

        if (tenantError || !tenant) {
            return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }

        const settings = settingsData?.settings;
        if (!settings || !settings.enableRazorpay || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
            return NextResponse.json({ success: false, error: "Razorpay is not fully configured" }, { status: 400 });
        }

        // 3. Calculate amount: studentCount * pricePerStudentPerMonth * 12 (annual billing)
        // Or if we just want monthly, let's just do monthly for now or Annual? Let's just do 12 months for standard subscription
        // The user said "RS 30 per student for monthly". Usually software is billed annually to avoid monthly transaction fees.
        // I will calculate 12 months.
        const months = Number(body.months) || 12;
        const billableStudents = Math.max(1, studentCount || 0); // Minimum 1 student to avoid 0 amount
        
        let discountPercent = 0;
        if (months === 1) discountPercent = Number(settings.discount1Month) || 0;
        else if (months === 3) discountPercent = settings.discount3Month !== undefined ? Number(settings.discount3Month) : 5;
        else if (months === 6) discountPercent = settings.discount6Month !== undefined ? Number(settings.discount6Month) : 10;
        else if (months >= 12) discountPercent = settings.discount12Month !== undefined ? Number(settings.discount12Month) : 20;

        const discountMultiplier = (100 - discountPercent) / 100;
        const pricePerMonth = settings.pricePerStudentPerMonth || 30;
        const totalAmountINR = Math.round(billableStudents * pricePerMonth * months * discountMultiplier);
        
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
        // Shorten tenantId and use seconds-level timestamp to stay under Razorpay's 40-character limit
        const shortTenantId = String(tenantId).replace(/[^a-zA-Z0-9]/g, '').slice(-12);
        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_${shortTenantId}_${Math.floor(Date.now() / 1000)}`
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
