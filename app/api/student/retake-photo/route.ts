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

        if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length < 128) {
            return NextResponse.json({ success: false, error: "Valid 128-dimensional face embedding is required" }, { status: 400 });
        }

        // Fetch current student by studentId or firebaseUID
        let student = await db.students.getById(targetId);
        if (!student && firebaseUID) {
            student = await db.students.getByFirebaseUID(firebaseUID);
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

        // Explicitly clear recapture flag
        dynamicFields.requiresFaceRecapture = false;

        const updatePayload: any = {
            profilePicture,
            faceDescriptor,
            dynamicFields,
            firebaseUid: student.firebaseUid || student.firebaseUID || firebaseUID,
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
