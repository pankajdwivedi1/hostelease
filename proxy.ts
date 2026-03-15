import { NextResponse, NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const hostname = request.headers.get('host') || '';

    // Define your main domains (where the landing page and signup live)
    const mainDomains = ['hostelease.com', 'localhost:3000', 'localhost', 'hostelease.vercel.app'];

    // Check if the current hostname is one of the main domains
    const isMainDomain = mainDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));

    let subdomain = '';

    if (isMainDomain) {
        // Find which main domain matched
        const matchedDomain = mainDomains.find(domain => hostname === domain || hostname.endsWith('.' + domain));
        
        if (matchedDomain && hostname !== matchedDomain) {
            // Extract everything before the matched domain (e.g., oist.localhost:3000 -> oist)
            // hostname: jaypee-university.com.localhost:3000
            // matchedDomain: localhost:3000
            // subdomain: jaypee-university.com
            subdomain = hostname.slice(0, -(matchedDomain.length + 1));
        }
    } else {
        // If it's a custom domain, we would need a lookup table
        // For now, let's assume it's just the first part
        const hostParts = hostname.split('.');
        subdomain = hostParts[0];
    }

    let tenantSlugToSet = 'default';
    if (subdomain && subdomain !== 'www') {
        tenantSlugToSet = subdomain;
    }

    // 🔥 CORRECT WAY TO PASS HEADERS TO API ROUTES IN NEXT.JS MIDDLEWARE:
    // We must modify the REQUEST headers, not just the RESPONSE headers.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-slug', tenantSlugToSet);

    // Return response with the modified request headers
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // Also set it in response for client-side visibility/debugging if needed
    response.headers.set('x-tenant-slug', tenantSlugToSet);

    // Add logging for tenant resolution
    if (!tenantSlugToSet || tenantSlugToSet === 'default') {
        console.warn(`⚠️ [Tenant Proxy] No specific tenant slug resolved for hostname: "${hostname}". Setting to "default".`);
    } else {
        console.log(`🔍 [Tenant Proxy] Resolved tenant slug: "${tenantSlugToSet}" for hostname: "${hostname}".`);
    }

    return response;
}

// Only run middleware on relevant paths
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
