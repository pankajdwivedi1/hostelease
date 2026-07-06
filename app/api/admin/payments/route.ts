import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Admin fetch all payments (with filters)
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        const filters: any = {};
        if (status && status !== "all") filters.status = status;
        if (search) filters.search = search;

        const payments = await db.transactions.list(filters);

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
            const payment = await db.transactions.findOne({
                utrNumber: utr.trim(),
                status: { $ne: "verified" },
            });

            if (payment) {
                // Update via adapter
                const updatedPayment = await db.transactions.update(payment._id, {
                    status: "verified",
                    reconciledViaCSV: true,
                    verifiedAt: new Date(),
                    adminRemarks: "Automatically verified via Bank CSV reconciliation."
                });

                if (updatedPayment) {
                    import("@/lib/pushNotification").then(({ sendPushNotification }) => {
                        sendPushNotification(updatedPayment.studentId, "student", "paymentVerified", {
                            title: "Fee Payment Verified",
                            body: `Your fee payment of ₹${updatedPayment.amount} has been verified automatically.`,
                            url: "/"
                        }).catch(err => console.error("Payment CSV verified push failed:", err));
                    }).catch(err => console.log("pushNotification import failed in CSV verify:", err));
                }

                verifiedCount++;
                results.push({ utr, status: "verified", registrationId: payment.registrationId });
            } else {
                // Check if it was already verified
                const exists = await db.transactions.findOne({ utrNumber: utr.trim(), status: "verified" });
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
        const body = await request.json();
        const { paymentId, status, adminRemarks } = body;

        if (!paymentId || !status) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const updateData: any = { status, adminRemarks };
        if (status === "verified") {
            updateData.verifiedAt = new Date();
        }

        const payment = await db.transactions.update(paymentId, updateData);

        if (!payment) {
            return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
        }

        // Trigger Push Notification if status is verified
        if (status === "verified") {
            try {
                import("@/lib/pushNotification").then(({ sendPushNotification }) => {
                    sendPushNotification(payment.studentId, "student", "paymentVerified", {
                        title: "Fee Payment Verified",
                        body: `Your fee payment of ₹${payment.amount} has been verified by the administrator.`,
                        url: "/"
                    }).catch(err => console.error("Payment manual verified push failed:", err));
                });
            } catch (e) {
                console.error("Failed to trigger payment verification push:", e);
            }
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

