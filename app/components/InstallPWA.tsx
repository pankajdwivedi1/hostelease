'use client';

import React, { useState, useEffect } from 'react';
import { Share, Download, X, Smartphone, ArrowBigUp } from 'lucide-react';

export default function InstallPWA() {
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // 1. Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone
            || document.referrer.includes('android-app://');

        if (isStandalone) return;

        // 2. Detect iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIOSDevice);

        // 3. Listen for Android/Chrome install prompt
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Show banner after a slight delay
            setTimeout(() => setShowBanner(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // 4. For iOS, show banner if not standalone
        if (isIOSDevice) {
            setTimeout(() => setShowBanner(true), 4000);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowBanner(false);
        }
        setDeferredPrompt(null);
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-6 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-4 overflow-hidden">
                {/* Progress Bar (Visual Polish) */}
                <div className="absolute top-0 left-0 h-1 bg-blue-600 w-full animate-progress" />

                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex-shrink-0 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Smartphone className="text-white w-6 h-6" />
                    </div>

                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            Install HostelEase
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                            {isIOS
                                ? "Add to home screen for a full-screen experience and better performance."
                                : "Install our app for instant access and a smoother experience."}
                        </p>
                    </div>

                    <button
                        onClick={() => setShowBanner(false)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                    {isIOS ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-center justify-between border border-blue-100 dark:border-blue-800/50">
                            <div className="flex items-center gap-3">
                                <div className="bg-white dark:bg-zinc-800 p-1.5 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
                                    <Share className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                                    Tap <span className="font-bold underline italic mx-0.5">Share</span> then <span className="font-bold underline italic mx-0.5">Add to Home Screen</span>
                                </span>
                            </div>
                            <ArrowBigUp className="w-5 h-5 text-blue-600 animate-bounce" />
                        </div>
                    ) : (
                        <button
                            onClick={handleInstallClick}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            <Download className="w-4 h-4" />
                            Install Now
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress {
          animation: progress 4s linear;
        }
      `}</style>
        </div>
    );
}
