import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch public student information by registration ID
export async function GET(
    request: NextRequest,
    { params }: { params: { registrationId: string } }
) {
    try {
        const { registrationId } = params;

        if (!registrationId) {
            return NextResponse.json(
                { success: false, error: "Registration ID is required" },
                { status: 400 }
            );
        }

        // Find student by registration ID using dbAdapter
        const students = await db.students.list({
            registrationId: registrationId.toUpperCase()
        });

        const student = students[0];

        if (!student) {
            return NextResponse.json(
                { success: false, error: "Student not found" },
                { status: 404 }
            );
        }

        // Return public student information
        return NextResponse.json({
            success: true,
            student: {
                name: student.name,
                email: student.email,
                phoneNumber: student.phoneNumber,
                collegeName: student.collegeName,
                branch: student.branch,
                section: student.section,
                hostelName: student.hostelName,
                roomNumber: student.roomNumber,
                erpInformation: student.erpInformation,
                registrationId: student.registrationId,
                profilePicture: student.profilePicture,
                studentStatus: student.studentStatus
            }
        });

    } catch (error: any) {
        console.error("Error fetching public student info:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch student information" },
            { status: 500 }
        );
    }
}
