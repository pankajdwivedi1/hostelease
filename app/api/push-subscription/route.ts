import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, phone, subscription } = body;

    if (!userId || !userType || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Missing required subscription parameters." },
        { status: 400 }
      );
    }

    // 1. Clear any duplicate records using the exact same endpoint
    try {
      if (subscription.endpoint) {
        await db.pushSubscription.deleteMany({
          endpoint: subscription.endpoint
        });
      }
    } catch (e) {}

    // 2. Build candidate userIds so that the physical device is reachable by both phone number and role ID
    const candidateIds = new Set<string>();
    candidateIds.add(String(userId).trim());

    const cleanInputPhone = String(phone || "").replace(/\D/g, "");
    if (cleanInputPhone.length >= 10) {
      candidateIds.add(cleanInputPhone.slice(-10));
    }

    const cleanUserIdPhone = String(userId).replace(/\D/g, "");
    if (cleanUserIdPhone.length >= 10) {
      candidateIds.add(cleanUserIdPhone.slice(-10));
    }

    // Always ensure Dean can be addressed by both "admin" and registered mobile number
    if (userType === "dean") {
      candidateIds.add("admin");
    }

    // 3. Register subscriptions for all candidate identifiers
    const createdSubs = [];
    for (const cId of Array.from(candidateIds)) {
      try {
        const sub = await db.pushSubscription.create({
          userId: cId,
          userType,
          subscription
        });
        createdSubs.push(sub);
      } catch (err) {
        console.warn(`Failed saving push subscription for candidate ${cId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      registeredIds: Array.from(candidateIds),
      count: createdSubs.length
    });
  } catch (error: any) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
