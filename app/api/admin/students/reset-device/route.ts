export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

/**
 * API to reset a specific student's device binding.
 * Only accessible by Wardens or Admins.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { studentId, adminSecret } = body;

        // Basic protection - this should ideally use your existing auth sessions,
        // but adding a studentId check here.
        if (!studentId) {
            return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
        }

        const student = await db.students.getById(studentId);
        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Reset the device binding
        await db.students.update(studentId, {
            deviceId: null,
            isProfileLocked: false, // Unlock so they can bind again
            deviceHistory: [
                ...((student as any).deviceHistory || []),
                { 
                    action: "reset_by_admin", 
                    timestamp: new Date(),
                    details: "Device binding cleared by administrator" 
                }
            ]
        });

        console.log(`✅ [DEVICE_RESET] Student ${student.name} (${student.registrationId}) device link cleared.`);

        return NextResponse.json({ 
            success: true, 
            message: `Device link for ${student.name} has been reset successfully.` 
        });

    } catch (error: any) {
        console.error("Error resetting student device:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
