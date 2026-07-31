import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || '';

    let tenantSlug = 'default';

    // 0. ⚡ HIGHEST PRIORITY: Env-var override (set NEXT_PUBLIC_TENANT_SLUG in Vercel/Railway)
    //    This guarantees the correct tenant is always resolved in production.
    const envTenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG;
    if (envTenantSlug) {
        tenantSlug = envTenantSlug;
    }
    // 1. Query parameter: ?tenant=slug
    else {
        const url = new URL(request.url);
        const tenantParam = url.searchParams.get('tenant');
        if (tenantParam) {
            tenantSlug = tenantParam;
        }
        // 2. Subdomain-based detection
        else if (hostname.includes('.localhost')) {
            tenantSlug = hostname.split('.localhost')[0];
        } else if (hostname.includes('.hosteleaze.com')) {
            tenantSlug = hostname.split('.hosteleaze.com')[0];
        } else if (hostname.includes('.hosteleaze.vercel.app')) {
            tenantSlug = hostname.split('.hosteleaze.vercel.app')[0];
        } else if (hostname.includes('.vercel.app')) {
            // Handle custom Vercel project subdomains
            const sub = hostname.split('.vercel.app')[0];
            if (sub && !sub.includes('hostelease') && !sub.includes('hosteleaze')) {
                tenantSlug = sub;
            }
        }
        // 3. Cookie-based persistence
        else {
            const tenantCookie = request.cookies.get('tenant-slug')?.value;
            if (tenantCookie) {
                tenantSlug = tenantCookie;
            }
        }
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
    if (tenantSlug !== 'default') {
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
