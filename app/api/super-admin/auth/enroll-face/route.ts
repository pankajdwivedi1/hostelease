import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authSession";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * 🛡️ SUPERADMIN FACE ENROLLMENT ENDPOINT
 * 
 * Saves Dr. Pankaj Dwivedi's 128-D biometric vector into PlatformSetting (`boss_superadmin_auth`).
 */
export async function POST(req: NextRequest) {
  try {
    const session = getAuthSession(req);
    const body = await req.json();
    const { descriptor, photoUrl } = body;

    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({
        success: false,
        error: "Valid 128-D biometric face vector is required"
      }, { status: 400 });
    }

    // Check existing auth setting
    const authRecord = await prisma.platformSetting.findUnique({
      where: { id: "boss_superadmin_auth" }
    });
    const authSettings = (authRecord?.settings as any) || {};

    // If already enrolled, require superadmin session to update it
    if (Array.isArray(authSettings.faceDescriptor) && authSettings.faceDescriptor.length === 128) {
      if (session?.role !== "superadmin") {
        return NextResponse.json({
          success: false,
          error: "Unauthorized. SuperAdmin session required to update Face ID."
        }, { status: 403 });
      }
    }

    authSettings.faceDescriptor = descriptor;
    authSettings.enrolledAt = new Date().toISOString();
    if (photoUrl && typeof photoUrl === "string") {
      authSettings.photoUrl = photoUrl;
    }

    await prisma.platformSetting.upsert({
      where: { id: "boss_superadmin_auth" },
      update: { settings: authSettings },
      create: { id: "boss_superadmin_auth", settings: authSettings }
    });

    console.log("✅ [SuperAdmin] Boss Face ID successfully enrolled!");
    return NextResponse.json({
      success: true,
      message: "Boss Face ID successfully enrolled and active on all devices!"
    });

  } catch (error: any) {
    console.error("❌ SuperAdmin Face Enrollment Error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to enroll Face ID."
    }, { status: 500 });
  }
}
