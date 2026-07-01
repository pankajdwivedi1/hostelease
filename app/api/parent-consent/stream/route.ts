import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get("fileId");

        if (!fileId) {
            return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            console.error("❌ [Proxy Stream API] Missing OAuth2 configuration in env vars.");
            return NextResponse.json({ error: "OAuth2 credentials not configured on server" }, { status: 500 });
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // 1. Fetch file metadata to get Content-Type
        const metadata = await drive.files.get({
            fileId: fileId,
            fields: "mimeType"
        });
        const mimeType = metadata.data.mimeType || "video/webm";

        // 2. Fetch the file media directly as ArrayBuffer (super fast for 1-2 MB files!)
        const response = await drive.files.get(
            { fileId: fileId, alt: "media" },
            { responseType: "arraybuffer" }
        );

        const buffer = response.data as ArrayBuffer;

        // 3. Return the buffer directly
        return new Response(buffer, {
            status: 200,
            headers: {
                "Content-Type": mimeType,
                "Content-Length": buffer.byteLength.toString(),
                "Cache-Control": "public, max-age=31536000, immutable",
                "Accept-Ranges": "bytes"
            }
        });

    } catch (error: any) {
        console.error("❌ [Proxy Stream API] Error streaming file:", error);
        return NextResponse.json({ error: error.message || "Failed to stream file" }, { status: 500 });
    }
}
