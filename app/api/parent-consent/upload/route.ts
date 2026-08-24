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
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientEmail || !privateKeyRaw || !folderId) {
    throw new Error(
      "Google Drive Service Account is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID."
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"]
  });
  const drive = google.drive({ version: "v3", auth });

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
    let student: any = null;
    if (permission) {
      student = typeof permission.studentId === "object" ? permission.studentId : null;
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

    // Send push notifications (Fire & Forget)
    try {
      import("@/lib/pushNotification").then(async ({ sendPushNotification }) => {
        if (student) {
          const studentIdStr = student.id || student._id || "";
          const studentPhoto = (student as any)?.profilePicture || (student as any)?.photoUrl || (student as any)?.photo || (student as any)?.image;
          
          // 1. Notify Warden if hostelName is set
          if (student.hostelName) {
            try {
              const hostels = await db.hostels.getAll();
              const matchedHostel = (hostels || []).find((h: any) => h.name === student.hostelName);
              const wardenId = matchedHostel?.wardenUsername;
              if (wardenId) {
                sendPushNotification(wardenId, "warden", "parentConsentVideoUploaded", {
                  title: "Parent Consent Video Uploaded",
                  body: `${student.name}'s parent uploaded a leave consent video.`,
                  url: "/",
                  icon: studentPhoto || "/icons/icon-192x192.png",
                  image: studentPhoto || undefined
                }).catch(err => console.error("Warden parent consent video upload push failed:", err));
              }
            } catch (err) {
              console.error("Hostel lookup for warden consent push failed:", err);
            }
          }

          // 2. Notify Dean (always "admin" / "dean" type)
          sendPushNotification("admin", "dean", "parentConsentVideoUploaded", {
            title: "Parent Consent Video Uploaded",
            body: `Consent video uploaded for student ${student.name}.`,
            url: "/",
            icon: studentPhoto || "/icons/icon-192x192.png",
            image: studentPhoto || undefined
          }).catch(err => console.error("Dean parent consent video upload push failed:", err));

          // 3. Notify Student
          sendPushNotification(studentIdStr.toString(), "student", "parentConsentVideoUploaded", {
            title: "Parent Consent Video Received",
            body: "Your parent has successfully uploaded the leave consent video.",
            url: "/",
            icon: studentPhoto || "/icons/icon-192x192.png",
            image: studentPhoto || undefined
          }).catch(err => console.error("Student parent consent video upload push failed:", err));
        }
      });
    } catch (e) {
      console.error("Failed to trigger parent consent video push notifications:", e);
    }

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
