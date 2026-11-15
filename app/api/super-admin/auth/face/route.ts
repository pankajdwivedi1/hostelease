import { NextRequest, NextResponse } from "next/server";
import { setAuthSessionCookie } from "@/lib/authSession";
import { verifyFaceAndLivenessServer } from "@/lib/serverAntiSpoof";
import { extractFaceDescriptorServer } from "@/lib/serverBossFaceAuth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * 🛡️ SUPERADMIN BIOMETRIC FACE LOGIN (ANY DEVICE - 100% SERVER-SIDE)
 * 
 * Allows Dr. Pankaj Dwivedi to unlock "Hosteleaze Boss Control" from ANY device (mobile, desktop, tablet)
 * with ZERO client-side model downloads.
 * 
 * Processing on Railway Server:
 * 1. Server-side face landmark & 128-D vector extraction (face-api on Node.js canvas)
 * 2. In-process MiniFASNetV2 ONNX Runtime anti-spoofing (screen glare, moiré grid, casing border detection)
 * 3. Strict 1:1 Euclidean distance matching against registered SuperAdmin descriptor (>= 75% calibrated threshold)
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

    // 2. Resolve 128-D Biometric Vector & Bounding Box (100% Server-Side Extraction)
    let finalDescriptor = descriptor;
    let finalBox = box;

    if (!Array.isArray(finalDescriptor) || finalDescriptor.length !== 128) {
      const extraction = await extractFaceDescriptorServer(image);
      if (!extraction.success || !extraction.descriptor) {
        return NextResponse.json({
          success: false,
          error: extraction.error || "No clear face detected! Please face the camera directly with good lighting."
        }, { status: 400 });
      }
      finalDescriptor = extraction.descriptor;
      finalBox = extraction.box;
    }

    // 3. Perform Server-Side Presentation Attack Detection (PAD) & 1:1 Vector Match
    const verification = await verifyFaceAndLivenessServer({
      liveImage: image,
      clientDescriptor: finalDescriptor,
      referenceDescriptor: authSettings.faceDescriptor,
      box: finalBox && typeof finalBox === "object" ? finalBox : undefined
    });

    // 4. Reject Spoofs (Screens, Paper photos, Video replays)
    if (verification.isSpoof) {
      console.warn(`🛑 [Boss Face Login] Spoof rejected: ${verification.reason} (Liveness: ${verification.livenessScore}%)`);
      return NextResponse.json({
        success: false,
        error: verification.reason || "Fraud Prevented: Screen or photo spoof detected! Please present your real physical face."
      }, { status: 400 });
    }

    // 5. Reject Biometric Mismatch
    if (!verification.isMatch) {
      console.warn(`🛑 [Boss Face Login] Biometric mismatch: MatchScore=${verification.matchScore}%, Distance=${verification.distance?.toFixed(3)}`);
      return NextResponse.json({
        success: false,
        error: `Biometric Mismatch (Confidence: ${verification.matchScore}%). Face does not match Dr. Pankaj Dwivedi.`
      }, { status: 401 });
    }

    // 6. Authorized Entry Granted!
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
