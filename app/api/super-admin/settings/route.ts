export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";

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
    customQrCodeUrl: "",
    globalPushEnabled: true,
    parentCurfewAbsentEnabled: true,
    parentGateScanInOutEnabled: true,
    wardenLeaveRequestEnabled: true,
    deanLeaveRequestEnabled: true,
    studentLeaveDecisionEnabled: true,
    curfewStart: "21:30",
    curfewEnd: "22:30",
    gracePeriodMinutes: 15,
    parentConsentVideoUploadedEnabled: true,
    outingOverdueEnabled: true,
    paymentVerifiedEnabled: true,
    leaveDecisionEnabled: true,
    outingGracePeriod: 30,
    absoluteOutingCutoff: "20:30"
};

export async function GET(request: NextRequest) {
    try {
        const activeSource = await db.getSource();
        
        if (activeSource === 'PRISMA') {
            try {
                const row = await prisma.platformSetting.findUnique({
                    where: { id: 'boss_payment_config' }
                });
                if (row?.settings) {
                    return NextResponse.json({ success: true, settings: { ...DEFAULT_SETTINGS, ...(row.settings as any) } });
                }
            } catch (e: any) {
                console.warn("Railway platformSettings GET error, checking default:", e?.message);
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
                    return NextResponse.json({ success: true, settings: { ...DEFAULT_SETTINGS, ...(data.settings as any) } });
                }
            } catch (e: any) {
                console.warn("Supabase platformSettings GET error:", e?.message);
            }
        }

        return NextResponse.json({ success: true, settings: DEFAULT_SETTINGS });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const settings = await request.json();
        const activeSource = await db.getSource();

        if (activeSource === 'PRISMA') {
            await prisma.platformSetting.upsert({
                where: { id: 'boss_payment_config' },
                update: {
                    settings: settings as any,
                    updatedAt: new Date()
                },
                create: {
                    id: 'boss_payment_config',
                    settings: settings as any
                }
            });
            return NextResponse.json({ success: true });
        }

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('platform_settings')
            .upsert({
                id: 'boss_payment_config',
                settings: settings,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Save platform settings error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to save settings" }, { status: 500 });
    }
}
