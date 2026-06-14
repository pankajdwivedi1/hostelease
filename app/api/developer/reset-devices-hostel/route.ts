import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { hostelName, password } = body;

        // Security Check - Use the developer password
        const DEVELOPER_PASSWORD = "Pankaj852963";
        if (password !== DEVELOPER_PASSWORD) {
            return NextResponse.json(
                { error: "Unauthorized: Invalid developer password" },
                { status: 401 }
            );
        }

        if (!hostelName) {
            return NextResponse.json(
                { error: "Hostel name is required" },
                { status: 400 }
            );
        }

        // Perform Bulk Reset using the Database Adapter (Mongo/Supabase)
        const source = await db.getSource();
        console.log(`⚡ Developer Bulk Reset triggered for [${hostelName}] on [${source}]`);

        let fieldsToReset: any;
        if (source === 'SUPABASE') {
            fieldsToReset = {
                device_id: null,
                face_descriptor: null,
                web_authn_credentials: null,
                is_profile_locked: false
            };
        } else {
            fieldsToReset = {
                deviceId: "",
                faceDescriptor: null,
                webAuthnCredentials: [],
                isProfileLocked: false
            };
        }

        const result = await db.students.bulkUpdate({ hostelName }, fieldsToReset);
        const count = result?.count || 0;

        const response = NextResponse.json({
            success: true,
            message: `Successfully reset devices for ${count} students in ${hostelName}.`,
            count
        });

        // 🔓 BULK RESET: Clear the trusted_device_owner cookie on the requesting browser too
        // (in case admin accidentally ran reset from a student browser).
        // The real fix is in webauthn/register which now bypasses stale cookies for reset students.
        response.cookies.set('trusted_device_owner', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/'
        });

        return response;

    } catch (error: any) {
        console.error("Bulk Reset API Error:", error);
        return NextResponse.json(
            { error: "Internal server error: " + (error.message || "Unknown error") },
            { status: 500 }
        );
    }
}
