export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { otpCache } from "@/lib/otpCache";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json();
    
    if (!phoneNumber || !otp) {
      return NextResponse.json({ success: false, error: "Phone number and OTP are required" }, { status: 400 });
    }

    let cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.substring(2);
    }

    // Check cache for reqId
    const cacheEntry = otpCache.get(cleaned);
    if (!cacheEntry || !cacheEntry.reqId) {
      return NextResponse.json({ success: false, error: "OTP session expired or not found. Please request a new OTP." }, { status: 400 });
    }

    if (Date.now() > cacheEntry.expires) {
      otpCache.delete(cleaned);
      return NextResponse.json({ success: false, error: "OTP expired. Please request a new one." }, { status: 400 });
    }

    const verifyResponse = await verifyMSG91_WidgetOTP(cleaned, cacheEntry.reqId, otp);

    if (!verifyResponse.success) {
        return NextResponse.json({ success: false, error: verifyResponse.error || "Invalid OTP" }, { status: 400 });
    }

    // Clear cache upon success
    otpCache.delete(cleaned);

    return NextResponse.json({ success: true, message: "OTP Verified Successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("❌ API Route Error (verify-otp):", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
