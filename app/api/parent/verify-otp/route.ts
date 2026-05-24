import { NextRequest, NextResponse } from "next/server";
import { otpCache } from "@/lib/otpCache";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json();
    if (!phoneNumber || !otp) {
      return NextResponse.json({ success: false, error: "Phone number and OTP are required" }, { status: 400 });
    }

    // Clean phone number
    let cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.substring(2);
    }

    const cachedEntry = otpCache.get(cleaned);

    if (!cachedEntry) {
      return NextResponse.json({ success: false, error: "OTP expired or not found. Please request a new one." }, { status: 400 });
    }

    if (Date.now() > cachedEntry.expires) {
      otpCache.delete(cleaned);
      return NextResponse.json({ success: false, error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    const reqId = cachedEntry.reqId;
    
    // 🔥 Verify OTP using MSG91 Widget API
    const verifyResponse = await verifyMSG91_WidgetOTP(cleaned, reqId, otp.trim());
    if (!verifyResponse.success) {
        return NextResponse.json({ success: false, error: verifyResponse.error || "Invalid OTP. Please check the code and try again." }, { status: 400 });
    }

    // Clean up cached OTP on success
    otpCache.delete(cleaned);
    console.log(`[PARENT LOGIN] Verification successful for phone: ${cleaned}`);
    
    return NextResponse.json({ success: true, message: "OTP verified successfully" });
  } catch (error: any) {
    console.error("❌ Verify OTP crash:", error);
    return NextResponse.json({ success: false, error: error.message || "Verification failed" }, { status: 500 });
  }
}
