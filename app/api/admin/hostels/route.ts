import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch all hostels
export async function GET(request: NextRequest) {
    try {
        let hostels: any[] = [];
        try {
            hostels = await db.hostels.getAll();
        } catch (dbErr: any) {
            console.warn("⚠️ [API GET HOSTELS] db.hostels.getAll() failed, using fallback:", dbErr?.message);
        }

        if (!Array.isArray(hostels) || hostels.length === 0) {
            hostels = [
                { _id: "1", id: "1", name: "GANGOTRI HOSTEL", totalRooms: 0, attendanceMode: "strict" },
                { _id: "2", id: "2", name: "GAYTRI HOSTEL", totalRooms: 0, attendanceMode: "strict" },
                { _id: "3", id: "3", name: "BOYS HOSTEL", totalRooms: 0, attendanceMode: "strict" },
                { _id: "4", id: "4", name: "GHB HOSTEL", totalRooms: 0, attendanceMode: "strict" },
            ];
        }

        console.log("=== API GET HOSTELS ===", hostels.length);
        const mappedHostels = hostels.map((h: any) => {
            const n = (h.name || '').toUpperCase();
            if (n.includes("GUEST") || n.includes("GHB")) {
                return { ...h, name: "GHB Hostel" };
            }
            return h;
        });
        return NextResponse.json({ success: true, hostels: mappedHostels });
    } catch (error: any) {
        console.error("Error in GET /api/admin/hostels:", error);
        const fallbackHostels = [
            { _id: "1", id: "1", name: "GANGOTRI HOSTEL", totalRooms: 0, attendanceMode: "strict" },
            { _id: "2", id: "2", name: "GAYTRI HOSTEL", totalRooms: 0, attendanceMode: "strict" },
            { _id: "3", id: "3", name: "BOYS HOSTEL", totalRooms: 0, attendanceMode: "strict" },
            { _id: "4", id: "4", name: "GHB HOSTEL", totalRooms: 0, attendanceMode: "strict" },
        ];
        return NextResponse.json({ success: true, hostels: fallbackHostels });
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
        const hostelId = body.id || body._id;
        const formattedName = typeof name === 'string' ? name.trim().toUpperCase() : name;
        const trimmedWardenUsername = typeof wardenUsername === 'string' ? wardenUsername.trim() : wardenUsername;
        const trimmedWardenPassword = typeof wardenPassword === 'string' ? wardenPassword.trim() : wardenPassword;

        let hostel;
        if (hostelId) {
            hostel = await db.hostels.update(hostelId, {
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
