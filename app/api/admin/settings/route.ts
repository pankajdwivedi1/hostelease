import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AdminSettings from "@/models/AdminSettings";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    let settings = await AdminSettings.findOne();
    if (!settings) {
      settings = await AdminSettings.create({
        radius: 100,
      });
    }

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching admin settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { lat, lng, radius } = body;

    if (lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let settings = await AdminSettings.findOne();
    if (!settings) {
      settings = await AdminSettings.create({
        hostelLocation: { lat, lng },
        radius: radius || 100,
      });
    } else {
      settings.hostelLocation = { lat, lng };
      if (radius !== undefined) {
        settings.radius = radius;
      }
      await settings.save();
    }

    return NextResponse.json({ success: true, settings }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating admin settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}



