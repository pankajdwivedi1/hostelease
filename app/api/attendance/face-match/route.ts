import { NextRequest, NextResponse } from "next/server";
import { verifyFaceAndLivenessServer } from "@/lib/serverAntiSpoof";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { db } = await import("@/lib/dbAdapter");
        const body = await request.json();
        const { image, registrationId, email, studentId, firebaseUID, id, clientDescriptor, box } = body;

        if (!image) {
            return NextResponse.json({ error: "Missing camera image for face verification" }, { status: 400 });
        }

        // 🎯 USER REQUIREMENT: Lookup student primarily by registrationId (e.g. BOYS-0001) or email.
        // Firebase UID is only used for authentication, not business logic or matching.
        let student: any = null;

        if (registrationId && typeof registrationId === "string" && registrationId.trim()) {
            const regClean = registrationId.trim().toUpperCase();
            student = await db.students.findOne({ registrationId: regClean });
            if (!student) {
                student = await db.students.findOne({ registrationId: registrationId.trim() });
            }
        }

        if (!student && email && typeof email === "string" && email.trim()) {
            const emailClean = email.trim().toLowerCase();
            student = await db.students.findOne({ email: emailClean });
            if (!student) {
                student = await db.students.findOne({ email: email.trim() });
            }
        }

        const fallbackId = studentId || id || firebaseUID;
        if (!student && fallbackId) {
            student = await db.students.getById(fallbackId);
            if (!student) {
                student = await db.students.findOne({ firebaseUID: fallbackId });
            }
        }

        if (!student) {
            return NextResponse.json({ 
                error: `Student not found for Registration ID: "${registrationId || 'N/A'}" or Email: "${email || 'N/A'}"` 
            }, { status: 404 });
        }

        const storedDescriptor = student.faceDescriptor || student.face_descriptor;
        if (!storedDescriptor || !Array.isArray(storedDescriptor) || storedDescriptor.length === 0) {
            return NextResponse.json({ 
                error: `Student face descriptor not registered for ${student.name || student.registrationId}. Please update your photo in profile first.` 
            }, { status: 404 });
        }

        // 🛡️ RUN NATIVE IN-PROCESS ONNX MINIFASNET + FAST FACE RECOGNITION
        const verification = await verifyFaceAndLivenessServer({
            liveImage: image,
            referenceDescriptor: storedDescriptor,
            clientDescriptor,
            box
        });

        // 🛑 1. PRESENTATION ATTACK DETECTED (Phone Screen, Video Replay, Printed Photo, Specular Glare)
        if (verification.isSpoof) {
            console.warn(`🛑 [Attendance Blocked] Spoof attack rejected for ${student.registrationId || student.email || student.name}: ${verification.reason}`);
            return NextResponse.json({
                success: false,
                isSpoof: true,
                isMatch: false,
                score: 0,
                livenessScore: verification.livenessScore,
                message: verification.reason,
                engine: verification.engine
            }, { status: 200 });
        }

        // 🛑 2. IDENTITY MISMATCH
        if (!verification.isMatch) {
            console.warn(`⚠️ [Attendance Blocked] Identity mismatch for ${student.registrationId || student.email || student.name} (Score: ${verification.matchScore}%)`);
            return NextResponse.json({
                success: false,
                isSpoof: false,
                isMatch: false,
                score: verification.matchScore,
                distance: verification.distance,
                livenessScore: verification.livenessScore,
                message: `Identity Mismatch (${verification.matchScore}% Match — Need 75%). Please ensure your face is well lit and looking straight.`,
                engine: verification.engine
            }, { status: 200 });
        }

        // ✅ 3. LIVENESS VERIFIED & BIOMETRIC IDENTITY MATCHED
        console.log(`✅ [Attendance Approved] Student ${student.registrationId || student.email || student.name} verified (Score: ${verification.matchScore}%, Liveness: ${verification.livenessScore}%)`);
        return NextResponse.json({
            success: true,
            isSpoof: false,
            isMatch: true,
            score: verification.matchScore,
            distance: verification.distance,
            livenessScore: verification.livenessScore,
            message: "Identity & Physical Human Liveness Verified",
            engine: verification.engine
        }, { status: 200 });

    } catch (error: any) {
        console.error("❌ Backend Face Match Error:", error);
        return NextResponse.json({ 
            error: error.message || "Face recognition server error" 
        }, { status: 500 });
    }
}
