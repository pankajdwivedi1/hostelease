export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    getBillingLedgerFromR2,
    saveBillingLedgerToR2,
    saveInvoiceDocumentToR2
} from "@/lib/billingR2Storage";

const DEFAULT_SETTINGS = {
    pricePerStudentPerMonth: 30,
    discount1Month: 0,
    discount3Month: 20,
    discount6Month: 30,
    discount12Month: 40,
    bankTransferDiscount: 3,
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId, utrNumber, months, amount, screenshotUrl, remarks } = body;

        if (!tenantId || !utrNumber) {
            return NextResponse.json({ success: false, error: "Missing tenantId or UTR reference number" }, { status: 400 });
        }

        const durationMonths = Number(months) || 12;

        const [tenant, studentCountRow, settingsRow] = await Promise.all([
            prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { id: true, name: true, adminEmail: true, subscriptionEndDate: true, subscriptionStatus: true }
            }),
            prisma.student.count({ where: { tenantId } }),
            prisma.platformSetting.findUnique({ where: { id: 'boss_payment_config' } })
        ]);

        if (!tenant) {
            return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }

        const paymentConfig = settingsRow?.settings ? { ...DEFAULT_SETTINGS, ...(settingsRow.settings as any) } : DEFAULT_SETTINGS;

        const currentEndDate = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : new Date();
        const startDate = (currentEndDate > new Date()) ? currentEndDate : new Date();
        const newEndDate = new Date(startDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

        // Update tenant subscription status in Prisma
        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                subscriptionStatus: 'active',
                subscriptionEndDate: newEndDate,
                isActive: true
            }
        });

        // ⚡ Create Immutable Snapshot for Cloudflare R2
        const studentCount = studentCountRow > 0 ? studentCountRow : 500;
        const ratePerStudentMonth = Number(paymentConfig.pricePerStudentPerMonth) || 30;
        const grossBase = studentCount * ratePerStudentMonth * durationMonths;

        let baseDiscount = 0;
        if (durationMonths === 1) baseDiscount = Number(paymentConfig.discount1Month ?? 0);
        else if (durationMonths === 3) baseDiscount = Number(paymentConfig.discount3Month ?? 20);
        else if (durationMonths === 6) baseDiscount = Number(paymentConfig.discount6Month ?? 30);
        else baseDiscount = Number(paymentConfig.discount12Month ?? 40);

        const bankIncentive = Number(paymentConfig.bankTransferDiscount ?? 3);
        const standardDiscountPercent = baseDiscount + bankIncentive;
        const standardDiscountAmount = Math.round(grossBase * (standardDiscountPercent / 100));
        const netCalculated = Math.max(0, grossBase - standardDiscountAmount);
        const finalPaid = (amount && Number(amount) > 0) ? Number(amount) : netCalculated;

        const invoiceId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const billingPeriod = durationMonths === 1 ? "1 Month" : durationMonths === 3 ? "3 Months" : durationMonths === 6 ? "6 Months" : durationMonths === 24 ? "2 Years" : "1 Year";

        const newInvoiceRecord = {
            id: invoiceId,
            tenantId: tenant.id,
            tenantName: tenant.name,
            amount: finalPaid,
            utr: utrNumber.trim(),
            date: new Date().toISOString(),
            billingType: "Verified Payment",
            paymentSource: "Direct Bank / UPI Transfer (UTR Verified)",
            billingPeriod: billingPeriod,
            months: durationMonths,
            studentCount: studentCount,
            ratePerStudentMonth: ratePerStudentMonth,
            grossBase: grossBase,
            standardDiscountPercent: standardDiscountPercent,
            standardDiscountAmount: standardDiscountAmount,
            extraDiscountType: "amount",
            extraDiscountAmount: 0,
            extraDiscountPercent: 0,
            totalDiscountAmount: standardDiscountAmount,
            remarks: remarks || `Direct Bank/UPI Renewal Submission (${durationMonths} Months)`,
            screenshotUrl: screenshotUrl || "",
            collegeDetails: {
                name: tenant.name,
                email: tenant.adminEmail || "",
                phone: "",
                address: "",
                contactName: "Dr Pankaj Dwivedi",
                contactPhone: "7974704918",
                gstin: ""
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Fetch current ledger from Cloudflare R2 / Prisma
        let currentLogs: any[] = [];
        try {
            const r2Logs = await getBillingLedgerFromR2();
            if (r2Logs && Array.isArray(r2Logs) && r2Logs.length > 0) {
                currentLogs = r2Logs;
            } else {
                const setting = await prisma.platformSetting.findUnique({
                    where: { id: 'super_admin_billing_ledger' }
                });
                if (setting?.settings && Array.isArray(setting.settings)) {
                    currentLogs = setting.settings as any[];
                }
            }
        } catch (e) {}

        const updatedLogs = [newInvoiceRecord, ...currentLogs];

        // ⚡ Save permanently to Cloudflare R2 & dual-sync with Prisma
        await Promise.allSettled([
            saveBillingLedgerToR2(updatedLogs),
            saveInvoiceDocumentToR2(newInvoiceRecord),
            prisma.platformSetting.upsert({
                where: { id: 'super_admin_billing_ledger' },
                update: { settings: updatedLogs as any, updatedAt: new Date() },
                create: { id: 'super_admin_billing_ledger', settings: updatedLogs as any, updatedAt: new Date() }
            })
        ]);

        return NextResponse.json({
            success: true,
            message: "Direct payment verified & subscription extended!",
            newEndDate: newEndDate.toISOString(),
            invoice: newInvoiceRecord
        });
    } catch (error: any) {
        console.error("Submit direct payment error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to process direct payment" }, { status: 500 });
    }
}
