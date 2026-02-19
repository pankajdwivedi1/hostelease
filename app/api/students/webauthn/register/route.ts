import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const body = await request.json();
        const { studentId, credential } = body;

        if (!studentId || !credential || !credential.id || !credential.publicKey) {
            return NextResponse.json(
                { error: "Missing required registration data" },
                { status: 400 }
            );
        }

        const { db } = await import("@/lib/dbAdapter");
        const student = await db.students.getById(studentId);

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Check if this credential ID is already registered somewhere else
        // Note: This requires a specialized findOne in dbAdapter or a general list with filter
        const studentsWithCred = await db.students.list({ search: credential.id });
        const existingCred = studentsWithCred.find((s: any) =>
            s.webAuthnCredentials?.some((c: any) => c.credentialID === credential.id) && s._id !== studentId
        );

        if (existingCred) {
            return NextResponse.json(
                { error: "This biometric device is already linked to another account." },
                { status: 403 }
            );
        }

        // Check if they already have a key
        const currentCreds = student.webAuthnCredentials || [];
        if (currentCreds.length > 0) {
            return NextResponse.json(
                { error: "Account already has a registered biometric device. Reset required for new device." },
                { status: 403 }
            );
        }

        // Save the new credential
        const newCredential = {
            credentialID: credential.id,
            publicKey: credential.publicKey,
            counter: credential.counter || 0,
            transports: credential.transports || ["internal"],
            createdAt: new Date().toISOString()
        };

        const updatedStudent = await db.students.update(studentId, {
            webAuthnCredentials: [newCredential],
            deviceId: credential.id
        });

        return NextResponse.json({
            success: true,
            message: "Biometric device registered and linked to account permanently.",
            student: updatedStudent
        });

    } catch (error: any) {
        console.error("WebAuthn Registration Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to register biometrics" },
            { status: 500 }
        );
    }
}
