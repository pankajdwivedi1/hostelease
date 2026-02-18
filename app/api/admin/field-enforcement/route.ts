import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FieldEnforcement from "@/models/FieldEnforcement";

export const dynamic = "force-dynamic";

// GET all field enforcement rules or for a specific hostel
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    let query: any = {};
    if (hostelName) {
      // Use regex for case-insensitive match if searching for a specific hostel
      query.hostelName = { $regex: new RegExp(`^${hostelName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }

    const enforcementRules = await FieldEnforcement.find(query).lean();

    return NextResponse.json({
      success: true,
      data: enforcementRules,
    });
  } catch (error: any) {
    console.error("Error fetching field enforcement rules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch field enforcement rules" },
      { status: 500 }
    );
  }
}

// POST - Create or update field enforcement rules for a hostel
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      hostelName,
      enforcedFields,
      isActive,
      notificationPriority,
      successMessage,
      autoCloseNotification,
    } = body;

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    if (!enforcedFields || !Array.isArray(enforcedFields)) {
      return NextResponse.json(
        { error: "enforcedFields must be an array" },
        { status: 400 }
      );
    }

    const normalizedHostelName = hostelName.trim();

    const sortedFields = enforcedFields.sort(
      (a: any, b: any) => (a.order || 0) - (b.order || 0)
    );

    const updateData = {
      hostelName: normalizedHostelName,
      enforcedFields: sortedFields,
      isActive: isActive ?? false,
      notificationPriority: notificationPriority || "normal",
      successMessage: successMessage || "All required fields have been completed! Thank you.",
      autoCloseNotification: autoCloseNotification ?? true,
    };

    const enforcement = await FieldEnforcement.findOneAndUpdate(
      { hostelName: { $regex: new RegExp(`^${normalizedHostelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
      { $set: updateData },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      data: enforcement,
    });
  } catch (error: any) {
    console.error("Error saving field enforcement rules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save field enforcement rules" },
      { status: 500 }
    );
  }
}

// PUT - Update specific hostel enforcement rules
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { hostelName, ...updateData } = body;

    const normalizedHostelName = hostelName.trim();
    // Sort fields by order if enforcedFields is provided
    if (updateData.enforcedFields && Array.isArray(updateData.enforcedFields)) {
      updateData.enforcedFields = updateData.enforcedFields.sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );
    }

    const enforcement = await FieldEnforcement.findOneAndUpdate(
      { hostelName: { $regex: new RegExp(`^${normalizedHostelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
      { $set: updateData },
      { new: true }
    );

    if (!enforcement) {
      return NextResponse.json(
        { error: "Hostel enforcement rules not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: enforcement,
    });
  } catch (error: any) {
    console.error("Error updating field enforcement rules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update field enforcement rules" },
      { status: 500 }
    );
  }
}

// DELETE - Delete field enforcement rules for a hostel
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    if (!hostelName) {
      return NextResponse.json(
        { error: "hostelName is required" },
        { status: 400 }
      );
    }

    const result = await FieldEnforcement.findOneAndDelete({
      hostelName: { $regex: new RegExp(`^${hostelName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
    });

    if (!result) {
      return NextResponse.json(
        { error: "Hostel enforcement rules not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Field enforcement rules deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting field enforcement rules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete field enforcement rules" },
      { status: 500 }
    );
  }
}
