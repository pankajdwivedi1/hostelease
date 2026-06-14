import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { otp, newPassword } = body;

        if (!otp || otp.length !== 6) {
            return NextResponse.json({ success: false, error: "A valid 6-digit OTP is required." }, { status: 400 });
        }

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json({ success: false, error: "Password must be at least 6 characters long." }, { status: 400 });
        }

        const tenantId = await db.getTenantIdOrThrow();
        const cacheKey = "super_admin_reset_" + tenantId;
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
        const verification = await verifyMSG91_WidgetOTP(cachedData.phone, cachedData.reqId, otp);

        if (!verification.success) {
            return NextResponse.json({
                success: false,
                error: verification.error || "Invalid OTP code entered."
            }, { status: 400 });
        }

        // Clear verification cache
        otpCache.delete(cacheKey);

        // Update Developer Password in settings
        await db.settings.update({ developerPassword: newPassword });

        return NextResponse.json({
            success: true,
            message: "Super Admin password reset successfully. You can now unlock the portal."
        });

    } catch (error: any) {
        console.error("Error in super admin reset password verify-otp:", error);
        return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
    }
}
