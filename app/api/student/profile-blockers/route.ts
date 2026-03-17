import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

/**
 * GET - Check which required fields are missing for a student
 * Returns: { hasBlockers: boolean, missingFields: [], enforcement: {} }
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");

        if (!studentId) {
            return NextResponse.json(
                { error: "studentId is required" },
                { status: 400 }
            );
        }

        // Fetch student data using adapter
        const student = await db.students.getById(studentId);
        if (!student) {
            return NextResponse.json(
                { error: "Student not found" },
                { status: 404 }
            );
        }

        // Fetch field enforcement rules for student's hostel
        const studentHostel = (student.hostelName || "").trim();
        console.log(`🔍 Checking blockers for student: ${studentId}, Hostel: "${studentHostel}"`);

        // Use adapter for enforcement lookup
        const rules = await db.fieldEnforcement.find({
            hostelName: { $regex: `^${studentHostel}$` }
        });

        // Find the active rule (usually only one per hostel)
        const enforcement = rules.find((r: any) => r.isActive);

        // If no enforcement rules or not active, no blockers
        if (!enforcement) {
            console.log(`ℹ️ No active enforcement rules found for hostel: "${studentHostel}"`);
            return NextResponse.json({
                hasBlockers: false,
                missingFields: [],
                enforcement: null,
                message: `No field enforcement active for hostel: "${studentHostel}"`,
                debug: {
                    studentHostel: studentHostel,
                    attemptedMatch: studentHostel
                }
            });
        }

        // Fetch student field progress via adapter
        const progress = await db.studentFieldProgress.find({
            studentId: student._id
        });

        console.log(`✅ Found ${enforcement.enforcedFields.length} rules. Student has ${progress.length} progress records.`);

        // Check which required fields are missing or need updating
        const enabledFields = enforcement.enforcedFields.filter((f: any) => f.isEnabled);
        const missingFields: any[] = [];

        // First pass: Determine if ANY field requires action
        let hasAnyActionRequired = false;
        const allEnforcedFields: any[] = [];

        for (const field of enabledFields) {
            const fieldValue = (student as any)[field.fieldId] ?? (student as any).dynamicFields?.[field.fieldId];
            const progressRecord = progress.find((p: any) => p.fieldId === field.fieldId);

            const isEmpty =
                fieldValue === undefined ||
                fieldValue === null ||
                fieldValue === "" ||
                (typeof fieldValue === "string" && fieldValue.trim() === "");

            let isBlocker = false;
            if (isEmpty) {
                isBlocker = true;
            } else if (field.skipCompleted === false) {
                isBlocker = true;
            } else if (field.skipCompleted === true && (!progressRecord || !progressRecord.isCompleted)) {
                isBlocker = true;
            }

            if (isBlocker) {
                hasAnyActionRequired = true;
            }

            allEnforcedFields.push({
                fieldId: field.fieldId,
                fieldLabel: field.fieldLabel,
                displayMode: field.displayMode,
                durationDays: field.durationDays,
                order: field.order || 0,
                isCurrentlyEmpty: isEmpty
            });
        }

        // If at least one blocker is found, return the full list of enabled fields
        if (hasAnyActionRequired) {
            missingFields.push(...allEnforcedFields);
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
            debug: {
                hostelMatched: enforcement.hostelName,
                totalRules: enabledFields.length,
                progressCount: progress.length,
                missingCount: missingFields.length
            }
        });

    } catch (error: any) {
        console.error("Error checking profile blockers:", error);
        return NextResponse.json(
            { error: error.message || "Failed to check profile blockers" },
            { status: 500 }
        );
    }
}

