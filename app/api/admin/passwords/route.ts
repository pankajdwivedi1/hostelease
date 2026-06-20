export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, newPassword } = body;

        if (!type || !newPassword) {
            return NextResponse.json({ error: "Type and new password are required" }, { status: 400 });
        }

        const updateField =
            type === "dean" ? "adminPassword" :
                type === "warden" ? "wardenPassword" :
                    type === "getpass" ? "getpassPassword" :
                        null;

        if (!updateField) {
            return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
        }

        await db.settings.update({ [updateField]: newPassword });

        return NextResponse.json({ success: true, message: `Password for ${type} updated successfully` }, { status: 200 });
    } catch (error: any) {
        console.error("Error updating password:", error);
        return NextResponse.json({ error: error.message || "Failed to update password" }, { status: 500 });
    }
}
