
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

        const instConfig = settings?.universityBankDetails || settings?.university_bank_details || {};

        return NextResponse.json({
            success: true,
            tenant: {
                name: tenant.name || "Oriental Group of Institutes (OGI)",
                logo: tenant.logoUrl || tenant.logo || "",
                primaryColor: tenant.primaryColor || tenant.primary_color || "#3b82f6",
                secondaryColor: tenant.secondaryColor || tenant.secondary_color || "#1e40af",
                slug: tenant.slug || "ogi",
                address: instConfig.address || tenant.address || "Oriental Campus, Raisen Road, Bhopal, MP - 462021",
                email: instConfig.email || tenant.email || tenant.adminEmail || tenant.admin_email || "info@oriental.ac.in",
                phone: instConfig.phone || tenant.phone || "+91 9981414729 / 0755-2529015",
                gstin: instConfig.gstin || tenant.gstin || "",
                contactName: instConfig.contactName || instConfig.coordinatorName || "Dr Pankaj Dwivedi",
                contactPhone: instConfig.contactPhone || instConfig.coordinatorPhone || "7974704918"
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
        const { name, logo, primaryColor, secondaryColor, address, email, phone, gstin, contactName, contactPhone } = body;

        const tenantId = tenant._id || tenant.id;

        const prismaData: any = {};
        if (name) prismaData.name = name;
        if (logo !== undefined) prismaData.logoUrl = logo;
        if (primaryColor) prismaData.primaryColor = primaryColor;
        if (secondaryColor) prismaData.secondaryColor = secondaryColor;

        if (tenantId) {
            try {
                const { prisma } = await import("@/lib/prisma");
                await prisma.tenant.update({
                    where: { id: tenantId },
                    data: prismaData
                });
            } catch (pErr: any) {
                console.warn("Prisma tenant update notice:", pErr?.message);
            }

            // Also update Supabase tenants table
            try {
                const supabaseAdmin = getSupabaseAdmin();
                await supabaseAdmin.from('tenants').update({
                    name: name || tenant.name,
                    logo_url: logo !== undefined ? logo : (tenant.logoUrl || tenant.logo),
                    primary_color: primaryColor || tenant.primaryColor,
                    secondary_color: secondaryColor || tenant.secondaryColor
                }).eq('id', tenantId);
            } catch (sErr: any) {
                console.warn("Supabase tenant update notice:", sErr?.message);
            }
        }

        // Save detailed institution info into existing universityBankDetails column of admin_settings
        const existingSettings = await db.settings.get();
        const existingBank = existingSettings?.universityBankDetails || existingSettings?.university_bank_details || {};
        const updatedBankDetails = {
            ...existingBank,
            address: address !== undefined ? address : (existingBank.address || ""),
            email: email !== undefined ? email : (existingBank.email || ""),
            phone: phone !== undefined ? phone : (existingBank.phone || ""),
            gstin: gstin !== undefined ? gstin : (existingBank.gstin || ""),
            contactName: contactName !== undefined ? contactName : (existingBank.contactName || ""),
            contactPhone: contactPhone !== undefined ? contactPhone : (existingBank.contactPhone || "")
        };

        await db.settings.update({
            universityBankDetails: updatedBankDetails,
            university_bank_details: updatedBankDetails
        });

        return NextResponse.json({ success: true, message: "Tenant configuration updated successfully" });
    } catch (error: any) {
        console.error("Error updating tenant config:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
