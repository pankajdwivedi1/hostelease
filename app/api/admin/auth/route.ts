import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AdminSettings from "@/models/AdminSettings";

const DEFAULT_ADMIN_PASSWORD = "pankajdwivedi81";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Fetch from DB
    const settings = await AdminSettings.findOne({});
    const dynamicPassword = settings?.adminPassword || DEFAULT_ADMIN_PASSWORD;

    if (password === dynamicPassword) {
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error("Error validating admin password:", error);
    return NextResponse.json(
      { error: "Failed to validate password" },
      { status: 500 }
    );
  }
}

