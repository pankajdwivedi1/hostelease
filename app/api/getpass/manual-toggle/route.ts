import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import crypto from 'crypto';

/**
 * Helper: Get IST time and date strings
 */
function getISTStrings(date: Date) {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);

    const hours = String(istDate.getUTCHours()).padStart(2, "0");
    const minutes = String(istDate.getUTCMinutes()).padStart(2, "0");
    const seconds = String(istDate.getUTCSeconds()).padStart(2, "0");
    const istTime = `${hours}:${minutes}:${seconds}`;

    const day = String(istDate.getUTCDate()).padStart(2, "0");
    const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
    const year = istDate.getUTCFullYear();
    const istDateStr = `${day}-${month}-${year}`;

    return { istTime, istDate: istDateStr };
}

/**
 * POST /api/getpass/manual-toggle
 * Allows Wardens/Admins to manually toggle a student's campus status
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { studentId, searchId, action, userType = 'admin' } = body;

        // Simple security check
        const validRoles = ['admin', 'warden', 'developer', 'gatekeeper'];
        if (!validRoles.includes(userType)) {
            return NextResponse.json(
                { error: "Unauthorized access" },
                { status: 403 }
            );
        }

        let student;

        // 🔍 SEARCH ACTION: Just find and return student profile for verification
        if (action === 'find' && searchId) {
            const results = await db.students.list({ search: searchId.trim() }, { light: false });
            if (!results || results.length === 0) {
                return NextResponse.json({ error: "No student found with this name or ID" }, { status: 404 });
            }
            // Return the first match for now, or the exact match if possible
            return NextResponse.json({ success: true, student: results[0] });
        }

        if (studentId) {
            student = await db.students.getById(studentId);
        } else if (searchId) {
            // Internal toggle by ID logic
            const s = searchId.trim();
            student = await db.students.findOne({ registrationId: s });
            if (!student) {
                student = await db.students.findOne({ erpInformation: s });
            }
        }

        if (!student) {
            return NextResponse.json(
                { error: "Student not found with this ID" },
                { status: 404 }
            );
        }

        const source = await db.getSource ? await db.getSource() : 'SUPABASE';

        const now = new Date();
        const { istTime, istDate } = getISTStrings(now);
        const currentStatus = student.studentStatus || "in";

        if (currentStatus === "in") {
            // MANUALLY MARK OUT
            // ⚡ FIX: Find and close any existing open passes before creating a new one
            const { records: existingPasses } = await db.gatePasses.list({
                studentId: student._id.toString(),
                status: "out",
            });

            if (existingPasses && existingPasses.length > 0) {
                console.log(`[MANUAL_TOGGLE] Found ${existingPasses.length} stale passes for ${student.name}. Resolving...`);
                for (const oldPass of existingPasses) {
                    if (!oldPass) continue;
                    const diffMs = now.getTime() - new Date(oldPass.checkOutTime).getTime();
                    await db.gatePasses.update(oldPass._id, {
                        checkInTime: now,
                        checkInISTTime: istTime,
                        checkInISTDate: istDate,
                        status: "auto-resolved", // Use auto-resolved for stale entries
                        durationMinutes: Math.round(diffMs / 60000),
                        qrTokenUsedIn: "SYSTEM_AUTO_CLOSE_ON_MANUAL_OUT"
                    });
                }
            }

            const gatePass = await db.gatePasses.create({
                studentId: student._id.toString(),
                firebaseUID: student.firebaseUID,
                studentName: student.name,
                hostelName: student.hostelName,
                roomNumber: student.roomNumber,
                registrationId: student.registrationId,
                checkOutTime: now,
                checkOutISTTime: istTime,
                checkOutISTDate: istDate,
                status: "out",
                gateName: "Manual (Warden)",
                qrTokenUsedOut: "MANUAL_BY_" + userType.toUpperCase(),
            });

            // Update student status to "out"
            await db.students.update(student._id.toString(), { studentStatus: "out" });

            return NextResponse.json({
                success: true,
                action: "checkout",
                message: `${student.name} marked OUT manually.`,
                newStatus: "out"
            });
        } else {
            // MANUALLY MARK IN
            // ⚡ FIX: Find ALL open gate passes for this student
            const { records: openPasses } = await db.gatePasses.list({
                studentId: student._id.toString(),
                status: "out",
            });

            if (openPasses && openPasses.length > 0) {
                for (const pass of openPasses) {
                    if (!pass) continue;
                    const diffMs = now.getTime() - new Date(pass.checkOutTime).getTime();
                    const durationMinutes = Math.round(diffMs / 60000);

                    await db.gatePasses.update(pass._id, {
                        checkInTime: now,
                        checkInISTTime: istTime,
                        checkInISTDate: istDate,
                        status: "in",
                        qrTokenUsedIn: "MANUAL_BY_" + userType.toUpperCase(),
                        durationMinutes
                    });
                }
            }

            // Update student status to "in"
            await db.students.update(student._id.toString(), { studentStatus: "in" });

            return NextResponse.json({
                success: true,
                action: "checkin",
                message: `${student.name} marked IN manually.`,
                newStatus: "in"
            });
        }
    } catch (error: any) {
        console.error("❌ Manual toggle error:", error);
        return NextResponse.json(
            { error: error.message || "Operation failed" },
            { status: 500 }
        );
    }
}
