import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdminSession } from "@/lib/authSession";

export async function POST(request: NextRequest) {
    try {
    if (!isSuperAdminSession(request)) return NextResponse.json({ success: false, error: "Super admin access required" }, { status: 403 });
        const body = await request.json();
        const { message, type = 'info' } = body;

        const settings = await prisma.adminSettings.findMany({
            select: { id: true, universityBankDetails: true }
        });

        const updatePromises = settings.map((setting: any) => {
            const bankDetails = (setting.universityBankDetails as any) || {};
            if (message) {
                bankDetails.broadcast = { message, type, timestamp: new Date().toISOString() };
            } else {
                delete bankDetails.broadcast;
            }
            return prisma.adminSettings.update({
                where: { id: setting.id },
                data: { universityBankDetails: bankDetails }
            });
        });

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true, message: message ? "Broadcast sent to all nodes." : "Broadcast cleared." });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
