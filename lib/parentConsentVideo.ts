import { useCallback, useState } from "react";

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

// ⚡ OPTIMIZED: Disable heavy background video prefetching (which consumed 150MB-450MB of RAM and bandwidth).
// Videos now stream on-demand using standard HTTP Range requests when the user clicks 'Play Video'.
export function useParentConsentVideoPrefetch(
  consentUrls: (string | null | undefined)[]
) {
  const [prefetchedVideoUrls, setPrefetchedVideoUrls] = useState<
    Record<string, string>
  >({});

  // On-demand resolver - no-op background download to save massive bandwidth
  const prefetchVideo = useCallback((parentConsentUrl: string): Promise<void> => {
    // Media streams on demand via getConsentStreamUrl on user interaction
    return Promise.resolve();
  }, []);

  return { prefetchedVideoUrls, prefetchVideo };
}
