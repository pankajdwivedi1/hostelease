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
        if (cleaned.length === 12 && cleaned.startsWith("91")) {
            cleaned = cleaned.substring(2);
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

        const supabase = getSupabaseAdmin();

        // 2. Check if slug exists
        const { data: existing } = await supabase
            .from('tenants')
            .select('id')
            .eq('slug', slug.toLowerCase().trim())
            .single();

        if (existing) {
            return NextResponse.json({ success: false, error: "This subdomain slug is already taken. Please choose another." }, { status: 409 });
        }

        // 3. Deploy the Tenant
        const { data: tenant, error } = await supabase
            .from('tenants')
            .insert({
                name,
                slug: slug.toLowerCase().trim(),
                admin_email: adminEmail,
                subscription_status: 'trial', // Force trial for public registration
                primary_color: '#3b82f6',
                is_active: true,
                subscription_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
            })
            .select()
            .single();

        if (error) throw error;

        // Store registration details in admin_settings to bypass tenants schema limitations
        // We use university_bank_details as it's an existing JSONB column
        const { error: settingsError } = await supabase.from('admin_settings').insert({
            tenant_id: tenant.id,
            university_bank_details: {
                contactName,
                contactPhone,
                totalHostelars
            }
        });

        if (settingsError) {
            console.error("Failed to store registration details:", settingsError);
            // We won't throw because the tenant was successfully created, but we log the error
        }

        // 4. Return success and default credentials
        return NextResponse.json({
            success: true,
            tenant: {
                _id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                adminEmail: tenant.admin_email,
                defaultAdminPass: "pankajdwivedi81", // The system's global default auth
                defaultDevPass: "Pankaj852963"
            }
        });
    } catch (error: any) {
        console.error("Error in public verify-and-deploy:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
