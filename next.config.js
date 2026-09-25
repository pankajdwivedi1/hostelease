const defaultRuntimeCaching = require("next-pwa/cache");

// 1. Runtime Caching Configuration
// Ensures that static models and uploaded images are cached ON-DEMAND when accessed,
// rather than pre-downloading all 500+ student images during initial app launch.
const customRuntimeCaching = [
    {
        // ⚡ On-demand caching for Cloudflare R2 student profile photos
        urlPattern: /^https:\/\/.*\.r2\.dev\/.*/i,
        handler: "CacheFirst",
        options: {
            cacheName: "r2-profile-photos-cache",
            expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
            },
        },
    },
    {
        // ⚡ On-demand caching for student photos and uploaded documents
        urlPattern: /\/(?:api\/)?uploads\/.+/i,
        handler: "CacheFirst",
        options: {
            cacheName: "user-uploads-cache",
            expiration: {
                maxEntries: 150,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
            },
        },
    },
    {
        // ⚡ On-demand caching for Face-API & TensorFlow model shards
        urlPattern: /\/models\/.+/i,
        handler: "CacheFirst",
        options: {
            cacheName: "face-models-cache",
            expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Year
            },
        },
    },
    // StaleWhileRevalidate for HTML routes: Instantly serves the cached App Shell
    // from local mobile storage in <0.2s (WhatsApp/Facebook style), while silently
    // fetching fresh updates in the background.
    ...defaultRuntimeCaching.map((entry) => {
        if (entry.options && entry.options.cacheName === "others") {
            const { networkTimeoutSeconds, ...restOptions } = entry.options;
            return {
                ...entry,
                handler: "StaleWhileRevalidate",
                options: {
                    ...restOptions,
                    expiration: {
                        maxEntries: 64,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            };
        }
        return entry;
    }),
];

const withPWA = require("next-pwa")({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
    // 🛡️ CRITICAL: NEVER precache user uploads or heavy AI models in Service Worker
    publicExcludes: [
        "!models/**/*",
        "!uploads/**/*",
        "!**/*.map",
        "!**/*.bin",
        "!**/*shard*",
    ],
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
        optimizePackageImports: ['firebase', 'firebase-admin', 'mongoose', 'lucide-react', '@radix-ui/react-slider'],
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
