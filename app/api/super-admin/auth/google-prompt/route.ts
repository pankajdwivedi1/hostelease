import { NextRequest, NextResponse } from "next/server";
import {
  createPromptChallenge,
  getChallengeForPhone,
  verifyPromptResponse,
  rejectPromptChallenge,
  checkChallengeStatus,
  getMasterSecurityPhoneStatus
} from "@/lib/googlePromptSecurity";
import { setAuthSessionCookie } from "@/lib/authSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challengeId = searchParams.get("challengeId");

  if (challengeId) {
    const data = getChallengeForPhone(challengeId);
    if (!data) {
      return NextResponse.json({ error: "Challenge not found or expired" }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  // Return master phone binding status
  const status = await getMasterSecurityPhoneStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. CREATE CHALLENGE (Triggered from PC Login)
    if (action === "create") {
      const userAgent = request.headers.get("user-agent") || "";
      const forwardedFor = request.headers.get("x-forwarded-for") || "";
      const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "Localhost / Internal";

      let browser = "Web Browser";
      if (userAgent.includes("Chrome")) browser = "Chrome";
      else if (userAgent.includes("Firefox")) browser = "Firefox";
      else if (userAgent.includes("Safari")) browser = "Safari";
      else if (userAgent.includes("Edge")) browser = "Edge";

      let os = "Desktop PC";
      if (userAgent.includes("Windows")) os = "Windows PC";
      else if (userAgent.includes("Mac")) os = "Mac OS";
      else if (userAgent.includes("Linux")) os = "Linux";

      const challenge = await createPromptChallenge({
        ip,
        browser,
        os,
        location: "Campus Admin Terminal"
      });

      return NextResponse.json({
        success: true,
        ...challenge
      });
    }

    // 2. CHECK STATUS (Poll from PC)
    if (action === "check") {
      const { challengeId } = body;
      if (!challengeId) {
        return NextResponse.json({ error: "Missing challengeId" }, { status: 400 });
      }

      const status = checkChallengeStatus(challengeId);

      // If approved by the phone, issue the authenticated SuperAdmin session cookie!
      if (status.status === "APPROVED") {
        const response = NextResponse.json({
          status: "APPROVED",
          message: "Access granted by Master Security Phone"
        });
        setAuthSessionCookie(response, { role: "superadmin" });
        return response;
      }

      return NextResponse.json(status);
    }

    // 3. RESPOND (Tapped on Phone)
    if (action === "respond") {
      const { challengeId, selectedNumber, rejected } = body;
      if (!challengeId) {
        return NextResponse.json({ error: "Missing challengeId" }, { status: 400 });
      }

      if (rejected) {
        rejectPromptChallenge(challengeId);
        return NextResponse.json({ success: true, status: "REJECTED" });
      }

      if (typeof selectedNumber !== "number") {
        return NextResponse.json({ error: "Invalid selected number" }, { status: 400 });
      }

      const result = verifyPromptResponse(challengeId, selectedNumber);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Google Prompt API Error:", err);
    return NextResponse.json({ error: err?.message || "Internal Error" }, { status: 500 });
  }
}
