export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { getAuthSession, isPrivilegedSession, isSuperAdminSession, unauthorizedJson } from "@/lib/authSession";

export async function PATCH(request: NextRequest) {
    try {
        const session = getAuthSession(request);
        if (!isPrivilegedSession(session)) {
            return unauthorizedJson("Administrator access required", 403);
        }

        const body = await request.json();
        const { type, newPassword, deanPhone, superAdminPhone } = body;

        if (!type || (!newPassword && !deanPhone && !superAdminPhone)) {
            return NextResponse.json({ error: "Type and credentials are required" }, { status: 400 });
        }

        // Only superadmin may change developer/superadmin credentials
        if ((type === "superadmin" || type === "developer") && !isSuperAdminSession(request)) {
            return unauthorizedJson("Super admin access required", 403);
        }

        const updateData: any = {};

        if (newPassword) {
            const updateField =
                type === "dean" ? "adminPassword" :
                    type === "warden" ? "wardenPassword" :
                        type === "getpass" ? "getpassPassword" :
                            (type === "superadmin" || type === "developer") ? "developerPassword" :
                                null;

            if (!updateField) {
                return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
            }
            updateData[updateField] = newPassword;
        }

        if (type === "dean" && deanPhone !== undefined) {
            let cleanPhone = deanPhone.replace(/\D/g, "");
            if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
            updateData.deanPhone = cleanPhone;

            const currentSettings = await db.settings.get();
            const bankDetails = (currentSettings?.universityBankDetails as any) || {};
            updateData.universityBankDetails = {
                ...bankDetails,
                deanPhone: cleanPhone
            };
        }

        if ((type === "superadmin" || type === "developer") && superAdminPhone !== undefined) {
            let cleanPhone = superAdminPhone.replace(/\D/g, "");
            if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
            updateData.superAdminPhone = cleanPhone;

            const currentSettings = await db.settings.get();
            const bankDetails = (currentSettings?.universityBankDetails as any) || {};
            updateData.universityBankDetails = {
                ...bankDetails,
                superAdminPhone: cleanPhone
            };
        }

        await db.settings.update(updateData);

        return NextResponse.json({ success: true, message: `Credentials for ${type} updated successfully` }, { status: 200 });
    } catch (error: any) {
        console.error("Error updating password:", error);
        return NextResponse.json({ error: error.message || "Failed to update password" }, { status: 500 });
    }
}
