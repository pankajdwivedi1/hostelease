export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { sendMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phoneNumber } = body;

        if (!phoneNumber) {
            return NextResponse.json({ success: false, error: "Phone number is required." }, { status: 400 });
        }

        let inputPhone = phoneNumber.replace(/\D/g, "");
        if (inputPhone.length === 12 && inputPhone.startsWith("91")) {
            inputPhone = inputPhone.substring(2);
        }

        if (inputPhone.length !== 10) {
            return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
        }

        const tenantId = await db.getTenantIdOrThrow();
        const settings = await db.settings.get();

        if (!settings) {
            return NextResponse.json({ success: false, error: "University settings not found." }, { status: 404 });
        }

        const bankDetails = settings.universityBankDetails || {};
        const registeredPhone = bankDetails.superAdminPhone || bankDetails.contactPhone;

        if (!registeredPhone) {
            return NextResponse.json({
                success: false,
                error: "No recovery phone number has been configured for this portal. Please contact developer support."
            }, { status: 400 });
        }

        let cleanRegistered = registeredPhone.replace(/\D/g, "");
        if (cleanRegistered.length === 12 && cleanRegistered.startsWith("91")) {
            cleanRegistered = cleanRegistered.substring(2);
        }

        if (inputPhone !== cleanRegistered) {
            return NextResponse.json({
                success: false,
                error: "The entered phone number does not match our records for Super Admin recovery."
            }, { status: 400 });
        }

        // Send OTP via MSG91
        const smsResponse = await sendMSG91_WidgetOTP(inputPhone);

        if (!smsResponse.success) {
            return NextResponse.json({
                success: false,
                error: `Failed to send OTP: ${smsResponse.error || "SMS Gateway Error"}`
            }, { status: 500 });
        }

        const expires = Date.now() + 5 * 60 * 1000; // 5 minutes validity
        otpCache.set("super_admin_reset_" + tenantId, {
            reqId: smsResponse.reqId,
            expires,
            phone: inputPhone
        } as any);

        const maskedPhone = "******" + inputPhone.substring(6);
        return NextResponse.json({
            success: true,
            message: `OTP sent successfully to registered mobile number ${maskedPhone}`
        });

    } catch (error: any) {
        console.error("Error in super admin reset password request-otp:", error);
        return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
    }
}
