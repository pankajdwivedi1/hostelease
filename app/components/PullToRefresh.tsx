"use client";

import React, { useState, useRef, useCallback } from "react";

export interface PullToRefreshOptions {
  onRefresh: () => Promise<any> | void;
  pullThreshold?: number; // Distance in px to trigger refresh (default: 50)
  maxPullDistance?: number; // Maximum pull distance (default: 85)
  resistance?: number; // Resistance factor (default: 0.45)
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  pullThreshold = 50,
  maxPullDistance = 85,
  resistance = 0.45,
  disabled = false,
}: PullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      if (typeof window !== "undefined" && window.scrollY <= 5 && !isRefreshing) {
        touchStartYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPullingRef.current || isRefreshing || disabled) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartYRef.current;

      if (diff > 0 && typeof window !== "undefined" && window.scrollY <= 5) {
        const distance = Math.min(diff * resistance, maxPullDistance);
        setPullDistance(distance);
      } else {
        setPullDistance(0);
      }
    },
    [isRefreshing, disabled, resistance, maxPullDistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled) return;
    isPullingRef.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      setPullDistance(0);
      setIsRefreshing(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {}
      }
      try {
        await onRefresh();
      } catch (err) {
        console.error("Manual pull-to-refresh error:", err);
      } finally {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, pullThreshold, isRefreshing, disabled, onRefresh]);

  const PullIndicator = useCallback(
    ({ className = "" }: { className?: string }) => (
      <div
        className={`fixed top-3 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-300 flex items-center justify-center ${className}`}
        style={{
          opacity: isRefreshing ? 1 : Math.min(pullDistance / 45, 1),
          transform: `translateX(-50%) translateY(${
            isRefreshing ? 14 : Math.max(0, pullDistance - 15)
          }px) scale(${isRefreshing ? 1 : Math.min(pullDistance / 45, 1)})`,
        }}
      >
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg border border-gray-200/90 flex items-center gap-2 text-xs font-bold text-gray-700">
          <svg
            className={`w-3.5 h-3.5 text-blue-600 ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: !isRefreshing
                ? `rotate(${pullDistance * 4}deg)`
                : undefined,
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="text-[10px] font-extrabold tracking-tight uppercase text-gray-700">
            {isRefreshing
              ? "Updating from server..."
              : pullDistance >= pullThreshold
              ? "Release to refresh"
              : "Pull down to refresh"}
          </span>
        </div>
      </div>
    ),
    [isRefreshing, pullDistance, pullThreshold]
  );

  return {
    isRefreshing,
    pullDistance,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    PullIndicator,
  };
}

export default function PullToRefresh({
  onRefresh,
  children,
  className = "",
  disabled = false,
}: {
  onRefresh: () => Promise<any> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { touchHandlers, PullIndicator } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  return (
    <div className={`relative ${className}`} {...touchHandlers}>
      <PullIndicator />
      {children}
    </div>
  );
}
