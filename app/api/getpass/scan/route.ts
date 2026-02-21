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
                { error: "This is not a valid GETPASS QR code" },
                { status: 400 }
            );
        }

        const token = parsedQR.t;

        // Verify token exists and hasn't expired
        const tokenRecord = await db.gatePassTokens.findOne({ token });

        if (!tokenRecord) {
            return NextResponse.json(
                { error: "QR code has expired. Please scan the new QR code displayed at the gate." },
                { status: 410 }
            );
        }

        // Check if token is expired
        if (new Date() > new Date(tokenRecord.expiresAt)) {
            return NextResponse.json(
                { error: "QR code has expired. Please scan the new QR code displayed at the gate." },
                { status: 410 }
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

        if (currentStatus === "in") {
            // STUDENT IS GOING OUT (CHECK-OUT)
            // Double check: ensure no open gate pass exists
            const existingOpenPass = await db.gatePasses.findOne({
                studentId: student._id,
                status: "out",
            });

            if (existingOpenPass) {
                // Close the old one first
                const diffMs = now.getTime() - new Date(existingOpenPass.checkOutTime).getTime();
                await db.gatePasses.update(existingOpenPass._id, {
                    checkInTime: now,
                    checkInISTTime: istTime,
                    checkInISTDate: istDate,
                    status: "in",
                    durationMinutes: Math.round(diffMs / 60000),
                    qrTokenUsedIn: token
                });
            }

            // Create new gate pass (check-out)
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
                gateName: parsedQR.g || "Main Gate",
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
            // Find the open gate pass for this student
            const openPass = await db.gatePasses.findOne({
                studentId: student._id,
                status: "out",
            });

            if (!openPass) {
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

            // Calculate duration
            const diffMs = now.getTime() - new Date(openPass.checkOutTime).getTime();
            const durationMinutes = Math.round(diffMs / 60000);

            // Close the gate pass
            const updatedPass = await db.gatePasses.update(openPass._id, {
                checkInTime: now,
                checkInISTTime: istTime,
                checkInISTDate: istDate,
                status: "in",
                qrTokenUsedIn: token,
                durationMinutes
            });

            // Update student status to "in"
            await db.students.update(student._id.toString(), { studentStatus: "in" });

            // Format duration for display
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            const durationText = hours > 0
                ? `${hours}h ${mins}m`
                : `${mins} minutes`;

            return NextResponse.json({
                success: true,
                action: "checkin",
                message: `Welcome back, ${student.name}! You were out for ${durationText}.`,
                gatePass: {
                    id: updatedPass._id,
                    checkOutTime: updatedPass.checkOutISTTime,
                    checkOutDate: updatedPass.checkOutISTDate,
                    checkInTime: updatedPass.checkInISTTime,
                    checkInDate: updatedPass.checkInISTDate,
                    durationMinutes,
                    gateName: updatedPass.gateName,
                },
                studentName: student.name,
                hostelName: student.hostelName,
                roomNumber: student.roomNumber,
                newStatus: "in",
                durationMinutes,
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

