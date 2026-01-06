import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Permission from "@/models/Permission";
import Student from "@/models/Student";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { studentId, fromTime, toTime, reason, date } = body;

    if (!studentId || !fromTime || !toTime || !reason || !date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const permission = await Permission.create({
      studentId,
      fromTime,
      toTime,
      reason,
      date: new Date(date),
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

    const permissions = await Permission.find(query)
      .populate("studentId", "name email phoneNumber hostelName roomNumber profilePicture studentStatus")
      .sort({ createdAt: -1 });

    return NextResponse.json({ permissions }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { permissionId, status } = body;

    if (!permissionId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["pending", "allowed", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const permission = await Permission.findByIdAndUpdate(
      permissionId,
      { status },
      { new: true }
    ).populate("studentId", "name email phoneNumber hostelName roomNumber profilePicture studentStatus");

    if (!permission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 });
    }

    // If permission is allowed, set student studentStatus to "out"
    if (status === "allowed" && permission.studentId) {
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
    if (status === "rejected" && permission.studentId) {
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

