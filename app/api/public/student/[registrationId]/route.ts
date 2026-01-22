import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

// GET - Fetch public student information by registration ID
export async function GET(
    request: NextRequest,
    { params }: { params: { registrationId: string } }
) {
    try {
        await connectDB();

        const { registrationId } = params;

        if (!registrationId) {
            return NextResponse.json(
                { success: false, error: "Registration ID is required" },
                { status: 400 }
            );
        }

        // Find student by registration ID
        const student = await Student.findOne({
            registrationId: registrationId.toUpperCase()
        }).select(
            'name email phoneNumber collegeName branch section hostelName roomNumber erpInformation registrationId profilePicture studentStatus'
        ).lean();

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
