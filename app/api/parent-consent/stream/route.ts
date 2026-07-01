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
            console.error("❌ [Proxy Stream API] Missing OAuth2 configuration.");
            return NextResponse.json({ error: "OAuth2 credentials not configured" }, { status: 500 });
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

        // 2. Fetch the file media as ArrayBuffer
        const response = await drive.files.get(
            { fileId: fileId, alt: "media" },
            { responseType: "arraybuffer" }
        );

        // Convert raw ArrayBuffer to Node.js Buffer
        const buffer = Buffer.from(response.data as ArrayBuffer);
        const totalSize = buffer.length;

        // 3. Handle Range requests (essential for iOS Safari and mobile Chrome)
        const rangeHeader = request.headers.get("range");

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

            if (start >= totalSize || end >= totalSize) {
                return new Response(null, {
                    status: 416,
                    headers: {
                        "Content-Range": `bytes */${totalSize}`
                    }
                });
            }

            const chunk = buffer.subarray(start, end + 1);

            return new Response(chunk, {
                status: 206,
                headers: {
                    "Content-Type": mimeType,
                    "Content-Range": `bytes ${start}-${end}/${totalSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": chunk.length.toString(),
                    "Cache-Control": "public, max-age=31536000, immutable"
                }
            });
        } else {
            // Standard full response (used for fetch prefetching)
            return new Response(buffer, {
                status: 200,
                headers: {
                    "Content-Type": mimeType,
                    "Content-Length": totalSize.toString(),
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "public, max-age=31536000, immutable"
                }
            });
        }

    } catch (error: any) {
        console.error("❌ [Proxy Stream API] Error streaming file:", error);
        return NextResponse.json({ error: error.message || "Failed to stream file" }, { status: 500 });
    }
}
