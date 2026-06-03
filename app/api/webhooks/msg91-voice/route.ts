import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { status, phone, leaveId } = body;

    console.log("MSG91 Voice Webhook Received:", body);

    if (!status || !leaveId) {
      return NextResponse.json(
        { error: "Missing required fields (status, leaveId) in webhook payload" },
        { status: 400 }
      );
    }

    // Map webhook status to parentStatus schema status
    let parentStatus: "allowed" | "rejected" | "pending" | "no_response" = "pending";
    if (status === "approved" || status === "allowed") {
      parentStatus = "allowed";
    } else if (status === "rejected") {
      parentStatus = "rejected";
    } else if (status === "no_response" || status === "failed") {
      parentStatus = "no_response";
    } else {
      return NextResponse.json(
        { error: `Invalid status received: ${status}` },
        { status: 400 }
      );
    }

    // Verify the permission exists
    const currentPermission = await db.permissions.getById(leaveId);
    if (!currentPermission) {
      return NextResponse.json({ error: "Permission not found for provided leaveId" }, { status: 404 });
    }

    // Update the permission's parentStatus ONLY. The overall status is left to the Dean/Warden.
    await db.permissions.update(leaveId, { parentStatus });
    console.log(`Successfully updated leave ${leaveId} parentStatus to ${parentStatus} via MSG91 Webhook.`);

    return NextResponse.json({ success: true, message: `Parent status set to ${parentStatus}` }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing MSG91 webhook:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}
