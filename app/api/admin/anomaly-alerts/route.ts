export const dynamic = "force-dynamic";

/**
 * 🚨 Smart Attendance Anomaly Alerts
 * 
 * Detects students with 3+ consecutive absent days and sends
 * an in-app notification to the Warden.
 * 
 * Call this endpoint:
 *  - GET /api/admin/anomaly-alerts         → run detection and return results
 *  - Called by AdminDashboard on page load or manually triggered
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

const CONSECUTIVE_ABSENT_THRESHOLD = 3; // Alert after 3 consecutive absences

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const hostelFilter = searchParams.get("hostelName");
        const authHostelsParam = searchParams.get("authorizedHostels");

        // Parse authorized hostels if provided
        let authorizedHostels: string[] = [];
        if (authHostelsParam) {
            try {
                authorizedHostels = JSON.parse(authHostelsParam);
            } catch (e) {
                authorizedHostels = [authHostelsParam];
            }
        } else if (hostelFilter && hostelFilter !== "all") {
            authorizedHostels = [hostelFilter];
        }

        // 1. Get students matching the filter/authorized hostels
        let students: any[] = [];
        if (authorizedHostels.length > 0) {
            const studentsListList = await Promise.all(authorizedHostels.map(async (h) => {
                const list = await db.students.list({ hostelName: h });
                return Array.isArray(list) ? list : [];
            }));
            students = studentsListList.flat();
        } else {
            students = await db.students.list({});
        }

        // Deduplicate students by id if needed
        const seenIds = new Set<string>();
        students = students.filter(student => {
            if (!student || !student._id) return false;
            const idStr = student._id.toString();
            if (seenIds.has(idStr)) return false;
            seenIds.add(idStr);
            return true;
        });

        if (!students || students.length === 0) {
            return NextResponse.json({ success: true, alerts: [], message: "No students found" });
        }

        // 2. Build date array for last 7 days (IST)
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).split('/').reverse().join('-');
            dates.push(dateStr);
        }
        // dates[0] = today, dates[1] = yesterday, etc.

        // Fetch all attendance records for the last 7 days in a single range query
        const earliestDate = dates[6];
        const latestDate = dates[0];
        const attendanceLogs = await db.attendance.list({
            startDate: earliestDate,
            endDate: latestDate
        }, { limit: 10000 });

        const attendanceSet = new Set(
            (attendanceLogs || []).map((log: any) => {
                const sid = typeof log.studentId === 'object' && log.studentId !== null
                    ? (log.studentId._id || log.studentId.id)
                    : log.studentId;
                return `${sid}_${log.date}`;
            })
        );

        const alerts: Array<{
            studentId: string;
            studentName: string;
            hostelName: string;
            roomNumber: string;
            consecutiveAbsentDays: number;
            parentPhone: string;
            missingDates: string[];
        }> = [];

        // 3. Check each student
        for (const student of students) {
            if (!student._id) continue;

            let consecutiveAbsent = 0;
            const missingDates: string[] = [];

            for (const date of dates) {
                const hasAttendance = attendanceSet.has(`${student._id.toString()}_${date}`);
                if (!hasAttendance) {
                    consecutiveAbsent++;
                    missingDates.push(date);
                } else {
                    break; // Stop at first day they WERE present
                }
            }

            if (consecutiveAbsent >= CONSECUTIVE_ABSENT_THRESHOLD) {
                alerts.push({
                    studentId: student._id.toString(),
                    studentName: student.name || "Unknown",
                    hostelName: student.hostelName || "",
                    roomNumber: student.roomNumber || "",
                    consecutiveAbsentDays: consecutiveAbsent,
                    parentPhone: student.fatherNumber || student.motherNumber || "",
                    missingDates: missingDates.slice(0, consecutiveAbsent),
                });
            }
        }

        return NextResponse.json({
            success: true,
            alerts,
            checkedStudents: students.length,
            threshold: CONSECUTIVE_ABSENT_THRESHOLD,
            message: alerts.length === 0
                ? "✅ No attendance anomalies detected"
                : `⚠️ ${alerts.length} student(s) absent for ${CONSECUTIVE_ABSENT_THRESHOLD}+ consecutive days`,
        });

    } catch (error: any) {
        console.error("[ANOMALY ALERTS] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to run anomaly detection" },
            { status: 500 }
        );
    }
}
