export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { verifyMSG91_WidgetOTP } from "@/lib/msg91";
import { otpCache } from "@/lib/otpCache";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { otp, contactName, contactPhone, totalHostelars, leaveApprovalMethod } = body;

        if (!otp || otp.length !== 6) {
            return NextResponse.json({ success: false, error: "A valid 6-digit OTP is required." }, { status: 400 });
        }

        const tenantId = await db.getTenantIdOrThrow();

        // 1. Verify OTP Cache
        const cacheKey = "settings_update_" + tenantId;
        const cachedData: any = otpCache.get(cacheKey);

        if (!cachedData) {
            return NextResponse.json({ success: false, error: "OTP expired or not requested. Please request a new OTP." }, { status: 400 });
        }

        if (Date.now() > cachedData.expires) {
            otpCache.delete(cacheKey);
            return NextResponse.json({ success: false, error: "OTP has expired. Please request a new OTP." }, { status: 400 });
        }

        // 2. Verify with MSG91
        const verification = await verifyMSG91_WidgetOTP(cachedData.phone, cachedData.reqId, otp);
        
        if (!verification.success) {
            return NextResponse.json({ success: false, error: verification.error || "Invalid OTP Code." }, { status: 400 });
        }

        // 3. Clear cache
        otpCache.delete(cacheKey);

        // 4. Update the Database
        const { data: settings } = await db.supabase
            .from('admin_settings')
            .select('_id, university_bank_details')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        const bankDetails = settings?.university_bank_details || {};
        
        // Update fields
        if (contactName !== undefined) bankDetails.contactName = contactName;
        if (contactPhone !== undefined) bankDetails.contactPhone = contactPhone;
        if (totalHostelars !== undefined) bankDetails.totalHostelars = totalHostelars;

        if (settings) {
            const { error } = await db.supabase
                .from('admin_settings')
                .update({ 
                    university_bank_details: bankDetails,
                    ...(leaveApprovalMethod ? { leave_approval_method: leaveApprovalMethod } : {})
                })
                .eq('_id', settings._id);
            if (error) throw error;
        } else {
            const { error } = await db.supabase
                .from('admin_settings')
                .insert({ 
                    tenant_id: tenantId, 
                    university_bank_details: bankDetails,
                    ...(leaveApprovalMethod ? { leave_approval_method: leaveApprovalMethod } : {})
                });
            if (error) throw error;
        }

        return NextResponse.json({
            success: true,
            message: "Settings updated successfully."
        });
    } catch (error: any) {
        console.error("Error verifying OTP and updating settings:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
