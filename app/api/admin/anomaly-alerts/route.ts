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
import { writeAdminAuditLog } from "@/lib/auditLog";

const CONSECUTIVE_ABSENT_THRESHOLD = 3; // Alert after 3 consecutive absences

export async function GET(request: NextRequest) {
    try {
        // 1. Get all students
        const students = await db.students.list({});
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
        for (const student of students.slice(0, 200)) { // Cap at 200 to avoid timeout
            if (!student._id) continue;

            let consecutiveAbsent = 0;
            const missingDates: string[] = [];

            for (const date of dates) {
                const record = await db.attendance.checkToday(student._id.toString(), date);
                if (!record) {
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

                // Write audit log for anomaly detection
                writeAdminAuditLog({
                    action: "ATTENDANCE_ANOMALY_DETECTED",
                    entityType: "student",
                    entityId: student._id.toString(),
                    entityName: student.name || "Unknown",
                    details: {
                        consecutiveAbsentDays: consecutiveAbsent,
                        missingDates: missingDates.slice(0, consecutiveAbsent),
                        parentPhone: student.fatherNumber || student.motherNumber || "",
                    },
                    performedBy: "system",
                }).catch(console.error);
            }
        }

        return NextResponse.json({
            success: true,
            alerts,
            checkedStudents: Math.min(students.length, 200),
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
