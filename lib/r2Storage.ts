import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 configuration
 */
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "a9ae2d32d680701b543584167b43aa44";
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "1c9011d11cb2cd98d9fdd7834da38324";
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "b359c3fc5b0bf1d23027286e1a6726d48d3752f4cdf7ea1e66096e22f7c68ff0";

export const R2_PHOTOS_BUCKET = process.env.R2_PHOTOS_BUCKET_NAME || "hosteleaze-student-photos";
export const R2_PHOTOS_PUBLIC_BASE = (
  process.env.R2_PHOTOS_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_R2_PHOTOS_PUBLIC_URL ||
  "https://pub-754ab0d29b3a43b69d79a461c85d3056.r2.dev"
).replace(/\/$/, "");

export function isR2Configured(): boolean {
  return !!(
    (process.env.R2_ACCESS_KEY_ID || R2_ACCESS_KEY_ID) &&
    (process.env.R2_SECRET_ACCESS_KEY || R2_SECRET_ACCESS_KEY) &&
    (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID || R2_ACCOUNT_ID)
  );
}

function getR2Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadConsentToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME || "hosteleaze-consent";

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const base = (process.env.R2_PUBLIC_URL || R2_PHOTOS_PUBLIC_BASE).replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function uploadPhotoToR2(
  buffer: Buffer,
  key: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: R2_PHOTOS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${R2_PHOTOS_PUBLIC_BASE}/${key}`;
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

