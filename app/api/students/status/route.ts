export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, status, deviceId } = body;

    if (!studentId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ============================================================
    // 🔒 RULE 1: Setting status to "out" via this endpoint is FORBIDDEN.
    // Going outside MUST happen through QR gate scan or gatekeeper
    // manual entry only. This endpoint is only for confirming "in".
    // ============================================================
    if (status === "out") {
      return NextResponse.json(
        {
          error: "⛔ Invalid operation. Students must scan the gate QR code or use the gatekeeper entry to mark exit. Direct status update to 'out' is not allowed.",
          code: "DIRECT_OUT_FORBIDDEN",
        },
        { status: 403 }
      );
    }

    if (!["in", "out"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'in' or 'out'" },
        { status: 400 }
      );
    }

    const studentRecord = await db.students.getById(studentId, true);
    if (!studentRecord) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Verify deviceId if bound (ignoring 'no-binding' placeholder)
    const recordDeviceId = studentRecord.deviceId?.trim();
    if (recordDeviceId && recordDeviceId !== "no-binding" && recordDeviceId !== deviceId) {
      return NextResponse.json(
        { error: "This device is not registered for this student." },
        { status: 403 }
      );
    }

    // ============================================================
    // 🔒 RULE 2: Cannot mark "in" via this endpoint if an open gate
    // pass exists. The student must scan the return QR at the gate.
    // This prevents the device-reset bypass bug where a student who
    // went outside gets flipped back to "in" on re-login without
    // physically returning through the gate.
    // ============================================================
    if (status === "in") {
      try {
        const openPassResult = await db.gatePasses.list(
          { studentId: studentId, status: "out" },
          { limit: 1 }
        );
        const openPasses = openPassResult?.records || openPassResult || [];
        if (Array.isArray(openPasses) && openPasses.length > 0) {
          console.warn(
            `🚫 [STATUS_BLOCK] Blocked "in" update for student ${studentRecord.name} — active gate pass found. Must scan return QR.`
          );
          return NextResponse.json(
            {
              error: "⛔ You have an active gate pass. Please scan the return QR code at the gate to mark your return. Contact your warden if you need help.",
              code: "OPEN_GATEPASS_EXISTS",
            },
            { status: 409 }
          );
        }
      } catch (passCheckErr) {
        // Non-blocking: if gate pass check fails, log and continue
        // to avoid locking out students due to a DB query failure
        console.warn("⚠️ Gate pass check failed (non-critical, continuing):", passCheckErr);
      }
    }

    const updatedStudent = await db.students.update(studentId, { studentStatus: status });

    if (!updatedStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // ============================================================
    // 📋 AUDIT LOG: Record every status change with IP and timestamp
    // ============================================================
    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

      console.log(
        `📋 [STATUS_AUDIT] Student: ${studentRecord.name} (${studentId}) | ` +
        `Status: ${studentRecord.studentStatus || "unknown"} → ${status} | ` +
        `Device: ${deviceId?.slice(0, 8) || "none"}... | IP: ${ip} | ` +
        `Time: ${new Date().toISOString()}`
      );
    } catch (auditErr) {
      // Audit logging is non-critical — never block the main flow
      console.warn("⚠️ Audit log failed (non-critical):", auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        student: updatedStudent,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating student status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update student status" },
      { status: 500 }
    );
  }
}
