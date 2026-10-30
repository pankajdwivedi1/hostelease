export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// ⚡ In-memory LRU cache for image buffers (keeps up to 300 active profile pictures in fast RAM)
const imageMemoryCache = new Map<string, { buffer: Buffer; contentType: string; ts: number }>();
const MAX_CACHE_ENTRIES = 300;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

function isAllowedImageUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  const allowHosts = new Set<string>();

  const addFromBase = (base?: string | null) => {
    if (!base) return;
    try {
      allowHosts.add(new URL(base).hostname.toLowerCase());
    } catch { /* ignore */ }
  };

  addFromBase(process.env.R2_PHOTOS_PUBLIC_URL);
  addFromBase(process.env.NEXT_PUBLIC_R2_PHOTOS_PUBLIC_URL);
  addFromBase(process.env.R2_PUBLIC_URL);
  addFromBase(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
  // Known public photo CDN used by this app (hostname only; no secrets)
  allowHosts.add("pub-754ab0d29b3a43b69d79a461c85d3056.r2.dev");

  if (allowHosts.has(host)) return true;
  // Allow other Cloudflare R2 public buckets only (not arbitrary SSRF targets)
  if (host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com")) return true;
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    if (!isAllowedImageUrl(imageUrl)) {
      return new NextResponse("URL host is not allowed", { status: 403 });
    }

    // 1. Check in-memory RAM cache first (0ms latency response)
    const cached = imageMemoryCache.get(imageUrl);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
          "X-Image-Cache": "HIT-MEMORY",
        },
      });
    }

    // 2. Fetch from remote Cloudflare R2 / S3
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const remoteRes = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "image/webp,image/avif,image/jpeg,image/png,image/*",
      },
    });
    clearTimeout(timeout);

    if (!remoteRes.ok) {
      return new NextResponse(`Failed to fetch image: ${remoteRes.statusText}`, {
        status: remoteRes.status,
      });
    }

    const contentType = remoteRes.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await remoteRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Store in LRU RAM cache
    if (imageMemoryCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = imageMemoryCache.keys().next().value;
      if (firstKey) imageMemoryCache.delete(firstKey);
    }
    imageMemoryCache.set(imageUrl, {
      buffer,
      contentType,
      ts: Date.now(),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "X-Image-Cache": "MISS",
      },
    });
  } catch (error: any) {
    console.error("Image proxy error:", error);
    return new NextResponse(error.message || "Failed to proxy image", { status: 500 });
  }
}
