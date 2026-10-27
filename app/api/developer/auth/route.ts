export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { setAuthSessionCookie } from "@/lib/authSession";

const resolveConfiguredPassword = (value: string | undefined, envKey: string) => {
    const envValue = (process.env[envKey] || "").trim();
    if (envValue) return envValue;
    return (value || "").trim();
};

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        let allowedPassword = "";
        try {
            const settings = await db.settings.get();
            allowedPassword = resolveConfiguredPassword(settings?.developerPassword, "DEVELOPER_LOGIN_PASSWORD");
        } catch (dbError) {
            console.warn("Could not fetch tenant settings; using environment configuration only.");
        }

        if (!allowedPassword) {
            return NextResponse.json(
                { error: "Developer authentication is not configured. Set DEVELOPER_LOGIN_PASSWORD in the environment." },
                { status: 503 }
            );
        }

        if (password === allowedPassword) {
            const response = NextResponse.json({ success: true });
            setAuthSessionCookie(response, { role: "superadmin" });
            return response;
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
