import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

// GET - Fetch all locations
export async function GET(request: NextRequest) {
    try {
        const settings = await db.settings.get();

        const locations = settings?.hostelLocations || [];

        return NextResponse.json({
            success: true,
            locations,
            count: locations.length
        });
    } catch (error: any) {
        console.error("Error fetching locations:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch locations" },
            { status: 500 }
        );
    }
}

// POST - Add a new location
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, lat, lng, radius } = body;

        // Validation
        if (!name || !lat || !lng || !radius) {
            return NextResponse.json(
                { success: false, error: "All fields are required: name, lat, lng, radius" },
                { status: 400 }
            );
        }

        if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radius !== 'number') {
            return NextResponse.json(
                { success: false, error: "lat, lng, and radius must be numbers" },
                { status: 400 }
            );
        }

        // Get current settings
        const settings = await db.settings.get();
        const hostelLocations = (settings?.hostelLocations || []).slice();
        hostelLocations.push({ name, lat, lng, radius });

        await db.settings.update({ hostelLocations });

        return NextResponse.json({
            success: true,
            message: "Location added successfully",
            location: { name, lat, lng, radius },
            totalLocations: hostelLocations.length
        });
    } catch (error: any) {
        console.error("Error adding location:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to add location" },
            { status: 500 }
        );
    }
}

// PUT - Update an existing location
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { index, name, lat, lng, radius } = body;

        // Validation
        if (index === undefined || !name || !lat || !lng || !radius) {
            return NextResponse.json(
                { success: false, error: "All fields are required: index, name, lat, lng, radius" },
                { status: 400 }
            );
        }

        const settings = await db.settings.get();

        if (!settings || !settings.hostelLocations || settings.hostelLocations.length === 0) {
            return NextResponse.json(
                { success: false, error: "No locations found to update" },
                { status: 404 }
            );
        }

        if (index < 0 || index >= settings.hostelLocations.length) {
            return NextResponse.json(
                { success: false, error: `Invalid index. Must be between 0 and ${settings.hostelLocations.length - 1}` },
                { status: 400 }
            );
        }

        // Update the location
        const hostelLocations = settings.hostelLocations.slice();
        hostelLocations[index] = { name, lat, lng, radius };
        await db.settings.update({ hostelLocations });

        return NextResponse.json({
            success: true,
            message: "Location updated successfully",
            location: { name, lat, lng, radius },
            index
        });
    } catch (error: any) {
        console.error("Error updating location:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to update location" },
            { status: 500 }
        );
    }
}

// DELETE - Remove a location
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const indexStr = searchParams.get('index');

        if (indexStr === null) {
            return NextResponse.json(
                { success: false, error: "Index parameter is required" },
                { status: 400 }
            );
        }

        const index = parseInt(indexStr);

        const settings = await db.settings.get();

        if (!settings || !settings.hostelLocations || settings.hostelLocations.length === 0) {
            return NextResponse.json(
                { success: false, error: "No locations found to delete" },
                { status: 404 }
            );
        }

        if (index < 0 || index >= settings.hostelLocations.length) {
            return NextResponse.json(
                { success: false, error: `Invalid index. Must be between 0 and ${settings.hostelLocations.length - 1}` },
                { status: 400 }
            );
        }

        // Remove the location
        const hostelLocations = settings.hostelLocations.slice();
        const deletedLocation = hostelLocations.splice(index, 1)[0];
        await db.settings.update({ hostelLocations });

        return NextResponse.json({
            success: true,
            message: "Location deleted successfully",
            deletedLocation,
            remainingLocations: hostelLocations.length
        });
    } catch (error: any) {
        console.error("Error deleting location:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to delete location" },
            { status: 500 }
        );
    }
}

