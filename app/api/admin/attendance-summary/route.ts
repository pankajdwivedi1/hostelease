import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const requestedDate = searchParams.get("date");
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

        // Get today's date in IST YYYY-MM-DD
        const dateObj = new Date();
        const istDateStr = dateObj.toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });

        const dateParts = istDateStr.split(/[^0-9]/);
        let today = "";

        if (dateParts.length >= 3) {
            if (dateParts[0].length === 4) {
                today = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
            } else {
                today = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
        } else {
            today = dateObj.toISOString().split('T')[0];
        }

        const date = requestedDate || today;

        // Fetch hostels for mapping and category initialization
        const hostelsList = await db.hostels.getAll();

        if (!Array.isArray(hostelsList)) {
            console.error("[ATTENDANCE_SUMMARY] hostelsList is not an array:", hostelsList);
            throw new Error("Failed to retrieve hostels list");
        }

        const canonicalHostelNames = hostelsList
            .filter(h => h && h.name)
            .map((h: any) => h.name);

        console.log(`[ATTENDANCE_SUMMARY] Canonical Hostels:`, canonicalHostelNames);

        // 3. Helper to categorize hostel names (handling old data variations)
        const getHostelCategory = (rawName: string) => {
            if (!rawName) return "Other";
            const name = rawName.toUpperCase();

            // Priority 1: Match canonical names exactly first
            const exactMatch = canonicalHostelNames.find(c => c.toUpperCase() === name);
            if (exactMatch) return exactMatch;

            // Priority 2: Fuzzy matching for known categories
            if (name.includes("GUEST") || name.includes("GHB")) return "GHB Hostel";
            if (name.includes("GANGOTRI")) return "Gangotri Hostel";
            if (name.includes("GAYATRI") || name.includes("GAYTRI")) return "Gaytri Hostel";
            if (name.includes("BOYS")) return "Boys Hostel";

            return rawName; // Fallback to raw name if no category matches
        };

        // 4. Initialize summary with 0 for all canonical hostels
        const formattedSummary: Record<string, number> = {};
        canonicalHostelNames.forEach(name => {
            formattedSummary[name] = 0;
        });

        // 5. Fetch Attendance Summary from DB
        console.log(`[ATTENDANCE_SUMMARY] Fetching for date: ${date}`);
        const result = await db.attendance.summary(date);

        if (!result) {
            console.error("[ATTENDANCE_SUMMARY] db.attendance.summary returned null/undefined");
            throw new Error("Database returned no result for summary");
        }

        let presentStudentIds: string[] = result.presentStudentIds || [];

        // 6. Aggregate results into categories using the summary returned by the adapter
        if (result.summary && Array.isArray(result.summary)) {
            // result.summary is [{_id: 'Hostel Name', count: 10}]
            result.summary.forEach((item: any) => {
                const category = getHostelCategory(item._id);
                // Filter by authorized hostels if provided
                if (authorizedHostels.length > 0 && !authorizedHostels.includes(category)) return;
                formattedSummary[category] = (formattedSummary[category] || 0) + (item.count || 0);
            });
        }

        // 7. Get global settings for manual attendance toggle
        const settings = await db.settings.get();
        const enableManualAttendance = settings?.enableManualAttendance ?? false;

        // ⚡ MAJOR OPTIMIZATION: Consolidate 20+ count queries into 1 single fetch
        const [studentData, pendingCountResult] = await Promise.all([
            db.students.list({}, { select: 'hostel_name,student_status' }),
            db.permissions.count({ status: 'pending' })
        ]);

        let studentList = Array.isArray(studentData) ? studentData : [];
        const pendingCount = typeof pendingCountResult === 'number' ? pendingCountResult : 0;
        
        // ⚡ WARDEN FILTER: If authorized hostels are specified, filter the student list
        if (authorizedHostels.length > 0) {
            studentList = studentList.filter((s: any) => {
                const category = getHostelCategory(s.hostelName);
                return authorizedHostels.includes(category);
            });
        }

        // Global Stats (Now filtered for Wardens if applicable)
        const stats = {
            totalStudents: studentList.length,
            totalIn: studentList.filter((s: any) => s.studentStatus === 'in').length,
            totalOut: studentList.filter((s: any) => s.studentStatus === 'out').length,
            pendingPermissions: pendingCount // Pending permissions count remains global for simplicity or can be filtered if needed
        };

        // Hostel-Specific Stats
        const hostelStats: Record<string, { total: number; in: number; out: number }> = {};
        
        // Initialize hostelStats for all canonical hostels (or just authorized ones)
        const activeHostels = authorizedHostels.length > 0 ? authorizedHostels : canonicalHostelNames;
        activeHostels.forEach(h => {
            hostelStats[h] = { total: 0, in: 0, out: 0 };
        });

        // ⚡ SINGLE PASS: Aggregate counts for each hostel in memory
        studentList.forEach((s: any) => {
            const hCategory = getHostelCategory(s.hostelName);
            // Double check filtering
            if (authorizedHostels.length > 0 && !authorizedHostels.includes(hCategory)) return;

            if (!hostelStats[hCategory]) {
                hostelStats[hCategory] = { total: 0, in: 0, out: 0 };
            }
            hostelStats[hCategory].total++;
            if (s.studentStatus === 'in') hostelStats[hCategory].in++;
            else if (s.studentStatus === 'out') hostelStats[hCategory].out++;
        });

        return NextResponse.json({
            success: true,
            summary: formattedSummary, 
            hostelStats,              
            stats,
            presentStudentIds,
            enableManualAttendance,
            date
        });


    } catch (error: any) {
        console.error("❌ [ATTENDANCE_SUMMARY_ERROR]:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Internal Server Error",
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
