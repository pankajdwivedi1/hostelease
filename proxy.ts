import { NextResponse, NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const hostname = request.headers.get('host') || '';
    
    let tenantSlug = 'default';
    
    // 1. Priority: ?tenant=slug query parameter
    const url = new URL(request.url);
    const tenantParam = url.searchParams.get('tenant');
    if (tenantParam) {
        tenantSlug = tenantParam;
    } 
    // 2. Secondary: Hostname-based detection
    else if (hostname.includes('.localhost')) {
        tenantSlug = hostname.split('.localhost')[0];
    } else if (hostname.includes('.hosteleaze.com')) {
        tenantSlug = hostname.split('.hosteleaze.com')[0];
    } else if (hostname.includes('.hosteleaze.vercel.app')) {
        tenantSlug = hostname.split('.hosteleaze.vercel.app')[0];
    }
    // 3. Tertiary: Cookie-based persistence
    else {
        const tenantCookie = request.cookies.get('tenant-slug')?.value;
        if (tenantCookie) {
            tenantSlug = tenantCookie;
        }
    }

    // Clean up
    if (tenantSlug === 'www' || tenantSlug === 'localhost' || tenantSlug.includes(':') || tenantSlug === 'hosteleaze-silk' || tenantSlug === 'hostelease-silk') {
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

    // Set cookie for persistence if a valid tenant was found
    if (tenantSlug !== 'default') {
        response.cookies.set('tenant-slug', tenantSlug, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            sameSite: 'lax',
        });
    }

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
