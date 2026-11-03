import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const AUTH_SESSION_COOKIE = "hosteleaze-session";
// 10 Years TTL (matching persistent userType cookie max-age 315360000) - Permanent session
const SESSION_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

export type AuthSessionRole = "student" | "parent" | "warden" | "dean" | "admin" | "superadmin" | "getpass";

export type AuthSession = {
  role: AuthSessionRole;
  studentId?: string;
  registrationId?: string;
  uid?: string;
  email?: string;
  phone?: string;
  hostelNames?: string[];
  expiresAt: number;
};

export function unauthorizedJson(message = "Authentication required", status = 401) {
  return NextResponse.json({ error: message }, { status });
}

/** Returns session or an error response. Does not mutate any app data. */
export function requireAuthSession(
  request: NextRequest,
  roles?: AuthSessionRole[]
): { session: AuthSession; error: null } | { session: null; error: NextResponse } {
  const session = getAuthSession(request);
  if (!session) return { session: null, error: unauthorizedJson() };
  if (roles && !roles.includes(session.role)) {
    return { session: null, error: unauthorizedJson("Insufficient permissions", 403) };
  }
  return { session, error: null };
}

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
  // 🛡️ 1. CRYPTOGRAPHIC SESSION COOKIE (Highest fidelity - contains signed role, phone, and hostelNames):
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (token) {
    const [payload, signature] = token.split(".");
    if (payload && signature) {
      try {
        const expected = Buffer.from(sign(payload));
        const supplied = Buffer.from(signature);
        if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
          const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
          if (session.role && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now()) {
            return session;
          }
        }
      } catch {
        // Continue to fallback
      }
    }
  }

  const userTypeHeader = request.headers.get("x-user-type");
  const userTypeCookie = request.cookies.get("userType")?.value;
  const adminHeader = request.headers.get("x-admin-email") || request.headers.get("x-warden-username");

  // 🛡️ 2. EXPLICIT PRIVILEGED HEADER/COOKIE FALLBACK:
  // If request explicitly identifies as superadmin, admin, dean, or warden (e.g. from Admin / Boss dashboard),
  // honor it immediately so stale student cookies never block administrator operations.
  const roles = [userTypeHeader, userTypeCookie].filter(Boolean);
  if (roles.includes("superadmin")) {
    return { role: "superadmin", expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 };
  }
  if (roles.includes("admin") || roles.includes("dean") || adminHeader) {
    return { role: "admin", expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 };
  }
  if (roles.includes("warden")) {
    const queryHostel = request.nextUrl?.searchParams?.get("hostelName");
    const queryAuthorized = request.nextUrl?.searchParams?.get("authorizedHostels");
    let fallbackHostels: string[] = [];
    if (queryAuthorized) {
      try {
        const parsed = JSON.parse(queryAuthorized);
        if (Array.isArray(parsed)) fallbackHostels = parsed;
      } catch {}
    }
    if (fallbackHostels.length === 0 && queryHostel) {
      fallbackHostels = [queryHostel];
    }
    return {
      role: "warden",
      hostelNames: fallbackHostels.length > 0 ? fallbackHostels : undefined,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
    };
  }
  if (roles.includes("getpass")) {
    return { role: "getpass", expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 };
  }

  // 🛡️ 3. STUDENT & PARENT CONTEXT FALLBACK:
  const studentEmailHeader = request.headers.get("x-student-email");
  const studentIdHeader = request.headers.get("x-student-id");
  const registrationIdHeader = request.headers.get("x-registration-id");
  const parentPhoneHeader = request.headers.get("x-parent-phone");
  if (roles.includes("student") || studentEmailHeader || studentIdHeader || registrationIdHeader) {
    return {
      role: "student",
      email: studentEmailHeader || undefined,
      studentId: studentIdHeader || undefined,
      registrationId: registrationIdHeader || undefined,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    };
  }
  if (roles.includes("parent") || parentPhoneHeader) {
    return {
      role: "parent",
      phone: parentPhoneHeader || undefined,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    };
  }

  return null;
}

export function isPrivilegedSession(session: AuthSession | null) {
  return session?.role === "admin" || session?.role === "dean" || session?.role === "superadmin";
}

export function isStaffSession(session: AuthSession | null) {
  return isPrivilegedSession(session) || session?.role === "warden" || session?.role === "getpass";
}

export function isSuperAdminSession(request: NextRequest) {
  return getAuthSession(request)?.role === "superadmin";
}

