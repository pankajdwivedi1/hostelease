
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getTenantFromRequest } from "@/lib/tenant";
import { db } from "@/lib/dbAdapter";

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

        // Also fetch institution details from admin_settings
        let settings: any = null;
        try {
            settings = await db.settings.get();
        } catch (e) {}

        const instConfig = settings?.universityBankDetails || {};

        return NextResponse.json({
            success: true,
            tenant: {
                name: tenant.name,
                logo: tenant.logo,
                primaryColor: tenant.primaryColor,
                secondaryColor: tenant.secondaryColor,
                slug: tenant.slug,
                address: instConfig.address || tenant.address || "",
                email: instConfig.email || tenant.email || "",
                phone: instConfig.phone || tenant.phone || "",
                gstin: instConfig.gstin || tenant.gstin || ""
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
        const { name, logo, primaryColor, secondaryColor, address, email, phone, gstin } = body;

        const supabase = getSupabaseAdmin();
        const updateData: any = {};
        
        if (name) updateData.name = name;
        if (logo !== undefined) updateData.logo_url = logo;
        if (primaryColor) updateData.primary_color = primaryColor;
        if (secondaryColor) updateData.secondary_color = secondaryColor;

        if (tenant._id) {
            await supabase
                .from('tenants')
                .update(updateData)
                .eq('id', tenant._id);
        }

        // Save detailed institution info into existing universityBankDetails column of admin_settings
        const existingSettings = await db.settings.get();
        const updatedBankDetails = {
            ...(existingSettings?.universityBankDetails || {}),
            address: address !== undefined ? address : (existingSettings?.universityBankDetails?.address || ""),
            email: email !== undefined ? email : (existingSettings?.universityBankDetails?.email || ""),
            phone: phone !== undefined ? phone : (existingSettings?.universityBankDetails?.phone || ""),
            gstin: gstin !== undefined ? gstin : (existingSettings?.universityBankDetails?.gstin || "")
        };

        await db.settings.update({
            universityBankDetails: updatedBankDetails
        });

        return NextResponse.json({ success: true, message: "Tenant configuration updated successfully" });
    } catch (error: any) {
        console.error("Error updating tenant config:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
