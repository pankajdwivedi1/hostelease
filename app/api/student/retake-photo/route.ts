import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { studentId, firebaseUID, profilePicture, faceDescriptor } = body;

        const targetId = studentId || firebaseUID;
        if (!targetId) {
            return NextResponse.json({ success: false, error: "studentId or firebaseUID is required" }, { status: 400 });
        }

        if (!profilePicture || typeof profilePicture !== 'string' || profilePicture.length < 100) {
            return NextResponse.json({ success: false, error: "Valid live profile picture is required" }, { status: 400 });
        }

        // 🛡️ ANTI-SPOOF CHECK: Block digital screens, mobile gallery photos, and paper cutouts
        const { checkLivenessWithAIService } = await import("@/lib/aiAttendanceClient");
        const liveness = await checkLivenessWithAIService(profilePicture);
        if (liveness.isSpoof) {
            console.warn("❌ Registration Photo Rejected (Spoof):", liveness.reason);
            return NextResponse.json({
                success: false,
                error: `Photo Rejected: ${liveness.reason} You must capture a real physical face in person.`
            }, { status: 400 });
        }

        if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length < 128) {
            return NextResponse.json({ success: false, error: "Valid 128-dimensional face embedding is required" }, { status: 400 });
        }

        // Fetch current student by studentId or firebaseUID
        let student = await db.students.getById(targetId);
        if (!student && firebaseUID) {
            student = await db.students.findOne({ firebaseUID });
        }
        if (!student && studentId) {
            student = await db.students.getById(studentId);
        }
        if (!student) {
            return NextResponse.json({ success: false, error: "Student profile not found" }, { status: 404 });
        }

        const dynamicFields = typeof student.dynamicFields === 'object' && student.dynamicFields !== null 
            ? { ...student.dynamicFields } 
            : {};

        let finalProfilePicture = profilePicture;
        if (profilePicture && (profilePicture.startsWith("data:image/") || profilePicture.startsWith("data:"))) {
            try {
                const { saveFileToRailway } = await import("@/lib/fileStorage");
                const studentUid = (student as any).firebaseUid || student.firebaseUID || firebaseUID || targetId;
                const tenantFolder = student.tenantId || "default";
                const filename = `${studentUid}_${Date.now()}`;
                const savedUrl = await saveFileToRailway(profilePicture, `profile-pictures/${tenantFolder}`, filename);
                if (savedUrl) {
                    finalProfilePicture = savedUrl;
                }
            } catch (r2Err: any) {
                console.warn("⚠️ Failed to upload retaken photo to R2:", r2Err.message);
            }
        }

        const updatePayload: any = {
            profilePicture: finalProfilePicture,
            faceDescriptor,
            dynamicFields,
            firebaseUid: (student as any).firebaseUid || student.firebaseUID || firebaseUID,
            email: student.email,
            phoneNumber: student.phoneNumber
        };

        const studentIdToUpdate = student._id || student.id || targetId;
        const updated = await db.students.update(studentIdToUpdate, updatePayload);


        return NextResponse.json({
            success: true,
            message: "Live face photo and embeddings saved successfully!",
            student: updated || { ...student, ...updatePayload }
        });
    } catch (error: any) {
        console.error("Retake Photo POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
