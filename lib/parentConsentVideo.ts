import { useCallback, useEffect, useRef, useState } from "react";
import { isDirectConsentVideoUrl } from "@/lib/r2Storage";

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

const MAX_PREFETCH_VIDEOS = 30;
const PREFETCH_CONCURRENCY = 3;

export function useParentConsentVideoPrefetch(
  consentUrls: (string | null | undefined)[]
) {
  const [prefetchedVideoUrls, setPrefetchedVideoUrls] = useState<
    Record<string, string>
  >({});
  const inflightRef = useRef(new Set<string>());
  const blobUrlsRef = useRef<string[]>([]);

  const prefetchVideo = useCallback((parentConsentUrl: string): Promise<void> => {
    const fileId = extractDriveFileId(parentConsentUrl);
    const cacheKey = fileId ?? getDirectPrefetchKey(parentConsentUrl);

    if (!cacheKey || inflightRef.current.has(cacheKey)) {
      return Promise.resolve();
    }

    inflightRef.current.add(cacheKey);
    const streamUrl = getConsentStreamUrl(parentConsentUrl);
    const isDirect = isDirectConsentVideoUrl(parentConsentUrl);

    return fetch(streamUrl, {
      priority: isDirect ? "high" : "low",
    } as RequestInit)
      .then((response) => {
        if (!response.ok) throw new Error("Prefetch failed");
        return response.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        blobUrlsRef.current.push(blobUrl);
        setPrefetchedVideoUrls((prev) => ({ ...prev, [cacheKey]: blobUrl }));
      })
      .catch(() => {
        inflightRef.current.delete(cacheKey);
      });
  }, []);

  useEffect(() => {
    const uniqueUrls = [
      ...new Set(consentUrls.filter(Boolean) as string[]),
    ].slice(0, MAX_PREFETCH_VIDEOS);

    if (uniqueUrls.length === 0) return;

    let cancelled = false;
    let cursor = 0;

    const runWorker = async () => {
      while (!cancelled && cursor < uniqueUrls.length) {
        const url = uniqueUrls[cursor];
        cursor += 1;
        await prefetchVideo(url);
      }
    };

    const workers = Array.from(
      { length: Math.min(PREFETCH_CONCURRENCY, uniqueUrls.length) },
      () => runWorker()
    );

    void Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [consentUrls, prefetchVideo]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  return { prefetchedVideoUrls, prefetchVideo };
}
