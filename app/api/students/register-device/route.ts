import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const body = await request.json();
        const { studentId, deviceId } = body;

        if (!studentId || !deviceId) {
            return NextResponse.json(
                { error: "Missing studentId or deviceId" },
                { status: 400 }
            );
        }

        // Check if student already has a registered device
        const existingStudent = await Student.findById(studentId);

        if (!existingStudent) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        if (existingStudent.deviceId && existingStudent.deviceId.trim() !== "") {
            return NextResponse.json(
                { error: "Your device is already registered for this account. Please contact the administrator to reset your device link if you have a new phone." },
                { status: 403 }
            );
        }

        // Update student with deviceId
        const student = await Student.findByIdAndUpdate(
            studentId,
            { deviceId },
            { new: true }
        );

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        return NextResponse.json(
            {
                success: true,
                message: "Device registered successfully",
                student,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error registering device:", error);
        return NextResponse.json(
            { error: error.message || "Failed to register device" },
            { status: 500 }
        );
    }
}
