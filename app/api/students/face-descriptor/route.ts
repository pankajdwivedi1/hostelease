export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

/**
 * API to save/update student face descriptor
 * This is used as the reference "lock" for all future attendance checks
 */
export async function POST(request: NextRequest) {
    try {
        const { firebaseUID, faceDescriptor } = await request.json();

        if (!firebaseUID || !faceDescriptor || !Array.isArray(faceDescriptor)) {
            return NextResponse.json(
                { error: "Invalid request. Missing firebaseUID or faceDescriptor array." },
                { status: 400 }
            );
        }

        const existingStudent = await db.students.findOne({ firebaseUID });
        const dynamicFields = typeof existingStudent?.dynamicFields === 'object' && existingStudent?.dynamicFields !== null
            ? { ...existingStudent.dynamicFields }
            : {};
        dynamicFields.requiresFaceRecapture = false;

        // Use the Database Adapter for a database-aware update (Mongo/Supabase/Prisma)
        const student = await db.students.save(firebaseUID, { 
            faceDescriptor,
            dynamicFields
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Face descriptor saved successfully. Your identity is now locked for attendance."
        });
    } catch (error: any) {
        console.error("Error saving face descriptor:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const firebaseUID = searchParams.get("firebaseUID");
        const email = searchParams.get("email");
        const registrationId = searchParams.get("registrationId");
        const studentId = searchParams.get("studentId");

        if (!firebaseUID && !email && !registrationId && !studentId) {
            return NextResponse.json(
                { error: "At least one identifier (firebaseUID, email, registrationId, studentId) is required." },
                { status: 400 }
            );
        }

        let student: any = null;

        if (firebaseUID || email) {
            student = await (db.students as any).findOneFast({
                firebaseUID: firebaseUID || undefined,
                email: email || undefined
            });
        }

        if (!student && registrationId) {
            const list = await db.students.list({ registrationId });
            student = list && list.length > 0 ? list[0] : null;
        }

        if (!student && studentId) {
            student = await db.students.findById(studentId);
        }

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        const descriptor = student.faceDescriptor || student.face_descriptor;
        if (!descriptor || !Array.isArray(descriptor) || descriptor.length < 68) {
            return NextResponse.json({
                success: false,
                message: "No registered face descriptor found for this student.",
                hasDescriptor: false
            }, { status: 200 });
        }

        return NextResponse.json({
            success: true,
            hasDescriptor: true,
            faceDescriptor: Array.from(descriptor),
            registrationId: student.registrationId || "",
            studentId: student._id || student.id || "",
            email: student.email || "",
            name: student.name || ""
        }, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching face descriptor:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

