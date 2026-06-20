export const dynamic = "force-dynamic";

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
        const { studentId, studentIds, searchId, action, userType = 'admin' } = body;
        const targetIds: string[] = studentIds || (studentId ? [studentId] : []);

        // 2. Validate Authorization (Only Admin/Warden/Gatekeeper/SuperAdmin can manually toggle)
        const role = String(userType || 'admin').toLowerCase().trim();
        const validRoles = ['admin', 'warden', 'developer', 'gatekeeper', 'superadmin', 'dean', 'campus', 'getpass', 'super admin'];

        if (!validRoles.includes(role)) {
            console.error(`[ManualToggle] Unauthorized access attempt with role: "${role}"`);
            return NextResponse.json(
                { error: "Unauthorized access", role: role },
                { status: 403 }
            );
        }

        // 🔍 SEARCH ACTION: Just find and return student profile for verification
        if (action === 'find' && searchId) {
            const s = searchId.trim();
            const isEmail = s.includes('@');
            const isNumeric = /^[0-9]+$/.test(s);
            const hasPhoneLength = /^\+?[0-9]{10,13}$/.test(s);
            const hasSpecialChars = /[^a-zA-Z0-9\s\-\/\.\']/.test(s);

            if (isEmail || isNumeric || hasPhoneLength || hasSpecialChars) {
                return NextResponse.json({ error: "Enter only Name, Registration or ERP ID" }, { status: 400 });
            }

            const results = await db.students.list({ gatepassSearch: s }, { light: false });
            if (!results || results.length === 0) {
                return NextResponse.json({ error: "No information exists in the database for the entered details." }, { status: 404 });
            }
            return NextResponse.json({ success: true, student: results[0] });
        }

        if (targetIds.length === 0 && searchId) {
            // Find student by registration or ERP ID
            const s = searchId.trim();
            let student = await db.students.findOne({ registrationId: s });
            if (!student) student = await db.students.findOne({ erpInformation: s });
            if (student) targetIds.push(student._id.toString());
        }

        if (targetIds.length === 0) {
            return NextResponse.json({ error: "No student IDs provided" }, { status: 400 });
        }

        const now = new Date();
        const { istTime, istDate } = getISTStrings(now);
        let processedCount = 0;

        for (const id of targetIds) {
            const student = await db.students.getById(id.toString());
            if (!student) continue;

            const currentStatus = student.studentStatus || "in";

            if (currentStatus === "in") {
                // MARK OUT
                const { records: existingPasses } = await db.gatePasses.list({
                    studentId: id.toString(),
                    status: "out",
                });

                if (existingPasses && existingPasses.length > 0) {
                    for (const oldPass of existingPasses) {
                        if (!oldPass) continue;
                        const diffMs = now.getTime() - new Date(oldPass.checkOutTime).getTime();
                        await db.gatePasses.update(oldPass._id, {
                            checkInTime: now,
                            checkInISTTime: istTime,
                            checkInISTDate: istDate,
                            status: "auto-resolved",
                            durationMinutes: Math.round(diffMs / 60000),
                            qrTokenUsedIn: "BULK_AUTO_CLOSE"
                        });
                    }
                }

                await db.gatePasses.create({
                    studentId: id.toString(),
                    firebaseUID: student.firebaseUID,
                    studentName: student.name,
                    hostelName: student.hostelName,
                    roomNumber: student.roomNumber,
                    registrationId: student.registrationId,
                    checkOutTime: now,
                    checkOutISTTime: istTime,
                    checkOutISTDate: istDate,
                    status: "out",
                    gateName: "Manual (Bulk)",
                    qrTokenUsedOut: "MANUAL_BY_" + userType.toUpperCase(),
                });

                await db.students.update(id.toString(), { studentStatus: "out" });
            } else {
                // MARK IN
                // ⚡ ROBUST SEARCH: Find passes by EITHER studentId OR firebaseUID to handle mismatches
                const openPassesBySIDRes = await db.gatePasses.list({
                    studentId: id.toString(),
                    status: "out",
                });
                
                const openPassesByFUIDRes = await db.gatePasses.list({
                    firebaseUID: student.firebaseUID,
                    status: "out",
                });

                // Combine and deduplicate records by _id
                const combinedPasses = [...(openPassesBySIDRes.records || []), ...(openPassesByFUIDRes.records || [])];
                const uniqueOpenPasses = Array.from(new Map(combinedPasses.map(p => [p._id, p])).values());

                if (uniqueOpenPasses.length > 0) {
                    for (const pass of uniqueOpenPasses) {
                        if (!pass) continue;
                        const diffMs = now.getTime() - new Date(pass.checkOutTime).getTime();
                        await db.gatePasses.update(pass._id, {
                            checkInTime: now,
                            checkInISTTime: istTime,
                            checkInISTDate: istDate,
                            status: "in",
                            qrTokenUsedIn: "MANUAL_BY_" + userType.toUpperCase(),
                            durationMinutes: Math.round(diffMs / 60000)
                        });
                    }
                }

                await db.students.update(id.toString(), { studentStatus: "in" });
            }
            processedCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Successfully updated status for ${processedCount} students.`,
            count: processedCount
        });
    } catch (error: any) {
        console.error("❌ Bulk toggle error:", error);
        return NextResponse.json(
            { error: error.message || "Bulk operation failed" },
            { status: 500 }
        );
    }
}
