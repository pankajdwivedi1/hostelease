import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import FieldEnforcement from "@/models/FieldEnforcement";

export const dynamic = "force-dynamic";

/**
 * GET - Check which required fields are missing for a student
 * Returns: { hasBlockers: boolean, missingFields: [], enforcement: {} }
 */
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");

        if (!studentId) {
            return NextResponse.json(
                { error: "studentId is required" },
                { status: 400 }
            );
        }

        // Fetch student data
        const student = await Student.findById(studentId).lean();
        if (!student) {
            return NextResponse.json(
                { error: "Student not found" },
                { status: 404 }
            );
        }

        // Fetch field enforcement rules for student's hostel
        const enforcement = await FieldEnforcement.findOne({
            hostelName: student.hostelName,
            isActive: true // Only if field enforcement is active
        }).lean();

        // If no enforcement rules or not active, no blockers
        if (!enforcement || !enforcement.isActive) {
            return NextResponse.json({
                hasBlockers: false,
                missingFields: [],
                enforcement: null,
                message: "No field enforcement active for this hostel"
            });
        }

        // Check which required fields are missing
        const enabledFields = enforcement.enforcedFields.filter((f: any) => f.isEnabled);
        const missingFields: any[] = [];

        for (const field of enabledFields) {
            const fieldValue = (student as any)[field.fieldId];

            // Check if field is empty/missing
            const isEmpty =
                fieldValue === undefined ||
                fieldValue === null ||
                fieldValue === "" ||
                (typeof fieldValue === "string" && fieldValue.trim() === "");

            if (isEmpty) {
                missingFields.push({
                    fieldId: field.fieldId,
                    fieldLabel: field.fieldLabel,
                    displayMode: field.displayMode,
                    durationDays: field.durationDays,
                    order: field.order || 0
                });
            }
        }

        // Sort by order
        missingFields.sort((a, b) => a.order - b.order);

        return NextResponse.json({
            hasBlockers: missingFields.length > 0,
            missingFields: missingFields,
            enforcement: {
                hostelName: enforcement.hostelName,
                notificationPriority: enforcement.notificationPriority,
                successMessage: enforcement.successMessage,
                autoCloseNotification: enforcement.autoCloseNotification
            },
            totalMissing: missingFields.length
        });

    } catch (error: any) {
        console.error("Error checking profile blockers:", error);
        return NextResponse.json(
            { error: error.message || "Failed to check profile blockers" },
            { status: 500 }
        );
    }
}
