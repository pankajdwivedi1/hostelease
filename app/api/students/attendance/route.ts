import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import Attendance from "@/models/Attendance";
import AdminSettings from "@/models/AdminSettings";

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
        const { studentId, lat, lng, deviceId } = body;

        if (!studentId || lat === undefined || lng === undefined || !deviceId) {
            return NextResponse.json(
                { error: "Missing required fields" },
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

        // 3. Verify Location and Time
        let adminSettings = await AdminSettings.findOne();
        if (!adminSettings || !adminSettings.hostelLocation) {
            return NextResponse.json({ error: "Hostel location not configured" }, { status: 400 });
        }

        // Check Time Window (IST)
        const now = new Date();
        const istTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }); // "HH:mm:ss"
        const istTime = istTimeStr.split(":").slice(0, 2).join(":"); // "HH:mm"

        const startTime = adminSettings.attendanceStartTime || "21:00";
        const endTime = adminSettings.attendanceEndTime || "22:30";

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

        const distance = calculateDistance(
            lat,
            lng,
            adminSettings.hostelLocation.lat,
            adminSettings.hostelLocation.lng
        );

        const radius = adminSettings.radius || 200;

        if (distance > radius) {
            return NextResponse.json(
                {
                    error: "You are not in campus",
                    distance: Math.round(distance),
                    radius,
                },
                { status: 400 }
            );
        }

        // 4. Save Attendance
        const newAttendance = await Attendance.create({
            studentId: student._id,
            firebaseUID: student.firebaseUID,
            name: student.name,
            hostelName: student.hostelName,
            roomNumber: student.roomNumber,
            date: today,
            location: { lat, lng },
            deviceId: deviceId,
            status: "present"
        });

        return NextResponse.json(
            {
                success: true,
                message: "Your attendance has been saved with green tick",
                attendance: newAttendance,
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

            const [attendance, adminSettings] = await Promise.all([
                Attendance.findOne({ studentId, date: today }),
                AdminSettings.findOne()
            ]);

            return NextResponse.json({
                marked: !!attendance,
                startTime: adminSettings?.attendanceStartTime || "18:00",
                endTime: adminSettings?.attendanceEndTime || "23:00"
            });
        }

        return NextResponse.json({ error: "Student ID required" }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
