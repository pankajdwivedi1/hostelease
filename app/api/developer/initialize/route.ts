export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!password || password.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        // Check if already setup
        const existingSettings = await db.settings.get();
        if (existingSettings?.developerPassword) {
            return NextResponse.json(
                { error: "Developer account is already initialized" },
                { status: 403 }
            );
        }

        // Initialize developer password
        await db.settings.update({ developerPassword: password });

        return NextResponse.json({ 
            success: true, 
            message: "Developer account initialized successfully" 
        });
    } catch (error: any) {
        console.error("Developer initialization error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
