import { NextRequest, NextResponse } from "next/server";
import { bindMasterSecurityPhone, unbindMasterSecurityPhone, getMasterSecurityPhoneStatus } from "@/lib/googlePromptSecurity";
import { getAuthSession, isPrivilegedSession } from "@/lib/authSession";
import { getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paramTenantId = searchParams.get("tenantId");
  const contextTenantId = await getCurrentTenantId().catch(() => null);
  const tenantId = paramTenantId || contextTenantId || null;

  const status = await getMasterSecurityPhoneStatus(tenantId);
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session || (!isPrivilegedSession(session) && session.role !== "superadmin")) {
      return NextResponse.json({ error: "Unauthorized. SuperAdmin or Admin access required." }, { status: 401 });
    }

    const body = await request.json();
    const { action, subscription, deviceName, tenantId: bodyTenantId } = body;
    const contextTenantId = await getCurrentTenantId().catch(() => null);
    const tenantId = bodyTenantId || contextTenantId || null;

    if (action === "bind") {
      if (!subscription || !subscription.endpoint) {
        return NextResponse.json({ error: "Invalid Web Push subscription" }, { status: 400 });
      }

      const userAgent = request.headers.get("user-agent") || "";
      const result = await bindMasterSecurityPhone(
        subscription,
        {
          name: deviceName || "Personal Mobile Phone",
          userAgent
        },
        tenantId
      );

      return NextResponse.json({
        success: true,
        message: "Device registered as Master Security Phone",
        tenantId,
        ...result
      });
    }

    if (action === "unbind") {
      await unbindMasterSecurityPhone(tenantId);
      return NextResponse.json({
        success: true,
        message: "Master Security Phone unbound successfully",
        tenantId
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Device binding API error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
