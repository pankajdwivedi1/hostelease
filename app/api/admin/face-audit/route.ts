import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const auditData = await db.students.audit("face-audit");
        return NextResponse.json({
            success: true,
            students: auditData
        });
    } catch (error: any) {
        console.error("Face Audit GET Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { studentIds, requiresFaceRecapture, vectorUpdates } = body;

        if (Array.isArray(vectorUpdates) && vectorUpdates.length > 0) {
            let vectorSuccessCount = 0;
            for (const item of vectorUpdates) {
                if (item.studentId && Array.isArray(item.faceDescriptor) && item.faceDescriptor.length > 0) {
                    try {
                        await db.students.update(item.studentId, {
                            faceDescriptor: item.faceDescriptor
                        });
                        vectorSuccessCount++;
                    } catch (err) {
                        console.warn(`Failed to backfill face vector for student ${item.studentId}:`, err);
                    }
                }
            }
            return NextResponse.json({
                success: true,
                updatedCount: vectorSuccessCount,
                message: `Successfully backfilled biometric face vectors for ${vectorSuccessCount} student(s).`
            });
        }

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ success: false, error: "studentIds or vectorUpdates array is required" }, { status: 400 });
        }

        let updatedCount = 0;

        for (const id of studentIds) {
            try {
                const student = await db.students.getById(id);
                if (!student) continue;

                const dynamicFields = typeof student.dynamicFields === 'object' && student.dynamicFields !== null 
                    ? { ...student.dynamicFields } 
                    : {};

                dynamicFields.requiresFaceRecapture = !!requiresFaceRecapture;

                await db.students.update(id, {
                    dynamicFields
                });
                updatedCount++;
            } catch (err) {
                console.warn(`Failed to update face retake flag for student ${id}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            updatedCount,
            message: requiresFaceRecapture 
                ? `Enforced live face recapture on ${updatedCount} student(s).`
                : `Cleared face retake flag for ${updatedCount} student(s).`
        });
    } catch (error: any) {
        console.error("Face Audit POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
