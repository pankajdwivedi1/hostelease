import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") || "json";

        // ✅ FIX: Add safety limits to prevent memory exhaustion
        const STUDENT_LIMIT = 5000;
        const ATTENDANCE_LIMIT = 50000;
        const PERMISSION_LIMIT = 10000;
        const TRANSACTION_LIMIT = 10000;

        // Fetch using adapter
        // Note: adapter methods might return different structures, let's normalize
        const [
            students,
            attendanceResp,
            permissionsResp,
            adminSettings,
            hostels,
            transactionsResp
        ] = await Promise.all([
            db.students.list({}, { light: true }), // light: true excludes big fields
            db.attendance.list({}, { limit: ATTENDANCE_LIMIT }),
            db.permissions.list({}, { limit: PERMISSION_LIMIT }),
            db.settings.get(),
            db.hostels.getAll(),
            db.transactions?.list ? db.transactions.list({}, { limit: TRANSACTION_LIMIT }) : Promise.resolve({ records: [] })
        ]);

        const attendance = Array.isArray(attendanceResp) ? attendanceResp : (attendanceResp.records || []);
        const permissions = Array.isArray(permissionsResp) ? permissionsResp : (permissionsResp.records || []);
        const transactions = Array.isArray(transactionsResp) ? transactionsResp : (transactionsResp.records || []);

        if (format === "json") {
            const allData = {
                students,
                attendance,
                permissions,
                adminSettings,
                hostels,
                transactions,
                export: {
                    timestamp: new Date().toISOString(),
                    totalRecords: {
                        students: students.length,
                        attendance: attendance.length,
                        permissions: permissions.length,
                        transactions: transactions.length
                    }
                }
            };

            return new NextResponse(JSON.stringify(allData, null, 2), {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="hosteleaze_db_dump_${new Date().toISOString().split('T')[0]}.json"`
                }
            });
        }
        else if (format === "csv" || format === "xlsx") {
            const workbook = XLSX.utils.book_new();

            // Helper to add sheet
            const addSheet = (data: any[], name: string) => {
                if (data && data.length > 0) {
                    const worksheet = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(workbook, worksheet, name);
                }
            };

            if (format === 'csv') {
                addSheet(students, "Students");
            } else {
                addSheet(students, "Students");
                addSheet(attendance, "Attendance");
                addSheet(permissions, "Permissions");
                if (adminSettings) addSheet([adminSettings], "Settings");
                addSheet(hostels, "Hostels");
                addSheet(transactions, "Transactions");
            }

            const buffer = XLSX.write(workbook, { type: "buffer", bookType: format === "csv" ? "csv" : "xlsx" });

            const contentType = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            const extension = format === "csv" ? "csv" : "xlsx";

            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `attachment; filename="hosteleaze_db_dump_${new Date().toISOString().split('T')[0]}.${extension}"`
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
