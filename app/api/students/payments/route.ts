import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

// GET - Fetch all payments for a student
export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const searchParams = request.nextUrl.searchParams;
        const studentId = searchParams.get("studentId");

        if (!studentId) {
            return NextResponse.json({ error: "Student ID required" }, { status: 400 });
        }

        const payments = await Transaction.find({ studentId }).sort({ createdAt: -1 });

        return NextResponse.json({
            success: true,
            payments,
        });
    } catch (error: any) {
        console.error("Error fetching payments:", error);
        return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
    }
}

// POST - Submit a new payment claim
export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const body = await request.json();
        const { studentId, registrationId, utrNumber, amount, paymentSource, screenshot } = body;

        // Validation
        if (!studentId || !registrationId || !utrNumber || !amount || !paymentSource) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check for duplicate UTR
        const existing = await Transaction.findOne({ utrNumber: utrNumber.trim() });
        if (existing) {
            return NextResponse.json(
                { error: "This UTR/Transaction ID has already been submitted." },
                { status: 400 }
            );
        }

        const transaction = await Transaction.create({
            studentId,
            registrationId,
            utrNumber: utrNumber.trim(),
            amount,
            paymentSource,
            screenshot,
            status: "pending",
        });

        return NextResponse.json({
            success: true,
            transaction,
            message: "Payment submitted successfully! It will be verified within 24-48 hours.",
        });
    } catch (error: any) {
        console.error("Error submitting payment:", error);
        if (error.code === 11000) {
            return NextResponse.json({ error: "Duplicate UTR Number detected." }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to submit payment" }, { status: 500 });
    }
}
