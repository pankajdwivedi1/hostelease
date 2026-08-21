export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
    try {
        const tenant = await getTenantFromRequest();
        if (!tenant) {
            return NextResponse.json({ success: false, error: "Unauthorized college node" }, { status: 401 });
        }

        const body = await request.json();
        const { utr } = body;

        if (!utr || typeof utr !== "string" || utr.trim().length < 6 || utr.trim().length > 25) {
            return NextResponse.json({ success: false, error: "Invalid UTR / Transaction Reference. Must be between 6 and 25 characters." }, { status: 400 });
        }

        const cleanUtr = utr.trim();
        const { default: db } = await import("@/lib/dbAdapter");

        const existingSettings = await db.settings.get();
        const bankDetails = existingSettings?.universityBankDetails || {};
        const now = new Date().toISOString();

        bankDetails.renewalUtr = cleanUtr;
        bankDetails.renewalStatus = 'pending';
        bankDetails.renewalSubmittedAt = now;

        await db.settings.update({
            universityBankDetails: bankDetails
        });

        return NextResponse.json({
            success: true,
            message: "Subscription renewal request submitted successfully.",
            renewalUtr: cleanUtr,
            renewalStatus: 'pending',
            renewalSubmittedAt: now
        });

    } catch (error: any) {
        console.error("Submit renewal exception:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
