import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch all hostels
export async function GET(request: NextRequest) {
    try {
        const hostels = await db.hostels.getAll();
        console.log("=== API GET HOSTELS ===", hostels.length, JSON.stringify(hostels));
        const mappedHostels = hostels.map((h: any) => {
            const n = h.name.toUpperCase();
            if (n.includes("GUEST") || n.includes("GHB")) {
                return { ...h, name: "GHB Hostel" };
            }
            return h;
        });
        return NextResponse.json({ success: true, hostels: mappedHostels });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch hostels" },
            { status: 500 }
        );
    }
}

// POST - Create or update hostel
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id,
            name,
            totalRooms,
            wardenUsername,
            wardenPassword,
            attendanceMode,
            allowWardenAddStudent,
            allowWardenEditProfile,
            allowWardenRemoveStudent,
            allowWardenNotification,
            allowStudentNotification,
            registrationFormat
        } = body;
        const formattedName = typeof name === 'string' ? name.trim().toUpperCase() : name;
        const trimmedWardenUsername = typeof wardenUsername === 'string' ? wardenUsername.trim() : wardenUsername;
        const trimmedWardenPassword = typeof wardenPassword === 'string' ? wardenPassword.trim() : wardenPassword;

        let hostel;
        if (id) {
            hostel = await db.hostels.update(id, {
                name: formattedName,
                totalRooms,
                wardenUsername: trimmedWardenUsername,
                wardenPassword: trimmedWardenPassword,
                attendanceMode,
                allowWardenAddStudent,
                allowWardenEditProfile,
                allowWardenRemoveStudent,
                allowWardenNotification: allowWardenNotification !== undefined ? allowWardenNotification : true,
                allowStudentNotification: allowStudentNotification !== undefined ? allowStudentNotification : true,
                registrationFormat
            });
        } else {
            hostel = await db.hostels.create({
                name: formattedName,
                totalRooms,
                wardenUsername: trimmedWardenUsername,
                wardenPassword: trimmedWardenPassword,
                attendanceMode,
                allowWardenAddStudent,
                allowWardenEditProfile,
                allowWardenRemoveStudent,
                allowWardenNotification: allowWardenNotification !== undefined ? allowWardenNotification : true,
                allowStudentNotification: allowStudentNotification !== undefined ? allowStudentNotification : true,
                registrationFormat
            });
        }

        return NextResponse.json({ success: true, hostel });
    } catch (error: any) {
        console.error("Error saving hostel:", error);
        return NextResponse.json(
            { error: error.message || "Failed to save hostel" },
            { status: 500 }
        );
    }
}

// DELETE - Delete a hostel
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) throw new Error("ID is required");

        await db.hostels.delete(id);

        return NextResponse.json({ success: true, message: "Hostel deleted" });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to delete hostel" },
            { status: 500 }
        );
    }
}
