import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/app-version
 * Public endpoint — no auth required.
 * Returns latest APK version info so installed apps can self-check for updates.
 *
 * Config source priority:
 *   1. platform_settings table (id: 'app_version_config')
 *   2. Railway Environment variables:
 *        LATEST_APP_VERSION = "1.0.1"
 *        LATEST_APK_URL     = "https://..."
 *        APK_RELEASE_NOTES  = "What changed..."
 *        FORCE_APP_UPDATE   = "false" | "true"
 */
export async function GET() {
    let dbConfig: any = null;
    try {
        const row = await prisma.platformSetting.findUnique({
            where: { id: "app_version_config" }
        });
        if (row?.settings && typeof row.settings === "object") {
            dbConfig = row.settings;
        }
    } catch {
        // Fallback to env vars on DB lookup failure
    }

    const latestVersion = dbConfig?.latestVersion || process.env.LATEST_APP_VERSION || "1.0.0";
    const apkUrl = dbConfig?.apkUrl || process.env.LATEST_APK_URL || "";
    const releaseNotes = dbConfig?.releaseNotes || process.env.APK_RELEASE_NOTES || "Performance improvements and bug fixes.";
    const forceUpdate =
        dbConfig?.forceUpdate === true ||
        dbConfig?.forceUpdate === "true" ||
        process.env.FORCE_APP_UPDATE === "true";

    return NextResponse.json(
        {
            success: true,
            latestVersion,
            apkUrl,
            releaseNotes,
            forceUpdate,
        },
        {
            headers: {
                "Cache-Control": "no-store, no-cache",
                "Pragma": "no-cache",
            },
        }
    );
}
