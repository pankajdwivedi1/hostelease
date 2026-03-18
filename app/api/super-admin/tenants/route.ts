import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

/**
 * GET: Fetch all colleges (Tenants) with extended stats
 */
/**
 * GET: Fetch all colleges (Tenants)
 * ?deleted=true to fetch Recycle Bin items
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const showDeleted = url.searchParams.get('deleted') === 'true';
        
        const supabase = getSupabaseAdmin();
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

        // 1. Fetch tenants with deletion filter
        let query = supabase.from('tenants').select('*');
        
        if (showDeleted) {
            query = query.eq('is_deleted', true);
        } else {
            // Guard against null/false for active rows
            query = query.or('is_deleted.is.null,is_deleted.eq.false');
        }

        const { data: tenants, error: tenantError } = await query.order('created_at', { ascending: false });

        if (tenantError) throw tenantError;

        // 2. ULTRA-PERFORMANCE BATCH FETCH: Get all student counts in one go
        const tenantIds = tenants?.map(t => t.id) || [];
        
        // Fetch all student counts for these tenants
        const { data: studentCounts, error: studentCountError } = await supabase
            .from('students')
            .select('tenant_id')
            .in('tenant_id', tenantIds);

        if (studentCountError) throw studentCountError;

        // Fetch attendance pulse for all (last 10 mins)
        const { data: trafficData, error: trafficError } = await supabase
            .from('attendance')
            .select('tenant_id')
            .in('tenant_id', tenantIds)
            .gte('timestamp', tenMinutesAgo);

        if (trafficError) throw trafficError;

        // Helper to count occurrences
        const getCount = (arr: any[], id: string) => arr.filter(item => item.tenant_id === id).length;

        const formattedTenants = tenants?.map(t => ({
            _id: t.id,
            name: t.name,
            slug: t.slug,
            adminEmail: t.admin_email,
            isActive: t.is_active,
            isDeleted: t.is_deleted || false,
            deletedAt: t.deleted_at,
            subscriptionStatus: t.subscription_status,
            subscriptionEndDate: t.subscription_end_date,
            primaryColor: t.primary_color,
            createdAt: t.created_at,
            studentCount: getCount(studentCounts || [], t.id),
            liveTraffic: getCount(trafficData || [], t.id),
        })) || [];

        const { count: globalPulse } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', tenMinutesAgo);

        return NextResponse.json({ 
            success: true, 
            tenants: formattedTenants,
            globalStats: {
                totalActiveTraffic: globalPulse || 0,
                revenueSummary: {
                    active: tenants?.filter(t => t.subscription_status === 'active').length || 0,
                    trial: tenants?.filter(t => t.subscription_status === 'trial').length || 0,
                    expired: tenants?.filter(t => t.subscription_status === 'expired').length || 0
                }
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST: Restore a Tenant or Add New
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, id } = body;

        const supabase = getSupabaseAdmin();

        // Handle Restore Action
        if (action === "restore" && id) {
            const { error } = await supabase
                .from('tenants')
                .update({ is_deleted: false, deleted_at: null })
                .eq('id', id);
            
            if (error) throw error;
            return NextResponse.json({ success: true, message: "University restored to active duty." });
        }

        const { name, slug, adminEmail, subscriptionStatus, primaryColor } = body;
        if (!name || !slug || !adminEmail) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

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

/**
 * DELETE: Soft Delete or Final Purge
 */
export async function DELETE(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        const purge = url.searchParams.get('purge') === 'true';

        if (!id) return NextResponse.json({ success: false, error: "Tenant ID is required" }, { status: 400 });

        const supabase = getSupabaseAdmin();
        
        if (purge) {
            console.log(`[SuperAdmin] PERMANENT PURGE for tenant: ${id}`);
            // Manually delete dependents
            await supabase.from('attendance').delete().eq('tenant_id', id);
            await supabase.from('students').delete().eq('tenant_id', id);
            
            const { error } = await supabase.from('tenants').delete().eq('id', id);
            if (error) throw error;
            
            return NextResponse.json({ success: true, message: "University node DESTROYED successfully." });
        } else {
            console.log(`[SuperAdmin] SOFT DELETE (Recycle Bin) for tenant: ${id}`);
            const { error } = await supabase
                .from('tenants')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            return NextResponse.json({ success: true, message: "University moved to Recycle Bin." });
        }
    } catch (error: any) {
        console.error("Delete handler crash:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

