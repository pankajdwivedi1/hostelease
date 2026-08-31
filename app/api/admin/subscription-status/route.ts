import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionStatus } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";
import { createCachedResponse } from "@/lib/cacheHelper";

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
    bankName: "PNB Bank",
    accountName: "DR. PANKAJ DWIVEDI",
    accountNumber: "06102413001048",
    ifsc: "PUNB0061010",
    upiId: "pankaj86.dwivedi-1@okicici",
    enableRazorpay: true,
    razorpayKeyId: "rzp_live_TAKnbp18wnY8Mu",
    razorpayKeySecret: "KEXn7SaynyjQ0uQhIlscY1Sc",
    pricePerStudentPerMonth: 25,
    discount1Month: 10,
    discount3Month: 20,
    discount6Month: 30,
    discount12Month: 40,
    bankTransferDiscount: 3,
    supportWhatsappNumber: "8269418956",
    customQrCodeUrl: "",
    enforceMandatoryPush: false
};

export async function GET(request: NextRequest) {
    try {
        const status = await getSubscriptionStatus();
        const activeSource = await db.getSource();

        let paymentSettings: any = DEFAULT_SETTINGS;

        try {
            const row = await prisma.platformSetting.findUnique({
                where: { id: 'boss_payment_config' }
            });
            if (row?.settings) {
                paymentSettings = { ...DEFAULT_SETTINGS, ...(row.settings as any) };
            }
        } catch (e: any) {
            console.warn("Railway subscription-status settings GET error:", e?.message);
        }

        // Security: NEVER send the Razorpay Secret Key to the client
        const safePaymentSettings = { ...paymentSettings };
        delete safePaymentSettings.razorpayKeySecret;

        if (!status) {
            return NextResponse.json({ success: true, isDefault: true, paymentSettings: safePaymentSettings }, {
                headers: { "Cache-Control": "no-store, max-age=0" }
            });
        }
        return NextResponse.json({ success: true, ...status, paymentSettings: safePaymentSettings }, {
            headers: { "Cache-Control": "no-store, max-age=0" }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
