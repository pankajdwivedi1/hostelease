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
