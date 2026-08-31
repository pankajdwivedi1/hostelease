import { headers } from 'next/headers';
import { cache } from 'react';
import { prisma } from './prisma';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const supabase = getSupabaseAdmin();

/**
 * Resolves the current tenant from the request headers
 * injected by the global Next.js middleware.
 */
// ⚡ IN-MEMORY CACHE for resolved tenants (Reduces DB load and speeds up every request)
const tenantCache = new Map<string, { tenant: any, expires: number }>();
const TENANT_CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Resolves the current tenant from the request headers
 * injected by the global Next.js middleware.
 */
export const getTenantFromRequest = cache(async () => {
    if (process.env.MOCK_TENANT_ID) {
        return {
            _id: process.env.MOCK_TENANT_ID,
            name: 'Mock Tenant',
            slug: 'mock',
            isActive: true,
        };
    }
    let slug: string | null = null;
    try {
        const headersList = await (headers as any)();
        slug = headersList.get('x-tenant-slug');

        // 1. ⚡ FIRST FALLBACK: Check if a query parameter was passed in the URL (via x-url header)
        if (!slug || slug === 'default') {
            const fullUrl = headersList.get('x-url');
            if (fullUrl) {
                const url = new URL(fullUrl);
                const urlTenant = url.searchParams.get('tenant');
                if (urlTenant) {
                    slug = urlTenant;
                }
            }
        }

        // 2. ⚡ SECOND FALLBACK: Resolve from cookies if still missing (useful for free Vercel tier)
        if (!slug || slug === 'default') {
            const cookiesList = headersList.get('cookie') || '';
            const match = cookiesList.match(/tenant-slug=([^;]+)/);
            if (match) {
                slug = match[1];
            }
        }

        // 3. ⚡ THIRD FALLBACK: Resolve from Host header if still missing
        if (!slug || slug === 'default') {
            const host = headersList.get('host') || '';
            if (host.includes('.localhost')) {
                slug = host.split('.localhost')[0];
            } else if (host.includes('.hosteleaze.vercel.app')) {
                slug = host.split('.hosteleaze.vercel.app')[0];
            } else if (host.includes('.vercel.app')) {
                slug = host.split('.vercel.app')[0];
            }
        }
    } catch (hErr) {
        // Headers not available in direct context
    }

    // 🛠️ FALLBACK: If resolving via main domain/localhost (no specific subdomain),
    // default to NEXT_PUBLIC_TENANT_SLUG or the main active tenant ("ogi") so production works seamlessly.
    if (!slug || slug === 'default' || slug === 'www' || slug.includes(':')) {
        const envSlug = process.env.NEXT_PUBLIC_TENANT_SLUG;
        if (envSlug) {
            slug = envSlug;
        } else {
            try {
                const firstTenant = await prisma.tenant.findFirst({
                    where: { isActive: true, isDeleted: false },
                    select: { slug: true }
                });
                if (firstTenant) {
                    slug = firstTenant.slug;
                    console.log(`🛠️ [Tenant] Fallback: No subdomain found, defaulting to "${slug}"`);
                }
            } catch (e) {
                slug = 'ogi';
            }
            if (!slug) slug = 'ogi';
        }
    }

    let normalizedSlug = (slug || 'ogi').toLowerCase();
    // ⚡ OIST / OGI ALIAS SUPPORT: Map 'oist' slug to 'ogi' which is the database slug for OGI tenant.
    if (normalizedSlug === 'oist') {
        normalizedSlug = 'ogi';
    }

    // ⚡ Check local memory cache first
    const cached = tenantCache.get(normalizedSlug);
    if (cached && cached.expires > Date.now()) {
        return cached.tenant;
    }

    let tenant: any = null;
    try {
        tenant = await prisma.tenant.findFirst({
            where: { slug: normalizedSlug, isActive: true, isDeleted: false }
        });
    } catch (prismaErr: any) {
        console.warn(`⚠️ [Tenant] Prisma lookup failed for "${normalizedSlug}", checking Supabase fallback...`);
    }

    if (!tenant) {
        try {
            const supabaseAdmin = getSupabaseAdmin();
            const { data: sTenant } = await supabaseAdmin
                .from('tenants')
                .select('*')
                .eq('slug', normalizedSlug)
                .maybeSingle();
            if (sTenant) {
                tenant = {
                    id: sTenant.id,
                    name: sTenant.name,
                    slug: sTenant.slug,
                    logoUrl: sTenant.logo_url,
                    primaryColor: sTenant.primary_color,
                    secondaryColor: sTenant.secondary_color,
                    subscriptionStatus: sTenant.subscription_status,
                    subscriptionEndDate: sTenant.subscription_end_date,
                    isActive: sTenant.is_active,
                    adminEmail: sTenant.admin_email,
                    createdAt: sTenant.created_at
                };
            }
        } catch (sErr) {
            console.error("❌ [Tenant] Supabase fallback error:", sErr);
        }
    }

    // Default fallback for OGI / OIST tenant if database server is unreachable
    if (!tenant && (normalizedSlug === 'ogi' || normalizedSlug === 'oist')) {
        tenant = {
            id: "26739d24-0214-409b-aa81-42e628e88c2b",
            name: "ORIENTAL GROUP OF INSTITUTES",
            slug: "ogi",
            subscriptionStatus: "active",
            subscriptionEndDate: "2026-09-01T00:00:00.000Z",
            isActive: true
        };
    }

    if (!tenant) {
        return null;
    }

    // Map tenant to camelCase structure expected by app
    const resolvedTenant = {
        _id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logoUrl || tenant.logo,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        subscriptionStatus: tenant.subscriptionStatus,
        subscriptionEndDate: tenant.subscriptionEndDate,
        isActive: tenant.isActive,
        adminEmail: tenant.adminEmail,
        createdAt: tenant.createdAt,
        defaultCountryCode: (tenant as any).defaultCountryCode || (tenant as any).default_country_code || "+91",
    };

    // Store in cache
    tenantCache.set(normalizedSlug, {
        tenant: resolvedTenant,
        expires: Date.now() + TENANT_CACHE_TTL
    });

    return resolvedTenant;
});

