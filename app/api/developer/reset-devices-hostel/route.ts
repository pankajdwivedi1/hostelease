import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const { hostelName, password } = await request.json();

        // Security Check - Use the developer password
        const DEVELOPER_PASSWORD = "pankaj852";
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
        const { db } = await import("@/lib/dbAdapter");
        const source = await db.getSource();

        let fieldsToReset: any;
        if (source === 'SUPABASE') {
            fieldsToReset = {
                device_id: null,
                face_descriptor: null,
                thumb_impression_id: null,
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

        const { count } = await db.students.bulkUpdate({ hostelName }, fieldsToReset);

        return NextResponse.json({
            success: true,
            message: `Successfully reset devices for ${count} students in ${hostelName}.`,
            count
        });

    } catch (error: any) {
        console.error("Bulk Reset API Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
