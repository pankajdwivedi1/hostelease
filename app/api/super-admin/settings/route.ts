export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'boss_payment_config')
            .single();

        if (error || !data) {
            // Return default settings if none exist
            return NextResponse.json({
                success: true,
                settings: {
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
                }
            });
        }

        return NextResponse.json({ success: true, settings: data.settings });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const settings = await request.json();
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
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
