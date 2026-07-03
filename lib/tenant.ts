import { headers } from 'next/headers';
import { getSupabaseAdmin } from './supabaseServer';
import { cache } from 'react';

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
    const headersList = await (headers as any)();
    let slug = headersList.get('x-tenant-slug');

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

    // 🛠️ DEVELOPMENT FALLBACK: If resolving via plain localhost (no subdomain), 
    // pick the first active tenant so the app doesn't crash with a 500 error.
    if ((!slug || slug === 'default' || slug === 'www' || slug.includes(':')) && process.env.NODE_ENV === 'development') {
        // We can't easily cache this part as slug is unstable here
        const supabase = getSupabaseAdmin();
        const { data: firstTenant } = await supabase
            .from('tenants')
            .select('slug')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
        
        if (firstTenant) {
            slug = firstTenant.slug;
            console.log(`🛠️ [Tenant] Dev Fallback: No subdomain found, defaulting to "${slug}"`);
        }
    }

    if (!slug || slug === 'default') {
        console.warn(`⚠️ [Tenant] No tenant slug found in headers (slug: "${slug}")`);
        return null;
    }

    let normalizedSlug = slug.toLowerCase();
    // ⚡ OIST / OGI ALIAS SUPPORT: Map 'oist' slug to 'ogi' which is the database slug for OGI tenant.
    if (normalizedSlug === 'oist') {
        normalizedSlug = 'ogi';
    }

    // ⚡ Check local memory cache first
    const cached = tenantCache.get(normalizedSlug);
    if (cached && cached.expires > Date.now()) {
        return cached.tenant;
    }

    console.log(`🔍 [Tenant] Searching for tenant with slug: "${normalizedSlug}"`);

    const supabase = getSupabaseAdmin();
    const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', normalizedSlug)
        .eq('is_active', true)
        .single();

    if (error || !tenant) {
        return null;
    }

    // Map Supabase snake_case to camelCase for compatibility with rest of app logic
    const resolvedTenant = {
        _id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo_url,
        primaryColor: tenant.primary_color,
        secondaryColor: tenant.secondary_color,
        subscriptionStatus: tenant.subscription_status,
        subscriptionEndDate: tenant.subscription_end_date,
        isActive: tenant.is_active,
        adminEmail: tenant.admin_email,
        createdAt: tenant.created_at
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
    if (!tenant) {
        return {
            name: 'Hosteleaze',
            logo: null,
            primaryColor: '#3b82f6',
            secondaryColor: '#1e40af',
        };
    }

    return {
        name: tenant.name,
        logo: tenant.logo,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
    };
}

/**
 * Returns the subscription status and days remaining for the current tenant.
 */
export async function getSubscriptionStatus() {
    const tenant = await getTenantFromRequest();
    if (!tenant) return null;

    const supabase = getSupabaseAdmin();
    // ⚡ ALWAYS fetch fresh subscription status to bypass 1-minute tenantCache
    const { data: freshTenant } = await supabase
        .from('tenants')
        .select('subscription_status, subscription_end_date, is_active')
        .eq('id', tenant._id)
        .maybeSingle();

    if (freshTenant) {
        tenant.subscriptionStatus = freshTenant.subscription_status;
        tenant.subscriptionEndDate = freshTenant.subscription_end_date;
        tenant.isActive = freshTenant.is_active;
    }

    const now = new Date();
    const endDate = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : null;

    let daysRemaining = null;
    if (endDate) {
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const { data: settings } = await supabase
        .from('admin_settings')
        .select('university_bank_details')
        .eq('tenant_id', tenant._id)
        .maybeSingle();

    const bankDetails = settings?.university_bank_details || {};
    const renewalUtr = bankDetails.renewalUtr || null;
    const renewalStatus = bankDetails.renewalStatus || null;
    const renewalSubmittedAt = bankDetails.renewalSubmittedAt || null;

    return {
        status: tenant.subscriptionStatus,
        isActive: tenant.isActive,
        endDate: endDate,
        startDate: tenant.createdAt,
        name: tenant.name,
        tenantId: tenant._id,
        daysRemaining: daysRemaining,
        isWarning: daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0,
        isExpired: (endDate && now > endDate) || tenant.subscriptionStatus === 'expired' || !tenant.isActive,
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
    const supabase = getSupabaseAdmin();
    const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    
    if (!tenant) return null;
    return {
        _id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.created_at,
        subscriptionEndDate: tenant.subscription_end_date,
        subscriptionStatus: tenant.subscription_status
    };
}
