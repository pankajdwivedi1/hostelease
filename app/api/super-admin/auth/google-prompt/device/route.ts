import { NextRequest, NextResponse } from "next/server";
import { bindMasterSecurityPhone, unbindMasterSecurityPhone, getMasterSecurityPhoneStatus } from "@/lib/googlePromptSecurity";
import { getAuthSession } from "@/lib/authSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getMasterSecurityPhoneStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (session?.role !== "superadmin") {
      return NextResponse.json({ error: "Unauthorized. SuperAdmin session required." }, { status: 401 });
    }

    const body = await request.json();
    const { action, subscription, deviceName } = body;

    if (action === "bind") {
      if (!subscription || !subscription.endpoint) {
        return NextResponse.json({ error: "Invalid Web Push subscription" }, { status: 400 });
      }

      const userAgent = request.headers.get("user-agent") || "";
      const result = await bindMasterSecurityPhone(subscription, {
        name: deviceName || "Personal Mobile Phone",
        userAgent
      });

      return NextResponse.json({
        success: true,
        message: "Device registered as Master Security Phone",
        ...result
      });
    }

    if (action === "unbind") {
      await unbindMasterSecurityPhone();
      return NextResponse.json({
        success: true,
        message: "Master Security Phone unbound successfully"
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Device binding API error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
