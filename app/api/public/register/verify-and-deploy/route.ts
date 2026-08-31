export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Here `accessToken` is actually the 6-digit OTP entered by the user
        const { name, slug, adminEmail, contactName, contactPhone, totalHostelars, accessToken } = body;

        if (!name || !slug || !adminEmail || !contactName || !contactPhone || !totalHostelars || !accessToken) {
            return NextResponse.json({ success: false, error: "Missing required fields or OTP code." }, { status: 400 });
        }

        let cleaned = contactPhone.replace(/\D/g, "");
        if (cleaned.length < 7 || cleaned.length > 15) {
            return NextResponse.json({ success: false, error: "Please enter a valid mobile number (7 to 15 digits)" }, { status: 400 });
        }

        // Verify OTP using the request ID stored in cache
        const cachedData: any = otpCache.get("register_" + cleaned);
        
        if (!cachedData || (!cachedData.reqId && !cachedData.otp)) {
            return NextResponse.json({ success: false, error: "OTP expired or not requested. Please request a new OTP." }, { status: 400 });
        }
        
        if (Date.now() > cachedData.expires) {
            otpCache.delete("register_" + cleaned);
            return NextResponse.json({ success: false, error: "OTP expired. Please request a new OTP." }, { status: 400 });
        }

        if (cachedData.otp) {
            if (cachedData.otp !== accessToken) {
                return NextResponse.json({ success: false, error: "Invalid OTP Code" }, { status: 400 });
            }
        } else {
            const verification = await verifyMSG91_WidgetOTP(cleaned, cachedData.reqId, accessToken);
            if (!verification.success) {
                return NextResponse.json({ success: false, error: verification.error || "Invalid OTP Code" }, { status: 400 });
            }
        }

        // OTP verified successfully, clear cache
        otpCache.delete("register_" + cleaned);

        const cleanSlug = slug.toLowerCase().trim();

        // 2. Check if slug exists in Prisma (Railway PostgreSQL)
        const { prisma } = await import("@/lib/prisma");
        const existingInPrisma = await prisma.tenant.findUnique({
            where: { slug: cleanSlug }
        }).catch(() => null);

        if (existingInPrisma) {
            return NextResponse.json({ success: false, error: "This subdomain slug is already taken. Please choose another." }, { status: 409 });
        }

        const tenantId = crypto.randomUUID();
        const tenantEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

        // Extract default country code from contactPhone (e.g. +61 or +91)
        const countryCodeMatch = contactPhone.match(/^\+\d+/);
        const derivedCountryCode = countryCodeMatch ? countryCodeMatch[0] : "+91";

        const bankDetails = {
            contactName,
            contactPhone,
            totalHostelars,
            defaultCountryCode: derivedCountryCode
        };

        // 3. Deploy Tenant in Railway PostgreSQL (Prisma)
        try {
            await prisma.tenant.create({
                data: {
                    id: tenantId,
                    name,
                    slug: cleanSlug,
                    adminEmail,
                    subscriptionStatus: 'trial',
                    primaryColor: '#3b82f6',
                    isActive: true,
                    subscriptionEndDate: tenantEndDate
                }
            });

            await prisma.adminSettings.create({
                data: {
                    tenantId: tenantId,
                    universityBankDetails: bankDetails as any
                }
            });
        } catch (pErr) {
            console.warn("Prisma public deploy note:", pErr);
        }

        // 4. Dual-sync to Supabase if connected
        try {
            const supabase = getSupabaseAdmin();
            await supabase
                .from('tenants')
                .insert({
                    id: tenantId,
                    name,
                    slug: cleanSlug,
                    admin_email: adminEmail,
                    subscription_status: 'trial',
                    primary_color: '#3b82f6',
                    is_active: true,
                    subscription_end_date: tenantEndDate.toISOString(),
                });

            await supabase.from('admin_settings').insert({
                tenant_id: tenantId,
                university_bank_details: bankDetails
            });
        } catch (sErr) {}

        // 5. Return success and default credentials
        return NextResponse.json({
            success: true,
            tenant: {
                _id: tenantId,
                name: name,
                slug: cleanSlug,
                adminEmail: adminEmail,
                defaultAdminPass: "pankajdwivedi81", // The system's global default auth
                defaultDevPass: "Pankaj852963"
            }
        });
    } catch (error: any) {
        console.error("Error in public verify-and-deploy:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
