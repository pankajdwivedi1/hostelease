import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Notification from "@/models/Notification";
import mongoose from "mongoose";

export async function GET(request: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");
        const hostelName = searchParams.get("hostelName");

        if (!studentId) {
            return NextResponse.json({ error: "Student ID required" }, { status: 400 });
        }

        const studentObjId = new mongoose.Types.ObjectId(studentId);

        // Fetch notifications from the last 48 hours that target this student
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const notifications = await Notification.find({
            $or: [
                { targetType: "all" },
                { targetType: "hostel", targetHostel: hostelName },
                { targetType: "individual", targetStudentId: studentObjId },
            ],
            createdAt: { $gte: fortyEightHoursAgo }
        }).sort({ createdAt: -1 });

        return NextResponse.json({ success: true, notifications });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectDB();
        const { notificationId, studentId } = await request.json();

        if (!notificationId || !studentId) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            {
                $addToSet: { acknowledgedBy: { studentId: new mongoose.Types.ObjectId(studentId), at: new Date() } },
            },
            { new: true }
        );

        return NextResponse.json({ success: true, notification });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
