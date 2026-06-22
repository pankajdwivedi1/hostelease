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

        // Fetch student field progress via adapter (try both studentId and firebaseUID for robustness)
        let progress = await db.studentFieldProgress.find({ studentId: student._id });
        // Fallback: if no progress found by _id, try by firebaseUID (handles Supabase vs Firebase ID mismatch)
        if (!progress || progress.length === 0) {
            progress = await db.studentFieldProgress.find({ firebaseUID: student.firebaseUID });
        }

        // Check which required fields are missing or need updating
        const enabledFields = enforcement.enforcedFields.filter((f: any) => f.isEnabled);
        const missingFields: any[] = [];

        // ── Helper: resolve the actual student property key from fieldId OR fieldLabel ──
        // When admin adds a field via Form Builder, fieldId may be a random string like
        // "name_copy_1782065596117" instead of the real student property "gender".
        // We use the fieldLabel to find the canonical property name as a fallback.
        const LABEL_TO_FIELD: Record<string, string> = {
            // Label (lowercase) → actual student property key
            "gender": "gender",
            "current year": "year",
            "year": "year",
            "semester": "semester",
            "social category": "category",
            "category": "category",
            "section": "section",
            "floor number": "floorNumber",
            "room number": "roomNumber",
            "hostel name": "hostelName",
            "hostel joining date": "joiningDate",
            "joining date": "joiningDate",
            "date of birth": "dob",
            "dob": "dob",
            "home state": "homeState",
            "father's name": "fatherName",
            "mother's name": "motherName",
            "erp id": "erpId",
            "college name": "collegeName",
            "branch": "branch",
            "permanent address": "permanentAddress",
        };

        const resolveFieldKey = (fieldId: string, fieldLabel: string): string => {
            // First try the fieldId directly as a student property
            if ((student as any)[fieldId] !== undefined) return fieldId;
            if ((student as any).dynamicFields?.[fieldId] !== undefined) return fieldId;
            // Fallback: use the label to find the real property name
            const canonicalKey = LABEL_TO_FIELD[fieldLabel?.toLowerCase()?.trim()];
            if (canonicalKey) return canonicalKey;
            // Last resort: return the original fieldId
            return fieldId;
        };

        for (const field of enabledFields) {
            const resolvedKey = resolveFieldKey(field.fieldId, field.fieldLabel);
            const fieldValue = (student as any)[resolvedKey] ?? (student as any).dynamicFields?.[resolvedKey];
            const progressRecord = progress.find((p: any) => p.fieldId === field.fieldId);


            const isEmpty =
                fieldValue === undefined ||
                fieldValue === null ||
                fieldValue === "" ||
                (typeof fieldValue === "string" && fieldValue.trim() === "");

            // ✅ CORRECT BLOCKER LOGIC (handles all 3 cases):
            //
            // Case 1: Field is empty → ALWAYS block (student must fill it)
            //
            // Case 2: Field has value + skipCompleted=false → ALWAYS block
            //   (Admin wants this re-collected every enforcement cycle, e.g. re-confirm room number)
            //
            // Case 3: Field has value + skipCompleted=true/undefined + NO completed progress record
            //   → Block ONCE (this is a NEW enforcement rule the student hasn't confirmed yet)
            //   After student clicks "Save & Continue", a progress record is saved → never shown again
            //
            // Case 4: Field has value + completed progress record → NOT a blocker
            //   (Student has already confirmed this enforcement, respect their submission)
            let isBlocker = false;

            if (isEmpty) {
                // Case 1: Field genuinely missing — must fill
                isBlocker = true;
            } else if (field.skipCompleted === false) {
                // Case 2: Admin wants repeated collection — block if no completed progress
                isBlocker = !progressRecord?.isCompleted;
            } else {
                // Case 3 vs 4: Has value, skipCompleted=true
                // Block if no completed progress record (new enforcement not yet confirmed)
                // Do NOT block if progress record exists and isCompleted=true
                isBlocker = !progressRecord || !progressRecord.isCompleted;
            }

            if (isBlocker) {
                // Only push the fields that are ACTUAL blockers (not all enforced fields)
                missingFields.push({
                    fieldId: field.fieldId,
                    fieldLabel: field.fieldLabel,
                    displayMode: field.displayMode,
                    durationDays: field.durationDays,
                    order: field.order || 0,
                    isCurrentlyEmpty: isEmpty
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

