// Quick Performance Test Script
// Run this in browser console to measure login performance

console.log('%c🚀 Login Performance Test', 'font-size: 20px; font-weight: bold; color: #4285F4');

// Store original fetch
const originalFetch = window.fetch;
const apiCalls = [];

// Monitor all API calls
window.fetch = function (...args) {
    const url = args[0];
    const startTime = performance.now();

    return originalFetch.apply(this, args).then(response => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        if (url.includes('/api/')) {
            apiCalls.push({
                url: url,
                duration: duration,
                timestamp: new Date().toISOString(),
                payload: response.headers.get('content-length') || 'unknown'
            });

            const isMinimal = url.includes('minimal=true');
            const emoji = isMinimal ? '⚡' : '📦';
            const color = isMinimal ? '#10b981' : '#6366f1';

            console.log(
                `%c${emoji} API Call: ${duration}ms`,
                `color: ${color}; font-weight: bold`,
                url.split('?')[0],
                isMinimal ? '(MINIMAL - FAST)' : '(FULL DATA)'
            );
        }

        return response;
    });
};

// Track page navigation
let loginStartTime;
let dashboardShowTime;

// Detect login
const originalPush = window.history.pushState;
window.history.pushState = function (...args) {
    const url = args[2];

    if (url === '/') {
        dashboardShowTime = performance.now();
        const totalTime = Math.round(dashboardShowTime - loginStartTime);

        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #8b5cf6');
        console.log('%c🏁 DASHBOARD LOADED!', 'font-size: 16px; font-weight: bold; color: #10b981');
        console.log(`%c⏱️  Total Time: ${totalTime}ms`, 'font-size: 14px; font-weight: bold; color: #f59e0b');
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #8b5cf6');

        if (totalTime < 1000) {
            console.log('%c✅ EXCELLENT! Under 1 second!', 'color: #10b981; font-weight: bold');
        } else if (totalTime < 2000) {
            console.log('%c👍 GOOD! Under 2 seconds', 'color: #3b82f6; font-weight: bold');
        } else {
            console.log('%c⚠️  Could be faster', 'color: #f59e0b; font-weight: bold');
        }

        // Show API call summary
        console.log('\n%c📊 API Call Summary:', 'font-weight: bold; font-size: 14px');
        apiCalls.forEach((call, index) => {
            const isMinimal = call.url.includes('minimal=true');
            const emoji = isMinimal ? '⚡' : '📦';
            console.log(`${emoji} Call ${index + 1}: ${call.duration}ms - ${call.url.split('?')[0]}`);
        });
    }

    return originalPush.apply(this, args);
};

// Instructions
console.log('\n%c📋 Instructions:', 'font-weight: bold; font-size: 14px; color: #6366f1');
console.log('%c1. Click "Continue as Student"', 'color: #64748b');
console.log('%c2. Complete Google login', 'color: #64748b');
console.log('%c3. Watch the performance metrics appear!', 'color: #64748b');
console.log('\n%c⏰ Test starting... Click login now!', 'font-weight: bold; color: #10b981');

loginStartTime = performance.now();
