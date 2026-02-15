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

        const student = await Student.findById(studentId);
        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Check if this credential ID is already registered somewhere else
        const existingCred = await Student.findOne({
            "webAuthnCredentials.credentialID": credential.id,
            _id: { $ne: studentId }
        });

        if (existingCred) {
            return NextResponse.json(
                { error: "This biometric device is already linked to another account." },
                { status: 403 }
            );
        }

        // FOR NOW: We allow ONE key per student to keep it "Strict" as requested
        // If they already have a key, they need a reset
        if (student.webAuthnCredentials && student.webAuthnCredentials.length > 0) {
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
            createdAt: new Date()
        };

        const updatedStudent = await Student.findByIdAndUpdate(
            studentId,
            {
                $push: { webAuthnCredentials: newCredential },
                // Also update the legacy deviceId for backward compatibility
                $set: { deviceId: credential.id }
            },
            { new: true }
        );

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
