export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { checkRateLimit } from "@/lib/requestLimiter";

// Cache for AdminSettings to reduce DB load during peak times
let cachedAdminSettings: any = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 60000; // 1 minute

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

export async function POST(request: NextRequest) {
    try {

        const body = await request.json();
        const {
            studentId,
            lat,
            lng,
            deviceId,
            wifiBSSID,
            verificationMethod,
            faceMatchPercentage,
            faceMatchStatus,
            flaggedPhotoUrl
        } = body;

        console.log('📥 Attendance Request Received:', {
            studentId,
            hasWiFi: !!wifiBSSID,
            hasGPS: !!(lat !== undefined && lng !== undefined),
            faceMatch: faceMatchPercentage ? `${faceMatchPercentage}%` : 'N/A',
            deviceId
        });

        // Basic required fields
        if (!studentId) {
            return NextResponse.json(
                { error: "Student ID is missing. Please log in again." },
                { status: 400 }
            );
        }

        // 🔥 RATE LIMIT CHECK: Prevent connection exhaustion during peak times
        const { allowed, retryAfter } = checkRateLimit(studentId);
        if (!allowed) {
            return NextResponse.json(
                {
                    error: "Too many requests. Please try again in a moment.",
                    retryAfter: Math.ceil(retryAfter / 1000), // Convert to seconds
                    waitSeconds: Math.ceil(retryAfter / 1000)
                },
                { status: 429, headers: { 'Retry-After': Math.ceil(retryAfter / 1000).toString() } }
            );
        }

        /*
        if (!deviceId) {
            return NextResponse.json(
                { error: "Device not registered. Please update your profile from the profile section to register this device first." },
                { status: 400 }
            );
        }
        */

        // WiFi or GPS coordinates required (at least one)
        const hasWiFi = wifiBSSID && wifiBSSID.trim().length > 0;
        const hasGPS = lat !== undefined && lng !== undefined;

        if (!hasWiFi && !hasGPS) {
            return NextResponse.json(
                { error: "Missing required fields. Provide either WiFi BSSID or GPS coordinates." },
                { status: 400 }
            );
        }


        // 1. Fetch Student and Verify Device (⚡ Database Aware)
        // Using dbAdapter to fetch from active source (Supabase or MongoDB)
        // We fetch the full student object because getById returns mapped camelCase data
        const student = await db.students.getById(studentId);

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        const isTester = false;

        // 🔥 SECURITY RESTRICTION: Mandatory Check-In First
        // If a student is marked as "out" in the gate system, they must scan the entry QR code 
        // to come "inside" before the daily attendance can be marked.
        const openGatePass = await db.gatePasses.findOne({ studentId, status: "out" });
        const isActuallyOut = student.studentStatus === 'out' || !!openGatePass;

        if (!isTester && isActuallyOut) {
            return NextResponse.json(
                {
                    error: "Access Denied: You are currently marked as OUT in the gate pass system. Please scan the entry QR code at the main gate to check-in first before marking daily attendance.",
                    isActuallyOut: true,
                    hasOpenPass: !!openGatePass,
                    studentStatus: student.studentStatus
                },
                { status: 403 }
            );
        }

        // ⚡ DISABLED: Device binding / Biometric check ignored as per user request
        /*
        if (!isTester) {
            // 🔥 STRICT MODE: Enforce WebAuthn (Biometric) verification only
            // We ignore the legacy `student.deviceId` field entirely.
            // The `deviceId` sent in the payload MUST match a registered WebAuthn Credential ID.

            const webAuthnCredentials = student.webAuthnCredentials || [];
            const isWebAuthnMatch = webAuthnCredentials.some((cred: any) => cred.credentialID === deviceId);

            // Logging for debugging
            if (!isWebAuthnMatch) {
                console.log(`⚠️ Biometric Mismatch for student ${student.email}:`, {
                    providedCredentialID: deviceId,
                    registeredCredentials: webAuthnCredentials.length
                });

                return NextResponse.json(
                    { error: "Biometric verification failed. Please register your device using Face/fingerprint in your profile." },
                    { status: 403 }
                );
            }
        }
        */

        // 2. Check for existing attendance today (IST Date)
        const today = new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).split('/').reverse().join('-'); // YYYY-MM-DD

        // Check for existing attendance in database
        const existingAttendance = await db.attendance.checkToday(studentId, today);
        if (existingAttendance) {
            if (isTester) {
                // Delete existing attendance for tester to allow re-marking multiple times
                await db.attendance.delete(existingAttendance._id);
            } else {
                return NextResponse.json(
                    { error: "Attendance already marked for today", alreadyMarked: true },
                    { status: 400 }
                );
            }
        }

        // 3. Verify Location and Time (Optimized with short-term cache)
        const nowMs = Date.now();
        let adminSettings;

        if (cachedAdminSettings && (nowMs - lastCacheUpdate < CACHE_DURATION)) {
            adminSettings = cachedAdminSettings;
        } else {
            adminSettings = await db.settings.get();
            cachedAdminSettings = adminSettings;
            lastCacheUpdate = nowMs;
        }

        // ⚡ NEW: WiFi BSSID Verification (Primary Method - FAST!)
        let isLocationVerified = body.isLocationVerified === true;
        let verifiedBy = isLocationVerified ? 'wifi' : '';

        // 📍 LOCATION VERIFICATION (Accurately reporting GPS vs Campus WiFi)
        const hostelLocations = adminSettings?.hostelLocations || [];
        const bodyAccuracy = Math.round(body.accuracy || 0);
        const GPS_ACCURACY_THRESHOLD = 300; // Allow up to 300m for mobile GPS compatibility

        // Check Time Window (IST)
        const now = new Date();
        const istTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }); // "HH:mm:ss"
        const istTime = istTimeStr.split(":").slice(0, 2).join(":"); // "HH:mm"

        const startTime = adminSettings?.attendanceStartTime || "21:00";
        const endTime = adminSettings?.attendanceEndTime || "23:00";

        if (!isTester && (istTime < startTime || istTime > endTime)) {
            return NextResponse.json(
                {
                    error: `Attendance window closed. You can mark attendance between ${startTime} and ${endTime} only.`,
                    startTime,
                    endTime,
                    currentTime: istTime
                },
                { status: 400 }
            );
        }

        // 🎯 PRIORITY 1: Check GPS Coordinates if provided by device
        let gpsVerified = false;
        if (lat !== undefined && lng !== undefined && !isTester) {
            let isInsideAny = false;
            let closestInfo = { distance: Infinity, radius: 0 };

            for (const loc of hostelLocations) {
                const dist = calculateDistance(lat, lng, loc.lat, loc.lng);
                const allowedRadius = ((loc as any).radius || 100) + (adminSettings?.overlapRadius ? 20 : 0);
                const isInside = dist <= allowedRadius;

                let isMatchValid = isInside;
                if (adminSettings?.prioritizeAssignedHostel) {
                    const isAssigned = student.hostelName?.toLowerCase().includes(loc.name.toLowerCase()) ||
                        loc.name.toLowerCase().includes(student.hostelName?.toLowerCase() || "");
                    isMatchValid = isInside && isAssigned;
                }

                if (isMatchValid) {
                    isInsideAny = true;
                    break;
                }

                if (dist < closestInfo.distance) {
                    closestInfo = { distance: dist, radius: allowedRadius };
                }
            }

            if (isInsideAny) {
                isLocationVerified = true;
                gpsVerified = true;
                verifiedBy = 'gps';
                console.log(`✅ GPS Verified: ${student.name} at coordinates (${lat}, ${lng}) within radius`);
            }
        }

        // 🎯 PRIORITY 2: Check Campus WiFi / Router BSSID (if GPS not verified or indoors)
        if (!isLocationVerified && !isTester) {
            if (wifiBSSID || body.verificationMethod === 'wifi' || body.verifiedBy === 'wifi' || body.isWifiVerified) {
                const incomingWifiSignal = wifiBSSID || body.verificationMethod || body.verifiedBy || "CAMPUS_WIFI_CONNECTED";
                const normalizedBSSID = String(incomingWifiSignal).toUpperCase().trim();

                const globalWhitelist = adminSettings?.wifiWhitelist || [];
                const allConfiguredBSSIDs = new Set<string>();
                for (const item of globalWhitelist) {
                    if (item && Array.isArray(item.bssids)) {
                        for (const b of item.bssids) {
                            if (b) allConfiguredBSSIDs.add(String(b).toUpperCase().trim());
                        }
                    }
                }

                const isBssidMatched = allConfiguredBSSIDs.size === 0 || 
                                       allConfiguredBSSIDs.has(normalizedBSSID) || 
                                       normalizedBSSID.includes("WIFI") || 
                                       normalizedBSSID === "CAMPUS_WIFI_CONNECTED" ||
                                       body.isWifiVerified === true ||
                                       body.verificationMethod === 'wifi';

                if (isBssidMatched) {
                    isLocationVerified = true;
                    verifiedBy = 'wifi';
                    console.log(`✅ Campus WiFi Verified: ${student.name} on Campus WiFi (${normalizedBSSID})`);
                }
            }
        }

        // 🎯 PRIORITY 3: Public IP Whitelist Verification
        if (!isLocationVerified && !isTester) {
            const forwarded = request.headers.get("x-forwarded-for");
            let rawClientIp = forwarded ? forwarded.split(",")[0] : (request as any).ip || "127.0.0.1";
            rawClientIp = rawClientIp.trim();
            const clientIp = rawClientIp.startsWith("::ffff:") ? rawClientIp.substring(7) : rawClientIp;
            const globalIpWhitelist = adminSettings?.wifiWhitelist || [];

            const ipWhitelisted = globalIpWhitelist.some((item: any) => {
                if (!item) return false;
                let ipToMatch = typeof item === 'string' ? item : (item.ip || item.name);
                if (!ipToMatch) return false;
                ipToMatch = ipToMatch.trim();
                if (ipToMatch.startsWith("::ffff:")) {
                    ipToMatch = ipToMatch.substring(7);
                }
                return ipToMatch === clientIp;
            });

            if (ipWhitelisted) {
                isLocationVerified = true;
                verifiedBy = 'ip';
                console.log(`✅ IP Verified: ${student.name} via Whitelisted IP: ${clientIp}`);
            }
        }

        if (isTester) {
            isLocationVerified = true;
            verifiedBy = 'gps';
            console.log(`✅ Tester Account Location Verified for ${student.name}`);
        }

            // ⚡ STRATEGY 1: SELF-HEALING IP WHITELIST
            // If GPS lock is highly accurate (<= 23m), we capture the public IP and update the hostel's whitelisted IP in database
            if (bodyAccuracy !== undefined && bodyAccuracy <= 23) {
                const forwarded = request.headers.get("x-forwarded-for");
                let rawClientIp = forwarded ? forwarded.split(",")[0] : (request as any).ip || "127.0.0.1";
                rawClientIp = rawClientIp.trim();
                const clientIp = rawClientIp.startsWith("::ffff:") ? rawClientIp.substring(7) : rawClientIp;

                if (clientIp && clientIp !== "127.0.0.1" && clientIp !== "::1") {
                    try {
                        const wifiWhitelist = adminSettings?.wifiWhitelist || [];
                        const hostelName = student.hostelName || "Campus WiFi";

                        const ipExists = wifiWhitelist.some((wl: any) => {
                            if (!wl.ip) return false;
                            let cleanWlIp = wl.ip.trim();
                            if (cleanWlIp.startsWith("::ffff:")) {
                                cleanWlIp = cleanWlIp.substring(7);
                            }
                            return cleanWlIp === clientIp && 
                            ((wl.hostelName && wl.hostelName.toLowerCase() === hostelName.toLowerCase()) ||
                             (wl.name && wl.name.toLowerCase().includes(hostelName.toLowerCase())));
                        });

                        if (!ipExists) {
                            const updatedWhitelist = [...wifiWhitelist];
                            const existingHostelIpIdx = updatedWhitelist.findIndex((wl: any) => 
                                (wl.hostelName && wl.hostelName.toLowerCase() === hostelName.toLowerCase()) ||
                                (wl.name && wl.name.toLowerCase().includes(hostelName.toLowerCase()))
                            );

                            const currentTimestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                            if (existingHostelIpIdx >= 0) {
                                const isWardenSynced = updatedWhitelist[existingHostelIpIdx].name?.toLowerCase().includes("warden") ||
                                                       (updatedWhitelist[existingHostelIpIdx].ip && !updatedWhitelist[existingHostelIpIdx].name?.toLowerCase().includes("self-healed"));
                                if (!isWardenSynced) {
                                    updatedWhitelist[existingHostelIpIdx] = {
                                        ...updatedWhitelist[existingHostelIpIdx],
                                        ip: clientIp,
                                        name: `Self-Healed ${hostelName} IP`,
                                        syncedByStudent: student.name || "Unknown Student",
                                        syncedAt: currentTimestamp
                                    };
                                }
                            } else {
                                updatedWhitelist.push({
                                    hostelName: hostelName,
                                    name: `Self-Healed ${hostelName} IP`,
                                    ip: clientIp,
                                    syncedByStudent: student.name || "Unknown Student",
                                    syncedAt: currentTimestamp,
                                    bssids: []
                                });
                            }

                            await db.settings.update({ wifiWhitelist: updatedWhitelist });
                            cachedAdminSettings = null;
                            lastCacheUpdate = 0;
                            console.log(`🔄 [Self-Healing] Automatically whitelisted IP ${clientIp} for ${hostelName} by student ${student.name}`);
                        }
                    } catch (err: any) {
                        console.error("Error updating self-healing IP whitelist:", err);
                    }
                }
            }

        // If neither WiFi nor GPS verified the location
        if (!isLocationVerified) {
            return NextResponse.json(
                { error: "Unable to verify location. Please ensure GPS is enabled or you're on campus WiFi." },
                { status: 400 }
            );
        }


        // 4. Save Attendance Immediately (Fixed from Queue System)
        const nowIST = new Date();
        const readableTime = nowIST.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
        const readableDate = nowIST.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).split('/').join('-');

        // Prepare data (camelCase for internal app usage)
        const attendanceData = {
            studentId: student._id.toString(), // Ensure string for Supabase
            firebaseUID: student.firebaseUID,
            name: student.name,
            hostelName: student.hostelName,
            roomNumber: student.roomNumber,
            date: today,
            istTime: readableTime,
            istDate: readableDate,
            location: {
                lat: lat || 0,
                lng: lng || 0,
                accuracy: bodyAccuracy || 0
            },
            deviceId: deviceId,
            status: "present" as const,
            verificationMethod: verifiedBy || 'gps',
            verifiedBy: verifiedBy || 'gps',
            isWifiVerified: verifiedBy === 'wifi' || verifiedBy === 'ip',
            faceMatchPercentage,
            faceMatchStatus,
            flaggedPhotoUrl,
            needsReview: faceMatchStatus === 'flagged',
            isTest: false,
            timestamp: nowIST // Ensure timestamp is passed
        };

        // ✅ CRITICAL FIX: Use DB Adapter to route to Supabase or MongoDB
        // The adapter handles snake_case conversion for Supabase automatically
        await db.attendance.mark(attendanceData);

        console.log(`✅ Attendance saved via DB ADAPTER for ${student.name}`);

        return NextResponse.json(
            {
                success: true,
                message: verifiedBy === 'wifi'
                    ? "✅ Attendance saved! Verified via Campus WiFi"
                    : verifiedBy === 'ip' ? "✅ Attendance saved! Verified via Campus Network" : "✅ Attendance saved! Verified via GPS",
                attendance: attendanceData,
                verifiedBy: verifiedBy,
                wifiBSSID: verifiedBy === 'wifi' ? wifiBSSID : undefined
            },
            { status: 200 }
        );

    } catch (error: any) {
        console.error("Error marking attendance:", error);
        return NextResponse.json(
            { error: error.message || "Failed to mark attendance" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const studentId = searchParams.get("studentId");

        if (!studentId) {
            return NextResponse.json({ error: "Student ID required" }, { status: 400 });
        }

        const nowMs = Date.now();
        let student: any = null;
        let adminSettings: any = null;

        try {
            const studentPromise = db.students.getById(studentId);
            const settingsPromise = (cachedAdminSettings && (nowMs - lastCacheUpdate < CACHE_DURATION))
                ? Promise.resolve(cachedAdminSettings)
                : db.settings.get();

            [student, adminSettings] = await Promise.all([studentPromise, settingsPromise]);

            if (adminSettings && (!cachedAdminSettings || (nowMs - lastCacheUpdate >= CACHE_DURATION))) {
                cachedAdminSettings = adminSettings;
                lastCacheUpdate = nowMs;
            }
        } catch (err: any) {
            console.warn("GET attendance student/settings fetch warning:", err?.message);
        }

        const today = new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).split('/').reverse().join('-');

        let attendance: any = null;
        try {
            attendance = await db.attendance.checkToday(studentId, today);
        } catch (attErr: any) {
            console.warn("GET attendance checkToday warning:", attErr?.message);
        }

        return NextResponse.json({
            marked: !!attendance,
            startTime: adminSettings?.attendanceStartTime || "21:00",
            endTime: adminSettings?.attendanceEndTime || "23:00"
        });
    } catch (e: any) {
        console.error("GET attendance endpoint error:", e?.message);
        return NextResponse.json({
            marked: false,
            startTime: "21:00",
            endTime: "23:00"
        });
    }
}
