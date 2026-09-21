import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        let logs: any[] = [];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_audit_logs' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                logs = setting.settings as any[];
            }
        } catch (pErr) {
            console.warn("Prisma audit log fetch note:", pErr);
        }

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newLog = await request.json(); // { action: string, details: string, user: string }

        // Fetch existing from Prisma (Railway PostgreSQL)
        let currentLogs: any[] = [];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_audit_logs' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                currentLogs = setting.settings as any[];
            }
        } catch (e) {}

        // Append log at beginning (newest first)
        const updatedLogs = [
            {
                ...newLog,
                timestamp: new Date().toISOString()
            },
            ...currentLogs
        ].slice(0, 1000); // Limit to last 1000 logs to prevent overflow

        await prisma.platformSetting.upsert({
            where: { id: 'super_admin_audit_logs' },
            update: { settings: updatedLogs as any, updatedAt: new Date() },
            create: { id: 'super_admin_audit_logs', settings: updatedLogs as any, updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, logs: updatedLogs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { timestamps, clearAll } = body;

        if (clearAll) {
            await prisma.platformSetting.upsert({
                where: { id: 'super_admin_audit_logs' },
                update: { settings: [] as any, updatedAt: new Date() },
                create: { id: 'super_admin_audit_logs', settings: [] as any, updatedAt: new Date() }
            });

            return NextResponse.json({ success: true, logs: [] });
        }

        if (Array.isArray(timestamps) && timestamps.length > 0) {
            let currentLogs: any[] = [];
            try {
                const setting = await prisma.platformSetting.findUnique({
                    where: { id: 'super_admin_audit_logs' }
                });
                if (setting?.settings && Array.isArray(setting.settings)) {
                    currentLogs = setting.settings as any[];
                }
            } catch (e) {}

            const updatedLogs = currentLogs.filter((log: any) => !timestamps.includes(log.timestamp));

            await prisma.platformSetting.upsert({
                where: { id: 'super_admin_audit_logs' },
                update: { settings: updatedLogs as any, updatedAt: new Date() },
                create: { id: 'super_admin_audit_logs', settings: updatedLogs as any, updatedAt: new Date() }
            });

            return NextResponse.json({ success: true, logs: updatedLogs });
        }

        return NextResponse.json({ success: false, error: "No timestamps or clearAll flag provided" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
