export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getTenantConfig, getSubscriptionStatus } from "@/lib/tenant";
import { db } from "@/lib/dbAdapter";

/**
 * GET /api/bootstrap
 * 
 * Unified application bootstrap endpoint.
 * Returns tenant branding, subscription status, and core admin settings
 * in a single coalesced round-trip instead of 4 separate calls.
 */
export async function GET(request: NextRequest) {
    try {
        const [config, subscription, settings] = await Promise.all([
            getTenantConfig().catch(() => ({
                name: "Hosteleaze",
                logo: null,
                primaryColor: "#3b82f6",
                secondaryColor: "#1e40af",
                defaultCountryCode: "+91",
            })),
            getSubscriptionStatus().catch(() => ({
                isExpired: false,
                daysRemaining: 30,
                status: "active",
            })),
            db.settings.get().catch(() => null),
        ]);

        return NextResponse.json(
            {
                success: true,
                tenant: config,
                subscription,
                settings: {
                    startTime: settings?.attendanceStartTime || "21:00",
                    endTime: settings?.attendanceEndTime || "22:30",
                    locations: settings?.hostelLocations || [],
                    overlapRadius: settings?.overlapRadius || false,
                    prioritizeAssignedHostel: settings?.prioritizeAssignedHostel || false,
                    wifiWhitelist: settings?.wifiWhitelist || [],
                    isPaymentEnabled: settings?.isPaymentEnabled || false,
                    hostelFeeAmount: settings?.hostelFeeAmount || 0,
                    universityBankDetails: settings?.universityBankDetails || {},
                    paymentInstructions: settings?.paymentInstructions || "",
                    leaveApprovalMethod: settings?.leaveApprovalMethod || "app",
                    registrationFieldsConfig: settings?.registrationFieldsConfig || {},
                    formBuilderConfig: settings?.formBuilderConfig || [],
                },
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
                },
            }
        );
    } catch (error: any) {
        console.error("❌ Error in /api/bootstrap:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Bootstrap failed" },
            { status: 500 }
        );
    }
}
