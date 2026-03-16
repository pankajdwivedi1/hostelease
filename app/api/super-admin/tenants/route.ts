import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

/**
 * GET: Fetch all colleges (Tenants)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        // 1. Fetch tenants
        const { data: tenants, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false });

        if (tenantError) throw tenantError;

        // 2. Fetch student counts for each tenant
        const { data: counts, error: countError } = await supabase
            .from('students')
            .select('tenant_id')
            .then(({ data }) => {
                // Manually group/count since Supabase grouping can be complex in a single call without RPC
                const map: Record<string, number> = {};
                (data || []).forEach(s => {
                    if (s.tenant_id) map[s.tenant_id] = (map[s.tenant_id] || 0) + 1;
                });
                return { data: map, error: null };
            });

        // Map back to expected camelCase for the UI
        const formattedTenants = (tenants || []).map(t => ({
            _id: t.id,
            name: t.name,
            slug: t.slug,
            adminEmail: t.admin_email,
            isActive: t.is_active,
            subscriptionStatus: t.subscription_status,
            subscriptionEndDate: t.subscription_end_date,
            primaryColor: t.primary_color,
            createdAt: t.created_at,
            studentCount: counts[t.id] || 0
        }));

        return NextResponse.json({ success: true, tenants: formattedTenants });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST: Add a new University/College
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("POST /api/super-admin/tenants - Body:", body);
        const { name, slug, adminEmail, subscriptionStatus, primaryColor } = body;

        if (!name || !slug || !adminEmail) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Check if slug exists
        const { data: existing } = await supabase
            .from('tenants')
            .select('id')
            .eq('slug', slug.toLowerCase().trim())
            .single();

        if (existing) {
            return NextResponse.json({ success: false, error: "This slug/subdomain is already taken" }, { status: 409 });
        }

        const { data: tenant, error } = await supabase
            .from('tenants')
            .insert({
                name,
                slug: slug.toLowerCase().trim(),
                admin_email: adminEmail,
                subscription_status: subscriptionStatus || 'trial',
                primary_color: primaryColor || '#3b82f6',
                is_active: true,
                subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            tenant: {
                _id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                adminEmail: tenant.admin_email,
                subscriptionStatus: tenant.subscription_status,
                isActive: tenant.is_active
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * PATCH: Update University Status/Subscription
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, is_active, subscriptionStatus, subscriptionEndDate } = body;

        if (!id) return NextResponse.json({ success: false, error: "Tenant ID is required" }, { status: 400 });

        const supabase = getSupabaseAdmin();
        const updateData: any = {};
        if (typeof is_active !== 'undefined') updateData.is_active = is_active;
        if (subscriptionStatus) updateData.subscription_status = subscriptionStatus;
        if (subscriptionEndDate) updateData.subscription_end_date = new Date(subscriptionEndDate).toISOString();

        const { data: tenant, error } = await supabase
            .from('tenants')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error || !tenant) return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });

        return NextResponse.json({
            success: true,
            tenant: {
                _id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                isActive: tenant.is_active,
                subscriptionStatus: tenant.subscription_status
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
