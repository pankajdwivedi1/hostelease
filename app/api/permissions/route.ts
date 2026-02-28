import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, fromDateTime, toDateTime, reason, requestType } = body;

    if (!studentId || !fromDateTime || !toDateTime || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate that toDateTime is after fromDateTime
    const fromDate = new Date(fromDateTime);
    const toDate = new Date(toDateTime);

    if (toDate <= fromDate) {
      return NextResponse.json(
        { error: "End date and time must be after start date and time" },
        { status: 400 }
      );
    }

    const student = await db.students.getById(studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const permission = await db.permissions.create({
      studentId,
      fromDateTime: new Date(fromDateTime),
      toDateTime: new Date(toDateTime),
      reason,
      requestType: requestType || "outing",
      status: "pending",
    });

    return NextResponse.json({ success: true, permission }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating permission:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create permission" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("studentId");
    const status = searchParams.get("status");

    const filters: any = {};
    if (studentId) {
      filters.studentId = studentId;
    }
    if (status && status !== "all") {
      filters.status = status;
    }

    const light = searchParams.get("light") === "true";
    // Adapter currently doesn't support field selection in list, but we can pass populate: true
    const { records: permissions } = await db.permissions.list(filters, { populate: true });

    return NextResponse.json({ permissions, success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error in GET /api/permissions:", error);
    return NextResponse.json(
      { permissions: [], success: false, error: error.message },
      { status: 200 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { permissionId, status, wardenStatus, deanStatus } = body;

    if (!permissionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const currentPermission = await db.permissions.getById(permissionId);
    if (!currentPermission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 });
    }

    let update: any = {};
    if (status) update.status = status;
    if (wardenStatus) update.wardenStatus = wardenStatus;
    if (deanStatus) update.deanStatus = deanStatus;

    // Logic for final status
    const finalWardenStatus = wardenStatus || currentPermission.wardenStatus;
    const finalDeanStatus = deanStatus || currentPermission.deanStatus;

    if (finalDeanStatus === "allowed" || (finalWardenStatus === "allowed" && finalDeanStatus === "allowed")) {
      update.status = "allowed";
    } else if (finalWardenStatus === "rejected" || finalDeanStatus === "rejected") {
      update.status = "rejected";
    } else {
      update.status = "pending";
    }

    const permission = await db.permissions.update(permissionId, update);

    // We need the student info for the status update below
    const populatedPermission = await db.permissions.getById(permissionId, { populate: true });

    if (!populatedPermission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 });
    }

    const finalStatus = populatedPermission.status;

    // If permission is allowed, set student studentStatus to "out"
    if (finalStatus === "allowed" && populatedPermission.studentId) {
      const studentId = typeof populatedPermission.studentId === "object"
        ? populatedPermission.studentId._id || populatedPermission.studentId.id
        : populatedPermission.studentId;

      await db.students.update(studentId, { studentStatus: "out" });
      console.log(`Student ${studentId} studentStatus updated to "out"`);
    }

    // If permission is rejected, set student studentStatus to "in" (they're back)
    if (finalStatus === "rejected" && populatedPermission.studentId) {
      const studentId = typeof populatedPermission.studentId === "object"
        ? populatedPermission.studentId._id || populatedPermission.studentId.id
        : populatedPermission.studentId;

      await db.students.update(studentId, { studentStatus: "in" });
    }

    return NextResponse.json({ success: true, permission: populatedPermission }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating permission:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update permission" },
      { status: 500 }
    );
  }
}
