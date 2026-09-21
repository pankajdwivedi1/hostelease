export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId, utrNumber, months } = body;

        if (!tenantId || !utrNumber) {
            return NextResponse.json({ success: false, error: "Missing tenantId or UTR reference number" }, { status: 400 });
        }

        const durationMonths = Number(months) || 12;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, subscriptionEndDate: true, subscriptionStatus: true }
        });

        if (!tenant) {
            return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }

        const currentEndDate = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : new Date();
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

        return NextResponse.json({
            success: true,
            message: "Direct payment verified & subscription extended!",
            newEndDate: newEndDate.toISOString()
        });
    } catch (error: any) {
        console.error("Submit direct payment error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to process direct payment" }, { status: 500 });
    }
}
