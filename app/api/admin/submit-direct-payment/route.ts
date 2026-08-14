export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";

const DEFAULT_SETTINGS = {
    pricePerStudentPerMonth: 25,
    discount1Month: 0,
    discount3Month: 15,
    discount6Month: 25,
    discount12Month: 30,
    bankTransferDiscount: 3,
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId, utrNumber, months, amount } = body;

        if (!tenantId || !utrNumber) {
            return NextResponse.json({ success: false, error: "Missing tenantId or UTR reference number" }, { status: 400 });
        }

        const durationMonths = Number(months) || 12;
        const activeSource = await db.getSource();

        let tenantName = "University";
        let currentEndDate = new Date();

        if (activeSource === 'PRISMA') {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { id: true, name: true, subscriptionEndDate: true, subscriptionStatus: true }
            });

            if (!tenant) {
                return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
            }

            tenantName = tenant.name;
            currentEndDate = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : new Date();
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

        } else {
            const supabase = getSupabaseAdmin();
            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .select('id, name, subscription_end_date, subscription_status')
                .eq('id', tenantId)
                .single();

            if (tenantError || !tenant) {
                return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
            }

            currentEndDate = tenant.subscription_end_date ? new Date(tenant.subscription_end_date) : new Date();
            const startDate = (currentEndDate > new Date()) ? currentEndDate : new Date();
            const newEndDate = new Date(startDate);
            newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

            await supabase
                .from('tenants')
                .update({
                    subscription_status: 'active',
                    subscription_end_date: newEndDate.toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', tenantId);

            return NextResponse.json({
                success: true,
                message: "Direct payment verified & subscription extended!",
                newEndDate: newEndDate.toISOString()
            });
        }

    } catch (error: any) {
        console.error("Submit direct payment error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to process direct payment" }, { status: 500 });
    }
}
