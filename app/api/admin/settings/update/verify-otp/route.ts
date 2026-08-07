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
        const { data: existingSettings } = await db.supabase
            .from('admin_settings')
            .select('id, _id, university_bank_details')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        const bankDetails = (existingSettings?.university_bank_details && typeof existingSettings.university_bank_details === 'object') 
            ? { ...existingSettings.university_bank_details } 
            : {};
        
        // Update fields
        if (contactName !== undefined && contactName !== null) bankDetails.contactName = String(contactName).trim();
        if (contactPhone !== undefined && contactPhone !== null) bankDetails.contactPhone = String(contactPhone).trim();
        if (totalHostelars !== undefined && totalHostelars !== null) bankDetails.totalHostelars = String(totalHostelars).trim();

        const updatePayload: any = {
            tenant_id: tenantId,
            university_bank_details: bankDetails,
            ...(leaveApprovalMethod ? { leave_approval_method: leaveApprovalMethod } : {})
        };

        if (existingSettings) {
            const { error } = await db.supabase
                .from('admin_settings')
                .update(updatePayload)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        } else {
            const { error } = await db.supabase
                .from('admin_settings')
                .insert([updatePayload]);
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
