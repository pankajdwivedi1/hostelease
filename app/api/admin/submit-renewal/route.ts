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
        const supabase = getSupabaseAdmin();

        // 1. Fetch current settings for the tenant
        const { data: settings, error: selectError } = await supabase
            .from('admin_settings')
            .select('*')
            .eq('tenant_id', tenant._id)
            .maybeSingle();

        if (selectError) {
            console.error("Error retrieving admin settings:", selectError);
            return NextResponse.json({ success: false, error: "Failed to retrieve university settings." }, { status: 500 });
        }

        const now = new Date().toISOString();

        if (!settings) {
            // Create a new settings record if missing
            const { error: insertError } = await supabase
                .from('admin_settings')
                .insert({
                    tenant_id: tenant._id,
                    university_bank_details: {
                        renewalUtr: cleanUtr,
                        renewalStatus: 'pending',
                        renewalSubmittedAt: now
                    }
                });

            if (insertError) {
                console.error("Error creating admin settings:", insertError);
                return NextResponse.json({ success: false, error: "Failed to save payment details." }, { status: 500 });
            }
        } else {
            // Update existing settings record
            const bankDetails = settings.university_bank_details || {};
            bankDetails.renewalUtr = cleanUtr;
            bankDetails.renewalStatus = 'pending';
            bankDetails.renewalSubmittedAt = now;

            const { error: updateError } = await supabase
                .from('admin_settings')
                .update({ university_bank_details: bankDetails, updated_at: now })
                .eq('_id', settings._id);

            if (updateError) {
                console.error("Error updating admin settings:", updateError);
                return NextResponse.json({ success: false, error: "Failed to update payment details." }, { status: 500 });
            }
        }

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
