"use client";

import React, { useState, useEffect } from "react";

// ⚡ Global in-memory cache to track loaded image URLs during session
const memoryLoadedUrls = new Set<string>();

export function getOptimizedImageUrl(src?: string | null): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("/api/image-proxy")) return src;
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }
  return src;
}

export function preloadFastImage(src?: string | null) {
  if (!src || typeof window === "undefined") return;
  const optimized = getOptimizedImageUrl(src);
  if (memoryLoadedUrls.has(optimized)) return;
  const img = new Image();
  img.src = optimized;
  img.onload = () => memoryLoadedUrls.add(optimized);
}

interface FastAvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  avatarClassName?: string;
  sizeClass?: string;
}

export default function FastAvatar({
  src,
  name = "Student",
  className = "w-full h-full",
  avatarClassName = "",
  sizeClass = "text-3xl sm:text-7xl",
}: FastAvatarProps) {
  const resolvedSrc = getOptimizedImageUrl(src);
  const [isLoaded, setIsLoaded] = useState(() => Boolean(resolvedSrc && memoryLoadedUrls.has(resolvedSrc)));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!resolvedSrc) {
      setIsLoaded(false);
      setHasError(false);
      return;
    }

    if (memoryLoadedUrls.has(resolvedSrc)) {
      setIsLoaded(true);
      setHasError(false);
      return;
    }

    // Reset state for new src
    setIsLoaded(false);
    setHasError(false);

    // Eager preload
    const img = new Image();
    img.src = resolvedSrc;
    img.onload = () => {
      memoryLoadedUrls.add(resolvedSrc);
      setIsLoaded(true);
    };
    img.onerror = () => {
      setHasError(true);
    };
  }, [resolvedSrc]);

  const initial = (name?.trim()?.charAt(0) || "S").toUpperCase();

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-slate-100 ${className}`}>
      {/* Background Initial Placeholder (Always visible while loading or on error) */}
      <div
        className={`absolute inset-0 flex items-center justify-center font-black select-none ${
          !isLoaded && !hasError ? "animate-pulse bg-gradient-to-br from-blue-50 via-slate-100 to-indigo-50" : "bg-slate-100"
        } ${sizeClass}`}
      >
        <span className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 bg-clip-text text-transparent">
          {initial}
        </span>
      </div>

      {/* Subtle Loading Spinner Indicator while image is fetching */}
      {!isLoaded && !hasError && resolvedSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
          <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Real High-Resolution Image */}
      {resolvedSrc && !hasError && (
        <img
          src={resolvedSrc}
          alt={name}
          loading="eager"
          // @ts-ignore
          fetchPriority="high"
          decoding="async"
          onLoad={() => {
            memoryLoadedUrls.add(resolvedSrc);
            setIsLoaded(true);
          }}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ease-out z-10 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${avatarClassName}`}
        />
      )}
    </div>
  );
}
