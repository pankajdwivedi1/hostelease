import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const { firebaseUID, attestationResponse } = await req.json();

        const student = await Student.findOne({ firebaseUID });
        if (!student || !student.currentChallenge) {
            return NextResponse.json({ error: 'Session expired or student not found' }, { status: 400 });
        }

        const expectedChallenge = student.currentChallenge;

        const host = req.headers.get('host') || 'localhost';
        const hostname = host.split(':')[0];
        const protocol = req.nextUrl.protocol === 'https:' ? 'https' : 'http';
        const origin = `${protocol}://${host}`;

        const verification = await verifyRegistrationResponse({
            response: attestationResponse,
            expectedChallenge,
            expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || origin,
            expectedRPID: process.env.NEXT_PUBLIC_RP_ID || hostname,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp }: any = verification.registrationInfo;

            const newAuthenticator = {
                credentialID: Buffer.from(credentialID).toString('base64'),
                credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
                counter,
                credentialDeviceType,
                credentialBackedUp,
            };

            // Add authenticator to student's record
            if (!student.authenticators) student.authenticators = [];
            student.authenticators.push(newAuthenticator);
            student.currentChallenge = undefined; // Clear challenge
            await student.save();

            return NextResponse.json({ verified: true });
        } else {
            return NextResponse.json({ verified: false }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Registration verification error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
