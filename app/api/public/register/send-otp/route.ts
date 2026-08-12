export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sendMSG91_WidgetOTP, sendMSG91_OTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: NextRequest) {
  try {
    const { contactPhone } = await request.json();
    if (!contactPhone) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    let cleaned = contactPhone.replace(/\D/g, "");
    
    if (cleaned.length < 7 || cleaned.length > 15) {
      return NextResponse.json({ success: false, error: "Please enter a valid mobile number (7 to 15 digits)" }, { status: 400 });
    }

    // Check if direct OTP template is configured
    const templateId = process.env.MSG91_TEMPLATE_ID_OTP;
    const isDirectConfigured = templateId && templateId.trim() !== "" && !templateId.includes("here") && !templateId.includes("template_id") && !templateId.includes("YOUR_");

    let reqId = "";
    let generatedOtp = "";

    if (isDirectConfigured) {
      // Generate a 6-digit OTP
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const smsResponse = await sendMSG91_OTP(cleaned, generatedOtp);
      if (!smsResponse.success) {
        return NextResponse.json({ success: false, error: `MSG91 Server Error: ${smsResponse.error}` }, { status: 500 });
      }
    } else {
      // Trigger MSG91 Widget API (Invisible Mode)
      const smsResponse = await sendMSG91_WidgetOTP(cleaned);
      if (!smsResponse.success) {
          return NextResponse.json({ success: false, error: `MSG91 Server Error: ${smsResponse.error}` }, { status: 500 });
      }
      reqId = smsResponse.reqId;
    }
    
    // Store reqId/otp in global cache to verify later
    const expires = Date.now() + 5 * 60 * 1000;
    otpCache.set("register_" + cleaned, { reqId, otp: generatedOtp, expires } as any);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to send OTP" }, { status: 500 });
  }
}
