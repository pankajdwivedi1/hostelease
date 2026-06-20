export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

// Master developer password (universal fallback)
const MASTER_DEVELOPER_PASSWORD = "Pankaj852963";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        // Try to fetch tenant-specific developer password
        let allowedPassword = MASTER_DEVELOPER_PASSWORD;
        try {
            const settings = await db.settings.get();
            if (settings?.developerPassword) {
                allowedPassword = settings.developerPassword;
            }
        } catch (dbError) {
            console.warn("Could not fetch tenant settings, falling back to master password");
        }

        if (password === allowedPassword || password === MASTER_DEVELOPER_PASSWORD) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { error: "Invalid password" },
                { status: 401 }
            );
        }
    } catch (error) {
        console.error("Developer authentication error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
