const defaultRuntimeCaching = require("next-pwa/cache");

// Customize runtimeCaching to serve HTML routes instantly from cache (StaleWhileRevalidate)
const customRuntimeCaching = defaultRuntimeCaching.map((entry) => {
    if (entry.options && entry.options.cacheName === "others") {
        const { networkTimeoutSeconds, ...restOptions } = entry.options;
        return {
            ...entry,
            handler: "StaleWhileRevalidate",
            options: restOptions,
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
