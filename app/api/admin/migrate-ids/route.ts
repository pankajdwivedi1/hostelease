import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const source = await db.getSource();
        const adminSettings = await db.settings.get();
        let hostelPrefixMap = adminSettings?.hostelPrefixMap || [
            { hostelName: "GHB Hostel", prefix: "GUEST" },
            { hostelName: "Boys Hostel", prefix: "BOYS" },
            { hostelName: "Gangotri Hostel", prefix: "GANGOTRI" },
            { hostelName: "Gaytri Hostel", prefix: "GAYTRI" }
        ];

        const students = await db.students.list({});
        students.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));

        const counters: { [key: string]: number } = {};
        const updates = [];

        for (const student of students) {
            if (!student) continue;

            let prefix = "STUDENT";
            // Find matching prefix
            if (Array.isArray(hostelPrefixMap)) {
                for (const mapping of hostelPrefixMap) {
                    if (student.hostelName?.toLowerCase().includes(mapping.hostelName.toLowerCase())) {
                        prefix = mapping.prefix;
                        break;
                    }
                }
            } else {
                for (const [name, p] of Object.entries(hostelPrefixMap)) {
                    if (student.hostelName?.toLowerCase().includes(name.toLowerCase())) {
                        prefix = p as string;
                        break;
                    }
                }
            }

            counters[prefix] = (counters[prefix] || 0) + 1;
            const regId = `${prefix}-${String(counters[prefix]).padStart(4, '0')}`;

            const studentId = (student._id || student.id)?.toString();
            if (studentId) {
                updates.push(
                    db.students.update(studentId, { registrationId: regId })
                );
            }
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
