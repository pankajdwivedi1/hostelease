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
        const canonicalHostelNames = hostelsList.map((h: any) => h.name);

        const getHostelCategory = (rawName: string): string => {
            const name = (rawName || "").toLowerCase().trim();
            const exactMatch = canonicalHostelNames.find(h => h.toLowerCase() === name);
            if (exactMatch) return exactMatch;

            if (name.includes("gaytri") || name.includes("hostel a")) return "Gaytri Hostel";
            if (name.includes("gangotri") || name.includes("hostel b")) return "Gangotri Hostel";
            if (name.includes("guest") || name.includes("guess") || name.includes("hostel d")) return "Guest House Boys Hostel";
            if (name.includes("boys") || name.includes("hostel c")) return "Boys Hostel";

            const closeMatch = canonicalHostelNames.find(h => name.includes(h.toLowerCase()) || h.toLowerCase().includes(name));
            return closeMatch || rawName;
        };

        const formattedSummary: Record<string, number> = {};
        canonicalHostelNames.forEach(name => {
            formattedSummary[name] = 0;
        });

        const result = await db.attendance.summary(date);

        let presentStudentIds: string[] = result.presentStudentIds || [];

        if (result.records) {
            // Supabase style return
            result.records.forEach((record: any) => {
                const category = getHostelCategory(record.hostel_name);
                formattedSummary[category] = (formattedSummary[category] || 0) + 1;
            });
        } else if (result.summary) {
            // MongoDB style return
            result.summary.forEach((item: any) => {
                const category = getHostelCategory(item._id);
                formattedSummary[category] = (formattedSummary[category] || 0) + item.count;
            });
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
