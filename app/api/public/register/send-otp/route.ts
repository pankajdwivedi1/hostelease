import { NextRequest, NextResponse } from "next/server";
import { sendMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: NextRequest) {
  try {
    const { contactPhone } = await request.json();
    if (!contactPhone) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    let cleaned = contactPhone.replace(/\D/g, "");
    
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.substring(2);
    }
    
    if (cleaned.length !== 10) {
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number" }, { status: 400 });
    }

    // Trigger MSG91 Widget API (Invisible Mode)
    const smsResponse = await sendMSG91_WidgetOTP(cleaned);
    
    if (!smsResponse.success) {
        return NextResponse.json({ success: false, error: `MSG91 Server Error: ${smsResponse.error}` }, { status: 500 });
    }

    const reqId = smsResponse.reqId; 
    
    // Store reqId in global cache to verify later
    const expires = Date.now() + 5 * 60 * 1000;
    otpCache.set("register_" + cleaned, { reqId: reqId, expires } as any);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to send OTP" }, { status: 500 });
  }
}
