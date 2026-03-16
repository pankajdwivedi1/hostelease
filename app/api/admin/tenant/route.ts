
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getTenantFromRequest } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET - Fetch current tenant configuration for administration
 */
export async function GET(request: NextRequest) {
    try {
        const tenant = await getTenantFromRequest();
        if (!tenant) {
            return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            tenant: {
                name: tenant.name,
                logo: tenant.logo,
                primaryColor: tenant.primaryColor,
                secondaryColor: tenant.secondaryColor,
                slug: tenant.slug
            }
        });
    } catch (error: any) {
        console.error("Error fetching tenant config:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST - Update tenant configuration
 */
export async function POST(request: NextRequest) {
    try {
        const tenant = await getTenantFromRequest();
        if (!tenant) {
            return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }

        const body = await request.json();
        const { name, logo, primaryColor, secondaryColor } = body;

        const supabase = getSupabaseAdmin();
        const updateData: any = {};
        
        if (name) updateData.name = name;
        if (logo !== undefined) updateData.logo_url = logo;
        if (primaryColor) updateData.primary_color = primaryColor;
        if (secondaryColor) updateData.secondary_color = secondaryColor;

        const { error } = await supabase
            .from('tenants')
            .update(updateData)
            .eq('id', tenant._id);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, message: "Tenant configuration updated successfully" });
    } catch (error: any) {
        console.error("Error updating tenant config:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
