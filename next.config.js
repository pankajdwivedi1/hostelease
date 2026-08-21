const defaultRuntimeCaching = require("next-pwa/cache");

// ⚡ ULTRA-FAST PWA LAUNCH: StaleWhileRevalidate for instant 0.1s mobile app launch
// Launches immediately from local phone disk storage on app icon tap,
// and silently synchronizes updates in the background.
const customRuntimeCaching = defaultRuntimeCaching.map((entry) => {
    if (entry.options && (entry.options.cacheName === "others" || entry.options.cacheName === "start-url")) {
        return {
            ...entry,
            handler: "StaleWhileRevalidate",
            options: {
                ...entry.options,
            },
        };
    }
    return entry;
});

const withPWA = require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
    publicExcludes: ["!models/**/*"],
    runtimeCaching: customRuntimeCaching,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        ignoreBuildErrors: true,
    },
    experimental: {
        optimizePackageImports: ['firebase', 'firebase-admin', 'mongoose'],
    },
    reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
