import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, subscription } = body;

    if (!userId || !userType || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Missing required subscription parameters." },
        { status: 400 }
      );
    }

    // Clear existing subscription for this user to avoid duplicates
    try {
      await db.pushSubscription.deleteMany({
        userId,
        userType
      });
    } catch (e) {}

    // Save subscription to the database
    const newSubscription = await db.pushSubscription.create({
      userId,
      userType,
      subscription
    });

    return NextResponse.json({
      success: true,
      subscription: newSubscription
    });
  } catch (error: any) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
