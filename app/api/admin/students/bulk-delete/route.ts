export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const { studentIds } = await request.json();

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "studentIds array is required" }, { status: 400 });
        }

        let deletedCount = 0;
        let authDeleteErrors = 0;

        for (const studentId of studentIds) {
            try {
                const student = await db.students.getById(studentId);
                if (student) {
                    const firebaseUID = student.firebaseUID;
                    if (firebaseUID) {
                        try {
                            await adminAuth.deleteUser(firebaseUID);
                        } catch (firebaseError: any) {
                            console.error(`Error deleting user ${firebaseUID} from Firebase Auth:`, firebaseError);
                            if (firebaseError.code !== "auth/user-not-found") {
                                authDeleteErrors++;
                            }
                        }
                    }

                    // Delete permissions
                    await db.permissions.deleteMany({ studentId });
                    // Delete student from database
                    await db.students.delete(studentId);
                    deletedCount++;
                }
            } catch (err) {
                console.error(`Error processing deletion for student ${studentId}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${deletedCount} students.`,
            deletedCount,
            authDeleteErrors
        }, { status: 200 });
    } catch (error: any) {
        console.error("Bulk delete API error:", error);
        return NextResponse.json({ error: error.message || "Failed to perform bulk delete action" }, { status: 500 });
    }
}
