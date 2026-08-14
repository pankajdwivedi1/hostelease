import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionStatus } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";

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
    discount1Month: 0,
    discount3Month: 15,
    discount6Month: 25,
    discount12Month: 30,
    bankTransferDiscount: 3,
    supportWhatsappNumber: "8269418956",
    customQrCodeUrl: ""
};

export async function GET(request: NextRequest) {
    try {
        const status = await getSubscriptionStatus();
        const activeSource = await db.getSource();

        let paymentSettings: any = DEFAULT_SETTINGS;

        if (activeSource === 'PRISMA') {
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
        } else {
            try {
                const supabase = getSupabaseAdmin();
                const { data } = await supabase
                    .from('platform_settings')
                    .select('settings')
                    .eq('id', 'boss_payment_config')
                    .maybeSingle();

                if (data?.settings) {
                    paymentSettings = { ...DEFAULT_SETTINGS, ...(data.settings as any) };
                }
            } catch (e: any) {
                console.warn("Supabase subscription-status settings GET error:", e?.message);
            }
        }

        // Security: NEVER send the Razorpay Secret Key to the client
        const safePaymentSettings = { ...paymentSettings };
        delete safePaymentSettings.razorpayKeySecret;

        if (!status) {
            return NextResponse.json({ success: true, isDefault: true, paymentSettings: safePaymentSettings });
        }
        return NextResponse.json({ success: true, ...status, paymentSettings: safePaymentSettings });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
