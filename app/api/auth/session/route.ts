import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { clearAuthSessionCookie, setAuthSessionCookie } from "@/lib/authSession";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) return NextResponse.json({ error: "Firebase ID token required" }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const response = NextResponse.json({ success: true });
    setAuthSessionCookie(response, { role: "student", uid: decoded.uid, email: decoded.email });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid Firebase ID token" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAuthSessionCookie(response);
  return response;
}