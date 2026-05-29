import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { sendMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: Request) {
    try {
        const tenantId = await db.getTenantIdOrThrow();

        // Fetch current settings to get the existing contactPhone
        const { data: settings } = await db.supabase
            .from('admin_settings')
            .select('university_bank_details')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        const bankDetails = settings?.university_bank_details || {};
        const existingPhone = bankDetails.contactPhone;

        if (!existingPhone) {
            return NextResponse.json({ 
                success: false, 
                error: "No mobile number is currently registered for your account. Please contact the Super Admin to set your initial mobile number." 
            }, { status: 400 });
        }

        let cleaned = existingPhone.replace(/\D/g, "");
        if (cleaned.length === 12 && cleaned.startsWith("91")) {
            cleaned = cleaned.substring(2);
        }

        if (cleaned.length !== 10) {
            return NextResponse.json({ success: false, error: "Currently registered mobile number is invalid." }, { status: 400 });
        }

        // Send OTP
        const smsResponse = await sendMSG91_WidgetOTP(cleaned);
        
        if (!smsResponse.success) {
            return NextResponse.json({ success: false, error: `MSG91 Server Error: ${smsResponse.error}` }, { status: 500 });
        }

        const reqId = smsResponse.reqId; 
        
        // Store reqId in global cache using tenantId to identify the request session
        const expires = Date.now() + 5 * 60 * 1000;
        otpCache.set("settings_update_" + tenantId, { reqId: reqId, expires, phone: cleaned } as any);

        // Mask the phone number for security in the response
        const maskedPhone = "******" + cleaned.substring(6);

        return NextResponse.json({
            success: true,
            message: `OTP sent successfully to ${maskedPhone}`
        });
    } catch (error: any) {
        console.error("Error requesting OTP:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
