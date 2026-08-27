import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OGI_SEED_TRANSACTION = {
    id: "tx_seed_ogi",
    tenantId: "26739d24-0214-409b-aa81-42e628e88c2b",
    tenantName: "Oriental Group of Institutes (OGI)",
    amount: 23130,
    utr: "659864589235",
    date: "2026-03-07T16:23:43.395Z",
    billingType: "Verified Payment",
    paymentSource: "Direct Bank / UPI Transfer (UTR Verified)",
    billingPeriod: "1 Year",
    remarks: "Initial seeded payment proof"
};

export async function GET() {
    try {
        let logs: any[] = [];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_billing_ledger' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                logs = setting.settings as any[];
            }
        } catch (e) {}

        if (logs.length === 0) {
            logs = [OGI_SEED_TRANSACTION];
            try {
                await prisma.platformSetting.upsert({
                    where: { id: 'super_admin_billing_ledger' },
                    update: { settings: logs as any, updatedAt: new Date() },
                    create: { id: 'super_admin_billing_ledger', settings: logs as any, updatedAt: new Date() }
                });
            } catch (e) {}
        }

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newRecord = await request.json(); // { tenantId, tenantName, amount, utr, date, billingType, billingPeriod, remarks, paymentSource }

        // Validate billingType
        const allowedTypes = ["Verified Payment", "Complimentary", "Deferred Billing (On Credit)"];
        if (!allowedTypes.includes(newRecord.billingType)) {
            return NextResponse.json({ success: false, error: "Invalid billing type" }, { status: 400 });
        }

        // Fetch existing from Prisma (Railway)
        let currentLogs: any[] = [OGI_SEED_TRANSACTION];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_billing_ledger' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                currentLogs = setting.settings as any[];
            }
        } catch (e) {}

        const updatedRecord = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            tenantId: newRecord.tenantId,
            tenantName: newRecord.tenantName,
            amount: Number(newRecord.amount) || 0,
            utr: newRecord.utr || "",
            date: newRecord.date || new Date().toISOString(),
            billingType: newRecord.billingType,
            paymentSource: newRecord.paymentSource || (newRecord.utr ? "Direct Bank / UPI Transfer (UTR Verified)" : "Direct Bank Transfer"),
            billingPeriod: newRecord.billingPeriod || "1 Month",
            remarks: newRecord.remarks || "",
            extraDiscountType: newRecord.extraDiscountType || (newRecord.extraDiscountAmount ? "amount" : "percent"),
            extraDiscountAmount: Number(newRecord.extraDiscountAmount) || 0,
            extraDiscountPercent: Number(newRecord.extraDiscountPercent) || 0
        };

        const updatedLogs = [updatedRecord, ...currentLogs];

        // Update Prisma (Railway PostgreSQL)
        await prisma.platformSetting.upsert({
            where: { id: 'super_admin_billing_ledger' },
            update: { settings: updatedLogs as any, updatedAt: new Date() },
            create: { id: 'super_admin_billing_ledger', settings: updatedLogs as any, updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, logs: updatedLogs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const updateData = await request.json(); // { id, tenantId, tenantName, amount, utr, date, billingType, billingPeriod, remarks, paymentSource, extraDiscountType, extraDiscountAmount, extraDiscountPercent }

        if (!updateData.id) {
            return NextResponse.json({ success: false, error: "Missing invoice ID" }, { status: 400 });
        }

        let currentLogs: any[] = [];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_billing_ledger' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                currentLogs = setting.settings as any[];
            }
        } catch (e) {}

        const index = currentLogs.findIndex((log: any) => log.id === updateData.id);
        if (index === -1) {
            return NextResponse.json({ success: false, error: "Invoice not found in ledger" }, { status: 404 });
        }

        currentLogs[index] = {
            ...currentLogs[index],
            tenantId: updateData.tenantId !== undefined ? updateData.tenantId : currentLogs[index].tenantId,
            tenantName: updateData.tenantName !== undefined ? updateData.tenantName : currentLogs[index].tenantName,
            amount: updateData.amount !== undefined ? (Number(updateData.amount) || 0) : currentLogs[index].amount,
            utr: updateData.utr !== undefined ? updateData.utr : currentLogs[index].utr,
            date: updateData.date !== undefined ? updateData.date : currentLogs[index].date,
            billingType: updateData.billingType !== undefined ? updateData.billingType : currentLogs[index].billingType,
            paymentSource: updateData.paymentSource !== undefined ? updateData.paymentSource : currentLogs[index].paymentSource,
            billingPeriod: updateData.billingPeriod !== undefined ? updateData.billingPeriod : currentLogs[index].billingPeriod,
            remarks: updateData.remarks !== undefined ? updateData.remarks : currentLogs[index].remarks,
            extraDiscountType: updateData.extraDiscountType !== undefined ? updateData.extraDiscountType : currentLogs[index].extraDiscountType,
            extraDiscountAmount: updateData.extraDiscountAmount !== undefined ? (Number(updateData.extraDiscountAmount) || 0) : (currentLogs[index].extraDiscountAmount || 0),
            extraDiscountPercent: updateData.extraDiscountPercent !== undefined ? (Number(updateData.extraDiscountPercent) || 0) : (currentLogs[index].extraDiscountPercent || 0),
            updatedAt: new Date().toISOString()
        };

        // Update Prisma (Railway PostgreSQL)
        await prisma.platformSetting.upsert({
            where: { id: 'super_admin_billing_ledger' },
            update: { settings: currentLogs as any, updatedAt: new Date() },
            create: { id: 'super_admin_billing_ledger', settings: currentLogs as any, updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, logs: currentLogs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        let id = searchParams.get("id");

        if (!id) {
            try {
                const body = await request.json();
                id = body.id;
            } catch (e) {}
        }

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing invoice ID to delete" }, { status: 400 });
        }

        let currentLogs: any[] = [];
        try {
            const setting = await prisma.platformSetting.findUnique({
                where: { id: 'super_admin_billing_ledger' }
            });
            if (setting?.settings && Array.isArray(setting.settings)) {
                currentLogs = setting.settings as any[];
            }
        } catch (e) {}

        const updatedLogs = currentLogs.filter((log: any) => log.id !== id);

        await prisma.platformSetting.upsert({
            where: { id: 'super_admin_billing_ledger' },
            update: { settings: updatedLogs as any, updatedAt: new Date() },
            create: { id: 'super_admin_billing_ledger', settings: updatedLogs as any, updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, logs: updatedLogs, deletedId: id });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

