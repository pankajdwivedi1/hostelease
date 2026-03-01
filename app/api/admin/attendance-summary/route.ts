import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const requestedDate = searchParams.get("date");

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

        // 6. Aggregate results into categories
        if (result.records && Array.isArray(result.records)) {
            // Supabase style return: records array
            // Optimization: Count unique students per hostel category
            const processedStudentsPerHostel = new Map<string, Set<string>>();

            result.records.forEach((record: any) => {
                const category = getHostelCategory(record.hostel_name || record.hostelName);
                const studentId = record.student_id || record.studentId || "unknown";

                if (!processedStudentsPerHostel.has(category)) {
                    processedStudentsPerHostel.set(category, new Set());
                }
                processedStudentsPerHostel.get(category)!.add(studentId);
            });

            // Convert sets to counts
            processedStudentsPerHostel.forEach((studentSet, category) => {
                formattedSummary[category] = studentSet.size;
            });
        } else if (result.summary && Array.isArray(result.summary)) {
            // Mongo style return: [{_id: 'Hostel Name', count: 10}]
            // Note: MongoDB aggregation with $group might already count unique students if written that way,
            // but for safety we'll assume item.count is correct or re-calculate if possible.
            // In MongoAdapter, it's just a count. Let's trust $group { $sum: 1 } for now but keep fuzzy matching.
            result.summary.forEach((item: any) => {
                const category = getHostelCategory(item._id);
                formattedSummary[category] = (formattedSummary[category] || 0) + (item.count || 0);
            });
        }

        // 7. Get global settings for manual attendance toggle
        const settings = await db.settings.get();
        const enableManualAttendance = settings?.enableManualAttendance ?? false;

        return NextResponse.json({
            success: true,
            summary: formattedSummary,
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
