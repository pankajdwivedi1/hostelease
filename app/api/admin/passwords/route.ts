import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AdminSettings from "@/models/AdminSettings";

export async function PATCH(request: NextRequest) {
    try {
        await connectDB();
        const body = await request.json();
        const { type, newPassword } = body;

        if (!type || !newPassword) {
            return NextResponse.json({ error: "Type and new password are required" }, { status: 400 });
        }

        const updateField = type === "dean" ? "adminPassword" : type === "warden" ? "wardenPassword" : null;

        if (!updateField) {
            return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
        }

        const result = await AdminSettings.findOneAndUpdate(
            {},
            { [updateField]: newPassword },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return NextResponse.json({ success: true, message: `Password for ${type} updated successfully` }, { status: 200 });
    } catch (error: any) {
        console.error("Error updating password:", error);
        return NextResponse.json({ error: error.message || "Failed to update password" }, { status: 500 });
    }
}
