import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || '';
    const url = new URL(request.url);
    const pathname = url.pathname;

    const tenantParam = url.searchParams.get('tenant');
    const tenantCookie = request.cookies.get('tenant-slug')?.value;

    const hostNameOnly = hostname.split(':')[0].toLowerCase();
    const isMainDomain = 
        hostNameOnly === 'localhost' || 
        hostNameOnly === '127.0.0.1' || 
        hostNameOnly === 'hosteleaze.com' || 
        hostNameOnly === 'www.hosteleaze.com' || 
        hostNameOnly === 'hosteleaze.vercel.app' || 
        hostNameOnly === 'hosteleaze-silk.vercel.app' || 
        hostNameOnly === 'hostelease-silk.vercel.app';

    // ⚡ LANDING PAGE PRESERVATION:
    // When visiting root '/' on main domain without explicit ?tenant= parameter or existing cookie,
    // do NOT set default tenant cookie so landing page loads for new visitors.
    if (isMainDomain && pathname === '/' && !tenantParam && !tenantCookie) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-url', request.url);
        return NextResponse.next({
            request: { headers: requestHeaders },
        });
    }

    let tenantSlug = 'default';

    // 1. Query parameter: ?tenant=slug
    if (tenantParam) {
        tenantSlug = tenantParam;
    }
    // 2. Subdomain-based detection
    else if (hostname.includes('.localhost')) {
        tenantSlug = hostname.split('.localhost')[0];
    } else if (hostname.includes('.hosteleaze.com')) {
        const sub = hostname.split('.hosteleaze.com')[0];
        if (sub !== 'www') tenantSlug = sub;
    } else if (hostname.includes('.hosteleaze.vercel.app')) {
        const sub = hostname.split('.hosteleaze.vercel.app')[0];
        if (sub !== 'www') tenantSlug = sub;
    } else if (hostname.includes('.vercel.app')) {
        const sub = hostname.split('.vercel.app')[0];
        if (sub && !sub.includes('hostelease') && !sub.includes('hosteleaze')) {
            tenantSlug = sub;
        }
    }
    // 3. Cookie-based persistence
    else if (tenantCookie) {
        tenantSlug = tenantCookie;
    }
    // 4. Environment variable or default fallback for tenant routes
    else {
        tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'ogi';
    }

    // Sanitize invalid slugs and map root/www domain to default tenant
    if (
        tenantSlug === 'www' ||
        tenantSlug === 'localhost' ||
        tenantSlug === 'default' ||
        tenantSlug.includes(':') ||
        tenantSlug === 'hosteleaze-silk' ||
        tenantSlug === 'hostelease-silk'
    ) {
        tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'ogi';
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-slug', tenantSlug);
    requestHeaders.set('x-url', request.url);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });

    // Persist valid slugs in a cookie (30-day expiry)
    if (tenantSlug && tenantSlug !== 'default') {
        response.cookies.set('tenant-slug', tenantSlug, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        });
    }

    response.headers.set('x-tenant-slug', tenantSlug);
    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
