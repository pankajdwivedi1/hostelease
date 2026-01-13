import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';
import { generateRegistrationOptions } from '@simplewebauthn/server';

export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const { firebaseUID } = await req.json();

        const student = await Student.findOne({ firebaseUID });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        const host = req.headers.get('host') || 'localhost';
        const hostname = host.split(':')[0];

        const options = await generateRegistrationOptions({
            rpName: 'Hostelease',
            rpID: process.env.NEXT_PUBLIC_RP_ID || hostname,
            userID: Buffer.from(student._id.toString()),
            userName: student.email,
            userDisplayName: student.name,
            attestationType: 'none',
            authenticatorSelection: {
                userVerification: 'preferred',
                residentKey: 'preferred',
            },
        });

        // Save challenge to the student document
        student.currentChallenge = options.challenge;
        await student.save();

        return NextResponse.json(options);
    } catch (error: any) {
        console.error('Registration options error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
