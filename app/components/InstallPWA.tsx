'use client';

import React, { useState, useEffect } from 'react';
import { Share, Download, X, Smartphone, ArrowBigUp, ExternalLink, Globe } from 'lucide-react';

export default function InstallPWA() {
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);
    const [isOEMOrFirefox, setIsOEMOrFirefox] = useState(false);
    const [browserName, setBrowserName] = useState('Browser');
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Check if already installed in standalone PWA mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone
            || document.referrer.includes('android-app://');

        if (isStandalone) return;

        // Check if user dismissed it in this session
        if (sessionStorage.getItem('pwa_banner_dismissed') === 'true') return;

        const ua = navigator.userAgent || '';

        // 2. Detect In-App Browsers (WhatsApp, Instagram, Facebook, Messenger, Telegram, WeChat, Line)
        const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line|MicroMessenger|Telegram|Twitter|Snapchat/i.test(ua);
        setIsInAppBrowser(inApp);

        // 3. Detect iOS (iPhone / iPad)
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        setIsIOS(isIOSDevice);

        // 4. Detect Specific Browsers for tailored guide
        if (/Firefox/i.test(ua)) {
            setIsOEMOrFirefox(true);
            setBrowserName('Firefox');
        } else if (/SamsungBrowser/i.test(ua)) {
            setBrowserName('Samsung Internet');
        } else if (/MiuiBrowser|XiaoMi/i.test(ua)) {
            setIsOEMOrFirefox(true);
            setBrowserName('Mi Browser');
        } else if (/VivoBrowser/i.test(ua)) {
            setIsOEMOrFirefox(true);
            setBrowserName('Vivo Browser');
        } else if (/OppoBrowser|HeyTapBrowser/i.test(ua)) {
            setIsOEMOrFirefox(true);
            setBrowserName('Oppo Browser');
        }

        // 5. Capture native Android Chrome/Edge/Samsung install prompt
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setTimeout(() => setShowBanner(true), 2500);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // 6. For iOS, In-App, or other browsers where event doesn't fire, show smart banner after 3.5s
        const timer = setTimeout(() => {
            setShowBanner(true);
        }, 3500);

        // 7. Listen for custom trigger from menus (e.g. "Install App" button in settings)
        const openHandler = () => setShowBanner(true);
        window.addEventListener('open-pwa-install', openHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('open-pwa-install', openHandler);
            clearTimeout(timer);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowBanner(false);
            }
            setDeferredPrompt(null);
        } else if (isInAppBrowser) {
            // Android Intent escape to native Google Chrome
            const currentUrl = window.location.href.replace(/^https?:\/\//, '');
            window.location.href = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`;
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        try {
            sessionStorage.setItem('pwa_banner_dismissed', 'true');
        } catch (e) {}
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-4 left-3 right-3 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md z-[99999] animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 text-white rounded-2xl shadow-2xl p-4 overflow-hidden">
                {/* Progress bar */}
                <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 w-full animate-progress" />

                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
                        <Smartphone className="text-white w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                                Install HostelEaze App
                            </h3>
                            <button
                                onClick={handleDismiss}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">
                            {isInAppBrowser
                                ? "You are in an in-app preview. Open in Chrome or Safari for face scan & instant launch."
                                : isIOS
                                ? "Add to your iPhone Home Screen for instant <0.2s launch."
                                : isOEMOrFirefox
                                ? `Add to home screen from your ${browserName} menu.`
                                : "Install on your phone for instant launch, offline support & live attendance."}
                        </p>
                    </div>
                </div>

                <div className="mt-3">
                    {/* 1. IN-APP BROWSER (WhatsApp / Instagram) */}
                    {isInAppBrowser ? (
                        <div className="space-y-2">
                            <button
                                onClick={handleInstallClick}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open in Google Chrome</span>
                            </button>
                            <p className="text-[10px] text-slate-400 text-center">
                                Or tap <span className="text-white font-bold">⋮ (3 dots)</span> at top-right & choose <span className="text-white font-bold">&quot;Open in browser&quot;</span>
                            </p>
                        </div>
                    ) : isIOS ? (
                        /* 2. APPLE IPHONE / SAFARI GUIDE */
                        <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="bg-blue-600/30 p-1.5 rounded-lg border border-blue-500/30">
                                    <Share className="w-4 h-4 text-blue-400" />
                                </div>
                                <span className="text-[11px] font-semibold text-slate-200">
                                    Tap <span className="text-blue-400 font-bold underline">Share</span> then <span className="text-blue-400 font-bold underline">&quot;Add to Home Screen&quot;</span> [+]
                                </span>
                            </div>
                            <ArrowBigUp className="w-4 h-4 text-blue-400 animate-bounce shrink-0" />
                        </div>
                    ) : deferredPrompt ? (
                        /* 3. NATIVE 1-TAP INSTALL (Chrome, Edge, Samsung) */
                        <button
                            onClick={handleInstallClick}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Install Now (Instant Access)</span>
                        </button>
                    ) : (
                        /* 4. OEM BROWSERS / FIREFOX GUIDE */
                        <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/60 text-[11px] text-slate-300 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span>
                                    Tap <span className="text-indigo-400 font-bold">⋮ menu</span> &rarr; select <span className="text-indigo-400 font-bold">&quot;Add to Home screen&quot;</span> or <span className="text-indigo-400 font-bold">&quot;Install App&quot;</span>
                                </span>
                            </div>
                        </div>
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

