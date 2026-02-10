import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Attendance from "@/models/Attendance";
import Hostel from "@/models/Hostel";

// Cache for Hostel list
let cachedHostels: any[] | null = null;
let lastHostelUpdate = 0;
const HOSTEL_CACHE_DURATION = 300000; // 5 minutes

export async function GET(request: NextRequest) {
    try {
        await connectDB();

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
        const nowMs = Date.now();
        let hostelsList;
        if (cachedHostels && (nowMs - lastHostelUpdate < HOSTEL_CACHE_DURATION)) {
            hostelsList = cachedHostels;
        } else {
            hostelsList = await Hostel.find().lean();
            cachedHostels = hostelsList;
            lastHostelUpdate = nowMs;
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

        // Get counts grouped by raw hostelName for the selected date
        const summary = await Attendance.aggregate([
            { $match: { date: date, isTest: { $ne: true } } },
            { $group: { _id: "$hostelName", count: { $sum: 1 } } }
        ]);

        const formattedSummary: Record<string, number> = {};

        // Initialize all canonical hostels with 0
        canonicalHostelNames.forEach(name => {
            formattedSummary[name] = 0;
        });

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
        const presentStudentIds = presentStudents.map(a => a.studentId.toString());

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
