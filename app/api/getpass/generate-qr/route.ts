import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import crypto from "crypto";

/**
 * GET /api/getpass/generate-qr
 * 
 * Called by the Gate Desktop screen every 10 seconds.
 * Generates a new rotating QR token and returns it.
 * The token is valid for 15 seconds (10s rotation + 5s buffer).
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const gateName = searchParams.get("gate") || "Main Gate";

        // Generate a cryptographically secure random token
        const token = crypto.randomBytes(32).toString("hex");
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15000); // 15 seconds validity (10s + 5s buffer)

        // Create the token in DB using adapter
        await db.gatePassTokens.create({
            token,
            gateName,
            createdAt: now,
            expiresAt: expiresAt,
        });

        // The QR code will encode this data
        const qrData = JSON.stringify({
            t: token, // token
            g: gateName, // gate name
            ts: now.getTime(), // timestamp
            app: "hostelease-getpass", // app identifier
        });

        return NextResponse.json({
            success: true,
            qrData,
            token,
            expiresAt: expiresAt.toISOString(),
            gateName,
            generatedAt: now.toISOString(),
        });
    } catch (error: any) {
        console.error("❌ Error generating QR token:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate QR token" },
            { status: 500 }
        );
    }
}

