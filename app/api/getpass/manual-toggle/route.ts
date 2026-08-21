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

    let rawHours = istDate.getUTCHours();
    const minutes = String(istDate.getUTCMinutes()).padStart(2, "0");
    const seconds = String(istDate.getUTCSeconds()).padStart(2, "0");
    const ampm = rawHours >= 12 ? "PM" : "AM";
    let hours12 = rawHours % 12;
    if (hours12 === 0) hours12 = 12;
    const hours = String(hours12).padStart(2, "0");
    const istTime = `${hours}:${minutes}:${seconds} ${ampm}`;

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
        const { studentId, studentIds, searchId, action, userType = 'admin', requestType = 'HOME-LEAVE', reason = 'Manual Management Override', operator = 'Admin' } = body;
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

        const { writeAdminAuditLog } = await import("@/lib/auditLog");

        for (const id of targetIds) {
            const student = await db.students.getById(id.toString());
            if (!student) continue;

            const currentStatus = student.studentStatus || "in";
            const isTargetOut = action === 'out' ? true : (action === 'in' ? false : (currentStatus === "in"));

            if (isTargetOut) {
                // MARK OUT (HOME-LEAVE or GATE-PASS)
                const passOutFilters: any = {
                    studentId: id.toString(),
                    status: "out",
                };
                if (student.firebaseUID && String(student.firebaseUID).trim()) {
                    passOutFilters.firebaseUID = String(student.firebaseUID).trim();
                }
                const { records: existingPasses } = await db.gatePasses.list(passOutFilters);

                let initialCheckOutTime = now;
                let initialIstTime = istTime;
                let initialIstDate = istDate;

                if (existingPasses && existingPasses.length > 0) {
                    const firstPass = existingPasses[0];
                    if (firstPass && firstPass.checkOutTime) {
                        initialCheckOutTime = new Date(firstPass.checkOutTime);
                        initialIstTime = firstPass.checkOutISTTime || firstPass.checkOutIstTime || istTime;
                        initialIstDate = firstPass.checkOutISTDate || firstPass.checkOutIstDate || istDate;
                    }
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

                // Determine target outing type:
                // Only mark as HOME-LEAVE if explicitly requested (e.g. from Visual Rooms Mark Home-Leave)
                // OR if the student already has an active approved HOME-LEAVE permission from Dean/Warden!
                let targetType = requestType;
                let passReason = reason;
                let createdPermId: string | undefined;

                if (userType === 'gatekeeper' && (!targetType || targetType === 'GATE-PASS')) {
                    // Gatekeeper manual checkout: Check if student has a currently valid approved HOME-LEAVE permission
                    const permsRes = await db.permissions.list({
                        studentId: id.toString(),
                        status: "allowed"
                    }, { limit: 5 });
                    const activePerms = Array.isArray(permsRes) ? permsRes : (permsRes?.records || permsRes?.permissions || []);
                    const approvedHomeLeave = activePerms.find((p: any) => {
                        const rType = String(p.requestType || '').toLowerCase();
                        const isLeaveType = (rType === 'home-leave' || rType === 'leave' || rType === 'hleave');
                        const isApproved = (p.status === 'allowed' || p.wardenStatus === 'approved' || p.deanStatus === 'approved') && p.status !== 'completed';
                        const notExpired = !p.toDateTime || (new Date(p.toDateTime).getTime() >= (now.getTime() - 24 * 60 * 60 * 1000));
                        return isLeaveType && isApproved && notExpired;
                    });

                    if (approvedHomeLeave) {
                        targetType = 'HOME-LEAVE';
                        passReason = passReason || approvedHomeLeave.reason || 'Approved Home Leave';
                        createdPermId = approvedHomeLeave._id || approvedHomeLeave.id;
                    } else {
                        targetType = 'GATE-PASS';
                        passReason = passReason || 'Gate Pass (Outing)';
                    }
                } else if (targetType === 'HOME-LEAVE' || targetType === 'leave') {
                    targetType = 'HOME-LEAVE';
                    passReason = passReason || 'Home Leave (Manual Approval)';

                    // Create permission record since Dean/Warden explicitly marked Home Leave
                    const fromDt = body.fromDateTime ? new Date(body.fromDateTime) : initialCheckOutTime;
                    const toDt = body.toDateTime ? new Date(body.toDateTime) : new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

                    try {
                        const createdPerm = await db.permissions.create({
                            studentId: id.toString(),
                            firebaseUID: student.firebaseUID,
                            name: student.name,
                            hostelName: student.hostelName,
                            roomNumber: student.roomNumber,
                            registrationId: student.registrationId,
                            fromDateTime: fromDt,
                            toDateTime: toDt,
                            reason: passReason,
                            status: "allowed",
                            wardenStatus: "approved",
                            deanStatus: "approved",
                            requestType: "HOME-LEAVE"
                        });
                        createdPermId = createdPerm?._id || createdPerm?.id;
                    } catch (permErr) {
                        console.error("Failed to create permission record on manual toggle:", permErr);
                    }
                } else {
                    targetType = 'GATE-PASS';
                    passReason = passReason || 'Gate Pass (Outing)';
                }

                await db.gatePasses.create({
                    studentId: id.toString(),
                    firebaseUID: student.firebaseUID,
                    studentName: student.name,
                    hostelName: student.hostelName,
                    roomNumber: student.roomNumber,
                    registrationId: student.registrationId,
                    checkOutTime: initialCheckOutTime,
                    checkOutISTTime: initialIstTime,
                    checkOutISTDate: initialIstDate,
                    status: "out",
                    type: targetType,
                    reason: passReason,
                    permissionId: createdPermId,
                    gateName: "Management Override",
                    qrTokenUsedOut: "MANUAL_BY_" + userType.toUpperCase(),
                });
                    status: "out",
                    type: targetType,
                    reason: passReason,
                    permissionId: createdPermId,
                    gateName: "Management Override",
                    qrTokenUsedOut: "MANUAL_BY_" + userType.toUpperCase(),
                });

                await db.students.update(id.toString(), { studentStatus: "out" });
                await writeAdminAuditLog({
                    action: "MANUAL_STATUS_OVERRIDE_OUT",
                    entityType: "student",
                    entityId: id.toString(),
                    entityName: student.name,
                    details: { status: "out", requestType: targetType, reason: passReason },
                    performedBy: operator || userType
                });
            } else {
                // MARK IN (Returned)
                const passInFilters: any = {
                    studentId: id.toString(),
                    status: "out",
                };
                if (student.firebaseUID && String(student.firebaseUID).trim()) {
                    passInFilters.firebaseUID = String(student.firebaseUID).trim();
                }

                const openPassesRes = await db.gatePasses.list(passInFilters);
                const uniqueOpenPasses = openPassesRes.records || [];

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

                        if (pass.permissionId) {
                            try {
                                await db.permissions.update(pass.permissionId, { status: "completed" });
                            } catch (pErr) {
                                console.warn("Failed to complete linked permission:", pErr);
                            }
                        }
                    }
                }

                // Complete all remaining active permissions for this student upon return
                try {
                    const activePermsRes = await db.permissions.list({ studentId: id.toString(), status: "allowed" });
                    const activePerms = Array.isArray(activePermsRes) ? activePermsRes : (activePermsRes?.records || activePermsRes?.permissions || []);
                    for (const p of activePerms) {
                        const pId = p._id || p.id;
                        if (pId) {
                            await db.permissions.update(pId, { status: "completed" });
                        }
                    }
                } catch (pErr) {
                    console.warn("Failed to complete permissions on return:", pErr);
                }

                await db.students.update(id.toString(), { studentStatus: "in" });
                await writeAdminAuditLog({
                    action: "MANUAL_STATUS_OVERRIDE_IN",
                    entityType: "student",
                    entityId: id.toString(),
                    entityName: student.name,
                    details: { status: "in", reason: reason || "Returned to Campus" },
                    performedBy: operator || userType
                });
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
