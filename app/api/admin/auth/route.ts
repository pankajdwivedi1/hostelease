import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { sendMSG91_WidgetOTP, verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";
import { setAuthSessionCookie } from "@/lib/authSession";

const resolveConfiguredPassword = (value: string | undefined, envKey: string) => {
  const envValue = (process.env[envKey] || "").trim();
  if (envValue) return envValue;
  return (value || "").trim();
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, phoneNumber, otp } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Fetch from DB using adapter
    const settings = await db.settings.get();
    const configuredPassword = resolveConfiguredPassword(settings?.adminPassword, "ADMIN_LOGIN_PASSWORD");

    if (!configuredPassword) {
      return NextResponse.json(
        { error: "Admin authentication is not configured. Set ADMIN_LOGIN_PASSWORD in the environment." },
        { status: 503 }
      );
    }

    if (password.trim() !== configuredPassword) {
      return NextResponse.json(
        { error: "Invalid authentication key" },
        { status: 401 }
      );
    }

    // Match Registered Dean Mobile Number
    let cleanInputPhone = (phoneNumber || "").replace(/\D/g, "");
    if (cleanInputPhone.length > 10) {
      cleanInputPhone = cleanInputPhone.slice(-10);
    }

    if (!cleanInputPhone || cleanInputPhone.length < 10) {
      return NextResponse.json(
        { error: "Please enter your 10-digit registered Dean mobile number." },
        { status: 400 }
      );
    }

    const bankDetails: any = settings?.universityBankDetails || {};
    let registeredDeanPhone = (settings?.deanPhone || bankDetails?.deanPhone || "").replace(/\D/g, "");
    if (registeredDeanPhone.length > 10) registeredDeanPhone = registeredDeanPhone.slice(-10);

    let isMatch = false;
    if (registeredDeanPhone && registeredDeanPhone.length === 10) {
      isMatch = cleanInputPhone === registeredDeanPhone;
    } else {
      let fallbackPhone = (bankDetails?.contactPhone || "").replace(/\D/g, "");
      if (fallbackPhone.length > 10) fallbackPhone = fallbackPhone.slice(-10);
      isMatch = cleanInputPhone === fallbackPhone;
    }

    if (!isMatch) {
      return NextResponse.json({
        error: `Mobile number +91 ${cleanInputPhone} does not match the registered Dean mobile number.`
      }, { status: 400 });
    }

    const cacheKey = `dean_auth_${cleanInputPhone}`;

    // Handle OTP verification if supplied
    if (otp && typeof otp === "string" && otp.trim().length === 6) {
      const cached = otpCache.get(cacheKey);
      if (!cached) {
        return NextResponse.json({
          error: "OTP session expired or not found. Please request a new OTP."
        }, { status: 400 });
      }

      if (Date.now() > cached.expires) {
        otpCache.delete(cacheKey);
        return NextResponse.json({
          error: "OTP has expired. Please request a new OTP."
        }, { status: 400 });
      }

      const verifyRes = await verifyMSG91_WidgetOTP(cleanInputPhone, cached.reqId || "", otp.trim());
      if (!verifyRes.success) {
        return NextResponse.json({
          error: verifyRes.error || "Invalid OTP entered. Please try again."
        }, { status: 400 });
      }

      otpCache.delete(cacheKey);

      const response = NextResponse.json({
        success: true,
        role: "dean",
        deanPhone: cleanInputPhone
      }, { status: 200 });
      setAuthSessionCookie(response, { role: "admin", phone: cleanInputPhone });
      return response;
    }

    // Send OTP via MSG91
    const smsResponse = await sendMSG91_WidgetOTP(cleanInputPhone);
    if (!smsResponse.success) {
      return NextResponse.json({
        error: `Failed to send OTP to ${cleanInputPhone}: ${smsResponse.error || "SMS service error"}`
      }, { status: 500 });
    }

    otpCache.set(cacheKey, {
      reqId: smsResponse.reqId,
      expires: Date.now() + 5 * 60 * 1000,
      phone: cleanInputPhone
    } as any);

    return NextResponse.json({
      success: true,
      requireOtp: true,
      reqId: smsResponse.reqId,
      phone: cleanInputPhone,
      message: `OTP sent successfully to Dean registered mobile number +91 ******${cleanInputPhone.slice(-4)}`
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error validating admin credentials:", error);
    return NextResponse.json(
      { error: "Failed to validate credentials" },
      { status: 500 }
    );
  }
}
