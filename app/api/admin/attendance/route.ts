import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get("date"); // Format: YYYY-MM-DD
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const hostelName = searchParams.get("hostelName");
        const studentId = searchParams.get("studentId");
        const id = searchParams.get("id");

        if (id) {
            const record = await db.attendance.getById(id);
            return NextResponse.json({ success: true, record });
        }

        // Date Validation Logic
        if (!studentId && !startDate && !date) {
            return NextResponse.json({ error: "Date or Date Range required" }, { status: 400 });
        }

        const filters = {
            date,
            startDate,
            endDate,
            hostelName,
            studentId
        };

        const attendance = await db.attendance.list(filters);

        return NextResponse.json({ success: true, attendance });
    } catch (error: any) {
        console.error("Error fetching attendance logs:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { studentIds } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "Student IDs are required" }, { status: 400 });
        }

        const now = new Date();
        const istDate = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).split('/').join('-');
        const istTime = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
        const today = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).split('/').reverse().join('-');

        const cookieStore = await cookies();
        const userType = cookieStore.get('userType')?.value || 'admin';

        // ⚡ BATCH OPTIMIZATION: Fetch all students in one single query instead of a loop
        const currentTenantId = await db.getTenantIdOrThrow();
        const students = await db.students.list({ 
            _id: { $in: studentIds },
            tenant_id: currentTenantId 
        }, { limit: studentIds.length });

        const attendanceRecords: any[] = [];
        
        for (const studentId of studentIds) {
            const student = students.find((s: any) => s._id.toString() === studentId);
            if (!student) continue;

            // Only mark if "IN" or status matches
            if (student.studentStatus !== 'in') continue;

            // Prepare bulk data
            attendanceRecords.push({
                studentId: student._id.toString(),
                firebaseUID: student.firebaseUID,
                name: student.name,
                hostelName: student.hostelName,
                roomNumber: student.roomNumber,
                date: today,
                istTime: istTime,
                istDate: istDate,
                location: { lat: 0, lng: 0, accuracy: 0 },
                status: "present",
                faceMatchStatus: "manual-override",
                needsReview: false,
                isTest: false,
                timestamp: now.toISOString(),
                tenantId: currentTenantId,
                deviceId: `marked-by-${userType}`
            });
        }

        if (attendanceRecords.length > 0) {
            // ⚡ BULK INSERT: Send all records to DB in one single trip
            const source = await db.getDbSource();
            if (source === 'SUPABASE') {
                const { error } = await db.supabase.from('attendance').insert(attendanceRecords.map(db.mapAttendanceToSnakeCase));
                if (error) throw error;
            } else {
                for (const rec of attendanceRecords) {
                    await db.attendance.mark(rec);
                }
            }
        }

        return NextResponse.json({ success: true, count: attendanceRecords.length });
    } catch (error: any) {
        console.error("Error marking manual attendance:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
