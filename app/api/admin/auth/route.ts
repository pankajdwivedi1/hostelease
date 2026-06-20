export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

const DEFAULT_ADMIN_PASSWORD = "pankajdwivedi81";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Fetch from DB using adapter
    const settings = await db.settings.get();
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
