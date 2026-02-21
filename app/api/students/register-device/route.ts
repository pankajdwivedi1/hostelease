import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { studentId, deviceId } = body;

        if (!studentId || !deviceId) {
            return NextResponse.json(
                { error: "Missing studentId or deviceId" },
                { status: 400 }
            );
        }

        const existingStudent = await db.students.getById(studentId);

        if (!existingStudent) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        const deviceIdField = existingStudent.device_id || existingStudent.deviceId;
        if (deviceIdField && deviceIdField.trim() !== "") {
            return NextResponse.json(
                { error: "Your account is already registered with a device. Please contact the administrator to reset your device link." },
                { status: 403 }
            );
        }

        // CRITICAL: Check if THIS deviceId is already used by ANY other student
        const studentsWithThisDevice = await db.students.list({ search: deviceId });
        const deviceUsedBy = studentsWithThisDevice.find((s: any) =>
            (s.device_id === deviceId || s.deviceId === deviceId) && s._id !== studentId
        );

        if (deviceUsedBy) {
            return NextResponse.json(
                { error: "This device is already registered with another student account (Registration ID: " + (deviceUsedBy.registrationId || "N/A") + "). Multiple accounts are not allowed on the same device." },
                { status: 403 }
            );
        }

        // Update student with deviceId
        const student = await db.students.update(studentId, {
            deviceId,
            action: "registerDevice" // Custom flag if we want history handling in adapter
        });

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
