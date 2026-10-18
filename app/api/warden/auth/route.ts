export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { assertTenantActive } from "@/lib/tenant";
import { sendMSG91_WidgetOTP, verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

const DEFAULT_WARDEN_PASSWORD = "warden456";

export async function POST(request: NextRequest) {
    try {
        // 🔒 Subscription Guard: Prevent warden login if subscription has ended
        const subCheck = await assertTenantActive();
        if (!subCheck.allowed) {
            return subCheck.response;
        }

        const body = await request.json();
        const { password, hostelId, phoneNumber, otp } = body;

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        if (!hostelId) {
            return NextResponse.json(
                { error: "Hostel selection is required" },
                { status: 400 }
            );
        }

        // 1. Handle special GETPASS login
        if (hostelId === 'getpass') {
            const settings = await db.settings.get();
            const getpassPassword = settings?.getpassPassword || "GET456";

            if (password.trim() === getpassPassword.trim()) {
                return NextResponse.json({
                    success: true,
                    type: 'getpass',
                    hostelName: 'GATEPASS MONITOR',
                    authorizedHostels: []
                }, { status: 200 });
            } else {
                return NextResponse.json(
                    { error: "Invalid authentication key for GATEPASS" },
                    { status: 401 }
                );
            }
        }

        // 2. Try to find the specific hostel
        const hostel = await db.hostels.getById(hostelId);
        if (!hostel) {
            return NextResponse.json(
                { error: "Invalid hostel selected" },
                { status: 404 }
            );
        }

        // 3. Fetch Global Settings & Warden Accounts
        const settings = await db.settings.get();
        const globalPassword = settings?.wardenPassword || DEFAULT_WARDEN_PASSWORD;
        const wardenAccounts = settings?.wardenAccounts || [];

        // 4. Check for dedicated Multi-Hostel Account first
        const matchedAccount = wardenAccounts.find((acc: any) => {
            const hasHostel = acc.hostels && Array.isArray(acc.hostels) && acc.hostels.includes(hostel.name);
            const passwordMatches = password.trim() === (acc.password || globalPassword).trim();
            return hasHostel && passwordMatches;
        });

        const validPassword = matchedAccount ? (matchedAccount.password || globalPassword) : (hostel.wardenPassword || globalPassword);

        if (password.trim() !== validPassword.trim()) {
            return NextResponse.json(
                { error: "Invalid authentication key for this hostel" },
                { status: 401 }
            );
        }

        // 5. Match Registered Warden Mobile Number (from hostel.wardenUsername)
        let cleanInputPhone = (phoneNumber || "").replace(/\D/g, "");
        if (cleanInputPhone.length > 10) {
            cleanInputPhone = cleanInputPhone.slice(-10);
        }

        if (!cleanInputPhone || cleanInputPhone.length < 10) {
            return NextResponse.json(
                { error: "Please enter your 10-digit registered warden mobile number." },
                { status: 400 }
            );
        }

        const extractNumbers = (str: string): string[] => {
            if (!str) return [];
            const matches = str.match(/\d{10}/g) || [];
            return Array.from(new Set(matches));
        };

        const registeredPhones = extractNumbers(hostel.wardenUsername || "");
        const isMatchedPhone = registeredPhones.includes(cleanInputPhone) || 
            (hostel.wardenUsername && hostel.wardenUsername.replace(/\D/g, "").includes(cleanInputPhone));

        if (!isMatchedPhone) {
            return NextResponse.json({
                error: `Mobile number +91 ${cleanInputPhone} is not registered for ${hostel.name}. Only the assigned warden mobile number can access this dashboard.`
            }, { status: 400 });
        }

        const cacheKey = `warden_${hostel._id}_${cleanInputPhone}`;

        // 6. Handle OTP Verification if OTP is supplied
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

            return NextResponse.json({
                success: true,
                hostelName: matchedAccount ? matchedAccount.hostels.join(", ") : hostel.name,
                hostelId: hostel._id,
                authorizedHostels: matchedAccount ? matchedAccount.hostels : [hostel.name],
                wardenUsername: hostel.wardenUsername,
                wardenPhone: cleanInputPhone
            }, { status: 200 });
        }

        // 7. Send OTP via MSG91
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
            message: `OTP sent successfully to registered warden number +91 ******${cleanInputPhone.slice(-4)}`
        }, { status: 200 });

    } catch (error: any) {
        console.error("❌ Error validating warden credentials:", error);
        return NextResponse.json(
            { error: `Authentication failed: ${error.message || 'Unknown error'}` },
            { status: 500 }
        );
    }
}
