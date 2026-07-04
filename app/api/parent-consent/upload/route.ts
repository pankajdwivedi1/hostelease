import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { db } from "@/lib/dbAdapter";
import { isR2Configured, uploadConsentToR2 } from "@/lib/r2Storage";

export const dynamic = "force-dynamic";

async function uploadToGoogleDrive(
  buffer: Buffer,
  videoFile: File,
  leaveId: string,
  studentSlug: string
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error(
      "Google Drive OAuth2 is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, and GOOGLE_DRIVE_FOLDER_ID."
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const originalName = videoFile.name || "";
  const fileExt = originalName.endsWith(".mp4") ? "mp4" : "webm";
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: `consent${studentSlug}_${leaveId}_${Date.now()}.${fileExt}`,
      parents: [folderId],
    },
    media: {
      mimeType: videoFile.type || "video/webm",
      body: stream,
    },
    fields: "id, webViewLink",
  });

  const fileId = response.data.id;
  const webViewLink = response.data.webViewLink;

  if (!fileId || !webViewLink) {
    throw new Error("Failed to retrieve upload metadata from Google Drive");
  }

  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch (permError: unknown) {
    const message =
      permError instanceof Error ? permError.message : "permission error";
    console.warn(`⚠️ [Google Drive] Could not set public permissions: ${message}`);
  }

  return webViewLink;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const leaveId = formData.get("leaveId") as string;
    const videoFile = formData.get("video") as File;

    if (!leaveId || !videoFile) {
      return NextResponse.json(
        { error: "Missing leaveId or video file" },
        { status: 400 }
      );
    }

    const permission = await db.permissions.getById(leaveId, { populate: true });
    let studentSlug = "";
    if (permission) {
      const student =
        typeof permission.studentId === "object" ? permission.studentId : null;
      if (student) {
        const cleanName = student.name
          ? student.name.trim().replace(/\s+/g, "_")
          : "Student";
        const cleanErp = student.registrationId
          ? student.registrationId.trim()
          : "";
        studentSlug = cleanErp ? `_${cleanName}_${cleanErp}` : `_${cleanName}`;
      }
    }

    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = videoFile.name || "";
    const fileExt = originalName.endsWith(".mp4") ? "mp4" : "webm";
    let contentType = videoFile.type || "video/webm";
    // Normalize Content-Type to avoid issues with codec parameters in AVPlayer/Safari (e.g. video/webm;codecs=vp9,opus)
    if (contentType.includes("webm")) {
      contentType = "video/webm";
    } else if (contentType.includes("mp4")) {
      contentType = "video/mp4";
    }

    let consentUrl: string;
    let storage: "r2" | "google_drive";

    if (isR2Configured()) {
      const key = `consent${studentSlug}_${leaveId}_${Date.now()}.${fileExt}`;
      console.log(`[R2] Uploading parent consent for Leave ID: ${leaveId}...`);
      consentUrl = await uploadConsentToR2(buffer, key, contentType);
      storage = "r2";
      console.log(`[R2] Uploaded consent video: ${consentUrl}`);
    } else {
      console.log(
        `[Google Drive] Uploading parent consent for Leave ID: ${leaveId} (R2 not configured)...`
      );
      consentUrl = await uploadToGoogleDrive(
        buffer,
        videoFile,
        leaveId,
        studentSlug
      );
      storage = "google_drive";
      console.log(`[Google Drive] Uploaded consent video: ${consentUrl}`);
    }

    await db.permissions.update(leaveId, {
      parentConsentUrl: consentUrl,
      parentStatus: "approved",
    });

    return NextResponse.json(
      {
        success: true,
        webViewLink: consentUrl,
        storage,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to upload consent video";
    console.error("❌ [Parent Consent Upload] Failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
