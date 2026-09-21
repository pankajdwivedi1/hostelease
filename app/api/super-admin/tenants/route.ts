import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET: Fetch all colleges (Tenants) with extended stats
 * ?deleted=true to fetch Recycle Bin items
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const showDeleted = url.searchParams.get('deleted') === 'true';
        
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

        // 1. Fetch tenants with deletion filter from Railway PostgreSQL (Prisma)
        const prismaTenants = await prisma.tenant.findMany({
            where: showDeleted ? { isDeleted: true } : { isDeleted: false },
            orderBy: { createdAt: 'desc' }
        });

        const tenants = prismaTenants.map(t => ({
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

        const tenantIds = tenants.map((t: any) => t.id);

        // 2. Get counts per tenant from Prisma
        const tenantStats = await Promise.all(tenantIds.map(async (id: string) => {
            let studentCount = 0;
            let liveTraffic = 0;
            let bankDetails: any = {};

            try {
                studentCount = await prisma.student.count({ where: { tenantId: id } });
            } catch (e: any) {
                console.warn("Student count error:", e?.message);
            }

            try {
                const [traffic, settings] = await Promise.all([
                    prisma.attendance.count({ where: { tenantId: id, timestamp: { gte: tenMinutesAgo } } }).catch(() => 0),
                    prisma.adminSettings.findFirst({ where: { tenantId: id } }).catch(() => null)
                ]);
                liveTraffic = traffic;
                bankDetails = settings?.universityBankDetails || {};
            } catch (e: any) {
                console.warn("Traffic/settings fetch error:", e?.message);
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

        const formattedTenants = tenants.map((t: any) => {
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
        });

        let globalPulse = 0;
        try {
            globalPulse = await prisma.attendance.count({ where: { timestamp: { gte: tenMinutesAgo } } });
        } catch {
            globalPulse = 0;
        }

        return NextResponse.json({ 
            success: true, 
            tenants: formattedTenants,
            globalStats: {
                totalActiveTraffic: globalPulse || 0,
                revenueSummary: {
                    active: tenants.filter((t: any) => t.subscription_status === 'active').length || 0,
                    trial: tenants.filter((t: any) => t.subscription_status === 'trial').length || 0,
                    expired: tenants.filter((t: any) => t.subscription_status === 'expired').length || 0
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

        // Handle Restore Action
        if (action === "restore" && id) {
            await prisma.tenant.updateMany({
                where: { id },
                data: { isDeleted: false, deletedAt: null }
            });
            
            return NextResponse.json({ success: true, message: "University restored to active duty." });
        }

        const { name, slug, adminEmail, subscriptionStatus, primaryColor } = body;
        if (!name || !slug || !adminEmail) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const cleanSlug = slug.toLowerCase().trim();

        // Check if slug exists in Prisma
        const existingInPrisma = await prisma.tenant.findUnique({
            where: { slug: cleanSlug }
        }).catch(() => null);

        if (existingInPrisma) {
            return NextResponse.json({ success: false, error: "This slug/subdomain is already taken" }, { status: 409 });
        }

        const tenantId = crypto.randomUUID();
        const tenantEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const newTenant = await prisma.tenant.create({
            data: {
                id: tenantId,
                name,
                slug: cleanSlug,
                adminEmail,
                subscriptionStatus: subscriptionStatus || 'trial',
                primaryColor: primaryColor || '#3b82f6',
                isActive: true,
                subscriptionEndDate: tenantEndDate
            }
        });

        return NextResponse.json({
            success: true,
            tenant: {
                _id: newTenant.id,
                name: newTenant.name,
                slug: newTenant.slug,
                adminEmail: newTenant.adminEmail,
                subscriptionStatus: newTenant.subscriptionStatus || 'trial',
                isActive: true
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

        const updateData: any = {};
        if (typeof is_active !== 'undefined') updateData.isActive = is_active;
        if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus;
        if (typeof subscriptionEndDate !== 'undefined') {
            updateData.subscriptionEndDate = subscriptionEndDate ? new Date(subscriptionEndDate) : null;
        }
        if (typeof createdAt !== 'undefined') {
            updateData.createdAt = createdAt ? new Date(createdAt) : undefined;
        }

        const tenant = await prisma.tenant.update({
            where: { id },
            data: updateData
        });

        // Update admin_settings in Railway PostgreSQL
        const hasContactUpdates = contactName !== undefined || contactPhone !== undefined || totalHostelars !== undefined || features !== undefined || storageQuotaMb !== undefined;
        let bankDetails: any = {};

        if (subscriptionStatus || subscriptionEndDate || hasContactUpdates) {
            const settings = await prisma.adminSettings.findFirst({ where: { tenantId: id } });
            bankDetails = settings?.universityBankDetails || {};

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
                await prisma.adminSettings.update({
                    where: { id: settings.id },
                    data: { universityBankDetails: bankDetails }
                });
            } else {
                await prisma.adminSettings.create({
                    data: { tenantId: id, universityBankDetails: bankDetails }
                });
            }
        }

        const formattedTenant = {
            _id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            adminEmail: tenant.adminEmail,
            isActive: tenant.isActive,
            subscriptionStatus: tenant.subscriptionStatus,
            subscriptionEndDate: tenant.subscriptionEndDate,
            primaryColor: tenant.primaryColor,
            createdAt: tenant.createdAt,
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

        if (purge) {
            console.log(`[SuperAdmin] PERMANENT PURGE for tenant: ${id}`);

            // Purge related records from Railway PostgreSQL
            await prisma.gatePass.deleteMany({ where: { tenantId: id } });
            await prisma.attendance.deleteMany({ where: { tenantId: id } });
            await prisma.student.deleteMany({ where: { tenantId: id } });
            await prisma.hostel.deleteMany({ where: { tenantId: id } });
            await prisma.fieldEnforcement.deleteMany({ where: { tenantId: id } });
            await prisma.adminSettings.deleteMany({ where: { tenantId: id } });
            await prisma.tenant.deleteMany({ where: { id } });
            
            return NextResponse.json({ success: true, message: "University node DESTROYED successfully." });
        } else {
            console.log(`[SuperAdmin] SOFT DELETE (Recycle Bin) for tenant: ${id}`);

            await prisma.tenant.updateMany({
                where: { id },
                data: { isDeleted: true, deletedAt: new Date() }
            });

            return NextResponse.json({ success: true, message: "University moved to Recycle Bin." });
        }
    } catch (error: any) {
        console.error("Delete handler crash:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
