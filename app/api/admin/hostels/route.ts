import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Hostel from "@/models/Hostel";

export const dynamic = "force-dynamic";

// GET - Fetch all hostels
export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const hostels = await Hostel.find().sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, hostels });
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
        await connectDB();
        const body = await request.json();
        const { id, name, totalRooms, wardenUsername, wardenPassword } = body;

        let hostel;
        if (id) {
            hostel = await Hostel.findByIdAndUpdate(
                id,
                { name, totalRooms, wardenUsername, wardenPassword },
                { new: true }
            );
        } else {
            hostel = await Hostel.create({ name, totalRooms, wardenUsername, wardenPassword });
        }

        return NextResponse.json({ success: true, hostel });
    } catch (error: any) {
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

        await connectDB();
        await Hostel.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Hostel deleted" });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to delete hostel" },
            { status: 500 }
        );
    }
}
