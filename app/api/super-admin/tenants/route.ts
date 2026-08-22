import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

        const activeDbSource = await db.getSource();
        let tenants: any[] = [];

        // 1. Fetch tenants with deletion filter from active DB (Railway/Prisma or Supabase)
        if (activeDbSource === 'PRISMA') {
            try {
                const prismaTenants = await prisma.tenant.findMany({
                    where: showDeleted ? { isDeleted: true } : { isDeleted: false },
                    orderBy: { createdAt: 'desc' }
                });
                tenants = prismaTenants.map(t => ({
                    id: t.id,
                    name: t.name,
                    slug: t.slug,
                    admin_email: t.adminEmail,
                    is_active: t.isActive,
                    is_deleted: t.isDeleted || false,
                    deleted_at: t.deletedAt,
                    subscription_status: t.subscriptionStatus,
                    subscription_end_date: t.subscriptionEndDate,
                    primary_color: t.primaryColor,
                    created_at: t.createdAt
                }));
            } catch (e: any) {
                console.warn("Prisma tenant list fetch error, falling back to Supabase:", e?.message);
            }
        }

        if ((!tenants || tenants.length === 0) && activeDbSource !== 'PRISMA') {
            let query = supabase.from('tenants').select('*');
            if (showDeleted) {
                query = query.eq('is_deleted', true);
            } else {
                query = query.or('is_deleted.is.null,is_deleted.eq.false');
            }
            const { data } = await query.order('created_at', { ascending: false });
            tenants = data || [];
        }

        const tenantIds = tenants?.map((t: any) => t.id) || [];

        // 2. Get counts per tenant from active DB without hanging fallbacks
        const tenantStats = await Promise.all(tenantIds.map(async (id: any) => {
            let studentCount = 0;
            let liveTraffic = 0;
            let bankDetails: any = {};

            if (activeDbSource === 'PRISMA') {
                try {
                    studentCount = await prisma.student.count({ where: { tenantId: id } });
                } catch (e: any) {
                    console.warn("Student count error on Railway:", e?.message);
                }
                try {
                    const [traffic, settings] = await Promise.all([
                        prisma.attendance.count({ where: { tenantId: id, timestamp: { gte: new Date(now.getTime() - 10 * 60 * 1000) } } }).catch(() => 0),
                        prisma.adminSettings.findFirst({ where: { tenantId: id } }).catch(() => null)
                    ]);
                    liveTraffic = traffic;
                    bankDetails = settings?.universityBankDetails || {};
                } catch (e: any) {
                    console.warn("Traffic/settings fetch error on Railway:", e?.message);
                }
            } else {
                try {
                    const [studentRes, trafficRes, settingsRes] = await Promise.all([
                        supabase.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
                        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('tenant_id', id).gte('timestamp', tenMinutesAgo),
                        supabase.from('admin_settings').select('university_bank_details').eq('tenant_id', id).maybeSingle()
                    ]);
                    studentCount = studentRes?.count || 0;
                    liveTraffic = trafficRes?.count || 0;
                    bankDetails = settingsRes?.data?.university_bank_details || {};
                } catch (e: any) {
                    console.warn("Supabase stats error:", e?.message);
                }
            }

            return {
                id,
                studentCount,
                liveTraffic,
                renewalUtr: bankDetails.renewalUtr || null,
                renewalStatus: bankDetails.renewalStatus || null,
                renewalSubmittedAt: bankDetails.renewalSubmittedAt || null,
                contactName: bankDetails.contactName || null,
                contactPhone: bankDetails.contactPhone || null,
                totalHostelars: bankDetails.totalHostelars || null,
                features: bankDetails.features || { smsEnabled: true, biometricEnabled: true, advancedAnalytics: false },
                storageBytes: bankDetails.lastStorageBytes || null,
                storageQuotaMb: bankDetails.storageQuotaMb || 100
            };
        }));

        const statsMap = new Map<string, any>(tenantStats.map((s: any) => [s.id, s]));

        const formattedTenants = tenants?.map((t: any) => {
            const stats = statsMap.get(t.id) as any;
            return {
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
                studentCount: stats?.studentCount || 0,
                liveTraffic: stats?.liveTraffic || 0,
                renewalUtr: stats?.renewalUtr || null,
                renewalStatus: stats?.renewalStatus || null,
                renewalSubmittedAt: stats?.renewalSubmittedAt || null,
                contactName: stats?.contactName || null,
                contactPhone: stats?.contactPhone || null,
                totalHostelars: stats?.totalHostelars || null,
                features: stats?.features,
                storageBytes: stats?.storageBytes || 0,
                storageQuotaMb: stats?.storageQuotaMb || 100
            };
        }) || [];

        let globalPulse = 0;
        try {
            if (activeDbSource === 'PRISMA') {
                globalPulse = await prisma.attendance.count({ where: { timestamp: { gte: new Date(now.getTime() - 10 * 60 * 1000) } } });
            } else {
                const { count } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).gte('timestamp', tenMinutesAgo);
                globalPulse = count || 0;
            }
        } catch {
            globalPulse = 0;
        }

        return NextResponse.json({ 
            success: true, 
            tenants: formattedTenants,
            globalStats: {
                totalActiveTraffic: globalPulse || 0,
                revenueSummary: {
                    active: tenants?.filter((t: any) => t.subscription_status === 'active').length || 0,
                    trial: tenants?.filter((t: any) => t.subscription_status === 'trial').length || 0,
                    expired: tenants?.filter((t: any) => t.subscription_status === 'expired').length || 0
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
        const { id, is_active, subscriptionStatus, subscriptionEndDate, createdAt, contactName, contactPhone, totalHostelars, features, storageQuotaMb } = body;

        if (!id) return NextResponse.json({ success: false, error: "Tenant ID is required" }, { status: 400 });

        const supabase = getSupabaseAdmin();
        let tenant: any = null;

        const updateData: any = {};
        if (typeof is_active !== 'undefined') updateData.is_active = is_active;
        if (subscriptionStatus) updateData.subscription_status = subscriptionStatus;
        if (typeof subscriptionEndDate !== 'undefined') {
            updateData.subscription_end_date = subscriptionEndDate ? new Date(subscriptionEndDate).toISOString() : null;
        }
        if (typeof createdAt !== 'undefined') {
            updateData.created_at = createdAt ? new Date(createdAt).toISOString() : null;
        }

        if (Object.keys(updateData).length > 0) {
            const { data, error } = await supabase
                .from('tenants')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            if (error || !data) return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
            tenant = data;
        } else {
            const { data, error } = await supabase
                .from('tenants')
                .select()
                .eq('id', id)
                .single();
            if (error || !data) return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
            tenant = data;
        }

        // Update Railway tenant status if active
        try {
            await prisma.tenant.update({
                where: { id },
                data: {
                    isActive: typeof is_active !== 'undefined' ? is_active : tenant.is_active,
                    subscriptionStatus: subscriptionStatus || tenant.subscription_status,
                    subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : undefined
                }
            });
        } catch (e) {
            console.warn("Railway tenant update warn:", e);
        }

        // Update admin_settings in both Supabase and Railway
        const hasContactUpdates = contactName !== undefined || contactPhone !== undefined || totalHostelars !== undefined || features !== undefined || storageQuotaMb !== undefined;
        let bankDetails: any = {};

        if (subscriptionStatus || subscriptionEndDate || hasContactUpdates) {
            const { data: settings } = await supabase
                .from('admin_settings')
                .select('_id, university_bank_details')
                .eq('tenant_id', id)
                .maybeSingle();
                
            bankDetails = settings?.university_bank_details || {};

            if (subscriptionStatus || subscriptionEndDate) {
                delete bankDetails.renewalUtr;
                delete bankDetails.renewalStatus;
                delete bankDetails.renewalSubmittedAt;
            }

            if (hasContactUpdates) {
                if (contactName !== undefined) bankDetails.contactName = contactName;
                if (contactPhone !== undefined) bankDetails.contactPhone = contactPhone;
                if (totalHostelars !== undefined) bankDetails.totalHostelars = totalHostelars;
                if (features !== undefined) bankDetails.features = features;
                if (storageQuotaMb !== undefined) bankDetails.storageQuotaMb = Number(storageQuotaMb) || 100;
            }

            if (settings) {
                await supabase
                    .from('admin_settings')
                    .update({ university_bank_details: bankDetails })
                    .eq('_id', settings._id);
            } else {
                await supabase
                    .from('admin_settings')
                    .insert({ tenant_id: id, university_bank_details: bankDetails });
            }
            try {
                const railwaySettings = await prisma.adminSettings.findFirst({ where: { tenantId: id } });
                if (railwaySettings) {
                    await prisma.adminSettings.update({
                        where: { id: railwaySettings.id },
                        data: { universityBankDetails: bankDetails }
                    });
                } else {
                    await prisma.adminSettings.create({
                        data: { tenantId: id, universityBankDetails: bankDetails }
                    });
                }
            } catch (e) {
                console.warn("Railway adminSettings sync warn:", e);
            }
        }

        const formattedTenant = {
            _id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            adminEmail: tenant.admin_email,
            isActive: tenant.is_active,
            subscriptionStatus: tenant.subscription_status,
            subscriptionEndDate: tenant.subscription_end_date,
            primaryColor: tenant.primary_color,
            createdAt: tenant.created_at,
            contactName: bankDetails.contactName || contactName,
            contactPhone: bankDetails.contactPhone || contactPhone,
            totalHostelars: bankDetails.totalHostelars || totalHostelars,
            features: bankDetails.features || features,
            storageQuotaMb: bankDetails.storageQuotaMb || Number(storageQuotaMb) || 100
        };

        return NextResponse.json({ success: true, tenant: formattedTenant });
    } catch (error: any) {
        console.error("Error updating tenant:", error);
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
            // Manually delete dependents to avoid foreign key constraints
            await supabase.from('gatepasses').delete().eq('tenant_id', id);
            await supabase.from('attendance').delete().eq('tenant_id', id);
            await supabase.from('students').delete().eq('tenant_id', id);
            await supabase.from('hostels').delete().eq('tenant_id', id);
            await supabase.from('warden_accounts').delete().eq('tenant_id', id);
            await supabase.from('admin_settings').delete().eq('tenant_id', id);
            
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

