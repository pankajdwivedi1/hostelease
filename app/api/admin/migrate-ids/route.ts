import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const students = await Student.find({});
        students.sort((a, b) => a.name.localeCompare(b.name));

        const hostelPrefixes: { [key: string]: string } = {
            "Guest House Boys Hostel": "GUEST",
            "Boys Hostel": "BOYS",
            "Gangotri Hostel": "GANGOTRI",
            "Gaytri Hostel": "GAYTRI"
        };

        const counters: { [key: string]: number } = {
            "GUEST": 0,
            "BOYS": 0,
            "GANGOTRI": 0,
            "GAYTRI": 0
        };

        const updates = [];

        for (const student of students) {
            let prefix = "STUDENT";
            // Find matching prefix
            for (const [name, p] of Object.entries(hostelPrefixes)) {
                if (student.hostelName.toLowerCase().includes(name.toLowerCase())) {
                    prefix = p;
                    break;
                }
            }

            counters[prefix] = (counters[prefix] || 0) + 1;
            const regId = `${prefix}-${String(counters[prefix]).padStart(4, '0')}`;

            updates.push(
                Student.findByIdAndUpdate(student._id, { registrationId: regId })
            );
        }

        await Promise.all(updates);

        return NextResponse.json({
            success: true,
            message: `Updated ${updates.length} students with registration IDs`,
            details: counters
        });
    } catch (error: any) {
        console.error("Migration error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
