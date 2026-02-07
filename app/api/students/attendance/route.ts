import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import Attendance from "@/models/Attendance";
import AdminSettings from "@/models/AdminSettings";

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
        await connectDB();

        const body = await request.json();
        const { studentId, lat, lng, deviceId, wifiBSSID, verificationMethod } = body;

        console.log('📥 Attendance Request Received:', { studentId, hasWiFi: !!wifiBSSID, hasGPS: !!(lat !== undefined && lng !== undefined), deviceId });

        // Basic required fields
        if (!studentId) {
            return NextResponse.json(
                { error: "Student ID is missing. Please log in again." },
                { status: 400 }
            );
        }

        if (!deviceId) {
            return NextResponse.json(
                { error: "Device not registered. Please update your profile from the profile section to register this device first." },
                { status: 400 }
            );
        }

        // WiFi or GPS coordinates required (at least one)
        const hasWiFi = wifiBSSID && wifiBSSID.trim().length > 0;
        const hasGPS = lat !== undefined && lng !== undefined;

        if (!hasWiFi && !hasGPS) {
            return NextResponse.json(
                { error: "Missing required fields. Provide either WiFi BSSID or GPS coordinates." },
                { status: 400 }
            );
        }


        // 1. Fetch Student and Verify Device
        const student = await Student.findById(studentId);
        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        if (student.deviceId && student.deviceId !== deviceId) {
            return NextResponse.json(
                { error: "Unauthorized device. This device is not registered to your account." },
                { status: 403 }
            );
        }

        // 2. Check for existing attendance today (IST Date)
        const today = new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).split('/').reverse().join('-'); // YYYY-MM-DD

        const existingAttendance = await Attendance.findOne({ studentId, date: today });
        if (existingAttendance) {
            return NextResponse.json(
                { error: "Attendance already marked for today", alreadyMarked: true },
                { status: 400 }
            );
        }

        // 3. Verify Location and Time (Optimized with short-term cache)
        const nowMs = Date.now();
        let adminSettings;

        if (cachedAdminSettings && (nowMs - lastCacheUpdate < CACHE_DURATION)) {
            adminSettings = cachedAdminSettings;
        } else {
            adminSettings = await AdminSettings.findOne().lean();
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
                (wl: any) => wl.hostelName.toLowerCase() === student.hostelName.toLowerCase()
            );

            if (studentHostelWifi && studentHostelWifi.bssids.includes(wifiBSSID.toUpperCase())) {
                isLocationVerified = true;
                verifiedBy = 'wifi';
                console.log(`✅ WiFi Verified: ${student.name} on ${studentHostelWifi.hostelName} WiFi (BSSID: ${wifiBSSID})`);
            } else {
                console.log(`⚠️ WiFi BSSID not whitelisted: ${wifiBSSID} for ${student.hostelName}`);
                // WiFi failed, will try GPS fallback below
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

        // Check GPS Accuracy (New requirement)
        const bodyAccuracy = Math.round(body.accuracy || 0);
        if (bodyAccuracy !== undefined && bodyAccuracy > 200) {
            return NextResponse.json(
                {
                    error: "Waiting for better GPS signal... (Accuracy too low)",
                    accuracy: bodyAccuracy
                },
                { status: 400 }
            );
        }

        // Check Time Window (IST)
        const now = new Date();
        const istTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }); // "HH:mm:ss"
        const istTime = istTimeStr.split(":").slice(0, 2).join(":"); // "HH:mm"

        const startTime = adminSettings?.attendanceStartTime || "21:00";
        const endTime = adminSettings?.attendanceEndTime || "23:00";

        if (istTime < startTime || istTime > endTime) {
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
            // Check GPS Accuracy (New requirement)
            const bodyAccuracy = Math.round(body.accuracy || 0);
            if (bodyAccuracy !== undefined && bodyAccuracy > 200) {
                return NextResponse.json(
                    {
                        error: "Waiting for better GPS signal... (Accuracy too low)",
                        accuracy: bodyAccuracy
                    },
                    { status: 400 }
                );
            }

            // Check if student is within any of the allowed circles
            let isInsideAny = false;
            let closestInfo = { distance: Infinity, radius: 0 };

            for (const loc of hostelLocations) {
                const dist = calculateDistance(lat, lng, loc.lat, loc.lng);
                // Default to 100 if radius.radius is missing (though our schema now has it)
                const allowedRadius = (loc as any).radius || 100;

                // ⚡ IMPROVED: Account for GPS accuracy (Effective Distance)
                if ((dist - bodyAccuracy) <= allowedRadius) {
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

        // 4. Save Attendance
        const nowIST = new Date();
        const readableTime = nowIST.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
        const readableDate = nowIST.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).split('/').join('-');

        const newAttendance = await Attendance.create({
            studentId: student._id,
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
                accuracy: verifiedBy === 'gps' ? (body.accuracy || 0) : 0
            },
            deviceId: deviceId,
            status: "present"
        });

        return NextResponse.json(
            {
                success: true,
                message: verifiedBy === 'wifi'
                    ? "✅ Attendance marked! Verified via Campus WiFi"
                    : "✅ Attendance marked! Verified via GPS",
                attendance: newAttendance,
                verifiedBy: verifiedBy, // 'wifi' or 'gps'
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
        await connectDB();
        const searchParams = request.nextUrl.searchParams;
        const studentId = searchParams.get("studentId");

        if (studentId) {
            const today = new Date().toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).split('/').reverse().join('-');

            const nowMs = Date.now();
            let adminSettings;
            if (cachedAdminSettings && (nowMs - lastCacheUpdate < CACHE_DURATION)) {
                adminSettings = cachedAdminSettings;
            } else {
                adminSettings = await AdminSettings.findOne().lean();
                cachedAdminSettings = adminSettings;
                lastCacheUpdate = nowMs;
            }

            const [attendance] = await Promise.all([
                Attendance.findOne({ studentId, date: today })
            ]);

            return NextResponse.json({
                marked: !!attendance,
                startTime: adminSettings?.attendanceStartTime || "21:00",
                endTime: adminSettings?.attendanceEndTime || "23:00"
            });
        }

        return NextResponse.json({ error: "Student ID required" }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
