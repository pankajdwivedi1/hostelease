export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";

const DEFAULT_SETTINGS = {
    enableRazorpay: true,
    razorpayKeyId: "rzp_live_TAKnbp18wnY8Mu",
    razorpayKeySecret: "KEXn7SaynyjQ0uQhIlscY1Sc",
    pricePerStudentPerMonth: 25,
    discount1Month: 0,
    discount3Month: 15,
    discount6Month: 25,
    discount12Month: 30,
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });
        }

        let tenantName = "University";
        let studentCount = 0;
        let settings: any = DEFAULT_SETTINGS;

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
            console.warn("Razorpay fetch warn:", e?.message);
        }

        if (!settings || !settings.enableRazorpay || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
            return NextResponse.json({ success: false, error: "Razorpay is not fully configured" }, { status: 400 });
        }

        const months = Number(body.months) || 3;
        const billableStudents = Math.max(1, studentCount || 0);
        const pricePerMonth = Number(settings.pricePerStudentPerMonth) || 25;
        
        let discountPercent = 0;
        if (months === 1) discountPercent = settings.discount1Month !== undefined ? Number(settings.discount1Month) : 0;
        else if (months === 3) discountPercent = settings.discount3Month !== undefined ? Number(settings.discount3Month) : 15;
        else if (months === 6) discountPercent = settings.discount6Month !== undefined ? Number(settings.discount6Month) : 25;
        else if (months >= 12) discountPercent = settings.discount12Month !== undefined ? Number(settings.discount12Month) : 30;

        const baseAmount = billableStudents * pricePerMonth * months;
        const discountAmount = Math.round(baseAmount * (discountPercent / 100));
        const finalAmount = Math.max(1, baseAmount - discountAmount);

        const razorpay = new Razorpay({
            key_id: String(settings.razorpayKeyId).trim(),
            key_secret: String(settings.razorpayKeySecret).trim(),
        });

        const options = {
            amount: finalAmount * 100, // Amount in paise
            currency: "INR",
            receipt: `rcpt_${tenantId.substring(0, 8)}_${Date.now().toString().slice(-6)}`,
            notes: {
                tenantId,
                tenantName,
                months,
                billableStudents,
                discountPercent
            }
        };

        const order = await razorpay.orders.create(options);

        return NextResponse.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: settings.razorpayKeyId,
            tenantName,
            finalAmount,
            baseAmount,
            discountPercent
        });
    } catch (error: any) {
        console.error("Razorpay Order Creation Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to create order" }, { status: 500 });
    }
}
