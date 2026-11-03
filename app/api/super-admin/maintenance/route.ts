export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdminSession } from "@/lib/authSession";
import { clearMaintenanceCache } from "@/app/api/maintenance-status/route";

export async function GET(request: NextRequest) {
    try {
        if (!isSuperAdminSession(request)) {
            return NextResponse.json({ success: false, error: "Super admin access required" }, { status: 403 });
        }

        const row = await prisma.platformSetting.findUnique({
            where: { id: 'boss_maintenance_mode' }
        });

        const settings = (row?.settings as any) || {
            enabled: false,
            message: "",
            estimatedTime: ""
        };

        return NextResponse.json({
            success: true,
            enabled: Boolean(settings.enabled),
            message: settings.message || "",
            estimatedTime: settings.estimatedTime || "",
            updatedAt: row?.updatedAt || null
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isSuperAdminSession(request)) {
            return NextResponse.json({ success: false, error: "Super admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { enabled, message, estimatedTime } = body;

        await prisma.platformSetting.upsert({
            where: { id: 'boss_maintenance_mode' },
            update: {
                settings: {
                    enabled: Boolean(enabled),
                    message: (message || "").trim(),
                    estimatedTime: (estimatedTime || "").trim()
                },
                updatedAt: new Date()
            },
            create: {
                id: 'boss_maintenance_mode',
                settings: {
                    enabled: Boolean(enabled),
                    message: (message || "").trim(),
                    estimatedTime: (estimatedTime || "").trim()
                }
            }
        });

        clearMaintenanceCache();

        // Write to SuperAdmin Audit Logs
        try {
            const auditRow = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_audit_logs' }
            });
            let logs: any[] = [];
            if (auditRow?.settings && Array.isArray(auditRow.settings)) {
                logs = auditRow.settings as any[];
            }
            logs.unshift({
                action: "MAINTENANCE_MODE_TOGGLE",
                details: enabled 
                    ? `Enabled Platform-Wide Maintenance Mode. Message: "${message || 'Default'}" (ETA: ${estimatedTime || 'N/A'})`
                    : "Disabled Platform-Wide Maintenance Mode. Normal operations restored.",
                user: "Super Admin",
                timestamp: new Date().toISOString()
            });
            await prisma.platformSetting.upsert({
                where: { id: 'super_admin_audit_logs' },
                update: { settings: logs.slice(0, 500) },
                create: { id: 'super_admin_audit_logs', settings: logs }
            });
        } catch (auditErr) {
            console.warn("Audit log creation note:", auditErr);
        }

        return NextResponse.json({
            success: true,
            enabled: Boolean(enabled),
            message: (message || "").trim(),
            estimatedTime: (estimatedTime || "").trim()
        });
    } catch (error: any) {
        console.error("Save maintenance mode error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to update maintenance settings" }, { status: 500 });
    }
}
