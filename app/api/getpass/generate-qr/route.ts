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

        const now = new Date();
        const timestamp = now.getTime();

        // Use a secret key to sign the token (In production, use process.env.GATEPASS_SECRET)
        const secret = "hostelease_secure_gate_key_2026";

        // Create a signature that includes gate name and timestamp
        const dataToSign = `${gateName}:${timestamp}`;
        const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

        // The token is now a combination of timestamp and signature
        const signedToken = `${timestamp}.${signature}`;
        const expiresAt = new Date(timestamp + 25000); // 15s rotation + 10s network buffer

        // The QR code will encode this data
        const qrData = JSON.stringify({
            t: signedToken, // signed token
            g: gateName,    // gate name
            ts: timestamp,  // timestamp
            app: "hostelease-getpass",
        });

        return NextResponse.json({
            success: true,
            qrData,
            token: signedToken,
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

