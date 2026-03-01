import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch all hostels
export async function GET(request: NextRequest) {
    try {
        console.log("🏨 [API/hostels] Fetching all hostels...");
        const hostels = await db.hostels.getAll();

        // If no hostels exist, create the default ones
        if (!hostels || hostels.length === 0) {
            console.log("🏨 [API/hostels] No hostels found, creating defaults...");
            const defaultHostels = [
                { name: "Gangotri Hostel" },
                { name: "Gaytri Hostel" },
                { name: "Boys Hostel" },
                { name: "GHB Hostel" },
            ];

            for (const h of defaultHostels) {
                await db.hostels.create(h);
            }

            const newHostels = await db.hostels.getAll();
            return NextResponse.json({ hostels: newHostels }, { status: 200 });
        }

        console.log(`🏨 [API/hostels] Returning ${hostels.length} hostels.`);
        return NextResponse.json({ hostels }, { status: 200 });
    } catch (error: any) {
        console.error("❌ [API/hostels] Error:", error);
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
        console.error("❌ [API/hostels] Error creating hostel:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create hostel" },
            { status: 500 }
        );
    }
}
