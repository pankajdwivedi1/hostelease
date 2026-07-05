import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 (optional — when set, new consent videos upload here instead of Google Drive).
 *
 * Server (.env):
 *   R2_ACCOUNT_ID=
 *   R2_ACCESS_KEY_ID=
 *   R2_SECRET_ACCESS_KEY=
 *   R2_BUCKET_NAME=hosteleaze-consent
 *   R2_PUBLIC_URL=https://pub-xxxx.r2.dev   (R2 public bucket URL or custom CDN domain)
 *
 * Client (.env — same public base, for fast direct playback detection):
 *   NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
    process.env.R2_PUBLIC_URL
  );
}

function getR2Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadConsentToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
  return `${base}/${key}`;
}

/** Client-safe: true when URL is served directly from R2/CDN (no proxy hop). */
export function isDirectConsentVideoUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("drive.google.com")) return false;

  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase && url.startsWith(publicBase)) return true;

  return (
    url.includes(".r2.dev") ||
    url.includes(".r2.cloudflarestorage.com") ||
    url.startsWith("/api/parent-consent/r2/")
  );
}
