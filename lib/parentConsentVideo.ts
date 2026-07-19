import { useCallback } from "react";

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

const EMPTY_PREFETCHED_VIDEO_URLS: Record<string, string> = {};

export function useParentConsentVideoPrefetch(
  _consentUrls: (string | null | undefined)[]
) {
  const prefetchVideo = useCallback((_parentConsentUrl: string): Promise<void> => {
    return Promise.resolve();
  }, []);

  return { prefetchedVideoUrls: EMPTY_PREFETCHED_VIDEO_URLS, prefetchVideo };
}
