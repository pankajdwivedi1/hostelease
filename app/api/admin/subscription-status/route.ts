import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionStatus } from "@/lib/tenant";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const status = await getSubscriptionStatus();
        if (!status) {
            return NextResponse.json({ success: true, isDefault: true });
        }
        return NextResponse.json({ success: true, ...status });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
