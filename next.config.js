const defaultRuntimeCaching = require("next-pwa/cache");

// StaleWhileRevalidate for HTML routes: Instantly serves the cached App Shell
// from local mobile storage in <0.2s (WhatsApp/Facebook style), while silently
// fetching fresh updates in the background.
const customRuntimeCaching = defaultRuntimeCaching.map((entry) => {
    if (entry.options && entry.options.cacheName === "others") {
        return {
            ...entry,
            handler: "StaleWhileRevalidate",
            options: {
                ...entry.options,
                expiration: {
                    maxEntries: 64,
                    maxAgeSeconds: 24 * 60 * 60, // 24 hours
                },
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
    compress: true,
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
    async headers() {
        return [
            {
                // ⚡ Face-API & TensorFlow Model Weights: Cache immutably for 1 year
                source: '/models/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                // ⚡ PWA Icons & Static Images: Cache for 30 days
                source: '/icons/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=2592000, stale-while-revalidate=604800',
                    },
                ],
            },
            {
                // ⚡ Static upload files
                source: '/uploads/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                ],
            },
        ];
    },
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
