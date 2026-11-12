export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { setAuthSessionCookie } from "@/lib/authSession";
import { activeQRSessions, createSuperAdminQRChallenge } from "@/lib/superAdminQRStore";

/**
 * GET /api/super-admin/auth/qr-login?challengeId=xxx
 * Desktop polls this every 1-2 seconds to see if phone has approved the QR code
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get("challengeId");

    if (!challengeId) {
        return NextResponse.json({ error: "Missing challengeId" }, { status: 400 });
    }

    const session = activeQRSessions.get(challengeId);

    if (!session) {
        return NextResponse.json({ status: "EXPIRED", error: "Session expired or not found" }, { status: 404 });
    }

    if (Date.now() > session.expiresAt) {
        session.status = "EXPIRED";
        activeQRSessions.delete(challengeId);
        return NextResponse.json({ status: "EXPIRED", error: "QR code expired" });
    }

    if (session.status === "APPROVED") {
        // Issue authenticated SuperAdmin session cookie to desktop
        const response = NextResponse.json({
            success: true,
            status: "APPROVED",
            message: "Login approved by Super Admin mobile device"
        });

        // Set secure HTTP-only session cookie
        setAuthSessionCookie(response, { role: "superadmin" });

        // Set UI convenience cookies
        response.cookies.set("userType", "superadmin", {
            path: "/",
            maxAge: 315360000,
            sameSite: "lax",
            httpOnly: false
        });

        response.cookies.set("tenant-expired", "false", {
            path: "/",
            maxAge: 315360000,
            sameSite: "lax",
            httpOnly: false
        });

        // Clean up once consumed
        activeQRSessions.delete(challengeId);
        return response;
    }

    return NextResponse.json({
        status: session.status,
        expiresIn: Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000))
    });
}

/**
 * POST /api/super-admin/auth/qr-login
 * action: "create" (from Desktop) | "approve" (from Mobile Phone)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        // 1. DESKTOP: Create new dynamic QR code challenge (e.g. reload after expiry)
        if (action === "create") {
            const userAgent = request.headers.get("user-agent") || "";
            const forwardedFor = request.headers.get("x-forwarded-for") || "";
            const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "Internal";

            const challenge = createSuperAdminQRChallenge({ userAgent, ip });

            return NextResponse.json({
                success: true,
                ...challenge
            });
        }

        // 2. MOBILE: Approve desktop QR code
        if (action === "approve") {
            const { challengeId, token } = body;

            if (!challengeId || !token) {
                return NextResponse.json({ error: "Invalid QR code payload" }, { status: 400 });
            }

            const session = activeQRSessions.get(challengeId);

            if (!session) {
                return NextResponse.json({ error: "This QR code has expired or is invalid. Please scan a fresh QR code." }, { status: 404 });
            }

            if (Date.now() > session.expiresAt) {
                session.status = "EXPIRED";
                activeQRSessions.delete(challengeId);
                return NextResponse.json({ error: "QR code has expired. Please refresh the QR code on your computer." }, { status: 410 });
            }

            if (session.token !== token) {
                return NextResponse.json({ error: "Security signature mismatch. Rejected." }, { status: 403 });
            }

            // Mark session approved
            session.status = "APPROVED";
            session.approvedBy = "SuperAdminMobileScanner";

            console.log(`✅ [SUPERADMIN_QR_AUTH] Desktop login session ${challengeId} approved successfully from mobile device.`);

            return NextResponse.json({
                success: true,
                status: "APPROVED",
                message: "Desktop Super Admin login approved successfully!"
            });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err: any) {
        console.error("QR Auth Error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
