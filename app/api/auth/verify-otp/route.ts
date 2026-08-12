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
    if (cleaned.length < 7 || cleaned.length > 15) {
      return NextResponse.json({ success: false, error: "Please enter a valid mobile number (7 to 15 digits)" }, { status: 400 });
    }

    // Check cache for reqId
    const cacheEntry = otpCache.get(cleaned);
    if (!cacheEntry || (!cacheEntry.reqId && !cacheEntry.otp)) {
      return NextResponse.json({ success: false, error: "OTP session expired or not found. Please request a new OTP." }, { status: 400 });
    }

    if (Date.now() > cacheEntry.expires) {
      otpCache.delete(cleaned);
      return NextResponse.json({ success: false, error: "OTP expired. Please request a new one." }, { status: 400 });
    }

    if (cacheEntry.otp) {
      if (cacheEntry.otp !== otp) {
        return NextResponse.json({ success: false, error: "Invalid OTP" }, { status: 400 });
      }
    } else {
      const verifyResponse = await verifyMSG91_WidgetOTP(cleaned, cacheEntry.reqId as string, otp);
      if (!verifyResponse.success) {
          return NextResponse.json({ success: false, error: verifyResponse.error || "Invalid OTP" }, { status: 400 });
      }
    }

    // Clear cache upon success
    otpCache.delete(cleaned);

    return NextResponse.json({ success: true, message: "OTP Verified Successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("❌ API Route Error (verify-otp):", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
