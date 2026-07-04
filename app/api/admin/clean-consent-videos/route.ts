import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

function getGoogleDriveFileId(url: string) {
    if (!url) return null;
    const matchD = url.match(/\/d\/([a-zA-Z0-9_-]{25,50})/);
    if (matchD) return matchD[1];
    const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]{25,50})/);
    if (matchId) return matchId[1];
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { studentId } = body;

        if (!studentId) {
            return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
        }

        const student = await db.students.getById(studentId);
        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Fetch all permissions for this student
        const result = await db.permissions.list({ studentId }, { limit: 1000 });
        const permissions = result.permissions || [];

        // Filter permissions that have a parentConsentUrl
        const permissionsWithConsent = permissions.filter(p => p.parentConsentUrl && p.parentConsentUrl.trim() !== "");

        if (permissionsWithConsent.length === 0) {
            return NextResponse.json({
                success: true,
                message: `No parent consent videos found for ${student.name}.`
            });
        }

        // Initialize Google OAuth2 client using refresh token
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        let driveDeletedCount = 0;
        let dbClearedCount = 0;
        const errors: string[] = [];

        let driveClient: any = null;
        if (clientId && clientSecret && refreshToken) {
            try {
                const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
                oauth2Client.setCredentials({ refresh_token: refreshToken });
                driveClient = google.drive({ version: "v3", auth: oauth2Client });
            } catch (err: any) {
                console.error("Failed to initialize Google Drive Client:", err);
                errors.push("Failed to authenticate with Google Drive API: " + err.message);
            }
        } else {
            console.warn("⚠️ Google Drive credentials missing in environment variables. Clearing database links only.");
            errors.push("Google Drive OAuth2 not configured on server (clearing database URLs only).");
        }

        for (const perm of permissionsWithConsent) {
            const fileId = getGoogleDriveFileId(perm.parentConsentUrl);
            
            // Delete file from Google Drive if client is initialized
            if (driveClient && fileId) {
                try {
                    await driveClient.files.delete({ fileId });
                    driveDeletedCount++;
                } catch (driveErr: any) {
                    console.error(`Failed to delete file ${fileId} from Google Drive:`, driveErr);
                    // 404 means the file was already deleted or doesn't exist, which is fine
                    if (driveErr.status !== 404) {
                        errors.push(`Google Drive error for file ${fileId}: ${driveErr.message || 'Unknown error'}`);
                    } else {
                        driveDeletedCount++; // count as removed
                    }
                }
            }

            // Always clear it in the database regardless of Google Drive deletion success
            try {
                await db.permissions.update(perm._id, {
                    parentConsentUrl: null
                });
                dbClearedCount++;
            } catch (dbErr: any) {
                console.error(`Failed to update permission ${perm._id} in database:`, dbErr);
                errors.push(`Database error for permission ${perm._id}: Failed to clear video URL`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Cleared ${dbClearedCount} database records for ${student.name}. Successfully deleted ${driveDeletedCount} files from Google Drive.`,
            driveDeletedCount,
            dbClearedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error("Error cleaning consent videos:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
