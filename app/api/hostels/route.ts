import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch all hostels
export async function GET(request: NextRequest) {
    try {
        const hostels = await db.hostels.getAll();

        // If no hostels exist, create the default ones
        if (hostels.length === 0) {
            const defaultHostels = [
                { name: "Gangotri Hostel" },
                { name: "Gaytri Hostel" },
                { name: "Boys Hostel" },
                { name: "Guest House Boys Hostel" },
            ];

            // Use Promise.all with create for each since insertMany isn't in adapter yet
            // or we can just loop.
            for (const h of defaultHostels) {
                await db.hostels.create(h);
            }

            const newHostels = await db.hostels.getAll();
            return NextResponse.json({ hostels: newHostels }, { status: 200 });
        }

        return NextResponse.json({ hostels }, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching hostels:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch hostels" },
            { status: 500 }
        );
    }
}

// POST - Create a new hostel
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: "Hostel name is required" },
                { status: 400 }
            );
        }

        // Check if hostel already exists
        const existingHostel = await db.hostels.findOne({ name: name.trim() });
        if (existingHostel) {
            return NextResponse.json(
                { error: "Hostel with this name already exists" },
                { status: 409 }
            );
        }

        const hostel = await db.hostels.create({ name: name.trim() });

        return NextResponse.json(
            { success: true, hostel },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("Error creating hostel:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create hostel" },
            { status: 500 }
        );
    }
}

// DELETE - Delete a hostel (Legacy support if needed, but admin has its own)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Hostel ID is required" },
                { status: 400 }
            );
        }

        const result = await db.hostels.delete(id);

        if (!result) {
            return NextResponse.json(
                { error: "Hostel not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, message: "Hostel deleted successfully" },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error deleting hostel:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete hostel" },
            { status: 500 }
        );
    }
}
