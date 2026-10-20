/**
 * APP VERSION — bump this every time you build and release a new APK.
 * Format: "MAJOR.MINOR.PATCH"
 *
 * How to release a new update:
 *  1. Increment APP_VERSION here (e.g., "1.0.1" → "1.0.2")
 *  2. Build the new APK:  npx cap sync android → gradlew assembleRelease
 *  3. Upload the new APK to Cloudflare R2 and copy its public URL
 *  4. On Railway dashboard, update these env vars:
 *       LATEST_APP_VERSION = "1.0.2"
 *       LATEST_APK_URL     = "https://pub-xxxx.r2.dev/hosteleaze-v1.0.2.apk"
 *       APK_RELEASE_NOTES  = "What changed in this version"
 *       FORCE_APP_UPDATE   = "false"   (set "true" only if old version is broken)
 *  5. git push → Railway redeploys → all installed apps see the update prompt automatically
 */
export const APP_VERSION = "1.0.0";
