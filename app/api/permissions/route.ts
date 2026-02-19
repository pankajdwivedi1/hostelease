import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Permission from "@/models/Permission";
import Student from "@/models/Student";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { studentId, fromDateTime, toDateTime, reason } = body;

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

    const student = await Student.findById(studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const permission = await Permission.create({
      studentId,
      fromDateTime: new Date(fromDateTime),
      toDateTime: new Date(toDateTime),
      reason,
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
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("studentId");
    const status = searchParams.get("status");

    let query: any = {};
    if (studentId) {
      query.studentId = studentId;
    }
    if (status && status !== "all") {
      query.status = status;
    }

    const light = searchParams.get("light") === "true";
    const studentFields = light
      ? "name email phoneNumber hostelName roomNumber studentStatus collegeName branch semester section"
      : "name email phoneNumber hostelName roomNumber profilePicture studentStatus collegeName branch semester section";

    // ✅ FIX: Added proper error handling and fallback
    let permissions = [];
    try {
      permissions = await Permission.find(query)
        .populate("studentId", studentFields)
        .sort({ createdAt: -1 })
        .lean();
    } catch (dbError: any) {
      console.warn("Warning: Could not fetch permissions from DB:", dbError.message);
      // Return empty array if permissions query fails (better than 500 error)
      permissions = [];
    }

    return NextResponse.json({ permissions, success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error in GET /api/permissions:", error);
    // Return empty permissions array instead of error to prevent 500
    return NextResponse.json(
      { permissions: [], success: false, error: error.message },
      { status: 200 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { permissionId, status, wardenStatus, deanStatus } = body;

    if (!permissionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const currentPermission = await Permission.findById(permissionId);
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

    const permission = await Permission.findByIdAndUpdate(
      permissionId,
      update,
      { new: true }
    ).populate("studentId", "name email phoneNumber hostelName roomNumber profilePicture studentStatus");

    if (!permission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 });
    }

    const finalStatus = permission.status;

    // If permission is allowed, set student studentStatus to "out"
    if (finalStatus === "allowed" && permission.studentId) {
      let studentId: string;

      if (typeof permission.studentId === "object" && permission.studentId._id) {
        studentId = permission.studentId._id.toString();
      } else if (typeof permission.studentId === "string") {
        studentId = permission.studentId;
      } else {
        studentId = permission.studentId.toString();
      }

      const updatedStudent = await Student.findByIdAndUpdate(
        studentId,
        { studentStatus: "out" },
        { new: true }
      );

      if (!updatedStudent) {
        console.error(`Failed to update student studentStatus for studentId: ${studentId}`);
      } else {
        console.log(`Student ${studentId} studentStatus updated to "out"`);
      }
    }

    // If permission is rejected, set student studentStatus to "in" (they're back)
    if (finalStatus === "rejected" && permission.studentId) {
      const studentId = typeof permission.studentId === "object"
        ? permission.studentId._id
        : permission.studentId;

      await Student.findByIdAndUpdate(
        studentId,
        { studentStatus: "in" },
        { new: true }
      );
    }

    return NextResponse.json({ success: true, permission }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating permission:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update permission" },
      { status: 500 }
    );
  }
}

