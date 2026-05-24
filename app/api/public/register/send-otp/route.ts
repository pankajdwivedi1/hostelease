import { NextRequest, NextResponse } from "next/server";
import { sendMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: NextRequest) {
    try {
        const { phoneNumber } = await request.json();

        if (!phoneNumber) {
            return NextResponse.json({ success: false, error: "Phone number is required." }, { status: 400 });
        }

        const msgResponse = await sendMSG91_WidgetOTP(phoneNumber);
        
        if (msgResponse.success && msgResponse.reqId) {
            // Store the reqId in cache for 10 minutes
            otpCache.set(phoneNumber, msgResponse.reqId);
            return NextResponse.json({ success: true, message: "OTP sent successfully via MSG91." });
        } else {
            return NextResponse.json({ success: false, error: msgResponse.error || "Failed to trigger OTP." }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Error in public send-otp:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
