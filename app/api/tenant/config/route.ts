
import { NextRequest, NextResponse } from "next/server";
import { getTenantConfig } from "@/lib/tenant";

/**
 * Public endpoint to fetch branding and config for the current tenant.
 * Used by the login page to show university-specific branding.
 */
export async function GET(request: NextRequest) {
    try {
        const config = await getTenantConfig();
        return NextResponse.json({ success: true, ...config });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
