import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

/**
 * GET - Check which enforced fields still need student confirmation.
 *
 * DESIGN: Progress record is the SOLE source of truth.
 *   • No progress record for a field  → BLOCKER (student must confirm this enforcement once)
 *   • Progress record with isCompleted = true → NOT a blocker (already confirmed)
 *   • skipCompleted = false → ALWAYS block (admin wants repeated collection every cycle)
 *
 * We do NOT check the student's profile field values.
 * Even if the student has existing data, they must click "Save & Continue" once
 * per enforcement rule to acknowledge it. After that it never appears again.
 *
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

        // Fetch student
        const student = await db.students.getById(studentId);
        if (!student) {
            return NextResponse.json(
                { error: "Student not found" },
                { status: 404 }
            );
        }

        // Fetch active enforcement rules for this student's hostel
        const studentHostel = (student.hostelName || "").trim();

        const rules = await db.fieldEnforcement.find({
            hostelName: { $regex: `^${studentHostel}$` },
        });

        const enforcement = rules.find((r: any) => r.isActive);

        if (!enforcement) {
            return NextResponse.json({
                hasBlockers: false,
                missingFields: [],
                enforcement: null,
                message: `No active field enforcement for hostel: "${studentHostel}"`,
            });
        }

        // Fetch this student's field completion progress
        // Try by studentId first, fallback to firebaseUID to handle ID format differences
        let progress = await db.studentFieldProgress.find({ studentId: student._id });
        if (!progress || progress.length === 0) {
            progress = await db.studentFieldProgress.find({ firebaseUID: student.firebaseUID });
        }

        // ─────────────────────────────────────────────────────────────────
        // BLOCKER CHECK
        // A field blocks the student if they have not yet submitted a
        // completed progress record for it (for the current enforcement config).
        // ─────────────────────────────────────────────────────────────────
        const enabledFields = enforcement.enforcedFields.filter((f: any) => f.isEnabled);
        const missingFields: any[] = [];

        for (const field of enabledFields) {
            const progressRecord = progress.find(
                (p: any) => p.fieldId === field.fieldId
            );

            let isBlocker: boolean;

            if (field.skipCompleted === false) {
                // Admin wants this re-submitted every cycle (e.g., current year update)
                isBlocker = !progressRecord?.isCompleted;
            } else {
                // Default: show once until student confirms, then never again
                isBlocker = !progressRecord || !progressRecord.isCompleted;
            }

            if (isBlocker) {
                missingFields.push({
                    fieldId: field.fieldId,
                    fieldLabel: field.fieldLabel,
                    displayMode: field.displayMode,
                    durationDays: field.durationDays,
                    order: field.order || 0,
                });
            }
        }

        missingFields.sort((a, b) => a.order - b.order);

        return NextResponse.json({
            hasBlockers: missingFields.length > 0,
            missingFields,
            enforcement: {
                _id: enforcement._id,
                hostelName: enforcement.hostelName,
                notificationPriority: enforcement.notificationPriority,
                successMessage: enforcement.successMessage,
                autoCloseNotification: enforcement.autoCloseNotification,
            },
            debug: {
                hostelMatched: enforcement.hostelName,
                totalFields: enabledFields.length,
                progressCount: progress.length,
                missingCount: missingFields.length,
            },
        });

    } catch (error: any) {
        console.error("Error checking profile blockers:", error);
        return NextResponse.json(
            { error: error.message || "Failed to check profile blockers" },
            { status: 500 }
        );
    }
}
