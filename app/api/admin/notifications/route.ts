export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { senderId, targetType, targetHostel, message, priority, expiresAt, senderRole, senderHostel } = body;
        let { targetStudentId } = body;

        if (!senderId || !targetType || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Handle individual target lookup by Email or Registration ID
        if (targetType === "individual" && targetStudentId) {
            let student = null;
            if (targetStudentId.includes("@")) {
                student = await db.students.findOne({ email: targetStudentId.toLowerCase().trim() });
            } else if (targetType === "individual") {
                // Try searching by registrationId
                student = await db.students.findOne({ registrationId: targetStudentId.trim() });

                // If not found by registrationId and it's not a valid ObjectId format, try database ID as fallback
                if (!student) {
                    student = await db.students.getById(targetStudentId);
                }
            }

            if (!student) {
                return NextResponse.json({ error: "Student not found with the provided ID/Email" }, { status: 404 });
            }
            targetStudentId = student._id;
        }

        const notification = await db.notifications.create({
            senderId,
            senderRole: senderRole || "warden",
            senderHostel: senderHostel || targetHostel || null,
            targetType,
            targetHostel,
            targetStudentId: targetStudentId || null,
            message,
            priority: priority || "normal",
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        });

        // ⚡ Dispatch Web Push Notifications to Phone Lock Screens
        (async () => {
            try {
                const { sendPushNotification } = await import("@/lib/pushNotification");
                const pushTitle = senderRole === "dean" ? "📢 Dean Announcement" : "📢 Warden Announcement";
                const payload = {
                    title: pushTitle,
                    body: message,
                    url: "/",
                    image: body.image || undefined,
                };

                if (targetType === "individual" && targetStudentId) {
                    await sendPushNotification(targetStudentId, "student", "deanBroadcast", payload);
                } else if (targetType === "hostel" && targetHostel) {
                    const students = await db.students.findMany({ hostelName: targetHostel });
                    for (const s of (students || [])) {
                        const sid = s._id || s.id;
                        if (sid) {
                            sendPushNotification(sid, "student", "deanBroadcast", payload).catch(() => {});
                        }
                    }
                } else if (targetType === "all") {
                    const students = await db.students.getAll();
                    for (const s of (students || [])) {
                        const sid = s._id || s.id;
                        if (sid) {
                            sendPushNotification(sid, "student", "deanBroadcast", payload).catch(() => {});
                        }
                    }
                }
            } catch (pushErr) {
                console.warn("Background push dispatch notice:", pushErr);
            }
        })();

        return NextResponse.json({ success: true, notification });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (id) {
            try {
                const notification = await db.notifications.getById(id);
                return NextResponse.json({ success: true, notification });
            } catch (err: any) {
                return NextResponse.json({ success: true, notification: null });
            }
        }

        try {
            const notifications = await db.notifications.list({}, { limit: 50 });
            return NextResponse.json({ success: true, notifications: notifications || [] });
        } catch (err: any) {
            console.error("Warning fetching notifications, returning empty array fallback:", err?.message || err);
            return NextResponse.json({ success: true, notifications: [] });
        }
    } catch (error: any) {
        return NextResponse.json({ success: true, notifications: [] });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const id = searchParams.get("id");

        if (action === "cleanup") {
            // Cleanup notifications older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await db.notifications.deleteMany({
                createdAt: { $lt: thirtyDaysAgo },
            });

            return NextResponse.json({ success: true, deletedCount: result.deletedCount });
        }

        if (id) {
            const role = searchParams.get("role");
            if (role === "warden") {
                try {
                    const existingNotif = await db.notifications.getById(id);
                    if (existingNotif && (existingNotif.senderRole === "dean" || existingNotif.senderRole === "superadmin" || existingNotif.targetType === "all")) {
                        return NextResponse.json({ error: "Wardens cannot delete broadcasts issued by Deans or Super Admins" }, { status: 403 });
                    }
                } catch (e) {
                    // proceed if getById fails
                }
            }
            await db.notifications.deleteMany({ _id: id });
            return NextResponse.json({ success: true, message: "Notification deleted" });
        }

        return NextResponse.json({ error: "Invalid action or missing ID" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, message, priority, expiryHours } = body;

        if (!id || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const updateData: any = { message };
        if (priority) updateData.priority = priority;

        if (expiryHours) {
            if (expiryHours === "never") {
                updateData.expiresAt = null;
            } else {
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + parseInt(expiryHours));
                updateData.expiresAt = expiresAt;
            }
        }

        const updated = await db.notifications.update(id, { $set: updateData });

        return NextResponse.json({ success: true, notification: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
