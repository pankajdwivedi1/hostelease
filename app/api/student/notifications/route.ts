export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");
        const hostelName = searchParams.get("hostelName");
        const id = searchParams.get("id");

        if (id) {
            const notification = await db.notifications.getById(id);
            return NextResponse.json({ success: true, notification });
        }

        if (!studentId) {
            return NextResponse.json({ error: "Student ID required" }, { status: 400 });
        }

        // Fetch notifications from the last 48 hours that target this student
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const notifications = await db.notifications.list({
            $or: [
                { targetType: "all" },
                { targetType: "hostel", targetHostel: hostelName },
                { targetType: "individual", targetStudentId: studentId },
            ],
            createdAt: { $gte: fortyEightHoursAgo }
        }, { limit: 50 });

        // Filter out expired and already acknowledged notifications
        const now = new Date();
        const activeNotifications = (notifications || []).filter((n: any) => {
            if (n.expiresAt && new Date(n.expiresAt) < now) {
                return false;
            }
            const ackList = n.acknowledgedBy || [];
            const isAcked = ackList.some((ack: any) => ack.studentId === studentId);
            if (isAcked) {
                return false;
            }
            return true;
        });

        return NextResponse.json({ success: true, notifications: activeNotifications });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { notificationId, studentId } = await request.json();

        if (!notificationId || !studentId) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const notification = await db.notifications.update(
            notificationId,
            {
                $addToSet: { acknowledgedBy: { studentId: studentId, at: new Date() } },
            }
        );

        return NextResponse.json({ success: true, notification });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

