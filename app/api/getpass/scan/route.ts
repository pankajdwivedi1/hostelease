export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, supabase } from "@/lib/dbAdapter";
import { sendMSG91_GatepassAlert } from "@/lib/msg91";

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
 * POST /api/getpass/scan
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { qrData, firebaseUID, deviceId } = body;

        // Validate required fields
        if (!qrData || !firebaseUID) {
            return NextResponse.json(
                { error: "Missing required fields: qrData, firebaseUID" },
                { status: 400 }
            );
        }

        // Parse QR data
        let parsedQR: any;
        try {
            parsedQR = JSON.parse(qrData);
        } catch {
            return NextResponse.json(
                { error: "Invalid QR code data" },
                { status: 400 }
            );
        }

        // Verify it's a GETPASS QR code
        if (parsedQR.app !== "hosteleaze-getpass") {
            return NextResponse.json(
                { error: "This is not a valid GATEPASS QR code" },
                { status: 400 }
            );
        }

        const token = parsedQR.t;
        const gateName = parsedQR.g || "Main Gate";

        // Verification logic for Digital Signature
        try {
            const [timestampStr, signature] = token.split('.');
            const timestamp = parseInt(timestampStr);
            const secret = "hosteleaze_secure_gate_key_2026";

            // Re-create the signature to compare
            const crypto = await import('crypto');
            const dataToVerify = `${gateName}:${timestamp}`;
            const expectedSignature = crypto.createHmac('sha256', secret).update(dataToVerify).digest('hex');

            // 1. Check if signature is valid
            if (signature !== expectedSignature) {
                throw new Error("Invalid signature");
            }

            // 2. Check if token is too old (25 seconds limit: 15s rotation + 10s network buffer)
            const nowMs = Date.now();
            if (nowMs - timestamp > 25000) {
                return NextResponse.json(
                    { error: "QR code has expired. Please scan the new QR code displayed at the gate." },
                    { status: 410 }
                );
            }
        } catch (err) {
            return NextResponse.json(
                { error: "This is an invalid or tempered QR code." },
                { status: 400 }
            );
        }

        // Find the student
        const student = await db.students.findOne({ firebaseUID });
        if (!student) {
            return NextResponse.json(
                { error: "Student not found. Please register first." },
                { status: 404 }
            );
        }

        // ============================================================
        // 🔒 DEVICE BINDING ENFORCEMENT (Google Pay-style)
        // ============================================================
        const storedDeviceId = (student.deviceId && student.deviceId.trim() !== "no-binding") ? student.deviceId.trim() : null;

        if (storedDeviceId) {
            // Device is already bound — incoming ID MUST match, no exceptions
            if (!deviceId || storedDeviceId !== deviceId.trim()) {
                console.warn(`🚫 [DEVICE_BLOCK] Scan blocked for ${student.name}. Expected: ${storedDeviceId?.slice(0,8)}... Got: ${deviceId?.slice(0,8) || 'none'}...`);
                return NextResponse.json(
                    {
                        error: "⛔ Attendance blocked. This account is registered on a different device. If you changed your phone, please contact your Warden to reset your device.",
                        code: "DEVICE_MISMATCH"
                    },
                    { status: 403 }
                );
            }
            // ✅ Device matches — continue
        } else if (deviceId?.trim()) {
            // No device bound yet — AUTO-BIND this device on first scan
            console.log(`📱 [DEVICE_BIND] First scan — binding device to ${student.name}: ${deviceId.slice(0,8)}...`);
            try {
                await db.students.update(student._id.toString(), {
                    deviceId: deviceId.trim(),
                    isProfileLocked: true,
                    deviceHistory: [
                        ...((student as any).deviceHistory || []),
                        { deviceId: deviceId.trim(), action: "registered", timestamp: new Date() }
                    ]
                });
                // Update local student object to reflect the new binding
                (student as any).deviceId = deviceId.trim();
            } catch (bindErr) {
                console.warn("⚠️ Device auto-bind failed (non-critical):", bindErr);
                // Continue — don't block the scan if binding fails
            }
        } else {
            // No device ID sent at all — warn but allow (student may be on old app version)
            console.warn(`⚠️ [NO_DEVICE_ID] Scan without deviceId for ${student.name}. Student should update their app.`);
        }
        // ============================================================

        const now = new Date();
        const { istTime, istDate } = getISTStrings(now);

        // Check student's current campus status
        const currentStatus = student.studentStatus || "in";

        // 🔥 DOUBLE SCAN GUARD: Prevent duplicate entries from double-tapping or network lag
        // We block any scan action (Outing or Return) if the student did something within the last 8 seconds
        try {
            const { records: activity } = await db.gatePasses.list({
                firebaseUID: student.firebaseUID
            }, { limit: 1, sortField: 'checkOutTime', sortOrder: 'desc' });

            if (activity && activity.length > 0 && activity[0]) {
                const last = activity[0] as any;
                const nowMs = Date.now();
                const lastOutMs = last.checkOutTime ? new Date(last.checkOutTime).getTime() : 0;
                const lastInMs = last.checkInTime ? new Date(last.checkInTime).getTime() : 0;
                const mostRecentMs = Math.max(lastOutMs, lastInMs);
                const timeDiff = nowMs - mostRecentMs;

                // Check for token reuse - prevents same QR code image being scanned twice instantly
                const isTokenReuse = last.qrTokenUsedOut === token || last.qrTokenUsedIn === token;

                // ⚡ SCAN GUARD: If activity was within 15 seconds OR the token is the same, assume it's a duplicate
                // This prevents students from accidentally scanning twice in a row
                if (isTokenReuse || (timeDiff < 15000)) {
                    console.log(`🚫 [SCAN_GUARD]: Blocked duplicate scan for ${student.name}. Reason: ${isTokenReuse ? 'Token Reused' : `Fast Scan (${timeDiff}ms)`}`);
                    return NextResponse.json({
                        success: true, 
                        action: "duplicate_blocked",
                        message: "Already scanned recently. Please wait a few seconds.",
                        newStatus: currentStatus,
                        studentName: student.name,
                        hostelName: student.hostelName,
                        isDuplicate: true
                    });
                }
            }
        } catch (guardError) {
            console.warn("⚠️ Scan guard check failed (skipping):", guardError);
            // We continue anyway if the check fails to avoid blocking legitimate users
        }

        if (currentStatus === "in") {
            // STUDENT IS GOING OUT (CHECK-OUT)
            // ⚡ FIX: Find ALL open passes and close them before starting a new one
            const { records: openPasses } = await db.gatePasses.list({
                studentId: student._id.toString(),
                status: "out",
            });

            if (openPasses && openPasses.length > 0) {
                console.log(`[SCAN_OUT] Found ${openPasses.length} stale passes for ${student.name}. Resolving...`);
                for (const oldPass of openPasses) {
                    if (!oldPass) continue;
                    const diffMs = now.getTime() - new Date(oldPass.checkOutTime).getTime();
                    await db.gatePasses.update(oldPass._id, {
                        checkInTime: now,
                        checkInISTTime: istTime,
                        checkInISTDate: istDate,
                        status: "auto-resolved", // Use auto-resolved to keep history clean
                        durationMinutes: Math.round(diffMs / 60000),
                        qrTokenUsedIn: "SYSTEM_AUTO_CLOSE_ON_NEW_OUTING"
                    });
                }
            }

            // ⚡ CHECK FOR PERMISSIONS: Is this an approved "Leave" or just a regular Outing?
            const { records: activePermissions } = await db.permissions.list({
                studentId: student._id.toString()
            });

            // ✅ DEFINITIVE GUARD: Build a set of permissionIds that were ALREADY consumed
            // by a previous gate pass (any status — out or in). A permission can only be
            // used ONCE. If a gate pass already exists with this permissionId, skip it.
            const alreadyConsumedPermIds = new Set<string>();
            try {
                // 📡 BANDWIDTH OPTIMIZATION: Only select permission_id column to reduce data transfer
                const { data: consumedPasses, error: gpErr } = await supabase
                    .from('gate_passes')
                    .select('permission_id')
                    .eq('student_id', student._id.toString())
                    .not('permission_id', 'is', null);

                if (!gpErr && consumedPasses) {
                    consumedPasses.forEach((gp: any) => {
                        alreadyConsumedPermIds.add(gp.permission_id.toString());
                    });
                }
            } catch (gpErr) {
                console.warn("⚠️ Could not fetch prior gate passes for permission check:", gpErr);
            }

            // Find if any permission covers "NOW" and is approved (by dean OR fully allowed)
            // A permission is only "active" if ALL of these are true:
            //   1. Approved (status="allowed" OR deanStatus="allowed")
            //   2. NOT already completed
            //   3. NOT already linked to a previous gate pass (already consumed)
            //   4. Current time is within [fromDateTime → toDateTime]
            //   5. requestType is explicitly "leave"
            const activeLeave = activePermissions?.find((p: any) => {
                const isFullyAllowed = p.status === "allowed";
                const isDeanAllowed = p.deanStatus === "allowed";

                if (!isFullyAllowed && !isDeanAllowed) return false;

                // Skip permissions already marked completed
                if (p.status === "completed") return false;

                // ✅ KEY FIX: Skip permissions already consumed by a previous gate pass
                const permId = (p._id || p.id)?.toString();
                if (permId && alreadyConsumedPermIds.has(permId)) return false;

                const start = new Date(p.fromDateTime).getTime();
                const end = new Date(p.toDateTime).getTime();
                const currentTime = now.getTime();
                const isInTimeWindow = currentTime >= start && currentTime <= end;

                if (!isInTimeWindow) return false;

                // ONLY explicitly-tagged leave permissions count as leave
                return p.requestType === "leave";
            });

            // Create new gate pass (check-out)
            const gatePass = await db.gatePasses.create({
                studentId: student._id.toString(),
                firebaseUID: student.firebaseUID,
                studentName: student.name,
                hostelName: student.hostelName,
                roomNumber: student.roomNumber,
                registrationId: student.registrationId,
                phoneNumber: student.phoneNumber,
                checkOutTime: now,
                checkOutISTTime: istTime,
                checkOutISTDate: istDate,
                status: "out",
                type: activeLeave ? "leave" : "outing",
                permissionId: activeLeave?._id || null,
                gateName: gateName,
                qrTokenUsedOut: token,
            });

            // Update student status to "out"
            await db.students.update(student._id.toString(), { studentStatus: "out" });

            // 🔥 Send MSG91 Gatepass Alert (Fire & Forget)
            const parentPhone = student.fatherNumber || student.motherNumber || student.localGuardianPhoneNumber;
            if (parentPhone) {
                const collegeBranding = student.collegeName || student.hostelName || "Campus";
                sendMSG91_GatepassAlert(parentPhone, student.name, gateName, istTime, "out", collegeBranding).catch(err => {
                    console.error("Background SMS send failed:", err);
                });
            }

            return NextResponse.json({
                success: true,
                action: "checkout",
                message: `${student.name}, you are now checked OUT from campus.`,
                gatePass: {
                    id: gatePass._id,
                    checkOutTime: gatePass.checkOutISTTime,
                    checkOutDate: gatePass.checkOutISTDate,
                    gateName: gatePass.gateName,
                },
                studentName: student.name,
                hostelName: student.hostelName,
                roomNumber: student.roomNumber,
                registrationId: student.registrationId,
                newStatus: "out",
            });
        } else {
            // STUDENT IS COMING BACK (CHECK-IN)
            // ⚡ FIX: Find ALL open gate passes for this student to resolve mismatches
            const { records: openPasses } = await db.gatePasses.list({
                studentId: student._id.toString(),
                status: "out",
            });

            if (!openPasses || openPasses.length === 0) {
                // No open pass found but status is "out" - fix status
                await db.students.update(student._id.toString(), { studentStatus: "in" });

                return NextResponse.json({
                    success: true,
                    action: "checkin",
                    message: `${student.name}, you are now checked IN to campus.`,
                    studentName: student.name,
                    hostelName: student.hostelName,
                    roomNumber: student.roomNumber,
                    newStatus: "in",
                    durationMinutes: 0,
                });
            }

            // Close ALL open gate passes found
            let totalDuration = 0;
            let lastUpdatedPass: any = null;

            for (let i = 0; i < openPasses.length; i++) {
                const pass = openPasses[i];
                if (!pass) continue;
                const diffMs = now.getTime() - new Date(pass.checkOutTime).getTime();
                const durationMinutes = Math.round(diffMs / 60000);
                totalDuration = durationMinutes; // Use the most relevant duration

                // ⚡ FIX: Only mark the FIRST (most recent) record as "in"
                // Subsequent ones are marked as "auto-resolved" to hide them from the dashboard
                const isMainRecord = i === 0;

                const updated = await db.gatePasses.update(pass._id, {
                    checkInTime: now,
                    checkInISTTime: istTime,
                    checkInISTDate: istDate,
                    status: isMainRecord ? "in" : "auto-resolved", // Only one "in" record
                    qrTokenUsedIn: token,
                    durationMinutes
                });

                if (isMainRecord) lastUpdatedPass = updated;
            }

            // Update student status to "in"
            await db.students.update(student._id.toString(), { studentStatus: "in" });

            // 🔥 Send MSG91 Gatepass Alert (Fire & Forget)
            const parentPhone = student.fatherNumber || student.motherNumber || student.localGuardianPhoneNumber;
            if (parentPhone && lastUpdatedPass) {
                const collegeBranding = student.collegeName || student.hostelName || "Campus";
                sendMSG91_GatepassAlert(parentPhone, student.name, lastUpdatedPass.gateName || "Main Gate", istTime, "in", collegeBranding).catch(err => {
                    console.error("Background SMS send failed:", err);
                });
            }

            // ✅ FIX: Mark the used leave permission as "completed" so it does NOT
            // trigger again on future scans. Without this, an old approved permission
            // whose time window still covers future time keeps classifying new outings as LEAVE.
            const usedPermissionId = (openPasses[0] as any)?.permissionId || (openPasses[0] as any)?.permission_id;
            if (usedPermissionId) {
                try {
                    await db.permissions.update(usedPermissionId, { status: "completed" });
                    console.log(`✅ Permission ${usedPermissionId} marked as completed after student checked in.`);
                } catch (permErr) {
                    console.warn("⚠️ Could not mark permission as completed (non-critical):", permErr);
                }
            }

            // Format duration for display (using last/most relevant)
            const hours = Math.floor(totalDuration / 60);
            const mins = totalDuration % 60;
            const durationText = hours > 0
                ? `${hours}h ${mins}m`
                : `${mins} minutes`;

            return NextResponse.json({
                success: true,
                action: "checkin",
                message: `Welcome back, ${student.name}! You were out for ${durationText}.`,
                gatePass: lastUpdatedPass ? {
                    id: lastUpdatedPass._id,
                    checkOutTime: lastUpdatedPass.checkOutISTTime,
                    checkOutDate: lastUpdatedPass.checkOutISTDate,
                    checkInTime: lastUpdatedPass.checkInISTTime,
                    checkInDate: lastUpdatedPass.checkInISTDate,
                    durationMinutes: totalDuration,
                    gateName: lastUpdatedPass.gateName,
                } : null,
                studentName: student.name,
                hostelName: student.hostelName,
                roomNumber: student.roomNumber,
                newStatus: "in",
                durationMinutes: totalDuration,
                durationText,
            });
        }
    } catch (error: any) {
        console.error("❌ Error processing gate pass scan:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process scan" },
            { status: 500 }
        );
    }
}

