import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';

export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const { firebaseUID, assertionResponse } = await req.json();

        const student = await Student.findOne({ firebaseUID });
        if (!student || !student.currentChallenge) {
            return NextResponse.json({ error: 'Session expired or student not found' }, { status: 400 });
        }

        const authenticator = student.authenticators?.find(
            (auth) => auth.credentialID === assertionResponse.id
        );

        if (!authenticator) {
            return NextResponse.json({ error: 'Authenticator not found' }, { status: 400 });
        }

        const host = req.headers.get('host') || 'localhost';
        const hostname = host.split(':')[0];
        const protocol = req.nextUrl.protocol === 'https:' ? 'https' : 'http';
        const origin = `${protocol}://${host}`;

        const verification = await verifyAuthenticationResponse({
            response: assertionResponse,
            expectedChallenge: student.currentChallenge,
            expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || origin,
            expectedRPID: process.env.NEXT_PUBLIC_RP_ID || hostname,
            authenticator: {
                credentialID: Buffer.from(authenticator.credentialID, 'base64'),
                credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
                counter: authenticator.counter,
            },
            requireUserVerification: true,
        });

        if (verification.verified) {
            // Update counter
            authenticator.counter = verification.authenticationInfo.newCounter;
            student.currentChallenge = undefined;
            await student.save();

            return NextResponse.json({ verified: true });
        } else {
            return NextResponse.json({ verified: false }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Authentication verification error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
