import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionStatus } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const status = await getSubscriptionStatus();
        
        // Fetch Boss Payment Settings
        const supabase = getSupabaseAdmin();
        const { data: settingsData } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'boss_payment_config')
            .single();

        const defaultSettings = {
            bankName: "PNB Bank",
            accountName: "DR. PANKAJ DWIVEDI",
            accountNumber: "06102413001048",
            ifsc: "PUNB0061010",
            upiId: "pankaj86.dwivedi-1@okicici",
            enableRazorpay: false,
            razorpayKeyId: "",
            razorpayKeySecret: "",
            pricePerStudentPerMonth: 30,
            customQrCodeUrl: ""
        };

        const paymentSettings = settingsData?.settings || defaultSettings;
        
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
