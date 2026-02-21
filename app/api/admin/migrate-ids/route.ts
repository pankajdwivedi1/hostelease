import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const source = await db.getSource();
        const settings = await db.settings.get();
        const hostelPrefixMap = settings?.hostelPrefixMap || {
            "Guest House Boys Hostel": "GUEST",
            "Boys Hostel": "BOYS",
            "Gangotri Hostel": "GANGOTRI",
            "Gaytri Hostel": "GAYTRI"
        };

        const students = await db.students.list({});
        students.sort((a: any, b: any) => a.name.localeCompare(b.name));

        const counters: { [key: string]: number } = {};
        const updates = [];

        for (const student of students) {
            let prefix = "STUDENT";
            // Find matching prefix
            for (const [name, p] of Object.entries(hostelPrefixMap)) {
                if (student.hostelName?.toLowerCase().includes(name.toLowerCase())) {
                    prefix = p as string;
                    break;
                }
            }

            counters[prefix] = (counters[prefix] || 0) + 1;
            const regId = `${prefix}-${String(counters[prefix]).padStart(4, '0')}`;

            updates.push(
                db.students.update(student._id.toString(), { registrationId: regId })
            );
        }

        await Promise.all(updates);

        return NextResponse.json({
            success: true,
            message: `Updated ${updates.length} students with registration IDs on ${source}`,
            details: counters
        });
    } catch (error: any) {
        console.error("Migration error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