/**
 * Gets the tenantId string from the current request context.
 * Useful for filtering database queries.
 */
export async function getCurrentTenantId() {
    const tenant = await getTenantFromRequest();
    return tenant ? tenant._id.toString() : null;
}

/**
 * Returns tenant-specific UI configurations like branding colors and name.
 */
export async function getTenantConfig() {
    const tenant = await getTenantFromRequest();
    if (!tenant) return null;

    let defaultCountryCode = "+91";
    try {
        const { prisma } = await import("@/lib/prisma");
        const settings = await prisma.adminSettings.findFirst({
            where: { tenantId: tenant._id },
            select: { university_bank_details: true }
        });

        if (settings?.university_bank_details?.defaultCountryCode) {
            defaultCountryCode = settings.university_bank_details.defaultCountryCode;
        }
    } catch (err) {
        // Fallback to default
    }

    return {
        name: tenant.name,
        logo: tenant.logo,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        defaultCountryCode,
    };
}

/**
 * Returns the subscription status and days remaining for the current tenant.
 */
export async function getSubscriptionStatus() {
    const tenant = await getTenantFromRequest();
    if (!tenant) return null;

    // ⚡ ALWAYS fetch fresh subscription status to bypass 1-minute tenantCache
    const tenantId = tenant._id || tenant.id;
    let freshTenant: any = null;
    try {
        freshTenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { subscriptionStatus: true, subscriptionEndDate: true, isActive: true }
        });
    } catch (e) {}

    if (!freshTenant) {
        try {
            const supabaseAdmin = getSupabaseAdmin();
            const { data: sTenant } = await supabaseAdmin
                .from('tenants')
                .select('subscription_status, subscription_end_date, is_active')
                .eq('id', tenantId)
                .maybeSingle();

            if (sTenant) {
                freshTenant = {
                    subscriptionStatus: sTenant.subscription_status,
                    subscriptionEndDate: sTenant.subscription_end_date,
                    isActive: sTenant.is_active
                };
            }
        } catch (sErr) {}
    }

    if (freshTenant) {
        tenant.subscriptionStatus = freshTenant.subscriptionStatus || tenant.subscriptionStatus;
        tenant.subscriptionEndDate = freshTenant.subscriptionEndDate || tenant.subscriptionEndDate;
        tenant.isActive = freshTenant.isActive !== undefined ? freshTenant.isActive : tenant.isActive;
    }

    const now = new Date();
    const rawEndDate = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : null;
    let endOfDayDate: Date | null = null;

    if (rawEndDate) {
        endOfDayDate = new Date(rawEndDate);
        // Ensure subscription remains valid until the final midnight 23:59:59.999 of the expiration date
        endOfDayDate.setHours(23, 59, 59, 999);
    }

    let daysRemaining = null;
    if (rawEndDate) {
        const diffTime = rawEndDate.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    let studentCount = 0;
    try {
        studentCount = await prisma.student.count({
            where: { tenantId }
        });
    } catch (e) {}

    let settings: any = null;
    try {
        settings = await prisma.adminSettings.findFirst({
            where: { tenantId },
            select: { universityBankDetails: true, totalHostelars: true }
        });
    } catch (e) {}

    const bankDetails: any = settings?.universityBankDetails || {};
    const renewalUtr = bankDetails.renewalUtr || null;
    const renewalStatus = bankDetails.renewalStatus || null;
    const renewalSubmittedAt = bankDetails.renewalSubmittedAt || null;
    const fallbackStudentCount = settings?.totalHostelars ? Number(settings.totalHostelars) : 0;

    const isExpired = (endOfDayDate && now > endOfDayDate) || tenant.subscriptionStatus === 'expired' || tenant.isActive === false;
    const isWarning = !isExpired && daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

    return {
        status: tenant.subscriptionStatus || "active",
        isActive: tenant.isActive !== false,
        endDate: endOfDayDate || rawEndDate,
        rawEndDate: rawEndDate,
        startDate: tenant.createdAt,
        name: tenant.name,
        tenantId: tenantId,
        daysRemaining: daysRemaining,
        studentCount: studentCount > 0 ? studentCount : (fallbackStudentCount > 0 ? fallbackStudentCount : 524),
        isWarning,
        isExpired,
        renewalUtr,
        renewalStatus,
        renewalSubmittedAt
    };
}

/**
 * Finds a tenant by its internal ID.
 */
export async function getTenantById(id: string) {
    if (!id) return null;
    const tenant = await prisma.tenant.findUnique({
        where: { id }
    });
    
    if (!tenant) return null;
    return {
        _id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.createdAt,
        subscriptionEndDate: tenant.subscriptionEndDate,
        subscriptionStatus: tenant.subscriptionStatus
    };
}

