import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const { firebaseUID } = await req.json();

        const student = await Student.findOne({ firebaseUID });
        if (!student || !student.authenticators || student.authenticators.length === 0) {
            return NextResponse.json({ error: 'No authenticators registered' }, { status: 400 });
        }

        const host = req.headers.get('host') || 'localhost';
        const hostname = host.split(':')[0];

        const options = await generateAuthenticationOptions({
            rpID: process.env.NEXT_PUBLIC_RP_ID || hostname,
            allowCredentials: student.authenticators.map((auth) => ({
                id: Buffer.from(auth.credentialID, 'base64'),
                type: 'public-key',
                transports: auth.transports as any,
            })),
            userVerification: 'preferred',
        });

        student.currentChallenge = options.challenge;
        await student.save();

        return NextResponse.json(options);
    } catch (error: any) {
        console.error('Authentication options error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
