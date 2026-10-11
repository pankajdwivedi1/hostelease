import { NextRequest, NextResponse } from "next/server";
import { verifyFaceAndLivenessServer } from "@/lib/serverAntiSpoof";

export const dynamic = "force-dynamic";

/**
 * 🛡️ Real-Time Live Biometric & Anti-Spoofing Verification API
 * 
 * Runs in-process MiniFASNetV2 ONNX Neural Model + Multi-Factor Presentation Attack Detection (PAD).
 * Directly detects and rejects:
 * - Mobile phone / tablet screens held up
 * - Video replays
 * - Printed photos & paper cutouts
 * - Specular glass glare reflection hotspots
 * - High-frequency digital screen Moiré lattice grid patterns
 * - Device casings and phone bezels
 * 
 * Execution time: < 15ms in Node.js RAM (Zero cold-start)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { image, box, descriptor } = body;

        if (!image || typeof image !== "string" || image.length < 50) {
            return NextResponse.json({ 
                success: false, 
                isSpoof: false, 
                isLive: false, 
                error: "Valid camera image data is required" 
            }, { status: 400 });
        }

        const verification = await verifyFaceAndLivenessServer({
            liveImage: image,
            clientDescriptor: Array.isArray(descriptor) ? descriptor : undefined,
            box: box && typeof box === "object" ? box : undefined
        });

        // 🛑 PRESENTATION ATTACK / MOBILE SCREEN SPOOF DETECTED
        if (verification.isSpoof) {
            console.warn(`🛑 [Live Liveness] Spoof Rejected: ${verification.reason} (Liveness: ${verification.livenessScore}%)`);
            return NextResponse.json({
                success: false,
                isLive: false,
                isSpoof: true,
                livenessScore: verification.livenessScore,
                reason: verification.reason,
                message: verification.reason || "Fraud Prevented: Mobile Phone Screen or Photo Spoof Detected! Please present your real physical face directly.",
                engine: verification.engine
            }, { status: 200 });
        }

        // ✅ GENUINE PHYSICAL LIVE HUMAN FACE
        console.log(`✅ [Live Liveness] Physical Human Face Verified (Liveness: ${verification.livenessScore}%)`);
        return NextResponse.json({
            success: true,
            isLive: true,
            isSpoof: false,
            livenessScore: verification.livenessScore,
            reason: verification.reason,
            engine: verification.engine
        }, { status: 200 });

    } catch (error: any) {
        console.error("❌ Live biometric verification error:", error);
        return NextResponse.json({
            success: false,
            isSpoof: false,
            isLive: false,
            error: error.message || "Failed to verify liveness with server neural model"
        }, { status: 500 });
    }
}
