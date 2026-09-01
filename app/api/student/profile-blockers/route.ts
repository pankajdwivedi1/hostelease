import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

/**
 * GET - Check which enforced fields still need student confirmation/update.
 *
 * DESIGN:
 *   • Active enforcement rule for student's hostel dictates mandatory fields.
 *   • If displayMode === 'on-first-incomplete': ONLY block if student is actually missing data.
 *   • If displayMode === 'on-next-login' or 'on-login':
 *       - If student has completed THIS active enforcement cycle (progressRecord.isCompleted === true and
 *         (!enforcement.updatedAt || new Date(progressRecord.completedAt) >= new Date(enforcement.updatedAt))):
 *           NOT a blocker if skipCompleted !== false.
 *       - Otherwise: It IS a blocker. The student will be prompted to confirm/update their details.
 *   • If durationDays is configured and the enforcement period has expired: Do not block.
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
        if (!studentHostel) {
            return NextResponse.json({
                hasBlockers: false,
                missingFields: [],
                enforcement: null,
                message: "Student does not have a hostel assigned",
            });
        }

        const rules = await db.fieldEnforcement.find({
            hostelName: { $regex: `^${studentHostel}$`, $options: 'i' },
        });

        const enforcement = rules.find((r: any) => r.isActive && (r.hostelName || "").toLowerCase().trim() === studentHostel.toLowerCase());

        if (!enforcement || !Array.isArray(enforcement.enforcedFields) || enforcement.enforcedFields.length === 0) {
            return NextResponse.json({
                hasBlockers: false,
                missingFields: [],
                enforcement: null,
                message: `No active field enforcement for hostel: "${studentHostel}"`,
            });
        }

        // Check global duration (in days) if specified
        if (enforcement.durationDays && enforcement.durationDays > 0 && enforcement.updatedAt) {
            const ruleTime = new Date(enforcement.updatedAt).getTime();
            const durationMs = enforcement.durationDays * 24 * 60 * 60 * 1000;
            if (Date.now() - ruleTime > durationMs) {
                return NextResponse.json({
                    hasBlockers: false,
                    missingFields: [],
                    enforcement: null,
                    message: "Enforcement duration has expired",
                });
            }
        }

        // Fetch this student's field completion progress
        const strId = (student._id || student.id || "").toString();
        let progress = await db.studentFieldProgress.find({ studentId: strId, hostelName: studentHostel });
        if (!progress || progress.length === 0) {
            progress = await db.studentFieldProgress.find({ studentId: strId });
        }
        if (!progress || progress.length === 0) {
            progress = await db.studentFieldProgress.find({ firebaseUID: student.firebaseUID || strId });
        }
        if (!progress) progress = [];

        const enabledFields = enforcement.enforcedFields.filter((f: any) => f.isEnabled !== false);
        const missingFields: any[] = [];
        const ruleUpdatedAt = enforcement.updatedAt ? new Date(enforcement.updatedAt).getTime() : 0;

        for (const field of enabledFields) {
            const progressRecord = progress.find(
                (p: any) => p.fieldId === field.fieldId
            );

            // Check if student profile already has a value saved
            const profileVal = (student as any)[field.fieldId] ?? student.dynamicFields?.[field.fieldId] ?? "";
            const hasValueInProfile = profileVal !== null && profileVal !== undefined && String(profileVal).trim() !== "";

            const isProgressCompleted = !!progressRecord?.isCompleted;
            const progressCompletedAt = progressRecord?.completedAt ? new Date(progressRecord.completedAt).getTime() : 0;

            // Verified completion for this cycle (completed on/after the rule was configured/applied)
            const isCompletedInCurrentCycle = isProgressCompleted && (ruleUpdatedAt === 0 || progressCompletedAt >= (ruleUpdatedAt - 10000));

            // Check field-level durationDays if specified
            if (field.durationDays && field.durationDays > 0 && ruleUpdatedAt > 0) {
                const durationMs = field.durationDays * 24 * 60 * 60 * 1000;
                if (Date.now() - ruleUpdatedAt > durationMs) {
                    continue; // Skip this field as its duration has elapsed
                }
            }

            let isBlocker = false;

            if (field.displayMode === "on-first-incomplete") {
                // Only block if value is genuinely missing/blank in profile
                isBlocker = !hasValueInProfile;
            } else if (field.skipCompleted === false) {
                // Admin wants this re-submitted on every login
                isBlocker = true;
            } else {
                // on-next-login or on-login: Block if student hasn't completed in this cycle
                isBlocker = !isCompletedInCurrentCycle;
            }

            if (isBlocker) {
                missingFields.push({
                    fieldId: field.fieldId,
                    fieldLabel: field.fieldLabel,
                    displayMode: field.displayMode || "on-next-login",
                    durationDays: field.durationDays,
                    order: field.order || 0,
                    currentValue: hasValueInProfile ? String(profileVal) : "",
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
                notificationPriority: enforcement.notificationPriority || "normal",
                successMessage: enforcement.successMessage || "All required fields have been completed! Thank you.",
                autoCloseNotification: enforcement.autoCloseNotification ?? true,
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
