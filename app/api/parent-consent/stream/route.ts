import { NextRequest } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Missing Google Service Account environment variables.");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"]
  });

  const credentials = await auth.authorize();
  const accessToken = credentials.access_token;

  if (!accessToken) {
    throw new Error("Failed to generate access token for Google Service Account");
  }

  // Token expires in 3600 seconds typically. Let's cache it for 50 minutes.
  cachedAccessToken = {
    token: accessToken,
    expiresAt: now + 50 * 60 * 1000,
  };

  return accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing fileId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();

    const rangeHeader = request.headers.get("range");
    const driveHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (rangeHeader) {
      driveHeaders.Range = rangeHeader;
    }

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: driveHeaders }
    );

    const headers = new Headers();
    let contentType = driveResponse.headers.get("content-type") || "";
    if (contentType.includes("mp4")) {
      contentType = "video/mp4";
    } else if (contentType.includes("webm")) {
      contentType = "video/webm";
    } else if (contentType.includes("quicktime") || contentType.includes("mov")) {
      contentType = "video/mp4";
    } else {
      contentType = "video/webm";
    }
    headers.set("Content-Type", contentType);

    const contentRange = driveResponse.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    const contentLength = driveResponse.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(driveResponse.body, {
      status: driveResponse.status,
      headers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to stream file";
    console.error("❌ [Proxy Stream API] Error streaming file:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
