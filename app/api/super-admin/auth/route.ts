import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { setAuthSessionCookie } from "@/lib/authSession";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const { getAuthSession } = await import("@/lib/authSession");
  return NextResponse.json({ authenticated: getAuthSession(request)?.role === "superadmin" });
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const settings = await db.settings.get().catch(() => null);
    const expected = (process.env.SUPERADMIN_LOGIN_PASSWORD || process.env.DEVELOPER_LOGIN_PASSWORD || settings?.developerPassword || "").trim();
    if (!expected) return NextResponse.json({ error: "Super admin authentication is not configured" }, { status: 503 });
    if (typeof password !== "string" || password !== expected) {
      return NextResponse.json({ error: "Invalid SuperAdmin Password" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    setAuthSessionCookie(response, { role: "superadmin" });
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
  }
}