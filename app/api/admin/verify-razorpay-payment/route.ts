export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
            console.warn("Razorpay verify settings warn:", e?.message);
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
        let paymentAmount = 0;
        try {
            const razorpay = new Razorpay({
                key_id: String(settings.razorpayKeyId).trim(),
                key_secret: String(settings.razorpayKeySecret).trim(),
            });
            const payment = await razorpay.payments.fetch(razorpay_payment_id);
            paymentAmount = Number(payment.amount) / 100; // In INR
        } catch (err) {
            console.error("Failed to fetch Razorpay payment details:", err);
        }

        const durationMonths = Number(months) || 3;

        // 1. Extend Tenant Subscription in Railway PostgreSQL (Prisma)
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { subscriptionEndDate: true }
        });

        const currentEndDate = tenant?.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : new Date();
        const startDate = (currentEndDate > new Date()) ? currentEndDate : new Date();
        const newEndDate = new Date(startDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                subscriptionStatus: 'active',
                subscriptionEndDate: newEndDate,
                isActive: true
            }
        });

        // 2. Append to Super Admin Billing Ledger in Prisma
        try {
            const billingSetting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_billing_ledger' }
            });
            const currentLogs: any[] = (billingSetting?.settings && Array.isArray(billingSetting.settings)) ? (billingSetting.settings as any[]) : [];
            const newInvoice = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                tenantId,
                tenantName,
                amount: paymentAmount || 0,
                utr: razorpay_payment_id,
                date: new Date().toISOString(),
                billingType: "Verified Payment",
                paymentSource: "Razorpay (Online Payment Gateway)",
                billingPeriod: `${durationMonths} Month${durationMonths > 1 ? 's' : ''}`,
                remarks: `Automated Gateway Settlement (Order ID: ${razorpay_order_id})`
            };

            await prisma.platformSetting.upsert({
                where: { id: 'super_admin_billing_ledger' },
                update: { settings: [newInvoice, ...currentLogs] as any, updatedAt: new Date() },
                create: { id: 'super_admin_billing_ledger', settings: [newInvoice, ...currentLogs] as any, updatedAt: new Date() }
            });
        } catch (e: any) {
            console.warn("Prisma ledger update notice:", e?.message);
        }

        return NextResponse.json({
            success: true,
            message: "Payment verified successfully!",
            newEndDate: newEndDate.toISOString()
        });
    } catch (error: any) {
        console.error("Verification error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to verify payment" }, { status: 500 });
    }
}
