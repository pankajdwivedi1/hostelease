import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch all payments for a student
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const studentId = searchParams.get("studentId");

        if (!studentId) {
            return NextResponse.json({ error: "Student ID required" }, { status: 400 });
        }

        const payments = await db.transactions.list({ studentId });

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
        const body = await request.json();
        const { studentId, registrationId, utrNumber, amount, paymentSource, screenshot } = body;

        // Validation
        if (!studentId || !registrationId || !utrNumber || !amount || !paymentSource) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check for duplicate UTR using adapter
        const existing = await db.transactions.findOne({ utrNumber: utrNumber.trim() });
        if (existing) {
            return NextResponse.json(
                { error: "This UTR/Transaction ID has already been submitted." },
                { status: 400 }
            );
        }

        const transaction = await db.transactions.create({
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
        // Handle duplicate key error for Mongo (11000) or Supabase (23505)
        if (error.code === 11000 || error.code === '23505') {
            return NextResponse.json({ error: "Duplicate UTR Number detected." }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to submit payment" }, { status: 500 });
    }
}
