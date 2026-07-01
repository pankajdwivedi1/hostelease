import { NextRequest } from "next/server";

export const runtime = "edge"; // ⚡ Bypasses Vercel's 4.5MB response size limit!
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get("fileId");

        if (!fileId) {
            return new Response(JSON.stringify({ error: "Missing fileId" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            console.error("❌ [Proxy Stream API] Missing OAuth2 configuration.");
            return new Response(JSON.stringify({ error: "OAuth2 credentials not configured" }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 1. Get access token dynamically via OAuth2 refresh token endpoint
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token"
            })
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.access_token) {
            throw new Error(tokenData.error_description || "Failed to refresh access token");
        }
        const accessToken = tokenData.access_token;

        // 2. Fetch the file media stream from Google Drive (passing browser's Range headers directly!)
        const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Range: request.headers.get("range") || ""
            }
        });

        // 3. Return Google's exact stream and headers to the browser (including range headers!)
        const headers = new Headers();
        headers.set("Content-Type", driveResponse.headers.get("content-type") || "video/webm");
        
        const contentRange = driveResponse.headers.get("content-range");
        if (contentRange) headers.set("Content-Range", contentRange);

        const contentLength = driveResponse.headers.get("content-length");
        if (contentLength) headers.set("Content-Length", contentLength);

        const acceptRanges = driveResponse.headers.get("accept-ranges");
        if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new Response(driveResponse.body, {
            status: driveResponse.status,
            headers
        });

    } catch (error: any) {
        console.error("❌ [Proxy Stream API] Error streaming file:", error);
        return new Response(JSON.stringify({ error: error.message || "Failed to stream file" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
