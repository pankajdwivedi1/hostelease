"use client";

import React, { useEffect, useRef, useState } from "react";

interface ParentConsentVideoModalProps {
  url: string | null;
  onClose: () => void;
}

const MOBILE_FRAME: React.CSSProperties = {
  width: "100%",
  height: "min(38vh, 260px)",
};

const DESKTOP_FRAME: React.CSSProperties = {
  aspectRatio: "9 / 16",
  width: "100%",
  maxHeight: "min(50vh, 380px)",
};

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 639px)").matches;
}

function getDefaultFrameStyle(): React.CSSProperties {
  return isMobileViewport() ? MOBILE_FRAME : DESKTOP_FRAME;
}

function getVideoFrameStyle(
  videoWidth: number,
  videoHeight: number,
  isMobile: boolean
): React.CSSProperties {
  if (isMobile) {
    return MOBILE_FRAME;
  }

  const ar = videoWidth / videoHeight;
  if (ar < 1) {
    return {
      aspectRatio: `${videoWidth} / ${videoHeight}`,
      width: "100%",
      maxHeight: "min(50vh, 380px)",
    };
  }

  return {
    aspectRatio: `${videoWidth} / ${videoHeight}`,
    width: "100%",
    maxHeight: "min(50vh, 380px)",
  };
}

export default function ParentConsentVideoModal({
  url,
  onClose,
}: ParentConsentVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [frameStyle, setFrameStyle] = useState<React.CSSProperties>(getDefaultFrameStyle);

  useEffect(() => {
    if (!url) return;

    const video = videoRef.current;
    if (!video) return;

    setFrameStyle(getDefaultFrameStyle());
    setIsLoading(true);
    setLoadError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setVideoDuration(0);
    setPlaybackSpeed(1);
    setIsMuted(false);

    const handleCanPlay = () => {
      setIsLoading(false);
      video.muted = false;
      video.volume = 1;
    };

    const handleError = () => {
      setIsLoading(false);
      setLoadError("Failed to load consent video. Please try again.");
    };

    video.addEventListener("canplay", handleCanPlay, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.load();

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.pause();
    };
  }, [url]);

  if (!url) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full border border-gray-100 dark:border-gray-700 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-gray-700 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all z-10 cursor-pointer shadow-sm hover:scale-105 border-0"
        >
          ✕
        </button>
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🎥 Parent Consent Video
          </h3>
        </div>
        <div className="py-3 px-3 sm:py-6 sm:px-4 flex justify-center bg-gray-50 dark:bg-gray-900">
          <div className="w-full flex flex-col items-center">
            <div
              className="relative overflow-hidden rounded-xl bg-black border border-gray-200 dark:border-gray-800 shadow-inner"
              style={frameStyle}
            >
              <video
                ref={videoRef}
                src={url}
                playsInline
                preload="auto"
                muted={isMuted}
                onTimeUpdate={(e) => {
                  const video = e.target as HTMLVideoElement;
                  setCurrentTime(video.currentTime);
                  if (
                    isFinite(video.duration) &&
                    video.duration > 0 &&
                    video.duration !== videoDuration
                  ) {
                    setVideoDuration(video.duration);
                  }
                }}
                onLoadedMetadata={(e) => {
                  const video = e.target as HTMLVideoElement;
                  if (video.videoWidth && video.videoHeight) {
                    setFrameStyle(
                      getVideoFrameStyle(
                        video.videoWidth,
                        video.videoHeight,
                        isMobileViewport()
                      )
                    );
                  }
                  if (video.duration === Infinity) {
                    setVideoDuration(24);
                  } else if (isFinite(video.duration)) {
                    setVideoDuration(video.duration);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsLoading(true)}
                onPlaying={() => setIsLoading(false)}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {isLoading && !loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl">
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wider">
                    Loading video...
                  </p>
                </div>
              )}

              {loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl px-4 text-center">
                  <p className="text-sm font-bold text-white mb-2">{loadError}</p>
                  <button
                    onClick={() => {
                      setLoadError(null);
                      setIsLoading(true);
                      videoRef.current?.load();
                    }}
                    className="text-xs font-black uppercase tracking-wider bg-white text-gray-900 px-4 py-2 rounded-lg cursor-pointer border-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {isMuted && isPlaying && !loadError && (
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.muted = false;
                      videoRef.current.volume = 1;
                      setIsMuted(false);
                    }
                  }}
                  className="absolute top-4 left-4 bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full cursor-pointer border-0 shadow-lg animate-pulse"
                >
                  🔊 Tap to unmute
                </button>
              )}

              <a
                href={url}
                download="parent-consent-video.webm"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-2.5 rounded-full transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 border border-slate-700/50 flex items-center justify-center backdrop-blur-sm z-20"
                title="Download Consent Video"
              >
                <svg
                  className="w-4.5 h-4.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </a>
            </div>

            <div className="w-full flex flex-col bg-slate-900 text-white p-2.5 sm:p-3 rounded-xl border border-slate-800 shadow-xl mt-2 sm:mt-3 select-none font-mono">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-slate-400 font-bold w-10 text-right">
                  {isFinite(currentTime) && !isNaN(currentTime)
                    ? `${Math.floor(currentTime / 60)
                        .toString()
                        .padStart(2, "0")}:${Math.floor(currentTime % 60)
                        .toString()
                        .padStart(2, "0")}`
                    : "00:00"}
                </span>
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCurrentTime(val);
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="flex-1 h-1 rounded-lg appearance-none cursor-pointer focus:outline-none accent-orange-500"
                  style={{
                    background: `linear-gradient(to right, #f97316 0%, #f97316 ${(currentTime / (videoDuration || 1)) * 100}%, #475569 ${(currentTime / (videoDuration || 1)) * 100}%, #475569 100%)`,
                  }}
                />
                <span className="text-[10px] text-slate-400 font-bold w-10 text-left">
                  {isFinite(videoDuration) && !isNaN(videoDuration)
                    ? `${Math.floor(videoDuration / 60)
                        .toString()
                        .padStart(2, "0")}:${Math.floor(videoDuration % 60)
                        .toString()
                        .padStart(2, "0")}`
                    : "00:00"}
                </span>
              </div>

              <div className="flex items-center justify-between px-1">
                <button
                  onClick={() => {
                    const speeds = [1, 1.25, 1.5, 2];
                    const nextSpeed =
                      speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                    setPlaybackSpeed(nextSpeed);
                    if (videoRef.current)
                      videoRef.current.playbackRate = nextSpeed;
                  }}
                  className="text-xs font-black text-slate-400 hover:text-white transition-colors bg-transparent border-0 py-1 px-1.5 cursor-pointer flex items-center"
                >
                  {playbackSpeed}x
                </button>

                <button
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current
                          .play()
                          .catch(() =>
                            setLoadError("Unable to play video. Please try again.")
                          );
                      }
                    }
                  }}
                  className="w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md border-0"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (videoRef.current) {
                      const nextMuted = !isMuted;
                      videoRef.current.muted = nextMuted;
                      if (!nextMuted) videoRef.current.volume = 1;
                      setIsMuted(nextMuted);
                    }
                  }}
                  className="text-slate-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer flex items-center p-1"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-850 flex justify-end gap-3 border-t border-gray-150 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
