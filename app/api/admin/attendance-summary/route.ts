import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Attendance from "@/models/Attendance";
import Hostel from "@/models/Hostel";
import { db } from "@/lib/dbAdapter"; // Import dbAdapter
import { supabase } from "@/lib/supabase"; // Import Supabase client

// Cache for Hostel list
let cachedHostels: any[] | null = null;
let lastHostelUpdate = 0;
const HOSTEL_CACHE_DURATION = 300000; // 5 minutes

export async function GET(request: NextRequest) {
    try {
        const source = await db.getSource(); // Check active DB
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

        // Use regex to split by any non-digit character (handles / or -)
        const dateParts = istDateStr.split(/[^0-9]/);
        let today = "";

        if (dateParts.length >= 3) {
            // Check if year is at index 0 or 2
            if (dateParts[0].length === 4) {
                today = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
            } else {
                today = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
        } else {
            // Fallback for unexpected formats
            today = dateObj.toISOString().split('T')[0];
        }

        const date = requestedDate || today;

        // Fetch hostels to use for mapping (Optimized with cache)
        // Note: Hostels are still in Mongo for now unless we migrate them too. 
        // Assuming metadata like Hostels is in Mongo or replicated. 
        // If Hostels are not in Supabase, we read from Mongo (since it's metadata).
        // Since the app seems to use Mongo for static/metadata, we keep fetching Hostels from Mongo for mapping.

        let hostelsList;
        try {
            await connectDB();
            const nowMs = Date.now();
            if (cachedHostels && (nowMs - lastHostelUpdate < HOSTEL_CACHE_DURATION)) {
                hostelsList = cachedHostels;
            } else {
                hostelsList = await Hostel.find().lean();
                cachedHostels = hostelsList;
                lastHostelUpdate = nowMs;
            }
        } catch (e) {
            // If Mongo fails, use empty list or fallback
            hostelsList = [];
            console.warn("Failed to fetch hostels list from Mongo:", e);
        }

        const canonicalHostelNames = hostelsList.map(h => h.name);

        const getHostelCategory = (rawName: string): string => {
            const name = (rawName || "").toLowerCase().trim();

            // Try explicit match first
            const exactMatch = canonicalHostelNames.find(h => h.toLowerCase() === name);
            if (exactMatch) return exactMatch;

            // Pattern based categorization
            if (name.includes("gaytri") || name.includes("hostel a")) return "Gaytri Hostel";
            if (name.includes("gangotri") || name.includes("hostel b")) return "Gangotri Hostel";
            if (name.includes("guest") || name.includes("guess") || name.includes("hostel d")) return "Guest House Boys Hostel";
            if (name.includes("boys") || name.includes("hostel c")) return "Boys Hostel";

            // Try to find the closest match in canonical names if still not found
            const closeMatch = canonicalHostelNames.find(h => name.includes(h.toLowerCase()) || h.toLowerCase().includes(name));
            return closeMatch || rawName;
        };

        const formattedSummary: Record<string, number> = {};
        // Initialize all canonical hostels with 0
        canonicalHostelNames.forEach(name => {
            formattedSummary[name] = 0;
        });

        let presentStudentIds: string[] = [];

        if (source === 'SUPABASE') {
            // SUPABASE LOGIC
            const { data: attendanceData, error } = await supabase
                .from('attendance')
                .select('student_id, hostel_name')
                .eq('date', date)
                .neq('is_test', true);

            if (error) throw error;

            attendanceData?.forEach((record: any) => {
                const category = getHostelCategory(record.hostel_name);
                if (formattedSummary[category] !== undefined) {
                    formattedSummary[category] += 1;
                } else {
                    formattedSummary[category] = 1;
                }
                if (record.student_id) presentStudentIds.push(record.student_id);
            });

        } else {
            // MONGODB LOGIC
            await connectDB();
            // Get counts grouped by raw hostelName for the selected date
            const summary = await Attendance.aggregate([
                { $match: { date: date, isTest: { $ne: true } } },
                { $group: { _id: "$hostelName", count: { $sum: 1 } } }
            ]);

            // Map aggregated counts to categories
            summary.forEach(item => {
                const category = getHostelCategory(item._id);
                if (formattedSummary[category] !== undefined) {
                    formattedSummary[category] += item.count;
                } else {
                    formattedSummary[category] = item.count; // New category found
                }
            });

            // Also get the list of studentIds who marked attendance to highlight them in UI
            const presentStudents = await Attendance.find({ date: date, isTest: { $ne: true } }).select("studentId");
            presentStudentIds = presentStudents.map(a => a.studentId.toString());
        }

        return NextResponse.json({
            success: true,
            summary: formattedSummary,
            presentStudentIds,
            date: date
        });
    } catch (error: any) {
        console.error("Error fetching attendance summary:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch attendance summary" },
            { status: 500 }
        );
    }
}
