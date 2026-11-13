export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { sendMSG91_WidgetOTP, verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";
import { setAuthSessionCookie } from "@/lib/authSession";
import { activeQRSessions } from "@/lib/superAdminQRStore";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, otp, challengeId } = body;

        // 1. Resolve registered Super Admin Phone
        let registeredPhone = "";
        try {
            const settings = await db.settings.get();
            const bankDetails = (settings?.universityBankDetails as any) || {};
            const rawPhone = (settings?.superAdminPhone || bankDetails.superAdminPhone || bankDetails.contactPhone || process.env.SUPERADMIN_PHONE || "").replace(/\D/g, "");
            registeredPhone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;
        } catch (dbErr) {
            console.warn("DB settings fetch failed in otp-login:", dbErr);
        }

        if (!registeredPhone && process.env.SUPERADMIN_PHONE) {
            registeredPhone = process.env.SUPERADMIN_PHONE.replace(/\D/g, "").slice(-10);
        }

        if (!registeredPhone || registeredPhone.length !== 10) {
            return NextResponse.json({
                success: false,
                error: "No registered Super Admin phone number found in system settings."
            }, { status: 400 });
        }

        const cacheKey = `superadmin_login_otp_${registeredPhone}`;

        // ACTION A: REQUEST OTP
        if (action === "request-otp") {
            const smsResponse = await sendMSG91_WidgetOTP(registeredPhone);

            if (!smsResponse.success) {
                return NextResponse.json({
                    success: false,
                    error: `Failed to send SMS OTP: ${smsResponse.error || "SMS Gateway Error"}`
                }, { status: 500 });
            }

            const expires = Date.now() + 5 * 60 * 1000; // 5 min
            otpCache.set(cacheKey, {
                reqId: smsResponse.reqId,
                expires
            });

            const maskedPhone = "******" + registeredPhone.slice(-4);
            return NextResponse.json({
                success: true,
                maskedPhone,
                message: `6-digit OTP sent to registered mobile: ${maskedPhone}`
            });
        }

        // ACTION B: VERIFY OTP & ISSUE AUTH SESSION
        if (action === "verify-otp") {
            const cleanOtp = (otp || "").toString().trim();
            if (!cleanOtp || cleanOtp.length !== 6) {
                return NextResponse.json({
                    success: false,
                    error: "Please enter a valid 6-digit OTP."
                }, { status: 400 });
            }

            const cached = otpCache.get(cacheKey);
            if (!cached) {
                return NextResponse.json({
                    success: false,
                    error: "OTP has expired or was not requested. Please request a new OTP."
                }, { status: 400 });
            }

            if (Date.now() > cached.expires) {
                otpCache.delete(cacheKey);
                return NextResponse.json({
                    success: false,
                    error: "OTP has expired. Please request a fresh OTP."
                }, { status: 400 });
            }

            const verification = await verifyMSG91_WidgetOTP(registeredPhone, cached.reqId || "", cleanOtp);
            if (!verification.success) {
                return NextResponse.json({
                    success: false,
                    error: verification.error || "Invalid OTP code entered."
                }, { status: 400 });
            }

            // OTP valid! Clear cache
            otpCache.delete(cacheKey);

            // If this was paired with a QR challenge on screen, mark the challenge approved
            if (challengeId && activeQRSessions.has(challengeId)) {
                const session = activeQRSessions.get(challengeId);
                if (session) {
                    session.status = "APPROVED";
                    session.approvedBy = "SuperAdminOTPAuth";
                }
            }

            // Issue authenticated session cookies
            const response = NextResponse.json({
                success: true,
                message: "Super Admin authenticated successfully via OTP"
            });

            setAuthSessionCookie(response, { role: "superadmin" });

            response.cookies.set("userType", "superadmin", {
                path: "/",
                maxAge: 315360000,
                sameSite: "lax",
                httpOnly: false
            });

            response.cookies.set("tenant-expired", "false", {
                path: "/",
                maxAge: 315360000,
                sameSite: "lax",
                httpOnly: false
            });

            console.log(`✅ [SUPERADMIN_AUTH] Super Admin logged in successfully via mobile OTP.`);
            return response;
        }

        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    } catch (err: any) {
        console.error("Super Admin OTP Login exception:", err);
        return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
    }
}
