import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || '';
    
    let tenantSlug = 'default';
    
    // Handle localhost and specific domains
    if (hostname.includes('.localhost')) {
        tenantSlug = hostname.split('.localhost')[0];
    } else if (hostname.includes('.hostelease.com')) {
        tenantSlug = hostname.split('.hostelease.com')[0];
    } else if (hostname.includes('.hostelease.vercel.app')) {
        tenantSlug = hostname.split('.hostelease.vercel.app')[0];
    }

    // ⚡ FALLBACK: Support ?tenant=slug query parameter for Vercel free tier / testing
    const url = new URL(request.url);
    const tenantParam = url.searchParams.get('tenant');
    if (tenantParam) {
        tenantSlug = tenantParam;
    }

    // Clean up
    if (tenantSlug === 'www' || tenantSlug === 'localhost' || tenantSlug.includes(':') || tenantSlug === 'hostelease-silk') {
        tenantSlug = 'default';
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-slug', tenantSlug);
    requestHeaders.set('x-url', request.url);

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // For debugging
    response.headers.set('x-tenant-slug', tenantSlug);
    
    return response;
}

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
