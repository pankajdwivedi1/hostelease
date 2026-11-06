import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { clearAuthSessionCookie, setAuthSessionCookie } from "@/lib/authSession";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) return NextResponse.json({ error: "Firebase ID token required" }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const cleanEmail = (decoded.email || "").toLowerCase().trim();

    let studentDbId: string | undefined;
    let registrationId: string | undefined;

    if (cleanEmail) {
      try {
        const student = await db.students.findOne({ email: cleanEmail });
        if (student) {
          studentDbId = String(student._id || student.id || "");
          registrationId = student.registrationId || (student as any).registration_id;
        }
      } catch (dbErr) {
        console.warn("[AUTH_SESSION] Database student lookup notice:", dbErr);
      }
    }

    const response = NextResponse.json({ success: true, studentId: studentDbId, registrationId });
    setAuthSessionCookie(response, {
      role: "student",
      studentId: studentDbId,
      registrationId: registrationId,
      email: cleanEmail,
      uid: decoded.uid,
    });
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
