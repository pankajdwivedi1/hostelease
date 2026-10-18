export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { sendMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, hostelId, phoneNumber } = body;

    if (!role || (role !== "warden" && role !== "dean" && role !== "superadmin")) {
      return NextResponse.json({ success: false, error: "Valid role ('warden', 'dean', or 'superadmin') is required." }, { status: 400 });
    }

    let cleanPhone = (phoneNumber || "").replace(/\D/g, "");
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit registered mobile number." }, { status: 400 });
    }

    if (role === "warden") {
      if (!hostelId) {
        return NextResponse.json({ success: false, error: "Please select your hostel." }, { status: 400 });
      }

      const hostel = await db.hostels.getById(hostelId);
      if (!hostel) {
        return NextResponse.json({ success: false, error: "Selected hostel not found." }, { status: 404 });
      }

      const extractNumbers = (str: string): string[] => {
        if (!str) return [];
        const matches = str.match(/\d{10}/g) || [];
        return Array.from(new Set(matches));
      };

      const registeredPhones = extractNumbers(hostel.wardenUsername || "");
      const isMatchedPhone = registeredPhones.includes(cleanPhone) || 
        (hostel.wardenUsername && hostel.wardenUsername.replace(/\D/g, "").includes(cleanPhone));

      if (!isMatchedPhone) {
        return NextResponse.json({
          success: false,
          error: `Mobile number +91 ${cleanPhone} is not registered for ${hostel.name} Warden.`
        }, { status: 400 });
      }
    } else if (role === "dean") {
      const settings = await db.settings.get();
      const bankDetails: any = settings?.universityBankDetails || {};
      let registeredDeanPhone = (settings?.deanPhone || bankDetails?.deanPhone || "").replace(/\D/g, "");
      if (registeredDeanPhone.length > 10) registeredDeanPhone = registeredDeanPhone.slice(-10);

      let isMatch = false;
      if (registeredDeanPhone && registeredDeanPhone.length === 10) {
        isMatch = cleanPhone === registeredDeanPhone;
      } else {
        let fallbackPhone = (bankDetails?.contactPhone || "").replace(/\D/g, "");
        if (fallbackPhone.length > 10) fallbackPhone = fallbackPhone.slice(-10);
        isMatch = cleanPhone === fallbackPhone;
      }

      if (!isMatch) {
        return NextResponse.json({
          success: false,
          error: `Mobile number +91 ${cleanPhone} does not match the registered Dean records.`
        }, { status: 400 });
      }
    } else if (role === "superadmin") {
      const settings = await db.settings.get();
      const bankDetails: any = settings?.universityBankDetails || {};
      let registeredSuperAdminPhone = (settings?.superAdminPhone || bankDetails?.superAdminPhone || "").replace(/\D/g, "");
      if (registeredSuperAdminPhone.length > 10) registeredSuperAdminPhone = registeredSuperAdminPhone.slice(-10);

      let isMatch = false;
      if (registeredSuperAdminPhone && registeredSuperAdminPhone.length === 10) {
        isMatch = cleanPhone === registeredSuperAdminPhone;
      } else {
        let fallbackPhone = (bankDetails?.contactPhone || "").replace(/\D/g, "");
        if (fallbackPhone.length > 10) fallbackPhone = fallbackPhone.slice(-10);
        isMatch = cleanPhone === fallbackPhone;
      }

      if (!isMatch) {
        return NextResponse.json({
          success: false,
          error: `Mobile number +91 ${cleanPhone} does not match the registered Super Admin records.`
        }, { status: 400 });
      }
    }

    // Send OTP via MSG91
    const smsResponse = await sendMSG91_WidgetOTP(cleanPhone);
    if (!smsResponse.success) {
      return NextResponse.json({
        success: false,
        error: `Failed to send OTP: ${smsResponse.error || "SMS Gateway Error"}`
      }, { status: 500 });
    }

    const cacheKey = `staff_reset_${role}_${hostelId || "dean"}_${cleanPhone}`;
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes validity
    otpCache.set(cacheKey, {
      reqId: smsResponse.reqId,
      expires,
      phone: cleanPhone,
      role,
      hostelId: hostelId || null
    } as any);

    const maskedPhone = "******" + cleanPhone.slice(-4);
    return NextResponse.json({
      success: true,
      message: `OTP sent successfully to registered mobile +91 ${maskedPhone}`
    });

  } catch (error: any) {
    console.error("Error in staff reset password request-otp:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
