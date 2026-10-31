import { NextRequest, NextResponse } from "next/server";
import { setAuthSessionCookie } from "@/lib/authSession";
import { verifyFaceAndLivenessServer } from "@/lib/serverAntiSpoof";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * 🛡️ SUPERADMIN BIOMETRIC FACE LOGIN (ANY DEVICE)
 * 
 * Allows Dr. Pankaj Dwivedi to unlock "Hosteleaze Boss Control" from ANY device (mobile, desktop, tablet)
 * by verifying live physical liveness (MiniFASNetV2 ONNX Runtime) and 128-D Euclidean distance matching
 * against the registered SuperAdmin face descriptor.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, descriptor, box } = body;

    if (!image || typeof image !== "string" || image.length < 50) {
      return NextResponse.json({
        success: false,
        error: "Valid face camera image data is required"
      }, { status: 400 });
    }

    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({
        success: false,
        error: "128-D biometric face vector is required"
      }, { status: 400 });
    }

    // 1. Fetch registered SuperAdmin Face Descriptor from PlatformSetting
    const authRecord = await prisma.platformSetting.findUnique({
      where: { id: "boss_superadmin_auth" }
    });
    const authSettings = (authRecord?.settings as any) || {};

    if (!Array.isArray(authSettings.faceDescriptor) || authSettings.faceDescriptor.length !== 128) {
      return NextResponse.json({
        success: false,
        error: "Boss Face ID has not been enrolled yet. Please log in on your authorized desktop to enroll your face."
      }, { status: 400 });
    }

    // 2. Perform Server-Side Presentation Attack Detection (PAD) & 1:1 Vector Match
    const verification = await verifyFaceAndLivenessServer({
      liveImage: image,
      clientDescriptor: descriptor,
      registeredDescriptor: authSettings.faceDescriptor,
      box: box && typeof box === "object" ? box : undefined
    });

    // 3. Reject Spoofs (Screens, Paper photos, Video replays)
    if (verification.isSpoof) {
      console.warn(`🛑 [Boss Face Login] Spoof rejected: ${verification.reason} (Liveness: ${verification.livenessScore}%)`);
      return NextResponse.json({
        success: false,
        error: verification.reason || "Fraud Prevented: Screen or photo spoof detected! Please present your real physical face."
      }, { status: 400 });
    }

    // 4. Reject Biometric Mismatch
    if (!verification.isMatch) {
      console.warn(`🛑 [Boss Face Login] Biometric mismatch: MatchScore=${verification.matchScore}%, Distance=${verification.distance?.toFixed(3)}`);
      return NextResponse.json({
        success: false,
        error: `Biometric Mismatch (Confidence: ${verification.matchScore}%). Face does not match Dr. Pankaj Dwivedi.`
      }, { status: 401 });
    }

    // 5. Authorized Entry Granted!
    console.log(`✅ [Boss Face Login] SuperAdmin Biometrics Verified! (Match: ${verification.matchScore}%, Liveness: ${verification.livenessScore}%)`);
    const response = NextResponse.json({
      success: true,
      message: "Welcome, Boss. Biometrics verified.",
      matchScore: verification.matchScore,
      livenessScore: verification.livenessScore
    });

    setAuthSessionCookie(response, { role: "superadmin" });
    return response;

  } catch (error: any) {
    console.error("❌ SuperAdmin Face Login Error:", error);
    return NextResponse.json({
      success: false,
      error: "Biometric authentication failed. Please try again."
    }, { status: 500 });
  }
}
