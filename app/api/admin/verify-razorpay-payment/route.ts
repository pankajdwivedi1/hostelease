export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import Razorpay from "razorpay";
import {
    getBillingLedgerFromR2,
    saveBillingLedgerToR2,
    saveInvoiceDocumentToR2
} from "@/lib/billingR2Storage";

const DEFAULT_SETTINGS = {
    razorpayKeyId: "rzp_live_TAKnbp18wnY8Mu",
    razorpayKeySecret: "KEXn7SaynyjQ0uQhIlscY1Sc",
    pricePerStudentPerMonth: 25,
    discount1Month: 10,
    discount3Month: 20,
    discount6Month: 30,
    discount12Month: 40,
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, tenantId, months } = body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !tenantId) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        let collegeDetails = {
            name: "University",
            email: "",
            phone: "+91 9981414729 / 0755-2529015",
            address: "Oriental Campus, Raisen Road, Bhopal, MP - 462021",
            contactName: "Dr Pankaj Dwivedi",
            contactPhone: "7974704918",
            gstin: ""
        };

        let tenantName = "University";
        let adminEmail = "";
        let studentCount = 0;
        let settings: any = { ...DEFAULT_SETTINGS };

        try {
            const [tenant, countRow, settingsRow] = await Promise.all([
                prisma.tenant.findUnique({ 
                    where: { id: tenantId }, 
                    include: { adminSettings: { take: 1 } }
                }),
                prisma.student.count({ where: { tenantId } }),
                prisma.platformSetting.findUnique({ where: { id: 'boss_payment_config' } })
            ]);
            if (tenant) {
                tenantName = tenant.name;
                adminEmail = tenant.adminEmail || "";
                const isOgi = tenant.name.toLowerCase().includes("oriental") || tenant.slug?.includes("ogi");
                const instConfig = (tenant.adminSettings?.[0]?.universityBankDetails as any) || {};
                collegeDetails = {
                    name: tenant.name,
                    email: instConfig.email || tenant.adminEmail || (isOgi ? "pankajdwivedi81@gmail.com" : ""),
                    phone: instConfig.phone || (isOgi ? "+91 9981414729 / 0755-2529015" : ""),
                    address: instConfig.address || (isOgi ? "Oriental Campus, Raisen Road, Bhopal, MP - 462021" : ""),
                    contactName: instConfig.contactName || (tenant as any).contactName || "Dr Pankaj Dwivedi",
                    contactPhone: instConfig.contactPhone || (tenant as any).contactPhone || "7974704918",
                    gstin: instConfig.gstin || ""
                };
            }
            studentCount = countRow || 0;
            if (settingsRow?.settings) {
                settings = { ...DEFAULT_SETTINGS, ...(settingsRow.settings as any) };
            }
        } catch (e: any) {
            console.warn("Razorpay verify settings warn:", e?.message);
        }

        if (!settings || !settings.razorpayKeySecret) {
            return NextResponse.json({ success: false, error: "Razorpay Secret not configured" }, { status: 500 });
        }

        // Verify HMAC SHA256 Signature
        const generated_signature = crypto
            .createHmac('sha256', String(settings.razorpayKeySecret).trim())
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return NextResponse.json({ success: false, error: "Invalid payment signature" }, { status: 400 });
        }

        // Fetch payment amount from Razorpay
        let paymentAmount = 0;
        try {
            const razorpay = new Razorpay({
                key_id: String(settings.razorpayKeyId).trim(),
                key_secret: String(settings.razorpayKeySecret).trim(),
            });
            const payment = await razorpay.payments.fetch(razorpay_payment_id);
            paymentAmount = Number(payment.amount) / 100; // In INR
        } catch (err) {
            console.error("Failed to fetch Razorpay payment details:", err);
        }

        const durationMonths = Number(months) || 3;

        // 1. Extend Tenant Subscription in Railway PostgreSQL (Prisma)
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { subscriptionEndDate: true }
        });

        const currentEndDate = tenant?.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : new Date();
        const startDate = (currentEndDate > new Date()) ? currentEndDate : new Date();
        const newEndDate = new Date(startDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                subscriptionStatus: 'active',
                subscriptionEndDate: newEndDate,
                isActive: true
            }
        });

        // 2. Compute Immutable Snapshot
        const effectiveStudentCount = studentCount > 0 ? studentCount : 500;
        const ratePerStudentMonth = Number(settings.pricePerStudentPerMonth) || 25;
        const grossBase = effectiveStudentCount * ratePerStudentMonth * durationMonths;

        let standardDiscountPercent = 0;
        if (durationMonths === 1) standardDiscountPercent = Number(settings.discount1Month ?? 10);
        else if (durationMonths === 3) standardDiscountPercent = Number(settings.discount3Month ?? 20);
        else if (durationMonths === 6) standardDiscountPercent = Number(settings.discount6Month ?? 30);
        else standardDiscountPercent = Number(settings.discount12Month ?? 40);

        const standardDiscountAmount = Math.round(grossBase * (standardDiscountPercent / 100));
        const finalPaid = paymentAmount > 0 ? paymentAmount : Math.max(0, grossBase - standardDiscountAmount);

        const invoiceId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const billingPeriod = durationMonths === 1 ? "1 Month" : durationMonths === 3 ? "3 Months" : durationMonths === 6 ? "6 Months" : durationMonths === 24 ? "2 Years" : "1 Year";

        const newInvoiceRecord = {
            id: invoiceId,
            tenantId,
            tenantName,
            amount: finalPaid,
            utr: razorpay_payment_id,
            date: new Date().toISOString(),
            billingType: "Verified Payment",
            paymentSource: "Online Payment Gateway (Razorpay)",
            billingPeriod: billingPeriod,
            months: durationMonths,
            studentCount: effectiveStudentCount,
            ratePerStudentMonth: ratePerStudentMonth,
            grossBase: grossBase,
            standardDiscountPercent: standardDiscountPercent,
            standardDiscountAmount: standardDiscountAmount,
            extraDiscountType: "amount",
            extraDiscountAmount: 0,
            extraDiscountPercent: 0,
            totalDiscountAmount: standardDiscountAmount,
            remarks: `Automated Gateway Settlement (Order ID: ${razorpay_order_id})`,
            screenshotUrl: "",
            collegeDetails: collegeDetails,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 3. Save to Cloudflare R2 (Permanent Master Copy) & Prisma
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
            message: "Payment verified successfully!",
            newEndDate: newEndDate.toISOString(),
            invoice: newInvoiceRecord
        });
    } catch (error: any) {
        console.error("Verification error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to verify payment" }, { status: 500 });
    }
}
