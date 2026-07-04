import { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || "Failed to refresh access token");
  }

  const expiresInMs = (tokenData.expires_in ?? 3600) * 1000;
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + expiresInMs,
  };

  return tokenData.access_token;
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

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.error("❌ [Proxy Stream API] Missing OAuth2 configuration.");
      return new Response(JSON.stringify({ error: "OAuth2 credentials not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

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
    const contentType = driveResponse.headers.get("content-type") || "";
    if (contentType.includes("video") || contentType.includes("octet-stream")) {
      headers.set("Content-Type", contentType);
    } else {
      headers.set("Content-Type", "video/webm");
    }

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
