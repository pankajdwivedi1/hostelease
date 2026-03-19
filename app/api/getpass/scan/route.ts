import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

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
        if (parsedQR.app !== "hostelease-getpass") {
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
            const secret = "hostelease_secure_gate_key_2026";

            // Re-create the signature to compare
            const crypto = await import('crypto');
            const dataToVerify = `${gateName}:${timestamp}`;
            const expectedSignature = crypto.createHmac('sha256', secret).update(dataToVerify).digest('hex');

            // 1. Check if signature is valid
            if (signature !== expectedSignature) {
                throw new Error("Invalid signature");
            }

            // 2. Check if token is too old (15 seconds limit)
            const nowMs = Date.now();
            if (nowMs - timestamp > 15000) {
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

        // Verify device if student has one registered
        if (student.deviceId && deviceId && student.deviceId !== deviceId) {
            return NextResponse.json(
                { error: "This device is not registered for this student." },
                { status: 403 }
            );
        }

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

            // Find if any permission covers "NOW" and is EITHER "allowed" OR "dean-accepted"
            const activeLeave = activePermissions?.find((p: any) => {
                const isAllowed = p.status === "allowed";
                const isDeanAccepted = p.deanStatus === "accepted" || p.deanStatus === "approved";
                
                if (!isAllowed && !isDeanAccepted) return false;

                const start = new Date(p.fromDateTime).getTime();
                const end = new Date(p.toDateTime).getTime();
                const currentTime = now.getTime();
                return currentTime >= start && currentTime <= end && p.requestType === "leave";
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

