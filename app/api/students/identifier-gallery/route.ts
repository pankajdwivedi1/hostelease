import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/identifier-gallery
 * 
 * Returns lightweight biometric face descriptors and identification metadata
 * for all registered students for instant 1:N offline-capable facial recognition.
 */
export async function GET(request: NextRequest) {
  try {
    let tenantId: string | null = null;
    try {
      tenantId = await db.getTenantIdOrThrow();
    } catch (_) {}

    const students = await prisma.student.findMany({
      where: {
        ...(tenantId ? { tenantId } : {})
      },
      select: {
        id: true,
        name: true,
        registrationId: true,
        erpId: true,
        erpInformation: true,
        hostelName: true,
        roomNumber: true,
        profilePicture: true,
        studentStatus: true,
        fatherNumber: true,
        motherNumber: true,
        collegeName: true,
        branch: true,
        year: true,
        semester: true,
        dynamicFields: true,
        faceDescriptor: true
      }
    });

    // Map to clean client model
    const gallery = students.map((s) => {
      const dynamicFields: any = typeof s.dynamicFields === "object" ? s.dynamicFields : {};
      return {
        id: s.id,
        name: s.name,
        registrationId: s.registrationId || "",
        erpId: s.erpId || s.erpInformation || "",
        hostelName: s.hostelName || "",
        roomNumber: s.roomNumber || "",
        profilePicture: s.profilePicture || null,
        studentStatus: s.studentStatus || "in",
        outingType: dynamicFields?.outingType || "outing",
        leaveTo: dynamicFields?.leaveTo || null,
        fatherNumber: s.fatherNumber || "",
        motherNumber: s.motherNumber || "",
        collegeName: s.collegeName || "",
        branch: s.branch || "",
        year: s.year || "",
        semester: s.semester || "",
        faceDescriptor: s.faceDescriptor
      };
    });

    return NextResponse.json({
      success: true,
      count: gallery.length,
      students: gallery
    });
  } catch (error: any) {
    console.error("❌ Failed to fetch identifier biometric gallery:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load biometric gallery" },
      { status: 500 }
    );
  }
}
