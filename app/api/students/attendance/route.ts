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

        const isTester = student.email === "prem86.dwivedi@gmail.com";

        // 🔥 SECURITY RESTRICTION: Mandatory Check-In First
        // If a student is marked as "out" in the gate system, they must scan the entry QR code 
        // to come "inside" before the daily attendance can be marked.
        if (!isTester && student.studentStatus === 'out') {
            return NextResponse.json(
                { error: "Access Denied: You are currently marked as OUT in the gate pass system. Please scan the entry QR code at the main gate to check-in first before marking daily attendance." },
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
        let isLocationVerified = false;
        let verifiedBy = '';

        if (wifiBSSID) {
            // Check if student's hostel has WiFi whitelist configured
            const wifiWhitelist = adminSettings?.wifiWhitelist || [];
            const studentHostelWifi = wifiWhitelist.find(
                (wl: any) => wl.hostelName?.toLowerCase() === student.hostelName?.toLowerCase()
            );

            // ✅ FIX: Normalize WiFi BSSID to uppercase for consistent comparison
            const normalizedBSSID = wifiBSSID.toUpperCase().trim();
            const storedBSSIDs = studentHostelWifi?.bssids?.map((b: string) => b.toUpperCase().trim()) || [];

            if (studentHostelWifi && storedBSSIDs.includes(normalizedBSSID)) {
                isLocationVerified = true;
                verifiedBy = 'wifi';
                console.log(`✅ WiFi Verified: ${student.name} on ${studentHostelWifi.hostelName} WiFi (BSSID: ${normalizedBSSID})`);
            } else {
                console.log(`⚠️ WiFi BSSID not whitelisted: ${normalizedBSSID} for ${student.hostelName}`);
                // WiFi failed, will try GPS fallback below
            }
        }

        // ⚡ NEW: Public IP Verification (Fallback for WiFi)
        if (!isLocationVerified) {
            const forwarded = request.headers.get("x-forwarded-for");
            const clientIp = forwarded ? forwarded.split(",")[0] : (request as any).ip || "127.0.0.1";
            const globalIpWhitelist = adminSettings?.wifiWhitelist || [];

            // If the whitelist is just strings (IPs), check them. 
            // If it's objects with bssids, check if any of them is just the IP string.
            const ipWhitelisted = globalIpWhitelist.some((item: any) => {
                const ipToMatch = typeof item === 'string' ? item : (item.ip || item.name);
                return ipToMatch === clientIp;
            });

            if (ipWhitelisted) {
                isLocationVerified = true;
                verifiedBy = 'ip';
                console.log(`✅ IP Verified: ${student.name} via Whitelisted IP: ${clientIp}`);
            }
        }

        // Use provided coordinates with their specific radii
        const defaultLocations = [
            { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" }, // Loc 1
            { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" }, // Original Location
            { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }       // Loc 2
        ];

        const hostelLocations = (adminSettings?.hostelLocations && adminSettings.hostelLocations.length > 0)
            ? adminSettings.hostelLocations
            : defaultLocations;

        // ✅ FIX: Improved GPS Accuracy Handling
        const bodyAccuracy = Math.round(body.accuracy || 0);
        const GPS_ACCURACY_THRESHOLD = 300; // Increased from 200m to 300m for better compatibility

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

        // ⚡ GPS FALLBACK: Only check GPS if WiFi verification failed
        if (!isLocationVerified && lat !== undefined && lng !== undefined) {
            // ✅ FIX: Improved accuracy check - allow up to 300m instead of 200m
            if (bodyAccuracy !== undefined && bodyAccuracy > GPS_ACCURACY_THRESHOLD) {
                return NextResponse.json(
                    {
                        error: `Waiting for better GPS signal... (Current accuracy: ${bodyAccuracy}m, needed: <${GPS_ACCURACY_THRESHOLD}m)`,
                        accuracy: bodyAccuracy,
                        requiredAccuracy: GPS_ACCURACY_THRESHOLD
                    },
                    { status: 400 }
                );
            }

            // Check if student is within any of the allowed circles
            let isInsideAny = false;
            let closestInfo = { distance: Infinity, radius: 0 };

            for (const loc of hostelLocations) {
                const dist = calculateDistance(lat, lng, loc.lat, loc.lng);

                // ⚡ DEVELOPER CONFIG: Radius Overlap (+20m if enabled)
                const allowedRadius = ((loc as any).radius || 100) + (adminSettings?.overlapRadius ? 20 : 0);

                const isInside = dist <= allowedRadius;

                // ⚡ DEVELOPER CONFIG: Prioritize Assigned Hostel
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

            if (!isInsideAny) {
                return NextResponse.json(
                    {
                        error: "You are not in campus",
                        distance: Math.round(closestInfo.distance),
                        radius: closestInfo.radius,
                    },
                    { status: 400 }
                );
            }

            // GPS verification passed
            isLocationVerified = true;
            verifiedBy = 'gps';
            console.log(`✅ GPS Verified: ${student.name} at coordinates (${lat}, ${lng})`);
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
                accuracy: verifiedBy === 'gps' ? (bodyAccuracy || 0) : 0
            },
            deviceId: deviceId,
            status: "present" as const,
            faceMatchPercentage,
            faceMatchStatus,
            flaggedPhotoUrl,
            needsReview: faceMatchStatus === 'flagged',
            isTest: isTester,
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

        if (studentId) {
            const nowMs = Date.now();

            // Use dbAdapter for student fetch to support Supabase/Mongo switching
            const studentPromise = db.students.getById(studentId);

            const [student, adminSettings] = await Promise.all([
                studentPromise,
                (cachedAdminSettings && (nowMs - lastCacheUpdate < CACHE_DURATION))
                    ? Promise.resolve(cachedAdminSettings)
                    : db.settings.get()
            ]);

            if (!cachedAdminSettings || (nowMs - lastCacheUpdate >= CACHE_DURATION)) {
                cachedAdminSettings = adminSettings;
                lastCacheUpdate = nowMs;
            }

            const isTester = student?.email === "prem86.dwivedi@gmail.com";

            const today = new Date().toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).split('/').reverse().join('-');

            // Use dbAdapter for attendance check
            const attendance = await db.attendance.checkToday(studentId, today);

            return NextResponse.json({
                marked: isTester ? false : !!attendance,
                startTime: adminSettings?.attendanceStartTime || "21:00",
                endTime: adminSettings?.attendanceEndTime || "23:00"
            });
        }

        return NextResponse.json({ error: "Student ID required" }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
