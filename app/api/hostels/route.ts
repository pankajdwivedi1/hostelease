import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch all hostels
export async function GET(request: NextRequest) {
    try {
        console.log("🏨 [API/hostels] Fetching all hostels...");
        const hostels = await db.hostels.getAll();

        // If no hostels exist for this tenant, create the default ones
        if (!hostels || hostels.length === 0) {
            console.log("🏨 [API/hostels] No hostels found for this tenant, creating defaults...");
            const defaultHostels = [
                { name: "GANGOTRI HOSTEL" },
                { name: "GAYTRI HOSTEL" },
                { name: "BOYS HOSTEL" },
                { name: "GHB HOSTEL" },
            ];

            for (const h of defaultHostels) {
                try {
                    // We check if it exists globally first or just use a safe create
                    // Since the current schema has a global unique constraint on 'name',
                    // we should be careful.
                    const existing = await db.hostels.findOne({ name: h.name });
                    if (!existing) {
                        await db.hostels.create(h);
                    }
                } catch (e: any) {
                    console.warn(`⚠️ [API/hostels] Could not create default hostel ${h.name}:`, e.message);
                }
            }

            const newHostels = await db.hostels.getAll();
            const sanitizedNewHostels = newHostels.map(({ wardenPassword, wardenUsername, ...h }: any) => h);
            return NextResponse.json({ hostels: sanitizedNewHostels }, { status: 200 });
        }

        console.log(`🏨 [API/hostels] Returning ${hostels.length} hostels.`);
        const sanitizedHostels = hostels.map(({ wardenPassword, wardenUsername, ...h }: any) => h);
        return NextResponse.json({ hostels: sanitizedHostels }, { status: 200 });
    } catch (error: any) {
        console.warn("⚠️ [API/hostels] Using default hostel list:", error.message);
        const fallbackHostels = [
            { id: "1", name: "GANGOTRI HOSTEL" },
            { id: "2", name: "GAYTRI HOSTEL" },
            { id: "3", name: "BOYS HOSTEL" },
            { id: "4", name: "GHB HOSTEL" },
        ];
        return NextResponse.json({ hostels: fallbackHostels }, { status: 200 });
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

        const formattedName = name.trim().toUpperCase();
        const existingHostel = await db.hostels.findOne({ name: formattedName });
        if (existingHostel) {
            return NextResponse.json(
                { error: "Hostel with this name already exists" },
                { status: 409 }
            );
        }

        const hostel = await db.hostels.create({ name: formattedName });

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
