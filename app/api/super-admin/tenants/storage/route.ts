import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const { tenantId } = await request.json();
        if (!tenantId) return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });

        // Calculate student & gatepass count on Railway
        const [studentCount, gatePassCount] = await Promise.all([
            prisma.student.count({ where: { tenantId } }),
            prisma.gatePass.count({ where: { tenantId } })
        ]);

        const estimatedBytes = (studentCount * 50000) + (gatePassCount * 500);

        const setting = await prisma.adminSettings.findFirst({
            where: { tenantId }
        });

        if (setting) {
            const bankDetails = (setting.universityBankDetails as any) || {};
            bankDetails.lastStorageBytes = estimatedBytes;

            await prisma.adminSettings.update({
                where: { id: setting.id },
                data: { universityBankDetails: bankDetails }
            });
        }

        return NextResponse.json({ success: true, storageBytes: estimatedBytes });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
