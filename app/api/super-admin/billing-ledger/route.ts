import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    getBillingLedgerFromR2,
    saveBillingLedgerToR2,
    saveInvoiceDocumentToR2,
    deleteInvoiceDocumentFromR2,
    listAllInvoicesFromR2,
    OGI_SEED_TRANSACTION
} from "@/lib/billingR2Storage";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Helper to get complete college details snapshot from Prisma
 */
async function fetchCollegeDetails(tenantId: string) {
    if (!tenantId) return null;
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { adminSettings: { take: 1 } }
        });
        if (!tenant) return null;
        const instConfig = (tenant.adminSettings?.[0]?.universityBankDetails as any) || {};
        return {
            name: tenant.name || "Oriental Group of Institutes (OGI)",
            email: instConfig.email || tenant.adminEmail || "pankajdwivedi81@gmail.com",
            phone: instConfig.phone || "+91 9981414729 / 0755-2529015",
            address: instConfig.address || "Oriental Campus, Raisen Road, Bhopal, MP - 462021",
            contactName: instConfig.contactName || "Dr Pankaj Dwivedi",
            contactPhone: instConfig.contactPhone || "7974704918",
            gstin: instConfig.gstin || ""
        };
    } catch (e) {
        return {
            name: "Oriental Group of Institutes (OGI)",
            email: "pankajdwivedi81@gmail.com",
            phone: "+91 9981414729 / 0755-2529015",
            address: "Oriental Campus, Raisen Road, Bhopal, MP - 462021",
            contactName: "Dr Pankaj Dwivedi",
            contactPhone: "7974704918",
            gstin: ""
        };
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const forceR2 = searchParams.get("forceR2") === "true" || searchParams.get("retrieve") === "true";
        let logs: any[] | null = null;

        // 1. If forceR2 is requested (from "Retrieve All Invoices from Cloudflare" button), do deep scan
        if (forceR2) {
            try {
                logs = await listAllInvoicesFromR2();
            } catch (e) {
                console.warn("Deep R2 invoice scan error:", e);
            }
        }

        // 2. Master source: Attempt to load from Cloudflare R2 permanent store
        if (!logs || logs.length === 0) {
            try {
                logs = await getBillingLedgerFromR2();
            } catch (e) {
                console.warn("Cloudflare R2 fetch error in billing-ledger GET:", e);
            }
        }

        // 3. Fallback: If not in R2, load from Prisma PostgreSQL
        if (!logs || logs.length === 0) {
            try {
                const setting = await prisma.platformSetting.findUnique({
                    where: { id: 'super_admin_billing_ledger' }
                });
                if (setting?.settings && Array.isArray(setting.settings) && setting.settings.length > 0) {
                    logs = setting.settings as any[];
                    // Hydrate Cloudflare R2 with existing DB records
                    await saveBillingLedgerToR2(logs);
                }
            } catch (e) {}
        }

        // 4. Fallback: Seed transaction if completely fresh
        if (!logs || logs.length === 0) {
            logs = [OGI_SEED_TRANSACTION];
            try {
                await Promise.all([
                    saveBillingLedgerToR2(logs),
                    saveInvoiceDocumentToR2(OGI_SEED_TRANSACTION),
                    prisma.platformSetting.upsert({
                        where: { id: 'super_admin_billing_ledger' },
                        update: { settings: logs as any, updatedAt: new Date() },
                        create: { id: 'super_admin_billing_ledger', settings: logs as any, updatedAt: new Date() }
                    })
                ]);
            } catch (e) {}
        }

        // 5. Ensure every record has full collegeDetails populated for identical viewing
        const enrichedLogs = logs.map((log: any) => {
            const hasDetails = log.collegeDetails && log.collegeDetails.address && log.collegeDetails.email;
            if (!hasDetails) {
                const isOgi = String(log.tenantName || "").toLowerCase().includes("oriental") || log.id === "tx_seed_ogi";
                return {
                    ...log,
                    studentCount: Number(log.studentCount) > 0 ? Number(log.studentCount) : 500,
                    ratePerStudentMonth: Number(log.ratePerStudentMonth) > 0 ? Number(log.ratePerStudentMonth) : 30,
                    collegeDetails: {
                        name: log.collegeDetails?.name || log.tenantName || (isOgi ? "Oriental Group of Institutes (OGI)" : "Partner College"),
                        address: log.collegeDetails?.address || (isOgi ? "Oriental Campus, Raisen Road, Bhopal, MP - 462021" : ""),
                        email: log.collegeDetails?.email || (isOgi ? "pankajdwivedi81@gmail.com" : ""),
                        phone: log.collegeDetails?.phone || (isOgi ? "+91 9981414729 / 0755-2529015" : ""),
                        contactName: log.collegeDetails?.contactName || "Dr Pankaj Dwivedi",
                        contactPhone: log.collegeDetails?.contactPhone || "7974704918",
                        gstin: log.collegeDetails?.gstin || ""
                    }
                };
            }
            return log;
        });

        // 6. Ensure Prisma and Cloudflare R2 have the enriched cache
        try {
            await Promise.all([
                saveBillingLedgerToR2(enrichedLogs),
                prisma.platformSetting.upsert({
                    where: { id: 'super_admin_billing_ledger' },
                    update: { settings: enrichedLogs as any, updatedAt: new Date() },
                    create: { id: 'super_admin_billing_ledger', settings: enrichedLogs as any, updatedAt: new Date() }
                })
            ]);
        } catch (e) {}

        return NextResponse.json({
            success: true,
            logs: enrichedLogs,
            source: forceR2 ? "cloudflare_r2_deep_scan" : "cloudflare_r2_master",
            totalRetrieved: enrichedLogs.length
        }, {
            headers: { "Cache-Control": "no-store, max-age=0" }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const newRecord = await request.json();

        // Validate billingType
        const allowedTypes = ["Verified Payment", "Complimentary", "Deferred Billing (On Credit)"];
        if (!allowedTypes.includes(newRecord.billingType)) {
            return NextResponse.json({ success: false, error: "Invalid billing type" }, { status: 400 });
        }

        // 1. Fetch current logs from Cloudflare R2 (fallback to Prisma)
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

        if (currentLogs.length === 0) {
            currentLogs = [OGI_SEED_TRANSACTION];
        }

        // 2. Fetch live college info & student count if not provided
        let liveStudentCount = 0;
        let collegeDetails = newRecord.collegeDetails || null;

        if (newRecord.tenantId) {
            try {
                const count = await prisma.student.count({ where: { tenantId: newRecord.tenantId } });
                liveStudentCount = count || 0;
            } catch (e) {}

            if (!collegeDetails) {
                collegeDetails = await fetchCollegeDetails(newRecord.tenantId);
            }
        }

        const billingPeriod = newRecord.billingPeriod || "1 Year";
        const months = Number(newRecord.months) || (
            billingPeriod.includes("1 Month") ? 1 :
            billingPeriod.includes("3") ? 3 :
            billingPeriod.includes("6") ? 6 :
            billingPeriod.includes("2 Year") ? 24 :
            billingPeriod.includes("3 Year") ? 36 : 12
        );

        const studentCount = Number(newRecord.studentCount) > 0 ? Number(newRecord.studentCount) : (liveStudentCount > 0 ? liveStudentCount : 500);
        const ratePerStudentMonth = Number(newRecord.ratePerStudentMonth) || 30;
        const grossBase = studentCount * ratePerStudentMonth * months;

        const isDirect = (newRecord.paymentSource || "").toLowerCase().includes("direct") || (newRecord.paymentSource || "").toLowerCase().includes("bank");
        let standardDiscountPercent = newRecord.standardDiscountPercent !== undefined 
            ? Number(newRecord.standardDiscountPercent)
            : (months === 1 ? 0 : months === 3 ? 20 : months === 6 ? 30 : 40) + (isDirect ? 3 : 0);

        const standardDiscountAmount = Math.round(grossBase * (standardDiscountPercent / 100));

        const extraDiscountType = newRecord.extraDiscountType || (newRecord.extraDiscountAmount ? "amount" : "percent");
        let extraDiscountAmount = 0;
        let extraDiscountPercent = 0;

        if (extraDiscountType === "amount" || (newRecord.extraDiscountAmount && Number(newRecord.extraDiscountAmount) > 0)) {
            extraDiscountAmount = Number(newRecord.extraDiscountAmount || newRecord.extraDiscountValue || 0);
            extraDiscountPercent = grossBase > 0 ? Number(((extraDiscountAmount / grossBase) * 100).toFixed(1)) : 0;
        } else if (newRecord.extraDiscountPercent && Number(newRecord.extraDiscountPercent) > 0) {
            extraDiscountPercent = Number(newRecord.extraDiscountPercent);
            extraDiscountAmount = Math.round(grossBase * (extraDiscountPercent / 100));
        }

        const totalDiscountAmount = standardDiscountAmount + extraDiscountAmount;
        const netCalculated = Math.max(0, grossBase - totalDiscountAmount);
        const finalPaid = (newRecord.amount !== undefined && Number(newRecord.amount) >= 0) ? Number(newRecord.amount) : netCalculated;

        const invoiceId = newRecord.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // 3. Create frozen immutable snapshot
        const updatedRecord = {
            id: invoiceId,
            tenantId: newRecord.tenantId,
            tenantName: newRecord.tenantName || collegeDetails?.name || "University Client",
            amount: finalPaid,
            utr: newRecord.utr || "",
            date: newRecord.date || new Date().toISOString(),
            billingType: newRecord.billingType,
            paymentSource: newRecord.paymentSource || (newRecord.utr ? "Direct Bank / UPI Transfer (UTR Verified)" : "Direct Bank Transfer"),
            billingPeriod: billingPeriod,
            months: months,
            studentCount: studentCount,
            ratePerStudentMonth: ratePerStudentMonth,
            grossBase: grossBase,
            standardDiscountPercent: standardDiscountPercent,
            standardDiscountAmount: standardDiscountAmount,
            extraDiscountType: extraDiscountType,
            extraDiscountAmount: extraDiscountAmount,
            extraDiscountPercent: extraDiscountPercent,
            totalDiscountAmount: totalDiscountAmount,
            remarks: newRecord.remarks || "",
            screenshotUrl: newRecord.screenshotUrl || "",
            collegeDetails: collegeDetails || {
                name: newRecord.tenantName || "University Client",
                address: "",
                email: "",
                phone: "",
                contactName: "Dr Pankaj Dwivedi",
                contactPhone: "7974704918",
                gstin: ""
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const updatedLogs = [updatedRecord, ...currentLogs];

        // 4. Save to Cloudflare R2 (Permanent Master Storage) & Individual Invoice File
        await Promise.allSettled([
            saveBillingLedgerToR2(updatedLogs),
            saveInvoiceDocumentToR2(updatedRecord),
            prisma.platformSetting.upsert({
                where: { id: 'super_admin_billing_ledger' },
                update: { settings: updatedLogs as any, updatedAt: new Date() },
                create: { id: 'super_admin_billing_ledger', settings: updatedLogs as any, updatedAt: new Date() }
            })
        ]);

        return NextResponse.json({ success: true, logs: updatedLogs, invoice: updatedRecord });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const updateData = await request.json();

        if (!updateData.id) {
            return NextResponse.json({ success: false, error: "Missing invoice ID" }, { status: 400 });
        }

        // 1. Fetch current logs from Cloudflare R2 (fallback to Prisma)
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

        const index = currentLogs.findIndex((log: any) => log.id === updateData.id);
        if (index === -1) {
            return NextResponse.json({ success: false, error: "Invoice not found in ledger" }, { status: 404 });
        }

        const existing = currentLogs[index];

        // Recalculate snapshot if fields were updated
        const billingPeriod = updateData.billingPeriod !== undefined ? updateData.billingPeriod : (existing.billingPeriod || "1 Year");
        const months = updateData.months !== undefined ? Number(updateData.months) : (
            billingPeriod.includes("1 Month") ? 1 :
            billingPeriod.includes("3") ? 3 :
            billingPeriod.includes("6") ? 6 :
            billingPeriod.includes("2 Year") ? 24 :
            billingPeriod.includes("3 Year") ? 36 : 12
        );

        const studentCount = updateData.studentCount !== undefined ? Number(updateData.studentCount) : (existing.studentCount || 500);
        const ratePerStudentMonth = updateData.ratePerStudentMonth !== undefined ? Number(updateData.ratePerStudentMonth) : (existing.ratePerStudentMonth || 30);
        const grossBase = studentCount * ratePerStudentMonth * months;

        const isDirect = (updateData.paymentSource || existing.paymentSource || "").toLowerCase().includes("direct") || (updateData.paymentSource || existing.paymentSource || "").toLowerCase().includes("bank");
        const standardDiscountPercent = updateData.standardDiscountPercent !== undefined 
            ? Number(updateData.standardDiscountPercent)
            : (existing.standardDiscountPercent !== undefined ? Number(existing.standardDiscountPercent) : (months === 1 ? 0 : months === 3 ? 20 : months === 6 ? 30 : 40) + (isDirect ? 3 : 0));

        const standardDiscountAmount = Math.round(grossBase * (standardDiscountPercent / 100));

        const extraDiscountType = updateData.extraDiscountType !== undefined ? updateData.extraDiscountType : (existing.extraDiscountType || "amount");
        let extraDiscountAmount = 0;
        let extraDiscountPercent = 0;

        if (extraDiscountType === "amount" || (updateData.extraDiscountAmount && Number(updateData.extraDiscountAmount) > 0)) {
            extraDiscountAmount = Number(updateData.extraDiscountAmount || updateData.extraDiscountValue || existing.extraDiscountAmount || 0);
            extraDiscountPercent = grossBase > 0 ? Number(((extraDiscountAmount / grossBase) * 100).toFixed(1)) : 0;
        } else if (updateData.extraDiscountPercent && Number(updateData.extraDiscountPercent) > 0) {
            extraDiscountPercent = Number(updateData.extraDiscountPercent);
            extraDiscountAmount = Math.round(grossBase * (extraDiscountPercent / 100));
        } else if (existing.extraDiscountPercent && Number(existing.extraDiscountPercent) > 0) {
            extraDiscountPercent = Number(existing.extraDiscountPercent);
            extraDiscountAmount = Math.round(grossBase * (extraDiscountPercent / 100));
        }

        const totalDiscountAmount = standardDiscountAmount + extraDiscountAmount;
        const netCalculated = Math.max(0, grossBase - totalDiscountAmount);
        const finalPaid = updateData.amount !== undefined ? Number(updateData.amount) : (existing.amount !== undefined ? existing.amount : netCalculated);

        const updatedInvoice = {
            ...existing,
            tenantId: updateData.tenantId !== undefined ? updateData.tenantId : existing.tenantId,
            tenantName: updateData.tenantName !== undefined ? updateData.tenantName : existing.tenantName,
            amount: finalPaid,
            utr: updateData.utr !== undefined ? updateData.utr : existing.utr,
            date: updateData.date !== undefined ? updateData.date : existing.date,
            billingType: updateData.billingType !== undefined ? updateData.billingType : existing.billingType,
            paymentSource: updateData.paymentSource !== undefined ? updateData.paymentSource : existing.paymentSource,
            billingPeriod: billingPeriod,
            months: months,
            studentCount: studentCount,
            ratePerStudentMonth: ratePerStudentMonth,
            grossBase: grossBase,
            standardDiscountPercent: standardDiscountPercent,
            standardDiscountAmount: standardDiscountAmount,
            extraDiscountType: extraDiscountType,
            extraDiscountAmount: extraDiscountAmount,
            extraDiscountPercent: extraDiscountPercent,
            totalDiscountAmount: totalDiscountAmount,
            remarks: updateData.remarks !== undefined ? updateData.remarks : existing.remarks,
            screenshotUrl: updateData.screenshotUrl !== undefined ? updateData.screenshotUrl : (existing.screenshotUrl || ""),
            collegeDetails: updateData.collegeDetails !== undefined ? updateData.collegeDetails : (existing.collegeDetails || {}),
            updatedAt: new Date().toISOString()
        };

        currentLogs[index] = updatedInvoice;

        // 2. Save updated ledger to Cloudflare R2 & Individual Invoice & PostgreSQL
        await Promise.allSettled([
            saveBillingLedgerToR2(currentLogs),
            saveInvoiceDocumentToR2(updatedInvoice),
            prisma.platformSetting.upsert({
                where: { id: 'super_admin_billing_ledger' },
                update: { settings: currentLogs as any, updatedAt: new Date() },
                create: { id: 'super_admin_billing_ledger', settings: currentLogs as any, updatedAt: new Date() }
            })
        ]);

        return NextResponse.json({ success: true, logs: currentLogs, invoice: updatedInvoice });
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

        // 1. Fetch current logs from Cloudflare R2 (fallback to Prisma)
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

        const updatedLogs = currentLogs.filter((log: any) => log.id !== id);

        // 2. Delete from Cloudflare R2 & update master ledger & Prisma
        await Promise.allSettled([
            deleteInvoiceDocumentFromR2(id),
            saveBillingLedgerToR2(updatedLogs),
            prisma.platformSetting.upsert({
                where: { id: 'super_admin_billing_ledger' },
                update: { settings: updatedLogs as any, updatedAt: new Date() },
                create: { id: 'super_admin_billing_ledger', settings: updatedLogs as any, updatedAt: new Date() }
            })
        ]);

        return NextResponse.json({ success: true, logs: updatedLogs, deletedId: id });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
