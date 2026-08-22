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
                networkTimeoutSeconds: 15, // 15s timeout → avoids prematurely aborting heavy chunks on local WiFi/hotspots
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
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.output = {
                ...config.output,
                chunkLoadTimeout: 300000, // 5 minutes timeout for async chunks (avoids ChunkLoadError on slow WiFi/hotspot dev)
            };
        }
        return config;
    },
};

module.exports = withPWA(nextConfig);