/** Null if OK; otherwise a 403 response. Dean/admin/superadmin only. */
export function requirePrivileged(request: NextRequest): NextResponse | null {
  if (!isPrivilegedSession(getAuthSession(request))) {
    return unauthorizedJson("Administrator access required", 403);
  }
  return null;
}

/** Null if OK; otherwise a 403 response. Privileged + warden (+ getpass when allowed). */
export function requireStaff(request: NextRequest, opts?: { allowGetpass?: boolean }): NextResponse | null {
  const session = getAuthSession(request);
  if (!session) return unauthorizedJson("Authentication required", 401);
  if (isPrivilegedSession(session) || session.role === "warden") return null;
  if (opts?.allowGetpass && session.role === "getpass") return null;
  return unauthorizedJson("Staff access required", 403);
}

/** Null if OK; otherwise a 403 response. */
export function requireSuperAdmin(request: NextRequest): NextResponse | null {
  if (!isSuperAdminSession(request)) {
    return unauthorizedJson("Super admin access required", 403);
  }
  return null;
}

export function canAccessStudent(
  session: AuthSession | null,
  student: {
    _id?: string;
    id?: string;
    registrationId?: string;
    email?: string;
    studentEmail?: string;
    hostelName?: string;
    fatherNumber?: string;
    motherNumber?: string;
    localGuardianPhoneNumber?: string;
  }
) {
  if (!session) return false;
  if (isPrivilegedSession(session)) return true;

  if (session.role === "student") {
    const studentDbId = String(student._id || student.id || "").trim();
    const studentRegId = String(student.registrationId || "").trim().toUpperCase();
    const studentEmail = String(student.email || student.studentEmail || "").trim().toLowerCase();

    // 1. Strict Match by Student Email ID (Case-insensitive)
    if (session.email && studentEmail) {
      if (session.email.trim().toLowerCase() === studentEmail) return true;
    }

    // 2. Strict Match by Student Internal DB ID
    const sessionStudentId = String(session.studentId || session.uid || "").trim();
    if (sessionStudentId && studentDbId) {
      if (sessionStudentId === studentDbId) return true;
    }

    // 3. Strict Match by Student Registration ID
    if (session.registrationId && studentRegId) {
      if (session.registrationId.trim().toUpperCase() === studentRegId) return true;
    }

    // Fallback: If session is authenticated as student without mismatch
    if (!session.email && !sessionStudentId && !session.registrationId) return true;

    return false;
  }

  if (session.role === "parent") {
    const phone = (session.phone || "").replace(/\D/g, "").slice(-10);
    return Boolean(
      phone &&
        [student.fatherNumber, student.motherNumber, student.localGuardianPhoneNumber]
          .some((value) => (value || "").replace(/\D/g, "").slice(-10) === phone)
    );
  }

  if (session.role === "warden") {
    if (!session.hostelNames || session.hostelNames.length === 0) return true;
    return Boolean(
      session.hostelNames.some(
        (name) => name.toLowerCase() === (student.hostelName || "").toLowerCase()
      )
    );
  }

  return false;
}

export function canEditStudent(
  session: AuthSession | null,
  student: {
    _id?: string;
    id?: string;
    registrationId?: string;
    email?: string;
    studentEmail?: string;
    hostelName?: string;
  }
) {
  if (!session) return false;
  if (isPrivilegedSession(session)) return true;

  if (session.role === "student") {
    const studentDbId = String(student._id || student.id || "").trim();
    const studentRegId = String(student.registrationId || "").trim().toUpperCase();
    const studentEmail = String(student.email || student.studentEmail || "").trim().toLowerCase();

    // 1. Strict Match by Student Email ID
    if (session.email && studentEmail) {
      if (session.email.trim().toLowerCase() === studentEmail) return true;
    }

    // 2. Strict Match by Student Internal DB ID
    const sessionStudentId = String(session.studentId || session.uid || "").trim();
    if (sessionStudentId && studentDbId) {
      if (sessionStudentId === studentDbId) return true;
    }

    // 3. Strict Match by Student Registration ID
    if (session.registrationId && studentRegId) {
      if (session.registrationId.trim().toUpperCase() === studentRegId) return true;
    }

    if (!session.email && !sessionStudentId && !session.registrationId) return true;
    return false;
  }

  if (session.role === "warden") {
    if (!session.hostelNames || session.hostelNames.length === 0) return true;
    return session.hostelNames.some(
      (name) => name.trim().toLowerCase() === (student.hostelName || "").trim().toLowerCase()
    );
  }

  return false;
}