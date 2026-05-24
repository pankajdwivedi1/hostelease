import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { otp, phoneNumber, name, slug, adminEmail, contactName, contactPhone } = body;

        if (!otp || !phoneNumber || !name || !slug || !adminEmail) {
            return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
        }

        // 1. Verify OTP
        const cachedReqId = otpCache.get(phoneNumber);
        if (!cachedReqId) {
            return NextResponse.json({ success: false, error: "OTP request expired. Please resend." }, { status: 400 });
        }

        const verification = await verifyMSG91_WidgetOTP(phoneNumber, cachedReqId as string, otp);
        if (!verification.success) {
            return NextResponse.json({ success: false, error: verification.error || "Invalid OTP." }, { status: 400 });
        }

        // Clear the cache to prevent reuse
        otpCache.delete(phoneNumber);

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
        // Note: we are currently ignoring contactName and contactPhone for the DB insert, 
        // as the schema doesn't support them yet. They are used for verification/CRM.
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

        // 4. Return success and default credentials
        return NextResponse.json({
            success: true,
            tenant: {
                _id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                adminEmail: tenant.admin_email,
                defaultAdminPass: "pankajdwivedi81", // The system's global default auth
                defaultDevPass: "pankaj852"
            }
        });
    } catch (error: any) {
        console.error("Error in public verify-and-deploy:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
