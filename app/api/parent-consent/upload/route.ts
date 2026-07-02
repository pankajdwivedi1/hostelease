import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const leaveId = formData.get("leaveId") as string;
        const videoFile = formData.get("video") as File;

        if (!leaveId || !videoFile) {
            return NextResponse.json({ error: "Missing leaveId or video file" }, { status: 400 });
        }

        // 1. Verify OAuth environment variables
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!clientId || !clientSecret || !refreshToken || !folderId) {
            console.error("❌ [Google Drive API] Missing OAuth2 configuration in env vars.");
            return NextResponse.json({ 
                error: "Google Drive OAuth2 is not configured yet on this server. Please setup Client ID, Client Secret, and Refresh Token in environment variables." 
            }, { status: 501 });
        }

        console.log(`[Google Drive API] Uploading parent consent video for Leave ID: ${leaveId} using OAuth2...`);

        // 2. Initialize Google OAuth2 client using refresh token
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({
            refresh_token: refreshToken
        });

        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // 3. Convert File to buffer and readable stream
        const arrayBuffer = await videoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const stream = Readable.from(buffer);

        const originalName = videoFile.name || "";
        const fileExt = originalName.endsWith(".mp4") ? "mp4" : "webm";

        // 4. Upload file metadata
        const fileMetadata = {
            name: `consent_${leaveId}_${Date.now()}.${fileExt}`,
            parents: [folderId]
        };

        const media = {
            mimeType: videoFile.type || "video/webm",
            body: stream
        };

        // 5. Create file on Google Drive (this consumes your personal Gmail quota, not Service Account)
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: "id, webViewLink, webContentLink"
        });

        const fileId = response.data.id;
        const webViewLink = response.data.webViewLink;

        if (!fileId || !webViewLink) {
            throw new Error("Failed to retrieve upload metadata from Google Drive");
        }

        console.log(`[Google Drive API] Successfully uploaded file to Google Drive. File ID: ${fileId}. Link: ${webViewLink}`);

        // 6. Make file viewable by anyone with the link
        try {
            await drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: "reader",
                    type: "anyone"
                }
            });
            console.log(`[Google Drive API] Permissions set to public read for file: ${fileId}`);
        } catch (permError: any) {
            console.warn(`⚠️ [Google Drive API] Could not set public permissions: ${permError.message}. Folder inheritance will apply.`);
        }

        // 7. Update leave request in DB with the link
        await db.permissions.update(leaveId, {
            parentConsentUrl: webViewLink,
            parentStatus: "approved"
        });

        console.log(`[Google Drive API] Database updated for Leave ID: ${leaveId} with parentConsentUrl`);

        return NextResponse.json({
            success: true,
            fileId,
            webViewLink
        }, { status: 200 });

    } catch (error: any) {
        console.error("❌ [Google Drive API] Upload failed:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to upload video to Google Drive" 
        }, { status: 500 });
    }
}
