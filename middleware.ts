import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || '';
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ⚡ BOT & SCRAPER BLOCKING:
    // Drop aggressive commercial crawlers that waste bandwidth (exempting webhooks and legitimate traffic)
    const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
    if (!pathname.startsWith('/api/webhooks')) {
        const isCommercialBot = 
            userAgent.includes('ahrefsbot') ||
            userAgent.includes('semrushbot') ||
            userAgent.includes('dotbot') ||
            userAgent.includes('petalbot') ||
            userAgent.includes('mj12bot') ||
            userAgent.includes('bytespider') ||
            userAgent.includes('zoominfobot') ||
            userAgent.includes('megaindex') ||
            userAgent.includes('blexbot') ||
            userAgent.includes('seekport');
            
        if (isCommercialBot) {
            return new NextResponse('Access denied', { status: 403 });
        }
    }

    const tenantParam = url.searchParams.get('tenant');
    const tenantCookie = request.cookies.get('tenant-slug')?.value;

    const hostNameOnly = hostname.split(':')[0].toLowerCase();
    const isMainDomain = 
        hostNameOnly === 'localhost' || 
        hostNameOnly === '127.0.0.1' || 
        hostNameOnly === 'hosteleaze.com' || 
        hostNameOnly === 'www.hosteleaze.com' || 
        hostNameOnly.endsWith('.railway.app');

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
    } else if (hostname.includes('.railway.app')) {
        const sub = hostname.split('.railway.app')[0];
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
        tenantSlug.includes(':')
    ) {
        tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'ogi';
    }

    // ⚡ 5. GLOBAL EXPIRY INTERCEPTOR:
    // If the tenant subscription is flagged as expired, immediately block operational APIs for regular users
    const isExemptRoute =
        pathname.startsWith('/superadmin') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/api/developer/auth') ||
        pathname.startsWith('/api/super-admin') ||
        pathname.startsWith('/api/superadmin') ||
        pathname.startsWith('/api/admin/active-db') ||
        pathname.startsWith('/api/admin/subscription-status') ||
        pathname.startsWith('/api/admin/create-razorpay-order') ||
        pathname.startsWith('/api/admin/verify-razorpay-payment') ||
        pathname.startsWith('/api/admin/submit-direct-payment') ||
        pathname.startsWith('/api/admin/upload-payment-proof') ||
        pathname.startsWith('/api/admin/billing-history') ||
        pathname.startsWith('/api/admin/auth') ||
        pathname.startsWith('/api/bootstrap') ||
        pathname.startsWith('/api/tenant/config');

    const isExpiredCookie = request.cookies.get('tenant-expired')?.value === 'true';
    const isSuperAdmin = request.cookies.get('userType')?.value === 'superadmin';

    if (isExpiredCookie && !isSuperAdmin && !isExemptRoute && pathname.startsWith('/api/')) {
        return NextResponse.json(
            {
                error: "College subscription has ended. Please contact your college administration to renew.",
                isExpired: true,
                blockedByMiddleware: true
            },
            { status: 403 }
        );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-slug', tenantSlug);
    requestHeaders.set('x-url', request.url);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });

    // Persist valid slugs in a cookie only if not already set (prevents redundant Set-Cookie headers that break CDN caching)
    if (tenantSlug && tenantSlug !== 'default' && tenantCookie !== tenantSlug) {
        response.cookies.set('tenant-slug', tenantSlug, {
            path: '/',
            maxAge: 60 * 60 * 24 * 180, // 6 months
            sameSite: 'lax',
        });
    }

    response.headers.set('x-tenant-slug', tenantSlug);
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - models/ (Face-API & TensorFlow AI model shards)
         * - icons/ (PWA icons)
         * - uploads/ (Static uploaded files)
         * - Static file extensions: .svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .woff, .woff2, .json, .txt, .xml
         */
        '/((?!_next/static|_next/image|favicon.ico|models/|icons/|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|txt|xml)$).*)',
    ],
};
