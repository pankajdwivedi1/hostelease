import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getCurrentTenantId } from "@/lib/tenant";
import { otpCache } from "@/lib/otpCache";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";
import crypto from "crypto";

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

    const cachedData = otpCache.get(cleaned);

    if (!cachedData) {
      return NextResponse.json({ success: false, error: "OTP expired or not found. Please request a new one." }, { status: 400 });
    }

    if (Date.now() > cachedData.expires) {
      otpCache.delete(cleaned);
      return NextResponse.json({ success: false, error: "OTP expired. Please request a new one." }, { status: 400 });
    }

    // Verify using MSG91 Widget API
    const verification = await verifyMSG91_WidgetOTP(cleaned, cachedData.reqId as string, otp);
    
    if (!verification.success) {
      return NextResponse.json({ success: false, error: verification.error || "Invalid OTP" }, { status: 400 });
    }

    // Clear cache after successful verification
    otpCache.delete(cleaned);
    console.log(`[PARENT LOGIN] Verification successful for phone: ${cleaned}`);
    
    return NextResponse.json({ success: true, message: "OTP verified successfully" });
  } catch (error: any) {
    console.error("❌ Verify OTP crash:", error);
    return NextResponse.json({ success: false, error: error.message || "Verification failed" }, { status: 500 });
  }
}
