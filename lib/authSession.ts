import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const AUTH_SESSION_COOKIE = "hosteleaze-session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type AuthSession = {
  role: "student" | "parent" | "warden" | "dean" | "admin" | "superadmin";
  uid?: string;
  email?: string;
  phone?: string;
  hostelNames?: string[];
  expiresAt: number;
};

function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is required to issue authenticated sessions");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function setAuthSessionCookie(response: NextResponse, session: Omit<AuthSession, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({
    ...session,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  })).toString("base64url");
  response.cookies.set(AUTH_SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAuthSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getAuthSession(request: NextRequest): AuthSession | null {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
    if (!session.role || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function isPrivilegedSession(session: AuthSession | null) {
  return session?.role === "admin" || session?.role === "dean" || session?.role === "superadmin";
}

export function isSuperAdminSession(request: NextRequest) {
  return getAuthSession(request)?.role === "superadmin";
}

export function canAccessStudent(session: AuthSession | null, student: { firebaseUID?: string; hostelName?: string; fatherNumber?: string; motherNumber?: string; localGuardianPhoneNumber?: string }) {
  if (!session) return false;
  if (isPrivilegedSession(session)) return true;
  if (session.role === "student") return Boolean(session.uid && session.uid === student.firebaseUID);
  if (session.role === "parent") {
    const phone = (session.phone || "").replace(/\D/g, "").slice(-10);
    return Boolean(phone && [student.fatherNumber, student.motherNumber, student.localGuardianPhoneNumber]
      .some((value) => (value || "").replace(/\D/g, "").slice(-10) === phone));
  }
  if (session.role === "warden") {
    return Boolean(session.hostelNames?.some((name) => name.toLowerCase() === (student.hostelName || "").toLowerCase()));
  }
  return false;
}

export function canEditStudent(session: AuthSession | null, student: { firebaseUID?: string; hostelName?: string }) {
  if (!session) return false;
  if (isPrivilegedSession(session)) return true;
  if (session.role === "student") return Boolean(session.uid && session.uid === student.firebaseUID);
  return session.role === "warden" && Boolean(session.hostelNames?.some((name) => name.toLowerCase() === (student.hostelName || "").toLowerCase()));
}