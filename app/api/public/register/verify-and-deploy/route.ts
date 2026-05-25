import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, slug, adminEmail, contactName, contactPhone, accessToken } = body;

        if (!name || !slug || !adminEmail || !contactName || !contactPhone || !accessToken) {
            return NextResponse.json({ success: false, error: "Missing required fields or access token." }, { status: 400 });
        }

        const authKey = process.env.MSG91_AUTH_KEY || "519254ATbuLFy7MglO6a11a1dcP1";

        // Verify the MSG91 access token
        const verifyResponse = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                authkey: authKey,
                "access-token": accessToken
            })
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.type !== "success") {
            return NextResponse.json({ success: false, error: "OTP Token Verification Failed: " + (verifyData.message || "Invalid Token") }, { status: 400 });
        }

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
