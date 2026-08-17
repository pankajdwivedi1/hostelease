export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, supabase } from "@/lib/dbAdapter";
import { sendMSG91_GatepassAlert } from "@/lib/msg91";
import { validators } from "@/lib/validation";

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
 * POST /api/getpass/scan
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { qrData, firebaseUID, email, phoneNumber, registrationId, deviceId, isOfflineSync } = body;

        const effectiveIdentifier = firebaseUID || email || phoneNumber || registrationId;

        // Validate required fields
        if (!qrData || !effectiveIdentifier) {
            return NextResponse.json(
                { error: "Missing required fields: qrData or student identifier (firebaseUID/email/phone)" },
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
            if (!isOfflineSync && (nowMs - timestamp > 25000)) {
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


        // Find the student with robust multi-attribute fallback
        let student = firebaseUID ? await db.students.findOne({ firebaseUID }) : null;

        const candidateStrings = [firebaseUID, email, phoneNumber, registrationId].filter(Boolean) as string[];

        for (const candidate of candidateStrings) {
            if (student) break;
            const s = candidate.trim();
            if (!s) continue;

            student = await db.students.findOne({ email: s });
            if (!student) student = await db.students.findOne({ _id: s });
            if (!student) student = await db.students.findOne({ phoneNumber: s });
            if (!student) {
                const { canonical, digitsOnly, last10 } = validators.normalizePhoneNumber(s);
                if (canonical) student = await db.students.findOne({ phoneNumber: canonical });
                if (!student && last10 && last10.length === 10) {
                    student = await db.students.findOne({ phoneNumber: last10 });
                }
                if (!student && digitsOnly) {
                    student = await db.students.findOne({ phoneNumber: digitsOnly });
                }
            }
            if (!student) student = await db.students.findOne({ registrationId: s });

            // ⚡ ULTIMATE FALLBACK: Use gatepassSearch (Same search engine as Manual Entry!)
            if (!student) {
                try {
                    const searchResults = await db.students.list({ gatepassSearch: s }, { light: false });
                    if (searchResults && searchResults.length > 0) {
                        student = searchResults[0];
                    }
                } catch (searchErr) {
                    console.warn("⚠️ gatepassSearch fallback error:", searchErr);
                }
            }
        }

        if (!student) {
            return NextResponse.json(
                { error: "Student not found. Please register first." },
                { status: 404 }
            );
        }

        // 🔗 AUTO-LINK & UPGRADE REAL FIREBASE UID:
        // If student record has a temporary placeholder UID (or different UID) and incoming firebaseUID is provided,
        // permanently upgrade & link the incoming real official UID to the database!
        if (student && typeof firebaseUID === 'string' && firebaseUID.trim()) {
            const cleanUID = firebaseUID.trim();
            if (cleanUID && student.firebaseUID !== cleanUID) {
                console.log(`🔗 [AUTO_UPGRADE_SCAN_UID] Upgrading student ${student.name} (${student.email || student.phoneNumber}) from "${student.firebaseUID}" to official UID "${cleanUID}"`);
                try {
                    await db.students.update(student._id ? student._id.toString() : student.id, { firebaseUID: cleanUID });
                    student.firebaseUID = cleanUID;
                } catch (linkErr) {
                    console.warn("⚠️ Auto-upgrade scan firebaseUID failed (non-critical):", linkErr);
                }
            }
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

        // ============================================================
        // ⚡ SPEED OPTIMIZATION: Query all DB dependencies in parallel!
        // ============================================================
        let activity: any[] = [];
        let openPasses: any[] = [];
        let activePermissions: any[] = [];
        let consumedPasses: any[] = [];

        try {
            const [activityRes, openPassesRes, permissionsRes, consumedRes] = await Promise.all([
                db.gatePasses.list({ firebaseUID: student.firebaseUID }, { limit: 1, sortField: 'checkOutTime', sortOrder: 'desc' }),
                db.gatePasses.list({ studentId: student._id.toString(), firebaseUID: student.firebaseUID, status: "out" }),
                db.permissions.list({ studentId: student._id.toString() }),
                db.gatePasses.list({ studentId: student._id.toString() })
            ]);

            activity = activityRes?.records || [];
            openPasses = openPassesRes?.records || [];
            activePermissions = permissionsRes?.records || [];
            consumedPasses = consumedRes?.records || [];
        } catch (dbErr) {
            console.error("⚠️ Failed to load scan database dependencies in parallel:", dbErr);
        }

        // 🔥 DOUBLE SCAN GUARD: Prevent duplicate entries from double-tapping or network lag
        // We block any scan action (Outing or Return) if the student did something within the last 8 seconds
        try {
            if (activity && activity.length > 0 && activity[0]) {
                const last = activity[0] as any;
                const nowMs = Date.now();
                const parseSafeDate = (timeVal: any, dateVal: any) => {
                    if (!timeVal) return 0;
                    const timeStr = String(timeVal);
                    if (timeStr.includes('T') || timeStr.includes('Z') || timeStr.length > 10) {
                        const parsed = new Date(timeStr);
                        if (!isNaN(parsed.getTime())) return parsed.getTime();
                    }
                    if (dateVal && timeStr.includes(':')) {
                        const dateStr = String(dateVal);
                        const dateParts = dateStr.split(/[-/]/);
                        const timeParts = timeStr.split(':');
                        if (dateParts.length === 3 && timeParts.length >= 2) {
                            const day = parseInt(dateParts[0]);
                            const month = parseInt(dateParts[1]) - 1;
                            const year = parseInt(dateParts[2]);
                            const hour = parseInt(timeParts[0]);
                            const minute = parseInt(timeParts[1]);
                            const second = timeParts[2] ? parseInt(timeParts[2]) : 0;
                            const parsed = new Date(year, month, day, hour, minute, second);
                            if (!isNaN(parsed.getTime())) return parsed.getTime();
                        }
                    }
                    const parsed = new Date(timeVal);
                    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
                };

                const lastOutMs = parseSafeDate(last.checkOutTime, last.checkOutISTDate);
                const lastInMs = parseSafeDate(last.checkInTime, last.checkInISTDate);
                const mostRecentMs = Math.max(lastOutMs, lastInMs);
                const timeDiff = nowMs - mostRecentMs;

                // Check for token reuse - prevents same QR code image being scanned twice instantly
                const isTokenReuse = last.qrTokenUsedOut === token || last.qrTokenUsedIn === token;

                // ⚡ QR SCAN COOLDOWN GUARD: Enforce configurable minimum minutes between consecutive scans
                let cooldownMinutes = 5;
                let allowEmergencyExit = true;
                try {
                    const settings = await db.settings.get();
                    if (settings?.qrScanCooldownMinutes !== undefined) {
                        cooldownMinutes = Number(settings.qrScanCooldownMinutes);
                    }
                    if (settings?.allowEmergencyExitWithoutCooldown !== undefined) {
                        allowEmergencyExit = Boolean(settings.allowEmergencyExitWithoutCooldown);
                    }
                } catch (sErr) {}

                // ⚡ DIRECTION-AWARE EMERGENCY OUTING:
                // If student is currently IN campus and wants to go OUT, and allowEmergencyExit is enabled:
                // Allow immediate exit without waiting for cooldown (requiring only 3s camera debounce buffer)
                const isExitAction = currentStatus === "in";
                const shouldBypassCooldown = isExitAction && allowEmergencyExit && !isTokenReuse && timeDiff >= 3000;

                const cooldownMs = Math.max(15000, cooldownMinutes * 60 * 1000);

                if (!shouldBypassCooldown && (isTokenReuse || (timeDiff < cooldownMs))) {
                    const elapsedSecs = Math.floor(timeDiff / 1000);
                    const remainingSecs = Math.max(1, Math.ceil((cooldownMs - timeDiff) / 1000));
                    const remainingMins = Math.ceil(remainingSecs / 60);
                    const isSeconds = remainingSecs < 60;
                    const remainingText = isSeconds ? `${remainingSecs} second(s)` : `${remainingMins} minute(s)`;
                    
                    console.log(`🚫 [SCAN_GUARD]: Blocked scan for ${student.name}. Reason: ${isTokenReuse ? 'Token Reused' : `Cooldown Active (${elapsedSecs}s < ${cooldownMs/1000}s)`}`);
                    
                    return NextResponse.json({
                        success: false, 
                        action: "cooldown_blocked",
                        error: isTokenReuse 
                            ? "This QR pass token was already scanned." 
                            : `Anti-Spoof Cooldown: You scanned ${Math.floor(elapsedSecs/60) > 0 ? `${Math.floor(elapsedSecs/60)}m ago` : `${elapsedSecs}s ago`}. Please wait ${remainingText} before scanning again.`,
                        message: `Anti-Spoof Cooldown: Please wait ${remainingText} before scanning again.`,
                        newStatus: currentStatus,
                        studentName: student.name,
                        hostelName: student.hostelName,
                        isDuplicate: true
                    }, { status: 400 });
                }
            }
        } catch (guardError) {
            console.warn("⚠️ Scan guard check failed (skipping):", guardError);
            // We continue anyway if the check fails to avoid blocking legitimate users
        }

        if (currentStatus === "in") {
            // STUDENT IS GOING OUT (CHECK-OUT)
            // ⚡ FIX: Find ALL open passes and close them before starting a new one
            if (openPasses && openPasses.length > 0) {
                console.log(`[SCAN_OUT] Found ${openPasses.length} stale passes for ${student.name}. Resolving...`);
                for (const oldPass of openPasses) {
                    if (!oldPass) continue;
                    const oldPassId = oldPass._id || oldPass.id;
                    const diffMs = now.getTime() - new Date(oldPass.checkOutTime).getTime();
                    await db.gatePasses.update(oldPassId, {
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
            
            // ✅ DEFINITIVE GUARD: Build a set of permissionIds that were ALREADY consumed
            // by a previous gate pass (any status — out or in). A permission can only be
            // used ONCE. If a gate pass already exists with this permissionId, skip it.
            const alreadyConsumedPermIds = new Set<string>();
            if (consumedPasses && consumedPasses.length > 0) {
                consumedPasses.forEach((gp: any) => {
                    const permId = gp.permissionId || gp.permission_id;
                    if (permId) {
                        alreadyConsumedPermIds.add(permId.toString());
                    }
                });
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
                studentId: (student._id || student.id).toString(),
                firebaseUID: student.firebaseUID || student.firebase_uid || (student as any).firebaseUid || "",
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

                // Send Web Push Notification to Parent (Fire & Forget)
                import("@/lib/pushNotification").then(({ sendPushNotification }) => {
                    const parentUserId = student.fatherNumber || (student._id.toString() + "_parent");
                    sendPushNotification(parentUserId, "parent", "parentScanInOut", {
                        title: "Gate Out-Pass Alert",
                        body: `Your ward ${student.name} has checked OUT from campus at ${istTime} via ${gateName}.`,
                        url: "/"
                    }).catch(err => console.error("Web Push to parent failed:", err));
                }).catch(e => console.error("Failed to load pushNotification helper:", e));
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
            // ⚡ REUSE: openPasses is already fetched in parallel at the top!

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
                const passId = pass._id || pass.id;
                const diffMs = now.getTime() - new Date(pass.checkOutTime).getTime();
                const durationMinutes = Math.round(diffMs / 60000);
                totalDuration = durationMinutes; // Use the most relevant duration

                // ⚡ FIX: Only mark the FIRST (most recent) record as "in"
                // Subsequent ones are marked as "auto-resolved" to hide them from the dashboard
                const isMainRecord = i === 0;

                const updated = await db.gatePasses.update(passId, {
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

                // Send Web Push Notification to Parent (Fire & Forget)
                import("@/lib/pushNotification").then(({ sendPushNotification }) => {
                    const parentUserId = student.fatherNumber || (student._id.toString() + "_parent");
                    sendPushNotification(parentUserId, "parent", "parentScanInOut", {
                        title: "Gate Check-In Alert",
                        body: `Your ward ${student.name} has checked IN to campus at ${istTime} via ${lastUpdatedPass?.gateName || "Main Gate"}.`,
                        url: "/"
                    }).catch(err => console.error("Web Push to parent failed:", err));
                }).catch(e => console.error("Failed to load pushNotification helper:", e));
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

