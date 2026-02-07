import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Transaction from "@/models/Transaction";

export const dynamic = "force-dynamic";

// GET - Admin fetch all payments (with filters)
export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        let query: any = {};
        if (status && status !== "all") query.status = status;
        if (search) {
            query.$or = [
                { registrationId: { $regex: search, $options: "i" } },
                { utrNumber: { $regex: search, $options: "i" } },
            ];
        }

        const payments = await Transaction.find(query)
            .populate("studentId", "name hostelName roomNumber email")
            .sort({ createdAt: -1 });

        return NextResponse.json({
            success: true,
            payments,
        });
    } catch (error: any) {
        console.error("Error fetching admin payments:", error);
        return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
    }
}

// POST - Reconcile payments via CSV data
export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const body = await request.json();
        const { csvRecords } = body; // Array of { utr: string, amount: number }

        if (!csvRecords || !Array.isArray(csvRecords)) {
            return NextResponse.json({ error: "Invalid CSV data" }, { status: 400 });
        }

        let verifiedCount = 0;
        let alreadyVerified = 0;
        const results = [];

        for (const record of csvRecords) {
            const { utr, amount } = record;
            if (!utr) continue;

            // Find the pending transaction with this UTR
            const payment = await Transaction.findOne({
                utrNumber: utr.trim(),
                status: { $ne: "verified" },
            });

            if (payment) {
                // Optional: Check if amount matches (caution: bank might add charges or student might pay partial)
                // For now, if UTR matches, we verify it.
                payment.status = "verified";
                payment.reconciledViaCSV = true;
                payment.verifiedAt = new Date();
                payment.adminRemarks = "Automatically verified via Bank CSV reconciliation.";
                await payment.save();
                verifiedCount++;
                results.push({ utr, status: "verified", registrationId: payment.registrationId });
            } else {
                // Check if it was already verified
                const exists = await Transaction.findOne({ utrNumber: utr.trim(), status: "verified" });
                if (exists) {
                    alreadyVerified++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            verifiedCount,
            alreadyVerified,
            message: `Reconciliation complete. ${verifiedCount} new payments verified.`,
        });
    } catch (error: any) {
        console.error("Error reconciling payments:", error);
        return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
    }
}

// PATCH - Manual update status (Approve/Reject)
export async function PATCH(request: NextRequest) {
    try {
        await connectDB();
        const body = await request.json();
        const { paymentId, status, adminRemarks } = body;

        if (!paymentId || !status) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const updateData: any = { status, adminRemarks };
        if (status === "verified") {
            updateData.verifiedAt = new Date();
        }

        const payment = await Transaction.findByIdAndUpdate(
            paymentId,
            { $set: updateData },
            { new: true }
        );

        if (!payment) {
            return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            payment,
            message: `Payment status updated to ${status}.`,
        });
    } catch (error: any) {
        console.error("Error updating payment status:", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}
