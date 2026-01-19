import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Notification from "@/models/Notification";
import Student from "@/models/Student";

export async function POST(request: Request) {
    try {
        await connectDB();
        const body = await request.json();
        const { senderId, targetType, targetHostel, message, priority } = body;
        let { targetStudentId } = body;

        if (!senderId || !targetType || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Handle individual target lookup by Email or Registration ID
        if (targetType === "individual" && targetStudentId) {
            let student = null;
            if (targetStudentId.includes("@")) {
                student = await Student.findOne({ email: targetStudentId.toLowerCase().trim() });
            } else if (targetType === "individual") {
                // Try searching by registrationId
                student = await Student.findOne({ registrationId: targetStudentId.trim() });

                // If not found by registrationId and it's not a valid ObjectId format, try database ID as fallback
                if (!student && /^[0-9a-fA-F]{24}$/.test(targetStudentId)) {
                    student = await Student.findById(targetStudentId);
                }
            }

            if (!student) {
                return NextResponse.json({ error: "Student not found with the provided ID/Email" }, { status: 404 });
            }
            targetStudentId = student._id;
        }

        const notification = await Notification.create({
            senderId,
            targetType,
            targetHostel,
            targetStudentId: targetStudentId || null,
            message,
            priority: priority || "normal",
        });

        return NextResponse.json({ success: true, notification });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        await connectDB();
        const notifications = await Notification.find()
            .populate("targetStudentId", "name registrationId")
            .sort({ createdAt: -1 })
            .limit(50);
        return NextResponse.json({ success: true, notifications });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");

        if (action === "cleanup") {
            // Cleanup notifications older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await Notification.deleteMany({
                createdAt: { $lt: thirtyDaysAgo },
            });

            return NextResponse.json({ success: true, deletedCount: result.deletedCount });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
