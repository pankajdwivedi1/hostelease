export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, hostelId, phoneNumber, otp, newPassword } = body;

    if (!role || (role !== "warden" && role !== "dean" && role !== "superadmin")) {
      return NextResponse.json({ success: false, error: "Valid role ('warden', 'dean', or 'superadmin') is required." }, { status: 400 });
    }

    let cleanPhone = (phoneNumber || "").replace(/\D/g, "");
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json({ success: false, error: "Valid 10-digit phone number is required." }, { status: 400 });
    }

    if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
      return NextResponse.json({ success: false, error: "A valid 6-digit OTP is required." }, { status: 400 });
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return NextResponse.json({ success: false, error: "New password must be at least 4 characters." }, { status: 400 });
    }

    const cacheKey = `staff_reset_${role}_${hostelId || (role === "superadmin" ? "superadmin" : "dean")}_${cleanPhone}`;
    const cachedData: any = otpCache.get(cacheKey);

    if (!cachedData) {
      return NextResponse.json({
        success: false,
        error: "OTP session expired or not found. Please request a new OTP."
      }, { status: 400 });
    }

    if (Date.now() > cachedData.expires) {
      otpCache.delete(cacheKey);
      return NextResponse.json({
        success: false,
        error: "OTP has expired. Please request a new OTP."
      }, { status: 400 });
    }

    // Verify OTP with MSG91
    const verifyRes = await verifyMSG91_WidgetOTP(cleanPhone, cachedData.reqId || "", otp.trim());
    if (!verifyRes.success) {
      return NextResponse.json({
        success: false,
        error: verifyRes.error || "Invalid OTP code entered. Please try again."
      }, { status: 400 });
    }

    // Clear verification cache
    otpCache.delete(cacheKey);

    // Update password in database
    if (role === "warden") {
      if (!hostelId) {
        return NextResponse.json({ success: false, error: "Hostel ID is required." }, { status: 400 });
      }
      await db.hostels.update(hostelId, { wardenPassword: newPassword.trim() });
    } else if (role === "dean") {
      await db.settings.update({ adminPassword: newPassword.trim() });
    } else if (role === "superadmin") {
      await db.settings.update({ developerPassword: newPassword.trim() });
    }

    const roleName = role === "warden" ? "Warden" : role === "superadmin" ? "Super Admin" : "Dean";
    return NextResponse.json({
      success: true,
      message: `${roleName} password updated successfully! You can now log in with your new password.`
    });

  } catch (error: any) {
    console.error("Error in staff reset password verify-otp:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
