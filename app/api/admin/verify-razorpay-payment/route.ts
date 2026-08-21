export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";
import crypto from "crypto";
import Razorpay from "razorpay";

const DEFAULT_SETTINGS = {
    razorpayKeyId: "rzp_live_TAKnbp18wnY8Mu",
    razorpayKeySecret: "KEXn7SaynyjQ0uQhIlscY1Sc",
    pricePerStudentPerMonth: 25,
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, tenantId, months } = body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !tenantId) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        const activeSource = await db.getSource();

        let settings: any = DEFAULT_SETTINGS;
        let tenantName = "University";
        let studentCount = 0;

        try {
            const [tenant, countRow, settingsRow] = await Promise.all([
                prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
                prisma.student.count({ where: { tenantId } }),
                prisma.platformSetting.findUnique({ where: { id: 'boss_payment_config' } })
            ]);
            if (tenant) tenantName = tenant.name;
            studentCount = countRow || 0;
            if (settingsRow?.settings) {
                settings = { ...DEFAULT_SETTINGS, ...(settingsRow.settings as any) };
            }
        } catch (e: any) {
            console.warn("Railway Razorpay verify settings warn:", e?.message);
        }

        if (!settings || !settings.razorpayKeySecret) {
            return NextResponse.json({ success: false, error: "Razorpay Secret not configured" }, { status: 500 });
        }

        // Verify HMAC SHA256 Signature
        const generated_signature = crypto
            .createHmac('sha256', String(settings.razorpayKeySecret).trim())
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return NextResponse.json({ success: false, error: "Invalid payment signature" }, { status: 400 });
        }

        // Fetch payment amount from Razorpay
        let amountPaid = 0;
        try {
            const razorpay = new Razorpay({
                key_id: String(settings.razorpayKeyId).trim(),
                key_secret: String(settings.razorpayKeySecret).trim()
            });
            const payment: any = await razorpay.payments.fetch(razorpay_payment_id);
            amountPaid = (payment?.amount || 0) / 100;
        } catch (razorpayFetchErr) {
            console.error("Failed to fetch payment amount from Razorpay:", razorpayFetchErr);
        }

        // Calculate subscription end date extension based on months paid
        const extensionMonths = Number(months) || 12;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + extensionMonths);

        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                subscriptionStatus: 'active',
                subscriptionEndDate: endDate,
                isActive: true
            }
        });

        return NextResponse.json({ success: true, message: "Subscription activated successfully" });

    } catch (error: any) {
        console.error("Razorpay Verify Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to verify payment" }, { status: 500 });
    }
}
