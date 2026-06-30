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

        // 1. Verify environment variables
        const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!clientEmail || !privateKeyRaw || !folderId) {
            console.error("❌ [Google Drive API] Missing service account configuration in env vars.");
            return NextResponse.json({ 
                error: "Google Drive storage is not configured yet on this server. Please setup environment variables." 
            }, { status: 501 });
        }

        // Format the private key correctly (handling potential escapes for newlines)
        const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

        console.log(`[Google Drive API] Uploading parent consent video for Leave ID: ${leaveId}...`);

        // 2. Initialize Google Auth client
        const auth = new google.auth.JWT(
            clientEmail,
            null,
            privateKey,
            ["https://www.googleapis.com/auth/drive"]
        );

        const drive = google.drive({ version: "v3", auth });

        // 3. Convert File to buffer and readable stream
        const arrayBuffer = await videoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const stream = Readable.from(buffer);

        // 4. Upload file metadata
        const fileMetadata = {
            name: `consent_${leaveId}_${Date.now()}.webm`,
            parents: [folderId]
        };

        const media = {
            mimeType: videoFile.type || "video/webm",
            body: stream
        };

        // 5. Create file on Google Drive
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

        console.log(`[Google Drive API] Successfully uploaded file. File ID: ${fileId}. Link: ${webViewLink}`);

        // 6. Make file viewable by anyone with the link (so Wardens & Deans can watch it)
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

        // 7. Update leave request (Permission table) in the database with the video link
        // We will also update parentStatus to 'approved' or update the metadata
        await db.permissions.update(leaveId, {
            parentConsentUrl: webViewLink,
            parentStatus: "approved" // Parent approved the leave by uploading video
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
