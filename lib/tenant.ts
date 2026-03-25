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
    const headersList = await (headers as any)();
    let slug = headersList.get('x-tenant-slug');

    // ⚡ FALLBACK: Resolve from cookies if x-tenant-slug is missing (useful for free Vercel tier)
    if (!slug || slug === 'default') {
        const cookiesList = headersList.get('cookie') || '';
        const match = cookiesList.match(/tenant-slug=([^;]+)/);
        if (match) {
            slug = match[1];
        }
    }

    // ⚡ FALLBACK: Resolve from Host header if x-tenant-slug is still missing
    if (!slug || slug === 'default') {
        const host = headersList.get('host') || '';
        if (host.includes('.localhost')) {
            slug = host.split('.localhost')[0];
        } else if (host.includes('.hostelease.vercel.app')) {
            slug = host.split('.hostelease.vercel.app')[0];
        } else if (host.includes('.vercel.app')) {
            // Support any .vercel.app domain
            slug = host.split('.vercel.app')[0];
        }

        // ⚡ NEW FALLBACK: Check for x-url-tenant header (passed from middleware) or query param logic
        if (!slug || slug === 'default' || slug === 'hostelease-silk') {
            const fullUrl = headersList.get('x-url'); // If middleware passes it
            if (fullUrl) {
                const url = new URL(fullUrl);
                slug = url.searchParams.get('tenant') || 'default';
            }
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

    const normalizedSlug = slug.toLowerCase();

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
        adminEmail: tenant.admin_email
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
            name: 'Hostelease',
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

    const now = new Date();
    const endDate = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : null;

    let daysRemaining = null;
    if (endDate) {
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
        status: tenant.subscriptionStatus,
        isActive: tenant.isActive,
        endDate: endDate,
        daysRemaining: daysRemaining,
        isWarning: daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0,
        isExpired: (endDate && now > endDate) || tenant.subscriptionStatus === 'expired' || !tenant.isActive
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
        slug: tenant.slug
    };
}
