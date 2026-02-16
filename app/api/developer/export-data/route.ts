import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import Attendance from "@/models/Attendance";
import Permission from "@/models/Permission";
import AdminSettings from "@/models/AdminSettings";
import Hostel from "@/models/Hostel";
import Notification from "@/models/Notification";
import Transaction from "@/models/Transaction";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") || "json";

        // ✅ FIX: Add safety limits to prevent memory exhaustion
        const STUDENT_LIMIT = 5000;
        const ATTENDANCE_LIMIT = 50000;
        const PERMISSION_LIMIT = 10000;
        const TRANSACTION_LIMIT = 10000;

        // Fetch using lean() to avoid hydration
        // 🚨 CRITICAL OPTIMIZATION: EXCLUDE BIG FIELDS (IMAGES)
        // profilePicture, faceDescriptor, flaggedPhotoUrl can be huge
        const [
            students,
            attendance,
            permissions,
            adminSettings,
            hostels,
            notifications,
            transactions
        ] = await Promise.all([
            Student.find({}, '-profilePicture -faceDescriptor -__v').lean().limit(STUDENT_LIMIT),
            Attendance.find({}, '-flaggedPhotoUrl -__v').limit(ATTENDANCE_LIMIT).lean(),
            Permission.find({}, '-__v').lean().limit(PERMISSION_LIMIT),
            AdminSettings.find({}, '-__v').lean(),
            Hostel.find({}, '-__v').lean(),
            Notification.find({}, '-__v').lean(),
            Transaction.find({}, '-__v').lean().limit(TRANSACTION_LIMIT)
        ]);

        if (format === "json") {
            const allData = {
                students,
                attendance,
                permissions,
                adminSettings,
                hostels,
                notifications,
                transactions,
                export: {
                    timestamp: new Date().toISOString(),
                    totalRecords: {
                        students: students.length,
                        attendance: attendance.length,
                        permissions: permissions.length,
                        transactions: transactions.length
                    },
                    limits: {
                        students: STUDENT_LIMIT,
                        attendance: ATTENDANCE_LIMIT,
                        permissions: PERMISSION_LIMIT,
                        transactions: TRANSACTION_LIMIT
                    }
                }
            };

            // Check if encoding fails (circular structure, etc.) - JSON.stringify might throw
            let jsonString = '';
            try {
                jsonString = JSON.stringify(allData, null, 2);
            } catch (jsonError) {
                console.error("JSON Stringify Error:", jsonError);
                throw new Error("Data too large or circular structure for JSON");
            }

            return new NextResponse(jsonString, {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="hostelease_db_dump_${new Date().toISOString().split('T')[0]}.json"`
                }
            });
        }
        else if (format === "csv" || format === "xlsx") {
            const workbook = XLSX.utils.book_new();

            // Helper to add sheet
            const addSheet = (data: any[], name: string) => {
                if (data && data.length > 0) {
                    // Flatten data slightly for better CSV/Excel experience could be good, but standard json_to_sheet is usually okay.
                    // For nested objects (like location: { lat, lng }), xlsx handles them but might just show [object Object].
                    // Simple flattening for nested objects if needed, but let's stick to basic for speed.

                    // Sanitize date objects if needed, but json_to_sheet logic handles dates.

                    const worksheet = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(workbook, worksheet, name);
                }
            };

            if (format === 'csv') {
                // CSV only supports one sheet.
                // We prioritize Students, then Attendance (concatenated? no).
                // We will output the Student list only for CSV to avoid empty/corrupted file issues.
                addSheet(students, "Students");

                // If user really wants attendance, they should use XLSX.
            } else {
                // XLSX supports sheets
                addSheet(students, "Students");
                addSheet(attendance, "Attendance");
                addSheet(permissions, "Permissions");
                addSheet(adminSettings, "Settings");
                addSheet(hostels, "Hostels");
                addSheet(notifications, "Notifications");
                addSheet(transactions, "Transactions");
            }

            // Write to buffer
            // Use 'base64' if buffer fails? No 'buffer' is standard for node.
            // If data is huge, this might still OOM. But removing images helps.
            const buffer = XLSX.write(workbook, { type: "buffer", bookType: format === "csv" ? "csv" : "xlsx" });

            const contentType = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            const extension = format === "csv" ? "csv" : "xlsx";

            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `attachment; filename="hostelease_db_dump_${new Date().toISOString().split('T')[0]}.${extension}"`
                }
            });
        } else {
            return NextResponse.json({ error: "Invalid format" }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Export Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to export data" },
            { status: 500 }
        );
    }
}
