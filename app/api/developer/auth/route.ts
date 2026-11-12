export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { createSuperAdminQRChallenge } from "@/lib/superAdminQRStore";

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
            // Password verified! Generate dynamic 2-Factor QR code challenge
            const userAgent = request.headers.get("user-agent") || "";
            const forwardedFor = request.headers.get("x-forwarded-for") || "";
            const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "Internal";

            const challenge = createSuperAdminQRChallenge({ userAgent, ip });

            console.log(`🔐 [SUPERADMIN_AUTH] Password verified. Generated QR challenge ${challenge.challengeId}`);

            return NextResponse.json({
                success: true,
                requiresQR: true,
                challengeId: challenge.challengeId,
                token: challenge.token,
                qrPayload: challenge.qrPayload,
                expiresInSeconds: challenge.expiresInSeconds
            });
        } else {
            return NextResponse.json(
                { error: "Invalid password" },
                { status: 401 }
            );
        }
    } catch (error: any) {
        console.error("Developer authentication error:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
}
