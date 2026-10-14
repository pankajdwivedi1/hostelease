import { useCallback, useRef, useState } from "react";

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export function getConsentStreamUrl(url: string): string {
  if (!url) return "";
  if (url.includes("drive.google.com")) {
    const fileId = extractDriveFileId(url);
    return fileId ? `/api/parent-consent/stream?fileId=${fileId}` : url;
  }
  // R2 / CDN / any other direct HTTPS URL — play straight from edge (fastest)
  return url;
}

export function resolveConsentVideoSrc(
  parentConsentUrl: string,
  prefetched: Record<string, string>
): string {
  const fileId = extractDriveFileId(parentConsentUrl);
  if (fileId && prefetched[fileId]) return prefetched[fileId];

  const directKey = getDirectPrefetchKey(parentConsentUrl);
  if (directKey && prefetched[directKey]) return prefetched[directKey];

  return getConsentStreamUrl(parentConsentUrl);
}

function getDirectPrefetchKey(url: string): string | null {
  if (!url || url.includes("drive.google.com")) return null;
  return url;
}

// ⚡ LIGHTWEIGHT EDGE PREWARM:
// Warm up HTTP connection and buffer the first 128KB chunk on hover so video starts in 0ms when clicked!
export function useParentConsentVideoPrefetch(
  consentUrls: (string | null | undefined)[]
) {
  const [prefetchedVideoUrls, setPrefetchedVideoUrls] = useState<
    Record<string, string>
  >({});
  const prewarmedUrlsRef = useRef<Set<string>>(new Set());

  const prefetchVideo = useCallback((parentConsentUrl: string): Promise<void> => {
    if (!parentConsentUrl || typeof window === "undefined") return Promise.resolve();
    const streamUrl = getConsentStreamUrl(parentConsentUrl);
    if (!streamUrl || prewarmedUrlsRef.current.has(streamUrl)) return Promise.resolve();

    prewarmedUrlsRef.current.add(streamUrl);

    try {
      // 1. Preload link element in head to warm TCP/TLS handshake
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "fetch";
      link.href = streamUrl;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);

      // 2. Buffer the first 128KB chunk so initial playback starts immediately with zero delay
      fetch(streamUrl, {
        headers: { Range: "bytes=0-131071" },
        cache: "force-cache",
      }).catch(() => {});
    } catch {
      // Ignore prefetch failures safely
    }

    return Promise.resolve();
  }, []);

  return { prefetchedVideoUrls, prefetchVideo };
}
