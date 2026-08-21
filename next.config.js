const defaultRuntimeCaching = require("next-pwa/cache");

// NetworkFirst for HTML routes: always fetch fresh code from server when online.
// Falls back to cache automatically when offline. Ensures students get new UI
// immediately on next app open after a Railway deploy.
const customRuntimeCaching = defaultRuntimeCaching.map((entry) => {
    if (entry.options && entry.options.cacheName === "others") {
        return {
            ...entry,
            handler: "NetworkFirst",
            options: {
                ...entry.options,
                networkTimeoutSeconds: 3, // 3s timeout → fall back to cache if server slow/offline
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
