import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter"; // Direct import from dbAdapter

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { studentId, credential } = body;

        if (!studentId || !credential || !credential.id || !credential.publicKey) {
            return NextResponse.json(
                { error: "Missing required registration data" },
                { status: 400 }
            );
        }

        const student = await db.students.getById(studentId);

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // 🔒 CHECK DEVICE LOCK: Is this browser already claimed by another student?
        const deviceOwnerCookie = request.cookies.get('trusted_device_owner');
        if (deviceOwnerCookie && deviceOwnerCookie.value !== studentId) {
            return NextResponse.json(
                { error: "Access Denied: This browser is permanently linked to another student. You cannot register a second account on this device." },
                { status: 403 }
            );
        }

        // Check if this credential ID is already registered somewhere else
        // Optimized using new getByCredentialId method in dbAdapter
        const existingStudent = await db.students.getByCredentialId(credential.id);

        if (existingStudent && existingStudent._id !== studentId) {
            return NextResponse.json(
                { error: "This biometric device is already linked to another account." },
                { status: 403 }
            );
        }

        // Check if current user already has a key
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

        // Update student with WebAuthn credentials ONLY and return the response with a locked cookie
        const updatedStudent = await db.students.update(studentId, {
            webAuthnCredentials: [newCredential]
        });

        const response = NextResponse.json({
            success: true,
            message: "Biometric device registered and linked to account permanently.",
            student: updatedStudent
        });

        // 🔒 DEVICE LOCK: Set a persistent cookie that locks this browser to this student
        // This prevents another student from registering on the same browser instance
        response.cookies.set('trusted_device_owner', studentId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365 * 10 // 10 years
        });

        return response;

    } catch (error: any) {
        console.error("WebAuthn Registration Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to register biometrics" },
            { status: 500 }
        );
    }
}
